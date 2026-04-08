import { NextResponse } from 'next/server';
import RemoteJupyterRunner from '../../../../../../lib/executor/remoteJupyterRunner.js';

const runner = new RemoteJupyterRunner();

export async function GET(_request, { params }) {
  const { runId } = params;
  if (!runId) {
    return NextResponse.json({ error: 'Missing runId path parameter' }, { status: 400 });
  }

  try {
    const result = await runner.fetchResult(runId);
    if (!result || result.status === 'not_found') {
      return NextResponse.json({ error: 'Run not found', runId }, { status: 404 });
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
