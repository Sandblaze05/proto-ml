// Explicit execution contract for Proto-ML pipelines.
//
// There are exactly two execution surfaces and they MUST NOT be confused:
//
//   PREVIEW ("preview")
//     The synthetic, in-process sampling path. Node runtimes are driven by
//     getSample(n) (see lib/runtimeFactories/* and
//     lib/executor/clientPreviewExecutor.js). It is used ONLY by the node
//     "Preview" tabs and the /api/graph/preview endpoint.
//     Preview outputs are ephemeral UI samples — they are NEVER compiled into
//     a durable run result and NEVER persisted through the Jupyter runner.
//
//   RUN / "one_off_compile" ("one_off_compile")
//     The ONLY implementation of "Run pipeline". Compiles the graph to Python
//     (lib/executor/pipelineCompiler.js), executes it via a local subprocess,
//     and persists the result as a durable run through the Jupyter runner
//     (lib/executor/remoteJupyterRunner.js). No other mode may produce a run.
export const PREVIEW = 'preview';
export const RUN = 'one_off_compile';

export const VALID_RUN_MODES = Object.freeze([RUN]);
export const VALID_PREVIEW_MODES = Object.freeze([PREVIEW]);

export const EXECUTION_CONTRACT = Object.freeze({
  PREVIEW,
  RUN,
  VALID_RUN_MODES,
  VALID_PREVIEW_MODES,
});
