import { NextResponse } from 'next/server';
import { bootstrapPluginsFromRepo } from '../../../../lib/plugins/pluginBootstrap.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await bootstrapPluginsFromRepo({ force: body?.force === true });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const result = await bootstrapPluginsFromRepo();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
