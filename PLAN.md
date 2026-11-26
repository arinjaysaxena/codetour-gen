# codetour-gen plan

Status: v1 rebuild scheduled (Python engine + TypeScript/React viewer), starting 2026-12-06. Spec: [docs/DESIGN.md](docs/DESIGN.md).

v0.1 was a JavaScript prototype. v1 is a Python analysis engine on tree-sitter (TS/JS, Python, Java, Go, Rust) with a cross-file reference graph, framework-aware entry detection, PageRank + git-churn ranking, a chaptered tour planner, grounded narration, a React viewer and CodeTour export.

Rules for v1:
- Work through the milestones in order; one or two tasks per working session, each a complete, tested change.
- v1 ships only when **every acceptance criterion** below passes and not before **2026-12-14**.
- After v1 ships, keep going down the Roadmap section. There is always a next task.

## Milestone 1: Python foundation (2026-12-06)
- [ ] `pyproject.toml` (hatchling), `codetour` package, typer CLI skeleton, ruff, mypy strict, pytest; CI on Python 3.11/3.12/3.13
- [ ] Repo walker (gitignore-aware, size limits), language detection, content-hash parse cache
- [ ] Fixture repositories under `tests/fixtures/repos/` (FastAPI, Express, Spring Boot, Go CLI, Rust axum)

## Milestone 2: parsing (2026-12-07)
- [ ] tree-sitter queries for Python and TS/JS: definitions and references, with tests per query
- [ ] tree-sitter queries for Java, Go and Rust, with tests per query
- [ ] Parallel parsing with a process pool

## Milestone 3: graph (2026-12-08)
- [ ] Symbol table and import resolution per language (relative paths, tsconfig paths, Python packages, Java packages, Go modules)
- [ ] Call, inheritance and instantiation edges with confidence levels; networkx graph
- [ ] Delete the JavaScript prototype (repo is Python + viewer TypeScript only)

## Milestone 4: entry points + ranking (2026-12-09)
- [ ] Entry detectors from the DESIGN.md table, each with a fixture test
- [ ] Importance ranking: PageRank, fan-in, git churn, doc mentions; exclusions for tests, generated and vendored code

## Milestone 5: planner + narration (2026-12-10)
- [ ] Chaptered planner (entry, flow, core domain, infrastructure), stop trimming, depth levels
- [ ] Grounded narration with pydantic validation and an identifier check; deterministic template fallback
- [ ] `tour.json` schema (versioned) and golden tours for every fixture repository

## Milestone 6: viewer (2026-12-11)
- [ ] Vite + React + TypeScript viewer: chapter sidebar, keyboard navigation, Shiki code pane, narration, deep links, themes
- [ ] ELK dependency minimap with current-stop highlight
- [ ] Bundle the viewer into the Python package; `codetour build` writes a static site; Playwright smoke test

## Milestone 7: exports + serve (2026-12-12)
- [ ] CodeTour `.tour` export compatible with the VS Code extension
- [ ] `codetour serve`, `codetour json`; GitHub Pages deployment guide
- [ ] Opt-in benchmark on real open-source repositories (`make bench`)

## Milestone 8: v1 release (2026-12-14)
- [ ] README rewrite with a screenshot of a real tour, install (`pipx`), CLI reference, how it works, supported frameworks
- [ ] CHANGELOG, version 1.0.0, PyPI-ready build, release notes

### v1 acceptance criteria
- [ ] No JavaScript prototype left; `mypy --strict` and ruff clean; viewer type-check clean
- [ ] Golden tours stable for all five fixture repositories
- [ ] Every entry detector covered by a fixture test
- [ ] Narration never contains identifiers missing from the symbol table (tested with a fake model)
- [ ] Generated `.tour` file loads in the CodeTour schema validator
- [ ] Parsing a 2,000-file fixture finishes in under 10 s in CI
- [ ] CI green on Python 3.11, 3.12 and 3.13

## Roadmap (after v1, keep working down this list)
- [ ] Tours for a specific question ("how does checkout work?") via graph search
- [ ] Diff tours: explain what a PR changes in terms of the tour
- [ ] More languages: C#, Kotlin, PHP
- [ ] Incremental rebuilds on file change (`codetour watch`)
- [ ] Tour quality metrics (coverage of top-ranked symbols, chapter balance)
