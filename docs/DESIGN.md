# codetour-gen v1 design

> Point it at any repository and get a guided tour of the codebase: where execution starts, where requests enter, what the core model is, and how the pieces connect.

## The problem

Onboarding onto an unfamiliar codebase means hours of jumping between files to build a mental model. Repo-to-diagram tools show *everything* at once. What people actually want is a **story**: start here, then this, then this, and here's why it matters. codetour-gen builds that story from real static analysis (a cross-file symbol and reference graph, entry-point detection, centrality ranking and git history) and renders it as an interactive tour.

## What v1 does

```
$ codetour build ./my-service -o tour/
Parsed 412 files (ts, py) in 1.8s · 3,904 symbols · 11,230 references
Entry points: src/server.ts (express app), cli/main.py (typer app)
Tour: 18 stops in 4 chapters → tour/index.html   (also tour/.tours/overview.tour)
```

The tour site has chapters (*Entry → Request flow → Core domain → Infrastructure*), stops with highlighted code ranges, a narration for each stop, a dependency minimap that highlights where you are, and "go deeper" links to related symbols. It also exports the **CodeTour `.tour` format**, so the same tour plays inside VS Code with the CodeTour extension.

## Language and tooling

- **Python 3.11+** for the analysis engine and CLI (package `codetour`):
  - `tree-sitter` with prebuilt language grammars, parsing TS/JS, Python, Java, Go and Rust;
  - `networkx` for graph algorithms;
  - `typer` for the CLI, `pydantic` for the data models.
- **TypeScript + React (Vite)** for the viewer in `viewer/`, built and bundled into the Python package as static assets. Shiki for highlighting, and ELK-based layout for the minimap.
- Quality tools: `ruff`, `mypy --strict` and `pytest` on the Python side; `vitest`, `typescript-eslint` and a Playwright smoke test on the viewer side. CI matrix: Python 3.11, 3.12 and 3.13.
- Packaging: `pyproject.toml` with hatchling, publishable to PyPI; `pipx install codetour-gen`.
- **Migration:** the JavaScript prototype is replaced by the Python engine plus the TS viewer, then deleted.

## Architecture

```
codetour/
  cli.py            build / serve / json / export
  scan/             repo walker (gitignore-aware, size limits), language detection, parse cache by content hash
  parse/            tree-sitter queries per language → Symbol and Reference records
  graph/            symbol table, cross-file resolution, the dependency graph (imports, calls, inheritance, instantiation)
  entry/            entry-point detectors: main functions, CLI frameworks, HTTP frameworks, UI roots
  rank/             importance: PageRank on the graph + git churn + README/doc mentions + fan-in
  plan/             tour planner: chapters, stop selection, ordering, code-range trimming
  narrate/          grounded narration (OpenAI-compatible, Ollama default) with a deterministic template fallback
  export/           site bundle, tour JSON, CodeTour .tour files
viewer/             React + TypeScript tour viewer
```

### parse/ and graph/

- Per-language tree-sitter queries extract definitions (modules, classes, functions, methods, interfaces, routes) and references (imports, calls, attribute access, `extends`/`implements`, instantiation).
- Resolution is best-effort but explicit about confidence:
  - imports are resolved through language rules (relative paths, `tsconfig` paths, Python packages, Java packages, Go modules);
  - calls are resolved by name within the imported scope;
  - unresolved references are kept with `confidence=low` and never presented as facts.
- Parsing runs in parallel with a process pool, and parse results are cached by file content hash in `.codetour/cache`. Target: under 5 s for a 2,000-file repository on a laptop.

### entry/

Detectors with framework-specific signatures, each a small tested rule:

| Kind | Examples |
|---|---|
| Program entry | `if __name__ == "__main__"`, `func main`, `public static void main`, `fn main`, `bin` entries in package.json |
| CLI | typer, click and argparse; commander and yargs; cobra; picocli |
| HTTP | FastAPI, Flask and Django URLs; Express, Fastify, Next.js routes; Spring `@RestController`; net/http, gin and chi; axum and actix |
| UI root | React `createRoot`, Next.js `app/` and `pages/` |
| Jobs | Celery tasks, cron entries |

### rank/ and plan/

- Importance score = weighted PageRank on the reverse dependency graph + fan-in + git churn (`git log --numstat`, recency-weighted) + mentions in README and docs. Test files, generated code and vendored code are excluded.
- The planner builds chapters:
  1. **Entry:** the top entry points.
  2. **Flow:** follow the highest-weight call path from an entry point to the domain layer.
  3. **Core domain:** the highest-ranked models and services not yet visited.
  4. **Infrastructure:** persistence, external clients and configuration.
- Each stop is a symbol with a trimmed code range (signature plus the key lines, capped), its edges to the previous stop and to the next, and "go deeper" neighbours. A tour has 10–25 stops; `--depth quick|standard|deep` changes the length.

### narrate/

- Each stop's prompt contains only grounded context: the code range, its callers and callees (signatures only), its role in the chapter, and the previous stop's summary for continuity.
- The output is validated with pydantic: a 2–4 sentence explanation plus "watch out for" notes. Any identifier in the narration that doesn't exist in the code's symbol table is flagged and removed.
- With no model, a deterministic template narration is built from the graph facts ("`OrderService.place` is called by 3 routes and writes through `OrderRepo`...").

### export/ and viewer/

- `tour.json` (versioned schema) is the single source of truth for both the site and the CodeTour export.
- Viewer features:
  - chapter sidebar and keyboard navigation;
  - a code pane with highlighted ranges and line numbers;
  - narration text;
  - an ELK-laid-out dependency minimap with the current stop highlighted and visited stops dimmed;
  - deep links (`#/stop/7`);
  - light and dark themes.
- `codetour serve` serves the site locally; the output folder is static and deployable to GitHub Pages.

## Quality bar

- **Fixture repositories** in `tests/fixtures/repos/`: small but realistic polyglot projects (a FastAPI service, an Express app, a Spring Boot app, a Go CLI, a Rust axum service) with **golden tour JSON** checked in.
- Unit tests for every tree-sitter query, every entry detector, resolution, ranking and planner rule.
- `mypy --strict` clean; ruff clean; viewer type-check and tests clean.
- Opt-in benchmark (`make bench`) on a few well-known open-source repositories, cloned at fixed commits, reporting parse time, graph size and tour stability.

## Out of scope for v1

Live IDE integration beyond the CodeTour export, multi-repo tours, and editing tours in the UI.
