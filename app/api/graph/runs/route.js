import { NextResponse } from 'next/server';
import { bootstrapPluginsFromRepo } from '../../../../lib/plugins/pluginBootstrap.js';
import { compileExecutionGraph } from '../../../../lib/executor/pipelineCompiler.js';
import RemoteJupyterRunner from '../../../../lib/executor/remoteJupyterRunner.js';
import { buildNodeDiagnostics } from '../../../../lib/executor/nodeDiagnostics.js';

const runner = new RemoteJupyterRunner();

export async function POST(request) {
  const body = await request.json();
  const {
    graph,
    targetNodeId,
    validationMode = 'strict',
    provider = 'colab',
    kernel = 'python3',
    metadata = {},
    executionMode = 'pipeline_topological',
    failurePolicy = 'fail-fast',
  } = body || {};

  if (!graph || !targetNodeId) {
    return NextResponse.json({ error: 'Missing graph or targetNodeId in request body' }, { status: 400 });
  }

  const normalizedMode = validationMode === 'relax' ? 'relax' : 'strict';
  const normalizedExecutionMode = executionMode === 'one_off_compile' ? 'one_off_compile' : 'pipeline_topological';
  const normalizedFailurePolicy = failurePolicy === 'fail-fast' ? 'fail-fast' : 'fail-fast';

  try {
    await bootstrapPluginsFromRepo();
    const nodeDiagnostics = buildNodeDiagnostics(graph);

    if (normalizedExecutionMode === 'pipeline_topological') {
      const mod = await import('../../../../lib/executor/createExecutor.js');
      const createDefaultExecutor = mod.createDefaultExecutor || (mod.default && mod.default.createDefaultExecutor) || mod.default;
      if (typeof createDefaultExecutor !== 'function') {
        throw new Error('createDefaultExecutor not found in executor module');
      }

      const executor = createDefaultExecutor();
      const execution = await executor.executeTopological(graph, {
        targetNodeId,
        failurePolicy: normalizedFailurePolicy,
      });

      const job = await runner.submitStructuredResult(
        {
          summary: execution.ok
            ? 'Topological pipeline run completed successfully.'
            : `Topological pipeline failed at node: ${execution.failedNodeId}`,
          execution,
          artifacts: [],
          metrics: {},
        },
        {
          provider,
          kernel: 'topological',
          status: execution.ok ? 'succeeded' : 'failed',
          metadata: {
            ...metadata,
            targetNodeId,
            executionMode: normalizedExecutionMode,
            failurePolicy: normalizedFailurePolicy,
          },
        },
      );

      return NextResponse.json({
        ok: execution.ok,
        run: {
          runId: job.jobId,
          status: job.status,
          provider: job.provider,
          kernel: job.kernel,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
        execution: {
          mode: normalizedExecutionMode,
          failurePolicy: normalizedFailurePolicy,
          order: execution.order,
          failedNodeId: execution.failedNodeId,
        },
        nodeDiagnostics,
      }, { status: execution.ok ? 200 : 400 });
    }

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

    const job = await runner.submitCode(compiled.code, {
      provider,
      kernel,
      metadata: {
        ...metadata,
        targetNodeId,
        executionMode: normalizedExecutionMode,
        failurePolicy: normalizedFailurePolicy,
        compileMetadata: compiled.metadata,
      },
    });

    return NextResponse.json({
      ok: true,
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
        mode: normalizedExecutionMode,
        failurePolicy: normalizedFailurePolicy,
      },
      nodeDiagnostics,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
