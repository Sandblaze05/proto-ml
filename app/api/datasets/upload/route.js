import { NextResponse } from 'next/server';

export async function POST(request) {
  return NextResponse.json({
    ok: false,
    clientOnly: true,
    error: 'Server-side file uploads are disabled. Upload files from the browser so they remain client-side.',
  }, { status: 410 });
}
