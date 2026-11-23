// Entry-point detection: finds where execution or requests enter the codebase.
const NAME_HINTS = /(^|\/)(main|index|app|server|cli|__main__|manage|wsgi|asgi|Application|Main)\.(?:[mc]?[jt]sx?|py|java)$/;
const BIN_DIR = /(^|\/)bin\//;

const ROUTE_PATTERNS = {
  js: /\b(?:app|router|server|fastify)\.(?:get|post|put|patch|delete|use|listen)\(|\.listen\(|createServer\(/,
  python: /@(?:\w+\.)?(?:route|get|post|put|delete|patch)\(|FastAPI\(|Flask\(|if\s+__name__\s*==\s*['"]__main__['"]/,
  java: /public\s+static\s+void\s+main\s*\(|@(?:SpringBootApplication|RestController|Controller|GetMapping|PostMapping|RequestMapping)/,
};

/**
 * Score each file as an entry point. Returns [{ path, kind, score, reasons }] for files scoring > 0,
 * highest score first. `kind` is 'cli' | 'server' | 'main' | 'entry'.
 */
export function detectEntryPoints(files, pkgJson = null) {
  const declared = new Set();
  if (pkgJson) {
    const bins = typeof pkgJson.bin === 'string' ? [pkgJson.bin] : Object.values(pkgJson.bin ?? {});
    for (const b of [...bins, pkgJson.main, pkgJson.module].filter(Boolean)) declared.add(b.replace(/^\.\//, ''));
  }
  const out = [];
  for (const f of files) {
    const reasons = [];
    let score = 0;
    let kind = 'entry';
    const lang = f.language === 'ts' ? 'js' : f.language;
    if (declared.has(f.path)) {
      score += 6;
      reasons.push('declared in package.json');
      kind = BIN_DIR.test(f.path) ? 'cli' : 'main';
    }
    if (BIN_DIR.test(f.path)) {
      score += 3;
      reasons.push('lives in bin/');
      kind = 'cli';
    }
    if (NAME_HINTS.test(f.path)) {
      score += 2;
      reasons.push('conventional entry file name');
      if (kind === 'entry') kind = 'main';
    }
    const re = ROUTE_PATTERNS[lang];
    if (re && re.test(f.source)) {
      score += 4;
      reasons.push('starts a server, registers routes or defines main()');
      if (kind !== 'cli') kind = /listen\(|createServer|FastAPI\(|Flask\(|SpringBoot|RestController|Controller|route|Mapping/.test(f.source) ? 'server' : 'main';
    }
    if (/(^|\/)(test|tests|__tests__|spec)\//.test(f.path) || /\.(test|spec)\.\w+$/.test(f.path)) score = 0;
    if (score > 0) out.push({ path: f.path, kind, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}
