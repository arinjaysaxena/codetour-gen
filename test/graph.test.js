import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkRepo } from '../src/walk.js';
import { buildGraph, normalizePath } from '../src/graph.js';

const mk = (root, files) => {
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(root, p, '..'), { recursive: true });
    writeFileSync(join(root, p), c);
  }
};

test('walker skips ignored dirs, binaries, oversized and unsupported files', () => {
  const root = mkdtempSync(join(tmpdir(), 'ct-'));
  mk(root, {
    'src/a.ts': 'export const a = 1;',
    'node_modules/x/index.js': 'x',
    'dist/out.js': 'x',
    '.hidden/h.js': 'x',
    'README.md': '# hi',
    'src/bin.js': 'a\0b',
    'src/big.js': 'x'.repeat(2000),
  });
  const { files, truncated } = walkRepo(root, { maxFileBytes: 1000 });
  assert.deepEqual(files.map((f) => f.path), ['src/a.ts']);
  assert.equal(truncated, false);
});

test('walker reports truncation at maxFiles', () => {
  const root = mkdtempSync(join(tmpdir(), 'ct-'));
  mk(root, { 'a.js': '1', 'b.js': '2', 'c.js': '3' });
  const r = walkRepo(root, { maxFiles: 2 });
  assert.equal(r.files.length, 2);
  assert.equal(r.truncated, true);
});

test('normalizePath handles dots and escapes', () => {
  assert.equal(normalizePath('a/./b/../c'), 'a/c');
  assert.equal(normalizePath('../x'), null);
});

const f = (path, language, source) => ({ path, language, source });

test('resolves JS/TS relative imports, index files and .js-for-.ts', () => {
  const g = buildGraph([
    f('src/main.ts', 'ts', "import { a } from './a.js'; import u from './util'; import _ from 'lodash';"),
    f('src/a.ts', 'ts', ''),
    f('src/util/index.ts', 'ts', "import m from '../main';"),
  ]);
  assert.deepEqual(g.imports.get('src/main.ts').sort(), ['src/a.ts', 'src/util/index.ts']);
  assert.deepEqual(g.importers.get('src/main.ts'), ['src/util/index.ts']);
  assert.deepEqual(g.external.get('src/main.ts'), ['lodash']);
});

test('resolves Python absolute, relative and package imports', () => {
  const g = buildGraph([
    f('app/main.py', 'python', 'from .models import User\nimport app.db\nimport os'),
    f('app/models.py', 'python', 'from . import db'),
    f('app/db/__init__.py', 'python', ''),
  ]);
  assert.deepEqual(g.imports.get('app/main.py').sort(), ['app/db/__init__.py', 'app/models.py']);
  assert.deepEqual(g.imports.get('app/models.py'), []);
  assert.deepEqual(g.external.get('app/main.py'), ['os']);
});

test('resolves Java imports by package and class, including static and wildcard', () => {
  const g = buildGraph([
    f('src/com/acme/App.java', 'java', 'package com.acme;\nimport com.acme.model.User;\nimport static com.acme.util.Strings.trim;\nimport java.util.List;'),
    f('src/com/acme/model/User.java', 'java', 'package com.acme.model;'),
    f('src/com/acme/util/Strings.java', 'java', 'package com.acme.util;'),
  ]);
  assert.deepEqual(g.imports.get('src/com/acme/App.java').sort(), ['src/com/acme/model/User.java', 'src/com/acme/util/Strings.java']);
  assert.deepEqual(g.external.get('src/com/acme/App.java'), ['java.util.List']);
  assert.equal(g.edges.length, 2);
});
