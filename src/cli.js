// CLI: codetour-gen <repo> --out tour/ [--steps 15] [--no-llm] [--model m] [--base-url u]
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { walkRepo } from './walk.js';
import { buildGraph } from './graph.js';
import { detectEntryPoints } from './entry.js';
import { planTour } from './plan.js';
import { narrateTour } from './narrate.js';
import { renderTourHtml } from './html.js';
import { createLlm } from './llm.js';
import { loadConfig } from './config.js';

export const USAGE = 'usage: codetour-gen <repo> [--out tour] [--steps 15] [--no-llm] [--model m] [--base-url url]';

export function parseArgs(argv) {
  const o = { repo: null, out: 'tour', steps: 15, llm: true, model: undefined, baseUrl: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--out') o.out = val();
    else if (a === '--steps') o.steps = Number(val());
    else if (a === '--no-llm') o.llm = false;
    else if (a === '--model') o.model = val();
    else if (a === '--base-url') o.baseUrl = val();
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else if (!o.repo) o.repo = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!o.repo) throw new Error('missing <repo>');
  if (!Number.isInteger(o.steps) || o.steps < 1) throw new Error('--steps must be a positive integer');
  return o;
}

/** Run the full pipeline; returns { outFile, stops }. `llm` can be injected for tests. */
export async function generate(opts, { llm, log = () => {} } = {}) {
  const root = resolve(opts.repo);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`not a directory: ${opts.repo}`);
  const { files, truncated } = walkRepo(root);
  if (!files.length) throw new Error('no TS/JS, Python or Java source files found');
  if (truncated) log('warning: file limit reached, tour covers a subset of the repo');
  let pkg = null;
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch { /* not a node project */ }
  const graph = buildGraph(files);
  const stops = planTour(graph, detectEntryPoints(files, pkg), { steps: opts.steps });
  const model = llm ?? (opts.llm ? createLlm(loadConfig(process.env, { model: opts.model, baseUrl: opts.baseUrl })) : null);
  const narrated = await narrateTour(stops, files, graph, model);
  const failed = narrated.filter((s) => s.error).length;
  if (failed) log(`warning: ${failed} stop(s) fell back to template narration (LLM unavailable?)`);
  const html = renderTourHtml({ title: `Tour of ${pkg?.name ?? basename(root)}`, stops: narrated }, files);
  mkdirSync(opts.out, { recursive: true });
  const outFile = join(opts.out, 'index.html');
  writeFileSync(outFile, html);
  return { outFile, stops: narrated };
}

export async function main(argv, log = console.log) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    log(`${e.message}\n${USAGE}`);
    return 2;
  }
  try {
    const { outFile, stops } = await generate(opts, { log });
    log(`wrote ${outFile} (${stops.length} stops)`);
    return 0;
  } catch (e) {
    log(`error: ${e.message}`);
    return 1;
  }
}
