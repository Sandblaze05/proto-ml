import { NextResponse } from 'next/server';
import { bootstrapPluginsFromRepo } from '../../../../lib/plugins/pluginBootstrap.js';
import { compileExecutionGraph } from '../../../../lib/executor/pipelineCompiler.js';

export async function POST(request) {
  const body = await request.json();
  const { graph, targetNodeId, n = 5, validationMode = 'strict' } = body || {};
  if (!graph || !targetNodeId) {
    return NextResponse.json({ error: 'Missing graph or targetNodeId in request body' }, { status: 400 });
  }

  const normalizedMode = validationMode === 'relax' ? 'relax' : 'strict';

  try {
    await bootstrapPluginsFromRepo();

    const validation = compileExecutionGraph(graph, { validationMode: normalizedMode, validateOnly: true });
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: 'Graph validation failed before preview execution',
          details: validation.errors,
          warnings: validation.warnings || [],
          metadata: validation.metadata,
        },
        { status: 400 },
      );
    }

    // Dynamically import the executor helper (supports CommonJS or ESM exports)
    const mod = await import('../../../../lib/executor/createExecutor.js');
    const createDefaultExecutor = mod.createDefaultExecutor || (mod.default && mod.default.createDefaultExecutor) || mod.default;
    if (typeof createDefaultExecutor !== 'function') {
      throw new Error('createDefaultExecutor not found in executor module');
    }

    const executor = createDefaultExecutor();
    const sample = await executor.preview(graph, targetNodeId, n);
    return NextResponse.json({
      ok: true,
      sample,
      warnings: validation.warnings || [],
      metadata: validation.metadata,
    });
  } catch (err) {
    // Propagate validation errors as 400 with structured details
    if (err && err.type === 'ValidationError') {
      return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
