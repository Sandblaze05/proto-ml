import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const body = await request.json();
    const p = body?.path;
    if (!p) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

    const projectRoot = process.cwd();
    const resolved = path.resolve(projectRoot, p);
    const uploadsRoot = path.join(process.cwd(), 'data', 'uploads');
    const relToUploads = path.relative(uploadsRoot, resolved);
    if (relToUploads.startsWith('..') || path.isAbsolute(relToUploads)) {
      return NextResponse.json({ error: 'Delete allowed only under data/uploads' }, { status: 403 });
    }

    // remove recursively
    await fs.rm(resolved, { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
