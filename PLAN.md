# codetour-gen plan

**Pitch.** codetour-gen points at a repository and produces a guided tour: "start here, this is where requests enter, this is the core model...". Static analysis (import graph, entry-point detection) picks and orders the stops; an LLM narrates each one through any OpenAI-compatible endpoint (local Ollama by default). The result is a single static HTML page with a step list and code panes, ready to host anywhere.

## v0.1 scope
- CLI: `codetour-gen <repo> --out tour/ [--steps 15] [--no-llm]`
- Languages: TS/JS, Python, Java (import extraction, entry-point detection)
- Import graph + centrality ranking to choose 10-20 tour stops
- Narration via provider-neutral LLM client; `--no-llm` uses template narration
- Static HTML output: step sidebar, code pane with highlighted range, prev/next, no server needed
- Tests never need network or API keys

## Schedule
### 2026-11-23 - foundations
- [x] Skeleton: ESM, node:test, eslint, CI
- [x] Language detection + import extraction for JS/TS, Python, Java

### 2026-11-24 - graph
- [x] Repo walker (ignore node_modules, build dirs, binaries) and file index
- [x] Import resolution to repo-relative files, import graph

### 2026-11-25 - analysis
- [x] Entry-point detection (main, server bootstrap, route handlers, CLI bins)
- [x] Centrality ranking and tour planner (10-20 ordered stops)

### 2026-11-26 - narration
- [x] Provider-neutral LLM client (OpenAI-compatible, Ollama default) + template fallback
- [x] Narration prompts per stop with neighbours context

### 2026-11-27 - output
- [x] Static HTML generator: step sidebar, code pane, line highlight, keyboard nav
- [x] CLI wiring end to end

### 2026-11-28 - quality
- [x] Fixture repos for the three languages, golden tests
- [x] Error handling, large-repo limits

### 2026-11-29 - ship
- [x] README (pitch, demo GIF steps, install, usage, how it works, roadmap)
- [x] LICENSE (MIT), polish, CI green

Status: v0.1 shipped
