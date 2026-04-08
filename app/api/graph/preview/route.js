import { NextResponse } from 'next/server';
import { bootstrapPluginsFromRepo } from '../../../../lib/plugins/pluginBootstrap.js';
import { compileExecutionGraph } from '../../../../lib/executor/pipelineCompiler.js';

export async function POST(request) {
  const body = await request.json();
  const { graph, targetNodeId, n = 5, validationMode = 'strict', seed } = body || {};
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

    try {
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
    } catch (previewErr) {
      // Preview execution can fail in backend-unavailable scenarios; still return workable compiled code.
      const compiled = compileExecutionGraph(graph, { validationMode: normalizedMode, seed });
      if (!compiled.ok) {
        return NextResponse.json(
          {
            error: 'Preview execution failed and code fallback compilation also failed',
            previewError: String(previewErr),
            details: compiled.errors,
            warnings: [...(validation.warnings || []), ...(compiled.warnings || [])],
            metadata: compiled.metadata,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: false,
        fallback: true,
        previewError: String(previewErr),
        sample: null,
        generatedCode: compiled.code,
        warnings: [...(validation.warnings || []), ...(compiled.warnings || [])],
        metadata: {
          ...validation.metadata,
          fallbackCompilation: compiled.metadata,
        },
      });
    }
  } catch (err) {
    // Propagate validation errors as 400 with structured details
    if (err && err.type === 'ValidationError') {
      return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
