// Narration: one short explanation per tour stop, from an LLM or a deterministic template.
const SNIPPET_LINES = 60;

const neighbours = (graph, path) => ({
  imports: graph.imports.get(path) ?? [],
  importedBy: graph.importers.get(path) ?? [],
});

const list = (xs, max = 5) => (xs.length ? xs.slice(0, max).join(', ') + (xs.length > max ? `, +${xs.length - max} more` : '') : 'none');

/** Template narration used with --no-llm and as the fallback when the LLM fails. */
export function templateNarration(stop, graph) {
  const n = neighbours(graph, stop.path);
  const parts = [`${stop.title}. ${stop.path} (${stop.why}).`];
  if (n.imports.length) parts.push(`It depends on ${list(n.imports)}.`);
  if (n.importedBy.length) parts.push(`It is used by ${list(n.importedBy)}.`);
  return parts.join(' ');
}

/** Build the chat messages asking for a short narration of one stop. */
export function buildPrompt(stop, file, graph, total) {
  const n = neighbours(graph, stop.path);
  const snippet = file.source.split('\n').slice(0, SNIPPET_LINES).join('\n');
  return [
    {
      role: 'system',
      content: 'You write guided code tours for new contributors. Reply with 2-4 plain sentences: what this file is for, ' +
        'how it connects to its neighbours, and what to look at in the code. No markdown headings, no code fences.',
    },
    {
      role: 'user',
      content: [
        `Tour stop ${stop.index} of ${total}: ${stop.title}`,
        `File: ${stop.path} (${file.language})`,
        `Why it is on the tour: ${stop.why}`,
        `Imports: ${list(n.imports)}`,
        `Imported by: ${list(n.importedBy)}`,
        '',
        `First ${SNIPPET_LINES} lines:`,
        snippet,
      ].join('\n'),
    },
  ];
}

/**
 * Narrate every stop. With no `llm`, uses templates. A failing LLM call falls back to the template
 * for that stop and records the error. Returns [{ ...stop, narration, source: 'llm'|'template' }].
 */
export async function narrateTour(stops, files, graph, llm = null) {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const out = [];
  for (const stop of stops) {
    let narration;
    let source = 'template';
    let error;
    if (llm) {
      try {
        narration = await llm.chat(buildPrompt(stop, byPath.get(stop.path), graph, stops.length));
        source = 'llm';
      } catch (e) {
        error = e.message;
      }
    }
    out.push({ ...stop, narration: narration ?? templateNarration(stop, graph), source, ...(error ? { error } : {}) });
  }
  return out;
}
