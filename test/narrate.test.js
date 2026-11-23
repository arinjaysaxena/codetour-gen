import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/graph.js';
import { createLlm } from '../src/llm.js';
import { loadConfig } from '../src/config.js';
import { buildPrompt, narrateTour, templateNarration } from '../src/narrate.js';

const f = (path, language, source = '') => ({ path, language, source });
const files = [f('a.js', 'js', "import './b.js'\nexport const a = 1"), f('b.js', 'js', 'export const b = 2')];
const graph = buildGraph(files);
const stops = [
  { path: 'a.js', role: 'entry', title: 'Start here', why: 'declared', index: 1 },
  { path: 'b.js', role: 'core', title: 'Core module', why: 'imported by 1 file', index: 2 },
];

test('loadConfig defaults to local Ollama and honours env/overrides', () => {
  assert.equal(loadConfig({}).baseUrl, 'http://localhost:11434/v1');
  const c = loadConfig({ CODETOUR_BASE_URL: 'http://x/v1/', CODETOUR_MODEL: 'm' }, { model: 'o' });
  assert.deepEqual([c.baseUrl, c.model], ['http://x/v1', 'o']);
});

test('createLlm posts chat completions and returns trimmed text', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
    return { ok: true, json: async () => ({ choices: [{ message: { content: ' hi \n' } }] }) };
  };
  const llm = createLlm({ baseUrl: 'http://h/v1', model: 'm', apiKey: 'k' }, fetchImpl);
  assert.equal(await llm.chat([{ role: 'user', content: 'x' }]), 'hi');
  assert.equal(seen.url, 'http://h/v1/chat/completions');
  assert.equal(seen.body.model, 'm');
  assert.equal(seen.auth, 'Bearer k');
});

test('createLlm throws on HTTP errors and empty content', async () => {
  const bad = createLlm({ baseUrl: 'http://h', model: 'm', apiKey: 'k' }, async () => ({ ok: false, status: 500, text: async () => 'boom' }));
  await assert.rejects(bad.chat([]), /500.*boom/);
  const empty = createLlm({ baseUrl: 'http://h', model: 'm', apiKey: 'k' }, async () => ({ ok: true, json: async () => ({ choices: [] }) }));
  await assert.rejects(empty.chat([]), /no message content/);
});

test('buildPrompt includes neighbours and code', () => {
  const [, user] = buildPrompt(stops[0], files[0], graph, 2);
  assert.match(user.content, /stop 1 of 2/);
  assert.match(user.content, /Imports: b\.js/);
  assert.match(user.content, /export const a = 1/);
});

test('templateNarration mentions dependencies and users', () => {
  assert.match(templateNarration(stops[0], graph), /depends on b\.js/);
  assert.match(templateNarration(stops[1], graph), /used by a\.js/);
});

test('narrateTour uses llm, and falls back to template per stop on failure', async () => {
  let n = 0;
  const llm = { chat: async () => { if (++n === 2) throw new Error('down'); return 'Narrated.'; } };
  const out = await narrateTour(stops, files, graph, llm);
  assert.deepEqual(out.map((s) => s.source), ['llm', 'template']);
  assert.equal(out[0].narration, 'Narrated.');
  assert.equal(out[1].error, 'down');
  assert.match(out[1].narration, /Core module/);
  const plain = await narrateTour(stops, files, graph);
  assert.ok(plain.every((s) => s.source === 'template'));
});
