# codetour-gen

Point it at a repository and get a guided tour: "start here, this is where requests enter, this is the core model...". The output is one static HTML page with a step list and a code pane, ready to host anywhere.

![demo](docs/demo.gif)

<!-- Demo GIF placeholder. To record it:
1. node bin/codetour-gen.js test/fixtures/js-app --no-llm --out demo-tour
2. Open demo-tour/index.html in a browser window about 1200x700.
3. Start a screen recorder (e.g. peek, licecap or ffmpeg x11grab).
4. Press the Right arrow key 5 times, one second apart, then click a step in the sidebar.
5. Stop at 15 seconds, save as docs/demo.gif (under 5 MB).
-->

## Install

Requires Node 20 or newer.

```sh
git clone https://github.com/arinjaysaxena/codetour-gen
cd codetour-gen
npm install
npm link        # optional: puts `codetour-gen` on your PATH
```

## Usage

```sh
codetour-gen <repo> [--out tour] [--steps 15] [--no-llm] [--model m] [--base-url url]
```

| Option | Meaning |
| --- | --- |
| `--out` | output directory (default `tour`); writes `index.html` |
| `--steps` | number of stops, 10-20 recommended (default 15) |
| `--no-llm` | skip the model and use template narration |
| `--model`, `--base-url` | override the LLM settings below |

Open `tour/index.html` in a browser. Use the sidebar, or the arrow keys, to move between stops.

### Narration model

Narration uses any OpenAI-compatible chat-completions endpoint and defaults to a local Ollama server, so nothing leaves your machine unless you point it elsewhere.

| Variable | Default |
| --- | --- |
| `CODETOUR_BASE_URL` | `http://localhost:11434/v1` |
| `CODETOUR_MODEL` | `llama3.1` |
| `CODETOUR_API_KEY` | `ollama` |

If the model is unreachable, affected stops fall back to template narration and a warning is printed.

## How it works

1. **Walk**: collect TS/JS, Python and Java files, skipping `node_modules`, build output and binaries (capped by a file limit).
2. **Graph**: extract imports per language and resolve them to repo files to build an import graph.
3. **Entry points**: detect `main` functions, server bootstraps, route handlers and CLI bins.
4. **Plan**: rank files by centrality and order them from entry points inward into 10-20 stops.
5. **Narrate**: for each stop the model gets the code plus its neighbours in the graph and writes a short explanation.
6. **Render**: emit a single self-contained HTML page with the step sidebar and highlighted code.

## Development

```sh
npm test && npm run lint && npm run build
```

Tests use fixture repos in `test/fixtures` and never need a network or API key.

## Roadmap

- More languages (Go, Rust, C#)
- Call-graph aware ordering, not just imports
- Syntax highlighting themes and a search box
- Incremental regeneration when the repo changes

## License

MIT
