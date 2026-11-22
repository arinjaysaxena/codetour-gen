import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage, extractImports } from '../src/lang.js';

test('detects languages by extension', () => {
  assert.equal(detectLanguage('src/a.tsx'), 'ts');
  assert.equal(detectLanguage('a.mjs'), 'js');
  assert.equal(detectLanguage('pkg/mod.PY'), 'python');
  assert.equal(detectLanguage('A.java'), 'java');
  assert.equal(detectLanguage('README.md'), null);
  assert.equal(detectLanguage('Makefile'), null);
});

test('extracts JS/TS imports, requires, re-exports and dynamic imports', () => {
  const src = `
    import a from './a.js';
    import { b, c } from "../b";
    import * as d from 'lodash';
    import './side-effect';
    export { e } from './e';
    const f = require('./f');
    const g = await import('./g');
    // import nope from './commented';
    /* import nah from './block'; */
  `;
  assert.deepEqual(extractImports('ts', src).sort(), ['../b', './a.js', './e', './f', './g', './side-effect', 'lodash']);
});

test('extracts Python imports including relative ones', () => {
  const src = 'import os, sys\nfrom . import x\nfrom ..models import User\n  import app.core.db\n';
  assert.deepEqual(extractImports('python', src).sort(), ['.', '..models', 'app.core.db', 'os', 'sys']);
});

test('extracts Java imports incl. static and wildcard', () => {
  const src = 'package a;\nimport java.util.List;\nimport static org.junit.Assert.*;\nimport com.acme.Foo;\n';
  assert.deepEqual(extractImports('java', src), ['java.util.List', 'org.junit.Assert.*', 'com.acme.Foo']);
});

test('unknown language yields no imports', () => {
  assert.deepEqual(extractImports('cobol', 'IMPORT X'), []);
});
