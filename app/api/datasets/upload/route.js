import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const form = await request.formData();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const baseDir = path.join(process.cwd(), 'data', 'uploads', id);
    await fsp.mkdir(baseDir, { recursive: true });

    for (const [fieldName, value] of form.entries()) {
      // We expect the client to append files where the form field name is the
      // relative path inside the uploaded directory (e.g. "cats/0001.jpg").
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
