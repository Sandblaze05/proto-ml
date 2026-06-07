import { NextResponse } from 'next/server';
import { jupyterRequest } from '../../../../lib/executor/jupyterServerProxy.js';

export const runtime = 'nodejs';

function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') throw new Error('Missing jupyterUrl');
  return input.replace(/\/+$/, '');
}

/**
 * GET /api/jupyter/kernel
 * Query params: jupyterUrl, jupyterToken, fresh (optional, forces a new kernel)
 *
 * Returns { kernelId, isNew } — caller holds onto kernelId for the session.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jupyterUrl = normalizeBaseUrl(searchParams.get('jupyterUrl') || '');
    const jupyterToken = String(searchParams.get('jupyterToken') || '');
    const allowInsecure = searchParams.get('allowInsecure') === 'true';
    const fresh = searchParams.get('fresh') === 'true';

    if (fresh) {
      const newKernel = await jupyterRequest(jupyterUrl, '/api/kernels', {
        method: 'POST',
        token: jupyterToken,
        allowInsecure,
        body: { name: 'python3' },
      });
      return NextResponse.json({ ok: true, kernelId: newKernel.id, isNew: true });
    }

    let kernelId = null;
    let isNew = false;
    try {
      const kernels = await jupyterRequest(jupyterUrl, '/api/kernels', {
        token: jupyterToken,
        allowInsecure,
      });
      if (Array.isArray(kernels) && kernels.length > 0) {
        kernelId = kernels[0].id;
      }
    } catch {
      // listing failed — proceed to create
    }

    if (!kernelId) {
      const newKernel = await jupyterRequest(jupyterUrl, '/api/kernels', {
        method: 'POST',
        token: jupyterToken,
        allowInsecure,
        body: { name: 'python3' },
      });
      kernelId = newKernel.id;
      isNew = true;
    }

    return NextResponse.json({ ok: true, kernelId, isNew });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

/**
 * DELETE /api/jupyter/kernel
 * Body: { jupyterUrl, jupyterToken, kernelId }
 *
 * Deletes (restarts cleanly) a kernel by id.
 */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const jupyterUrl = normalizeBaseUrl(body?.jupyterUrl || '');
    const jupyterToken = String(body?.jupyterToken || '');
    const kernelId = String(body?.kernelId || '');
    const allowInsecure = Boolean(body?.allowInsecure);
    if (!kernelId) throw new Error('Missing kernelId');

    await jupyterRequest(jupyterUrl, `/api/kernels/${kernelId}`, {
      method: 'DELETE',
      token: jupyterToken,
      allowInsecure,
    });

    return NextResponse.json({ ok: true, kernelId, deleted: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
