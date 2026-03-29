import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

async function safeStat(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const uploadsRoot = path.join(process.cwd(), 'data', 'uploads');
    await fs.mkdir(uploadsRoot, { recursive: true });

    const entries = await fs.readdir(uploadsRoot, { withFileTypes: true });
    const datasets = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const relPath = path.posix.join('data', 'uploads', entry.name);
      const fullPath = path.join(uploadsRoot, entry.name);
      const st = await safeStat(fullPath);
      datasets.push({
        id: entry.name,
        path: relPath,
        createdAt: st ? st.birthtime?.toISOString?.() : null,
        modifiedAt: st ? st.mtime?.toISOString?.() : null,
      });
    }

    datasets.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return NextResponse.json({ ok: true, datasets });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
