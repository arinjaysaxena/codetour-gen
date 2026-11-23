// Repo walker: collects source files for supported languages, skipping vendored/build output.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { detectLanguage } from './lang.js';

export const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'target', 'coverage', '.next', '.venv', 'venv',
  '__pycache__', '.gradle', '.idea', '.vscode', 'vendor', '.tox',
]);

export const DEFAULT_LIMITS = { maxFiles: 5000, maxFileBytes: 512 * 1024 };

const looksBinary = (buf) => buf.subarray(0, 1024).includes(0);

/**
 * Walk `root` and return [{ path (posix, repo-relative), language, source }], sorted by path.
 * Skips ignored dirs, oversized files and binary content. `truncated` is set when maxFiles is hit.
 */
export function walkRepo(root, limits = {}) {
  const { maxFiles, maxFileBytes } = { ...DEFAULT_LIMITS, ...limits };
  const files = [];
  let truncated = false;
  const visit = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (truncated) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name) && !e.name.startsWith('.')) visit(full);
      } else if (e.isFile()) {
        const language = detectLanguage(e.name);
        if (!language || statSync(full).size > maxFileBytes) continue;
        const buf = readFileSync(full);
        if (looksBinary(buf)) continue;
        if (files.length >= maxFiles) {
          truncated = true;
          return;
        }
        files.push({ path: relative(root, full).split(sep).join('/'), language, source: buf.toString('utf8') });
      }
    }
  };
  visit(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, truncated };
}
