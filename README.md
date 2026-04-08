# Proto-ML Visual Pipeline Builder

This project implements a graph-based ML pipeline editor where nodes hold template-generated Python code and can be compiled into a consistent pipeline script.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and navigate to the dashboard.

## Quick Start

1. Install dependencies and run the Next.js dev server:

```bash
npm install
npm run dev
```

2. Open http://localhost:3000 and go to the dashboard.

3. Create or load a graph from the palette, edit node configs, then use the compile preview to inspect generated Python.

## Current Progress (April 2026)

This reflects the current implementation status in the repository.

### Completed

- Core visual graph editor with dataset, transform, lifecycle, annotation, and shape nodes on an infinite canvas.

- Runtime-extensible node and preview-runtime registries for plugin-style expansion.
  - Node registry APIs: register/unregister/list/exists in [nodes/nodeRegistry.js](nodes/nodeRegistry.js#L1)
  - Runtime factory APIs: register/unregister/list/get in [lib/runtimeFactories/index.js](lib/runtimeFactories/index.js#L1)

- Core primitive node model for broad workflow authoring:
  - Transform primitives: map, join, route, plus programming primitives if/else and type-switch in [nodes/transforms/transformRegistry.js](nodes/transforms/transformRegistry.js#L1)
  - Lifecycle primitives: split, batch loader, model builder, objective, trainer, evaluator, predictor in [nodes/lifecycle/lifecycleRegistry.js](nodes/lifecycle/lifecycleRegistry.js#L1)

- Template system for on-the-fly pipeline creation:
  - Template validation/instantiation and source merge in [lib/templates/pipelineTemplateService.js](lib/templates/pipelineTemplateService.js#L1)
  - Template graph -> canvas/execution payload adapter in [lib/templates/templateCanvasAdapter.js](lib/templates/templateCanvasAdapter.js#L1)
  - One-step apply helper in [lib/templates/applyTemplateToStores.js](lib/templates/applyTemplateToStores.js#L1)
  - Built-in templates catalog in [lib/templates/builtinTemplates.js](lib/templates/builtinTemplates.js#L1)
  - UI integration under a dedicated Templates section in [components/NodePalette.js](components/NodePalette.js#L1)

- Plugin architecture with startup bootstrap from repo folder:
  - Manifest validation + lifecycle manager in [lib/plugins/pluginRegistry.js](lib/plugins/pluginRegistry.js#L1)
  - Default registry wiring in [lib/plugins/defaultPluginRegistry.js](lib/plugins/defaultPluginRegistry.js#L1)
  - Repo plugin discovery/bootstrap in [lib/plugins/pluginBootstrap.js](lib/plugins/pluginBootstrap.js#L1)
  - API endpoint in [app/api/plugins/bootstrap/route.js](app/api/plugins/bootstrap/route.js#L1)
  - Client bootstrap on canvas load in [lib/plugins/clientPluginBootstrap.js](lib/plugins/clientPluginBootstrap.js#L1), [app/canvas/page.js](app/canvas/page.js#L1), [app/canvas/[id]/page.js](app/canvas/[id]/page.js#L1)

- Improved connection diagnostics and compile UX:
  - Structured connection validation results in [store/useExecutionStore.js](store/useExecutionStore.js#L1)
  - Compiler now compiles from the current canvas graph and reports empty-graph errors correctly in [components/PipelineCompilerPanel.js](components/PipelineCompilerPanel.js#L1)
  - Compiler emits deterministic Python with a single run_pipeline() entrypoint in [lib/executor/pipelineCompiler.js](lib/executor/pipelineCompiler.js#L1)

- Deterministic and strict edge-aware routing in compiler/runtime:
  - Canonical source/target handle wiring with strict validation for multi-input nodes in [lib/executor/pipelineCompiler.js](lib/executor/pipelineCompiler.js#L1)
  - Deterministic topological ordering in compiler and preview executor in [lib/executor/pipelineCompiler.js](lib/executor/pipelineCompiler.js#L1), [lib/executor/graphExecutor.js](lib/executor/graphExecutor.js#L1)
  - Seeded reproducibility for split/preview behavior and generated runtime execution in [lib/runtimeFactories/lifecyclePreviewRuntime.js](lib/runtimeFactories/lifecyclePreviewRuntime.js#L1), [lib/pythonTemplates/runtimeHelpers.js](lib/pythonTemplates/runtimeHelpers.js#L1)

- Dataset handle contract and materialization support expanded:
  - Typed dataset-handle descriptors emitted by compiled code (out/features/targets/columns, etc.) in [lib/executor/pipelineCompiler.js](lib/executor/pipelineCompiler.js#L1)
  - Runtime materialization for csv/json/text/image (excluding api/database sources) and handle projection in [lib/pythonTemplates/runtimeHelpers.js](lib/pythonTemplates/runtimeHelpers.js#L1)
  - Objective/loss path now consumes materialized targets correctly in generated Python runtime in [lib/pythonTemplates/runtimeHelpers.js](lib/pythonTemplates/runtimeHelpers.js#L1)

- Real backend execution path and artifact persistence:
  - sklearn-backed trainer/evaluate/predict/export path with model/artifact persistence and model registry append in [lib/pythonTemplates/runtimeHelpers.js](lib/pythonTemplates/runtimeHelpers.js#L1)
  - Preview fallback to generated code when runtime preview fails in [app/api/graph/preview/route.js](app/api/graph/preview/route.js#L1)

- Plugin bootstrap reliability improvements:
  - Alternate bootstrap endpoint in [app/api/plugins/route.js](app/api/plugins/route.js#L1)
  - Client bootstrap 404 fallback from /api/plugins/bootstrap to /api/plugins in [lib/plugins/clientPluginBootstrap.js](lib/plugins/clientPluginBootstrap.js#L1)

- Transform map parity fix in generated Python runtime:
  - Core map now executes drop/select/filter/tokenize operations instead of falling back to branch semantics in [lib/pythonTemplates/runtimeHelpers.js](lib/pythonTemplates/runtimeHelpers.js#L1)
  - Integration regression coverage added in [__tests__/lib/executor/pipelineRealExecution.integration.test.js](__tests__/lib/executor/pipelineRealExecution.integration.test.js#L1)

- Node-level analysis/preview support:
  - Dataset analysis card in [components/nodes/DatasetNode.js](components/nodes/DatasetNode.js#L1)
  - Transform Preview tab with compact analysis hints in [components/nodes/TransformNode.js](components/nodes/TransformNode.js#L1)
  - Preview execution pipeline in [lib/executor/graphExecutor.js](lib/executor/graphExecutor.js#L1)

### Validation Status

- Focused Vitest suites are in place and passing for registries, templates, plugin bootstrap, execution store diagnostics, compiler determinism, preview runtime paths, and Python integration.
- Current high-signal execution suites are green locally:
  - `npx vitest run __tests__/lib/executor/pipelineRealExecution.integration.test.js`
  - `npx vitest run __tests__/lib/executor/pipelineCompiler.test.js __tests__/lib/executor/graphExecutor.test.js __tests__/lib/executor/pipelineExecution.test.js __tests__/lib/executor/pipelineCompiler.e2e.test.js __tests__/lib/runtimeFactories.test.js`
- GitHub Actions CI now provisions Python 3.11 before running tests to reduce Python integration flakiness on Linux runners in [.github/workflows/ci.yml](.github/workflows/ci.yml#L1).
- A full production build succeeds on Next.js 16.2.1.

### Remaining Work (to reach fully production-grade execution)

- Replace preview-oriented runtime behavior with production execution backends for full training/inference runs.
- Deepen compiler semantics for advanced branching/merging and richer type-shape validation.
- Expand config UX for complex nested schemas and stronger inline validation feedback.
- Add export/versioning flows for compiled artifacts and broader end-to-end integration coverage.

## How to test the compiler locally (developer notes)

1. Start the Next dev server: `npm run dev`.
2. Open the canvas and create a small graph (for example: dataset -> transform).
3. Open the Compiler panel and click Compile to preview generated Python.
4. For quick smoke tests of runtime execution, see `lib/executor/createExecutor.js` — you can run a node script that imports the compiler and executor to run a small graph outside the UI (useful for CI or debugging).

Example (quick dev script):

```js
// scripts/runCompileSmoke.js
const { compileGraph } = require('../lib/executor/pipelineCompiler');
const { createExecutor } = require('../lib/executor/createExecutor');

// load a saved graph JSON or construct a minimal graph object and call compileGraph(graph)
```

## Contributors / Contacts

- Primary implementation: repository owner and contributors in the commit history.
- For questions about templates or runtime design, inspect `lib/pythonTemplates` and `lib/executor`.

---
