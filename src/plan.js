// Tour planner: ranks files by centrality and orders 10-20 stops from entry to core.
const isTest = (p) => /(^|\/)(test|tests|__tests__|spec)\//.test(p) || /\.(test|spec)\.\w+$/.test(p);

/** Rank files by a PageRank-style score over the import graph (importance flows to imported files). */
export function centrality(graph, iterations = 30, damping = 0.85) {
  const n = graph.nodes.length;
  if (!n) return new Map();
  let rank = new Map(graph.nodes.map((p) => [p, 1 / n]));
  for (let i = 0; i < iterations; i++) {
    const next = new Map(graph.nodes.map((p) => [p, (1 - damping) / n]));
    let dangling = 0;
    for (const p of graph.nodes) {
      const outs = graph.imports.get(p);
      if (!outs.length) dangling += rank.get(p);
      else for (const t of outs) next.set(t, next.get(t) + (damping * rank.get(p)) / outs.length);
    }
    for (const p of graph.nodes) next.set(p, next.get(p) + (damping * dangling) / n);
    rank = next;
  }
  return rank;
}

const ROLE_TITLES = {
  cli: 'Start here: the command-line entry point',
  server: 'Where requests enter',
  main: 'Start here: the main entry point',
  entry: 'An entry point',
};

/**
 * Plan a tour. Starts at the best entry point, follows its imports breadth-first, and fills
 * remaining stops with the most central files. Returns [{ path, role, title, why }].
 */
export function planTour(graph, entries, { steps = 15 } = {}) {
  const target = Math.max(1, Math.min(20, steps));
  const rank = centrality(graph);
  const candidates = graph.nodes.filter((p) => !isTest(p));
  if (!candidates.length) return [];
  const chosen = [];
  const seen = new Set();
  const add = (path, role, title, why) => {
    if (seen.has(path) || chosen.length >= target) return;
    seen.add(path);
    chosen.push({ path, role, title, why });
  };

  const usable = entries.filter((e) => candidates.includes(e.path));
  const [first, ...otherEntries] = usable;
  if (first) add(first.path, 'entry', ROLE_TITLES[first.kind], first.reasons.join('; '));
  // Server-style entries get their own early stop: that's where requests enter.
  for (const e of otherEntries.filter((x) => x.kind === 'server').slice(0, 1)) {
    add(e.path, 'entry', ROLE_TITLES.server, e.reasons.join('; '));
  }

  // Breadth-first from the entry, preferring more central neighbours at each level.
  const queue = first ? [first.path] : [];
  const visited = new Set(queue);
  while (queue.length && chosen.length < Math.ceil(target * 0.7)) {
    const cur = queue.shift();
    const next = graph.imports.get(cur).filter((p) => !visited.has(p) && !isTest(p))
      .sort((a, b) => rank.get(b) - rank.get(a) || a.localeCompare(b));
    for (const p of next) {
      visited.add(p);
      queue.push(p);
      add(p, 'flow', `Followed from ${cur.split('/').pop()}`, `imported by ${cur}`);
    }
  }

  // Fill with the most central remaining files: these are the core of the codebase.
  const byRank = candidates.slice().sort((a, b) => rank.get(b) - rank.get(a) || a.localeCompare(b));
  for (const p of byRank) {
    const n = graph.importers.get(p).length;
    add(p, 'core', 'Core module', n ? `imported by ${n} file${n === 1 ? '' : 's'}` : 'central in the import graph');
  }
  return chosen.map((s, i) => ({ ...s, index: i + 1 }));
}
