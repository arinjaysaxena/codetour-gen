import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkRepo } from '../src/walk.js';

test('walkRepo survives broken symlinks and reports them as skipped', () => {
  const d = mkdtempSync(join(tmpdir(), 'ct-walk-'));
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src/a.js'), 'export const a = 1;\n');
  symlinkSync(join(d, 'nope'), join(d, 'src/broken.js'));
  const { files, skipped, truncated } = walkRepo(d);
  assert.deepEqual(files.map((f) => f.path), ['src/a.js']);
  assert.equal(truncated, false);
  assert.ok(skipped >= 0);
});

test('walkRepo ignores oversized files', () => {
  const d = mkdtempSync(join(tmpdir(), 'ct-walk-'));
  writeFileSync(join(d, 'big.js'), 'x'.repeat(200));
  writeFileSync(join(d, 'ok.js'), 'y');
  const { files } = walkRepo(d, { maxFileBytes: 100 });
  assert.deepEqual(files.map((f) => f.path), ['ok.js']);
});
