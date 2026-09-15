import { NextResponse } from 'next/server';

export async function POST(request) {
  return NextResponse.json({ ok: false, clientOnly: true, error: 'Server-side dataset deletion is disabled.' }, { status: 410 });
}
