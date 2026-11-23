import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/graph.js';
import { detectEntryPoints } from '../src/entry.js';
import { centrality, planTour } from '../src/plan.js';

const f = (path, language, source = '') => ({ path, language, source });

test('detects bin, server, main and ignores tests', () => {
  const files = [
    f('bin/tool.js', 'js', "import '../src/x.js'"),
    f('src/server.ts', 'ts', "const app = express(); app.get('/', h); app.listen(3000)"),
    f('app/main.py', 'python', "if __name__ == '__main__':\n  run()"),
    f('src/App.java', 'java', 'public static void main(String[] a){}'),
    f('src/util.js', 'js', 'export const x = 1'),
    f('test/server.test.js', 'js', 'app.listen(1)'),
  ];
  const e = detectEntryPoints(files, { bin: { tool: './bin/tool.js' } });
  const by = Object.fromEntries(e.map((x) => [x.path, x]));
  assert.equal(e[0].path, 'bin/tool.js');
  assert.equal(by['bin/tool.js'].kind, 'cli');
  assert.equal(by['src/server.ts'].kind, 'server');
  assert.ok(by['app/main.py'] && by['src/App.java']);
  assert.equal(by['src/util.js'], undefined);
  assert.equal(by['test/server.test.js'], undefined);
});

test('centrality favours widely imported files and sums to ~1', () => {
  const g = buildGraph([
    f('a.js', 'js', "import './core.js'"),
    f('b.js', 'js', "import './core.js'"),
    f('c.js', 'js', "import './core.js'; import './a.js'"),
    f('core.js', 'js'),
  ]);
  const r = centrality(g);
  const top = [...r.entries()].sort((x, y) => y[1] - x[1])[0][0];
  assert.equal(top, 'core.js');
  assert.ok(Math.abs([...r.values()].reduce((s, v) => s + v, 0) - 1) < 1e-9);
});

const bigRepo = () => {
  const files = [f('bin/cli.js', 'js', "import '../src/run.js'")];
  files.push(f('src/run.js', 'js', "import './model.js'; import './io.js'"));
  files.push(f('src/model.js', 'js', "import './util.js'"));
  files.push(f('src/io.js', 'js', "import './util.js'"));
  files.push(f('src/util.js', 'js'));
  for (let i = 0; i < 20; i++) files.push(f(`src/extra${i}.js`, 'js', "import './util.js'"));
  files.push(f('test/run.test.js', 'js', "import '../src/run.js'"));
  return files;
};

test('tour starts at the entry, follows imports, excludes tests, respects step count', () => {
  const files = bigRepo();
  const g = buildGraph(files);
  const tour = planTour(g, detectEntryPoints(files, { bin: { x: 'bin/cli.js' } }), { steps: 8 });
  assert.equal(tour.length, 8);
  assert.equal(tour[0].path, 'bin/cli.js');
  assert.equal(tour[1].path, 'src/run.js');
  assert.deepEqual(tour.map((s) => s.index), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(!tour.some((s) => s.path.startsWith('test/')));
  assert.equal(new Set(tour.map((s) => s.path)).size, tour.length);
  assert.ok(tour.some((s) => s.path === 'src/util.js' && s.role === 'flow' || s.role === 'core'));
});

test('step count is clamped to 1..20 and small repos give shorter tours', () => {
  const files = bigRepo();
  const g = buildGraph(files);
  const e = detectEntryPoints(files);
  assert.equal(planTour(g, e, { steps: 99 }).length, 20);
  const tiny = [f('a.js', 'js', "import './b.js'"), f('b.js', 'js')];
  assert.equal(planTour(buildGraph(tiny), [], { steps: 15 }).length, 2);
  assert.deepEqual(planTour(buildGraph([]), [], {}), []);
});
