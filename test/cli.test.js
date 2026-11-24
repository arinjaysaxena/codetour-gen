import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, generate, main } from '../src/cli.js';
import { renderTourHtml } from '../src/html.js';

function fixture() {
  const d = mkdtempSync(join(tmpdir(), 'ct-'));
  mkdirSync(join(d, 'src'));
  mkdirSync(join(d, 'bin'));
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'demo', bin: { demo: './bin/demo.js' } }));
  writeFileSync(join(d, 'bin/demo.js'), "import { run } from '../src/run.js';\nrun();\n");
  writeFileSync(join(d, 'src/run.js'), "import { model } from './model.js';\nexport const run = () => model;\n");
  writeFileSync(join(d, 'src/model.js'), 'export const model = "</script><b>x</b>";\n');
  return d;
}

test('parseArgs handles flags and rejects bad input', () => {
  const o = parseArgs(['r', '--out', 'o', '--steps', '5', '--no-llm']);
  assert.deepEqual([o.repo, o.out, o.steps, o.llm], ['r', 'o', 5, false]);
  assert.throws(() => parseArgs([]), /missing <repo>/);
  assert.throws(() => parseArgs(['r', '--steps', 'x']), /positive integer/);
  assert.throws(() => parseArgs(['r', '--nope']), /unknown option/);
  assert.throws(() => parseArgs(['r', '--out']), /needs a value/);
});

test('generate writes a self-contained page with all stops (no LLM)', async () => {
  const repo = fixture();
  const out = join(mkdtempSync(join(tmpdir(), 'ct-out-')), 'tour');
  const { outFile, stops } = await generate({ repo, out, steps: 10, llm: false });
  assert.equal(stops[0].path, 'bin/demo.js');
  const html = readFileSync(outFile, 'utf8');
  assert.match(html, /<title>Tour of demo<\/title>/);
  assert.match(html, /bin\/demo\.js/);
  // source containing </script> must not break out of the embedded JSON
  assert.equal(html.match(/<\/script>/g).length, 2);
});

test('generate uses an injected llm and reports fallbacks', async () => {
  const repo = fixture();
  const out = join(mkdtempSync(join(tmpdir(), 'ct-out-')), 't');
  const logs = [];
  const llm = { chat: async () => { throw new Error('down'); } };
  const { stops } = await generate({ repo, out, steps: 5, llm: true }, { llm, log: (m) => logs.push(m) });
  assert.ok(stops.every((s) => s.source === 'template'));
  assert.match(logs.join('\n'), /fell back to template/);
});

test('main returns exit codes', async () => {
  const lines = [];
  assert.equal(await main([], (m) => lines.push(m)), 2);
  assert.equal(await main(['/nonexistent-dir-xyz', '--no-llm'], (m) => lines.push(m)), 1);
  const repo = fixture();
  const out = join(mkdtempSync(join(tmpdir(), 'ct-out-')), 't');
  assert.equal(await main([repo, '--out', out, '--no-llm'], (m) => lines.push(m)), 0);
  assert.match(lines.at(-1), /wrote .*index\.html/);
});

test('renderTourHtml escapes the title', () => {
  const html = renderTourHtml({ title: '<x>', stops: [] }, []);
  assert.match(html, /&lt;x&gt;/);
});

test('--max-files limits the walk and warns', async () => {
  const repo = fixture();
  const out = join(mkdtempSync(join(tmpdir(), 'ct-out-')), 't');
  const logs = [];
  const { stops } = await generate({ repo, out, steps: 10, maxFiles: 2, llm: false }, { log: (m) => logs.push(m) });
  assert.ok(stops.length <= 2);
  assert.match(logs.join('\n'), /file limit \(2\) reached/);
  assert.throws(() => parseArgs(['r', '--max-files', '0']), /--max-files/);
});

test('steps above 20 warn and an empty repo gives a clear error', async () => {
  const repo = fixture();
  const out = join(mkdtempSync(join(tmpdir(), 'ct-out-')), 't');
  const logs = [];
  const { stops } = await generate({ repo, out, steps: 50, llm: false }, { log: (m) => logs.push(m) });
  assert.ok(stops.length <= 20);
  assert.match(logs.join('\n'), /capped at 20/);
  const empty = mkdtempSync(join(tmpdir(), 'ct-empty-'));
  await assert.rejects(generate({ repo: empty, out, steps: 5, llm: false }), /no TS\/JS, Python or Java/);
});
