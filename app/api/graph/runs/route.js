import { NextResponse } from 'next/server';
import { bootstrapPluginsFromRepo } from '../../../../lib/plugins/pluginBootstrap.js';
import { compileExecutionGraph } from '../../../../lib/executor/pipelineCompiler.js';
import { buildNodeDiagnostics } from '../../../../lib/executor/nodeDiagnostics.js';
import { PREVIEW, RUN } from '../../../../lib/executor/executionContract.js';

// "Run pipeline" is the sole implementation of the RUN (one_off_compile)
// contract: compile to Python and execute via the Jupyter/local subprocess
// runner, then return the structured execution result to the browser.
//
// The synthetic PREVIEW path (getSample-based runtimes) MUST NOT reach this
// endpoint. Preview is served by /api/graph/preview and is never persisted as
// a run result.
export async function POST(request) {
  const body = await request.json();
  const {
    graph,
    targetNodeId,
    validationMode = 'strict',
    metadata = {},
    mode: requestedMode,
    executionMode: legacyMode,
    failurePolicy = 'fail-fast',
  } = body || {};

  const requestedRunMode = requestedMode || legacyMode;
  if (requestedRunMode === PREVIEW) {
    return NextResponse.json(
      {
        error: 'Preview is a separate contract. Use /api/graph/preview to sample a node. Run pipeline only supports one_off_compile / Jupyter execution.',
        details: {
          requestedMode: requestedRunMode,
          supportedModes: ['one_off_compile'],
        },
      },
      { status: 400 },
    );
  }

  if (!graph || !targetNodeId) {
    return NextResponse.json({ error: 'Missing graph or targetNodeId in request body' }, { status: 400 });
  }

  const normalizedMode = validationMode === 'relax' ? 'relax' : 'strict';
  const normalizedFailurePolicy = failurePolicy === 'fail-fast' ? 'fail-fast' : 'fail-fast';

  try {
    await bootstrapPluginsFromRepo();
    const nodeDiagnostics = buildNodeDiagnostics(graph);

    const compiled = compileExecutionGraph(graph, { validationMode: normalizedMode });
    if (!compiled.ok) {
      return NextResponse.json(
        {
          error: 'Graph compilation failed',
          details: compiled.errors,
          warnings: compiled.warnings || [],
          metadata: compiled.metadata,
        },
        { status: 400 },
      );
    }

    const LocalSubprocessRunner = require('../../../../lib/executor/localSubprocessRunner.js');
    const localRunner = new LocalSubprocessRunner();
    const subprocessResult = await localRunner.runCode(compiled.code);
    const runId = `local-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runCreatedAt = new Date().toISOString();

    return NextResponse.json({
      ok: subprocessResult.ok,
      run: {
        runId,
        status: subprocessResult.ok ? 'succeeded' : 'failed',
        provider: 'local_python',
        kernel: 'python3',
        createdAt: runCreatedAt,
        updatedAt: runCreatedAt,
      },
      compile: {
        metadata: compiled.metadata,
        warnings: compiled.warnings || [],
      },
      execution: {
        mode: RUN,
        failurePolicy: normalizedFailurePolicy,
        output: subprocessResult.output,
        stdout: subprocessResult.stdout,
        stderr: subprocessResult.stderr,
        error: subprocessResult.error,
      },
      nodeDiagnostics,
    }, { status: subprocessResult.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
