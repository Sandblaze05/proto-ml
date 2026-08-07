import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

function isSafeWorkspacePath(resolvedPath) {
  const workspaceRoot = path.resolve(process.cwd())
  const relative = path.relative(workspaceRoot, resolvedPath)
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export async function GET(request) {
  const url = new URL(request.url)
  const requestedPath = String(url.searchParams.get('path') || '').trim()

  if (!requestedPath) {
    return NextResponse.json({ error: 'Missing path query parameter' }, { status: 400 })
  }

  const resolvedPath = path.resolve(requestedPath)
  if (path.basename(resolvedPath).toLowerCase() !== 'model.joblib') {
    return NextResponse.json({ error: 'Only model.joblib downloads are allowed' }, { status: 400 })
  }

  if (!isSafeWorkspacePath(resolvedPath)) {
    return NextResponse.json({ error: 'Path is outside the workspace' }, { status: 403 })
  }

  try {
    const file = await fs.readFile(resolvedPath)
    return new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="model.joblib"',
        'Content-Length': String(file.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err?.code === 'ENOENT'
      ? 'Weights file not found on server disk. Weights and artifacts are managed in browser session storage.'
      : String(err?.message || err)
    return NextResponse.json({ error: message, sessionOnly: true }, { status: 404 })
  }
}
