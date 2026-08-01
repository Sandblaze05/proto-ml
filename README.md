# Proto-ML Visual Pipeline Builder

Proto-ML is a graph-based ML pipeline editor. You build workflows on a canvas, configure nodes, preview node behavior with synthetic samples, and run supported pipelines through the real Python/Jupyter-backed execution path.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, then go to the dashboard or canvas.

## Available Scripts

- `npm run dev` - start the Next.js development server.
- `npm run build` - build the app for production.
- `npm run start` - start the production server.
- `npm run lint` - run ESLint.
- `npm run test` - run Vitest in watch mode.
- `npm run test:run` - run Vitest once.
- `npm run test:coverage` - run Vitest with coverage.
- `npm run test:ui` - open the Vitest UI.

## How Execution Works

Proto-ML now uses a strict split between preview and run:

- `Preview` is synthetic and in-process. It samples node behavior for the node-level preview tabs and the `/api/graph/preview` endpoint.
- `Run pipeline` uses the `one_off_compile` contract. It compiles the graph to Python and executes it through the local subprocess / Jupyter-backed runner exposed by `/api/graph/runs`.
- Preview output is ephemeral UI state. It is not persisted as a durable run result.

That split is intentional and is the current execution contract for the repo.

## Current Architecture

The codebase is organized around a few core layers:

- Canvas and node UI live under `app/` and `components/`.
- Node definitions, config defaults, ports, and validation live in the node registry and runtime-spec layer under `nodes/` and `lib/runtimeSpec/`.
- Preview runtimes live in `lib/runtimeFactories/` and power synthetic samples.
- Graph compilation and execution live in `lib/executor/`.
- Python template generation lives in `lib/pythonTemplates/`.
- Built-in templates and template-to-canvas adapters live in `lib/templates/`.
- Plugin bootstrap and registry code live in `lib/plugins/`.
- Dataset runtimes live in `lib/datasetRuntimes/`.
- Versioning and graph history helpers live in `lib/versioning/`.

The main node categories in the editor are dataset, transform, lifecycle, annotation, shape, and grouping nodes.

## What Is Usable Today

The project is still evolving, but the pieces that currently execute rather than only simulate are:

- The real `Run pipeline` path for supported graphs via Python/Jupyter execution.
- Dataset materialization for supported local sources such as CSV, JSON, text, and image-folder inputs.
- Python-backed transform and lifecycle workflows that compile through the current executor path.
- Node previews for inspecting behavior before committing to a full run.

Some nodes and flows are still preview-oriented or only partially implemented, so a successful preview does not automatically mean the same node has a durable production backend yet.

## Working With the Compiler

The compiler is designed to generate deterministic Python with a single pipeline entrypoint. If you are debugging a graph:

1. Create a small graph on the canvas.
2. Open the Compiler panel.
3. Use compile/preview to inspect the generated Python.
4. Use the run path only for the graphs that are meant to execute end-to-end.

## Testing

For focused checks, the most useful entry points are the Vitest suites around the executor, registry, and runtime-spec layers. A full build is also available with:

```bash
npm run build
```

## Notes

The repo is not feature-complete yet. The remaining work is mainly around broader execution backends, stronger validation, richer branching and merging semantics, and better artifact/version management.
