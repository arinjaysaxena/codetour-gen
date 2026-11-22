// Language detection and import extraction for TS/JS, Python and Java.
const EXT = {
  '.ts': 'ts', '.tsx': 'ts', '.mts': 'ts', '.cts': 'ts',
  '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js',
  '.py': 'python', '.java': 'java',
};

export function detectLanguage(path) {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? null : EXT[path.slice(dot).toLowerCase()] ?? null;
}

const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function jsImports(src) {
  const code = stripJsComments(src);
  const out = new Set();
  const patterns = [
    /\bimport\s+(?:[\w*${}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:[\w*${}\s,]+?)\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of code.matchAll(re)) out.add(m[1]);
  return [...out];
}

function pyImports(src) {
  const out = new Set();
  for (const m of src.matchAll(/^[ \t]*from\s+(\.*[\w.]*)\s+import\s+/gm)) out.add(m[1]);
  for (const m of src.matchAll(/^[ \t]*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm)) {
    for (const part of m[1].split(',')) out.add(part.trim());
  }
  return [...out].filter(Boolean);
}

function javaImports(src) {
  const out = new Set();
  for (const m of src.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm)) out.add(m[1]);
  return [...out];
}

/** Return the raw import specifiers found in a source file. */
export function extractImports(language, source) {
  switch (language) {
    case 'ts':
    case 'js':
      return jsImports(source);
    case 'python':
      return pyImports(source);
    case 'java':
      return javaImports(source);
    default:
      return [];
  }
}
