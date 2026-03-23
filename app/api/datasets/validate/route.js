import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

async function collectFilesRecursive(baseDir, maxFiles = 50) {
  const files = [];
  const queue = [baseDir];

  while (queue.length && files.length < maxFiles) {
    const cur = queue.shift();
    let entries = [];
    try {
      entries = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (entry.isFile()) {
        files.push(path.relative(baseDir, full));
      }
    }
  }

  return files;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const p = body?.path;
    if (!p) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

    const projectRoot = process.cwd();
    const resolved = path.resolve(projectRoot, p);
    // Only allow inspection inside project root for safety.
    const relToRoot = path.relative(projectRoot, resolved);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      return NextResponse.json({ error: 'Path outside project root' }, { status: 400 });
    }

    let st;
    try {
      st = await fs.stat(resolved);
    } catch (err) {
      if (err.code === 'ENOENT') return NextResponse.json({ ok: false, exists: false }, { status: 200 });
      throw err;
    }

    if (!st.isDirectory()) {
      return NextResponse.json({ ok: true, exists: true, isDirectory: false, isFile: true }, { status: 200 });
    }

    // list up to 50 files recursively for folder-based datasets (e.g. class subfolders)
    const files = await collectFilesRecursive(resolved, 50);
    return NextResponse.json({ ok: true, exists: true, isDirectory: true, isFile: false, files, count: files.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
