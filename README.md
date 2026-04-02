# Proto-ML Visual Pipeline Builder

This project implements a graph-based ML pipeline editor where nodes hold template-generated Python code and can be compiled into a consistent pipeline script.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and navigate to the dashboard.

## What Has Been Implemented

## Quick Start

1. Install dependencies and run the Next.js dev server:

```bash
npm install
npm run dev
```

2. Open http://localhost:3000 and go to the dashboard.

3. Create or load a graph from the palette, edit node configs, then use the compile preview to inspect generated Python.

## High-level Summary — Done vs Remaining

This section explains what has been implemented so far (concrete files and behaviors), and what remains to finish a production-ready pipeline toolchain.

**Completed (what's done today)**

- **Dataset nodes with template-based Python**: dataset nodes generate Python using templates and store generated code on node models; code is editable with Monaco and has helpful controls (wrap, copy, reset).
	- See: [lib/pythonTemplates/datasetNodeTemplate.js](lib/pythonTemplates/datasetNodeTemplate.js#L1)
	- See: [components/DatasetNode.js](components/DatasetNode.js#L1) and [components/nodes/MonacoCodeEditor.js](components/nodes/MonacoCodeEditor.js#L1)

- **Dataset / Transform separation**: dataset templates no longer inline transforms — transforms are first-class nodes in the graph.
	- See: [lib/pythonTemplates/datasetNodeTemplate.js](lib/pythonTemplates/datasetNodeTemplate.js#L1)

- **Transform registry & extensible transform system**: a registry-driven approach describes transforms' metadata (type, category, level, accepts/produces, defaultConfig, uiSchema) enabling discovery and a palette.
	- See: [nodes/transforms/transformRegistry.js](nodes/transforms/transformRegistry.js#L1)

- **Transform node UI**: a dedicated transform node renderer with tabs for config and generated code; footer stays visible when collapsed; config uses schema-driven widgets and code uses Monaco.
	- See: [components/nodes/TransformNode.js](components/nodes/TransformNode.js#L1)
	- Canvas and palette integration: [components/InfiniteCanvas.js](components/InfiniteCanvas.js#L1), [components/NodePalette.js](components/NodePalette.js#L1)

- **Capability-aware connections**: lightweight connection validation uses `produces`/`accepts` capability flags before running deeper compatibility checks.
	- See: [store/useExecutionStore.js](store/useExecutionStore.js#L1)

- **Graph compiler (structured artifact)**: compiler that validates basic graph invariants (non-empty graph, dataset sources, cycles), topologically sorts nodes, assigns deterministic symbols, and emits a structured Python entrypoint (`run_pipeline()`) with graph metadata, per-node config, and context wiring. A compile action shows a read-only Monaco preview.
	- See: [lib/executor/pipelineCompiler.js](lib/executor/pipelineCompiler.js#L1)
	- UI trigger: [components/DashboardNav.js](components/DashboardNav.js#L1)

**Current behavior notes**

- The emitted Python now has a single `run_pipeline()` entrypoint and returns structured metadata (`graph_spec`, `node_meta`, `node_outputs`, `ctx`), but transform/lifecycle/model execution is still stubbed. The output is deterministic and close to an exportable artifact, but not yet a full end-to-end trainer.

**Remaining (next work to reach an end-to-end runnable system)**


- **Runtime execution implementation** (high priority)
	- Implement `apply_transform` and `apply_node` runtime hooks that call actual transform implementations.
	- Add pluggable runtime targets: local Python process, Jupyter runner (see `lib/executor/remoteJupyterRunner.js`), and remote/cluster runtimes.
	- Files to update/extend: [lib/executor/createExecutor.js](lib/executor/createExecutor.js#L1), [lib/executor/remoteJupyterRunner.js](lib/executor/remoteJupyterRunner.js#L1), runtime factories in [lib/runtimeFactories/index.js](lib/runtimeFactories/index.js#L1).

- **Stronger semantic compilation** (medium priority)
	- Support multi-input nodes with merge strategies and explicit semantics for how multiple inputs combine (concat, merge-by-key, zip, etc.).
	- Add branch/condition code generation for conditional/guard nodes.
	- Enforce stricter staging rules (dataset -> transforms -> split -> train/eval) and add type/shape inference checks during compile.
	- Files to extend: [lib/executor/pipelineCompiler.js](lib/executor/pipelineCompiler.js#L1) and the transform registry.

- **Transform UX polish** (low/medium priority)
	- Improve schema widgets for nested objects and arrays (arrays-of-objects editors, add/remove controls).
	- Provide inline validation messages (required, min/max, pattern) in the node config panel.
	- Consider a small library of preset transforms and a UI for installing transform packs.

- **Compose/subgraph support**
	- Implement subgraph compilation and reuse (composable pipelines that expand into inline code or importable modules).
	- Visual grouping and parameterized subgraph inputs/outputs.

- **Compilation artifacts, persistence & export**
	- Persist compiled pipeline artifacts (with metadata and compiler diagnostics), add versioning, and allow export as a single `.py` artifact.

- **Testing and QA**
	- Add unit tests for graph validation and code emission (jest/mocha), and snapshot tests to detect regressions in generated code.
	- Add integration tests for node editing → compile → execute (using a lightweight local executor target).

## How to test the compiler locally (developer notes)

1. Start the Next dev server: `npm run dev`.
2. Open the dashboard and create a small graph: one dataset node → one transform node.
3. Use the compile action (Dashboard → Compile) to preview generated Python.
4. For quick smoke tests of runtime execution, see `lib/executor/createExecutor.js` — you can run a node script that imports the compiler and executor to run a small graph outside the UI (useful for CI or debugging).

Example (quick dev script):

```js
// scripts/runCompileSmoke.js
const { compileGraph } = require('../lib/executor/pipelineCompiler');
const { createExecutor } = require('../lib/executor/createExecutor');

// load a saved graph JSON or construct a minimal graph object and call compileGraph(graph)
```

## Suggested next steps (short-term roadmap)

- Implement a minimal local executor that maps `apply_transform` to a JS-to-Python call or direct Node-side logic for a small set of transforms.
- Add unit tests for `pipelineCompiler.js` covering cycle detection, topological sort, and code emission for sample graphs.
- Improve transform config widgets for nested objects (one or two focused widgets will raise UX quality substantially).

## Contributors / Contacts

- Primary implementation: repository owner and contributors in the commit history.
- For questions about templates or runtime design, inspect `lib/pythonTemplates` and `lib/executor`.

---
