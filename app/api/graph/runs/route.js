import { NextResponse } from 'next/server';
import { bootstrapPluginsFromRepo } from '../../../../lib/plugins/pluginBootstrap.js';
import { compileExecutionGraph } from '../../../../lib/executor/pipelineCompiler.js';
import RemoteJupyterRunner from '../../../../lib/executor/remoteJupyterRunner.js';

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
  } = body || {};

  if (!graph || !targetNodeId) {
    return NextResponse.json({ error: 'Missing graph or targetNodeId in request body' }, { status: 400 });
  }

  const normalizedMode = validationMode === 'relax' ? 'relax' : 'strict';

  try {
    await bootstrapPluginsFromRepo();

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
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
