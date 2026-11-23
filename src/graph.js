// Import resolution and the repo import graph.
import { extractImports } from './lang.js';

const dirname = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

/** Normalize a posix path with . and .. segments; returns null if it escapes the root. */
export function normalizePath(p) {
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (!out.length) return null;
      out.pop();
    } else out.push(seg);
  }
  return out.join('/');
}

const JS_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

function resolveJs(from, spec, paths) {
  if (!spec.startsWith('.')) return null; // bare specifier = external package
  const base = normalizePath(`${dirname(from)}/${spec}`);
  if (base === null) return null;
  const stripped = base.replace(/\.(m|c)?jsx?$/, ''); // TS imports './a.js' that resolve to a.ts
  const candidates = [];
  for (const b of new Set([base, stripped])) {
    for (const ext of JS_EXTS) candidates.push(b + ext);
    for (const ext of JS_EXTS.slice(1)) candidates.push(`${b}/index${ext}`);
  }
  return candidates.find((c) => paths.has(c)) ?? null;
}

function resolvePython(from, spec, paths) {
  const dots = /^\.*/.exec(spec)[0].length;
  const rest = spec.slice(dots).replace(/\./g, '/');
  let bases;
  if (dots) {
    let dir = dirname(from);
    for (let i = 1; i < dots; i++) dir = dirname(dir);
    bases = [dir];
  } else bases = ['', dirname(from)];
  for (const b of bases) {
    const stem = [b, rest].filter(Boolean).join('/');
    if (!stem) continue;
    for (const c of [`${stem}.py`, `${stem}/__init__.py`]) if (paths.has(c)) return c;
  }
  return null;
}

function resolveJava(spec, javaIndex) {
  const parts = spec.replace(/\.\*$/, '').split('.');
  // Try the longest prefix that is a known class (handles static imports and nested classes).
  for (let n = parts.length; n > 0; n--) {
    const hit = javaIndex.get(parts.slice(0, n).join('.'));
    if (hit) return hit;
  }
  return null;
}

function buildJavaIndex(files) {
  const index = new Map();
  for (const f of files) {
    if (f.language !== 'java') continue;
    const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(f.source)?.[1];
    const cls = f.path.split('/').pop().replace(/\.java$/, '');
    index.set(pkg ? `${pkg}.${cls}` : cls, f.path);
  }
  return index;
}

/**
 * Build the import graph. Returns { nodes: [path], edges: [{from,to}], external: Map<path,[spec]>,
 * importers: Map<path,[path]>, imports: Map<path,[path]> }.
 */
export function buildGraph(files) {
  const paths = new Set(files.map((f) => f.path));
  const javaIndex = buildJavaIndex(files);
  const imports = new Map();
  const importers = new Map();
  const external = new Map();
  const edges = [];
  for (const f of files) {
    imports.set(f.path, []);
    importers.set(f.path, importers.get(f.path) ?? []);
  }
  for (const f of files) {
    for (const spec of extractImports(f.language, f.source)) {
      let target = null;
      if (f.language === 'java') target = resolveJava(spec, javaIndex);
      else if (f.language === 'python') target = resolvePython(f.path, spec, paths);
      else target = resolveJs(f.path, spec, paths);
      if (target && target !== f.path) {
        if (!imports.get(f.path).includes(target)) {
          imports.get(f.path).push(target);
          importers.get(target).push(f.path);
          edges.push({ from: f.path, to: target });
        }
      } else if (!target) {
        if (!external.has(f.path)) external.set(f.path, []);
        external.get(f.path).push(spec);
      }
    }
  }
  return { nodes: files.map((f) => f.path), edges, imports, importers, external };
}
