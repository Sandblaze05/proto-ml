import { NextResponse } from 'next/server';
import RemoteJupyterRunner from '../../../../../../lib/executor/remoteJupyterRunner.js';

const runner = new RemoteJupyterRunner();

export async function POST(_request, { params }) {
  const { runId } = params;
  if (!runId) {
    return NextResponse.json({ error: 'Missing runId path parameter' }, { status: 400 });
  }

  try {
    const status = await runner.cancelJob(runId);
    if (!status || status.status === 'not_found') {
      return NextResponse.json({ error: 'Run not found', runId }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      run: {
        runId: status.jobId,
        status: status.status,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
        cancelledAt: status.cancelledAt || null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
