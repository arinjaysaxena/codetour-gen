import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from '../src/cli.js';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Golden tour orders: entry point first, then following imports down to the core model.
const GOLDEN = {
  'js-app': ['bin/cli.js', 'src/server.js', 'src/router.js', 'src/model.js'],
  'py-app': ['app/main.py', 'app/views.py', 'app/models.py'],
  'java-app': [
    'src/main/java/demo/Application.java',
    'src/main/java/demo/UserController.java',
    'src/main/java/demo/UserRepository.java',
  ],
};

for (const [name, order] of Object.entries(GOLDEN)) {
  test(`golden tour for ${name}`, async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'ct-gold-')), 'tour');
    const { stops, outFile } = await generate({ repo: fixture(name), out, steps: 10, llm: false });
    assert.deepEqual(stops.map((s) => s.path), order);
    assert.equal(stops[0].role, 'entry');
    assert.ok(stops.every((s) => s.narration && s.narration.length > 0));
    const html = readFileSync(outFile, 'utf8');
    for (const p of order) assert.ok(html.includes(p), `${p} missing from page`);
  });
}
