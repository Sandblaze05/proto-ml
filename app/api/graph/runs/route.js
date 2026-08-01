import { NextResponse } from 'next/server';
import { bootstrapPluginsFromRepo } from '../../../../lib/plugins/pluginBootstrap.js';
import { compileExecutionGraph } from '../../../../lib/executor/pipelineCompiler.js';
import RemoteJupyterRunner from '../../../../lib/executor/remoteJupyterRunner.js';
import { buildNodeDiagnostics } from '../../../../lib/executor/nodeDiagnostics.js';
import { PREVIEW, RUN } from '../../../../lib/executor/executionContract.js';

const runner = new RemoteJupyterRunner();

// "Run pipeline" is the sole implementation of the RUN (one_off_compile)
// contract: compile to Python and execute via the Jupyter/local subprocess
// runner, then persist the result as a durable run.
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

    const job = await runner.submitStructuredResult(
      subprocessResult.output || {
        ok: subprocessResult.ok,
        error: subprocessResult.error,
        stdout: subprocessResult.stdout,
        stderr: subprocessResult.stderr,
      },
      {
        provider: 'local_python',
        kernel: 'python3',
        status: subprocessResult.ok ? 'succeeded' : 'failed',
        metadata: {
          ...metadata,
          targetNodeId,
          mode: RUN,
          failurePolicy: normalizedFailurePolicy,
          compileMetadata: compiled.metadata,
          exitCode: subprocessResult.exitCode,
        },
      },
    );

    return NextResponse.json({
      ok: subprocessResult.ok,
      run: {
        runId: job.jobId,
        status: job.status,
        provider: job.provider,
        kernel: job.kernel,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
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
