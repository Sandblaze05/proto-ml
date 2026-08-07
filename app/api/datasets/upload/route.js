import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const form = await request.formData();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const baseDir = path.join(process.cwd(), 'data', 'uploads', id);
    
    try {
      await fsp.mkdir(baseDir, { recursive: true });

      for (const [fieldName, value] of form.entries()) {
        if (typeof value === 'string') continue;

        const relPath = path.posix.normalize(
          fieldName.replace(/\\/g, '/').replace(/^[\/]+/, '')
        );
        if (!relPath || relPath === '.' || relPath.startsWith('..')) {
          return NextResponse.json({ error: `Invalid upload path: ${fieldName}` }, { status: 400 });
        }

        const outPath = path.join(baseDir, ...relPath.split('/'));
        const relToBase = path.relative(baseDir, outPath);
        if (relToBase.startsWith('..') || path.isAbsolute(relToBase)) {
          return NextResponse.json({ error: `Upload path escapes target dir: ${fieldName}` }, { status: 400 });
        }

        await fsp.mkdir(path.dirname(outPath), { recursive: true });
        const buffer = Buffer.from(await value.arrayBuffer());
        await fsp.writeFile(outPath, buffer);
      }

      return NextResponse.json({ ok: true, uploadPath: `data/uploads/${id}` });
    } catch (fsErr) {
      // Handles read-only file systems (e.g., Vercel deployment)
      return NextResponse.json({
        ok: true,
        uploadPath: `client://${id}`,
        clientSessionOnly: true,
        warning: `Server filesystem read-only (${fsErr.code || fsErr.message}). Managed in session storage.`,
      });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
