import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') throw new Error('Missing jupyterUrl');
  return input.replace(/\/+$/, '');
}

function buildApiUrl(baseUrl, endpoint, token) {
  const url = new URL(String(endpoint).replace(/^\/+/, ''), `${baseUrl}/`);
  if (token) url.searchParams.set('token', token);
  return url;
}

async function jupyterRequest(baseUrl, endpoint, { method = 'GET', token = '', body, allowInsecure = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Token ${token}`;

  // XSRF handling for mutating requests
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const statusRes = await fetch(buildApiUrl(baseUrl, '/api/status', token), {
        method: 'GET',
        cache: 'no-store',
      });
      const cookie = statusRes.headers.get('set-cookie');
      if (cookie && cookie.includes('_xsrf=')) {
        const xsrf = cookie.split('_xsrf=')[1].split(';')[0];
        headers['X-XSRFToken'] = xsrf;
        headers['Cookie'] = `_xsrf=${xsrf}`;
      }
    } catch (e) {
      console.warn('Failed to pre-fetch XSRF token:', e);
    }
  }

  // Handle TLS for local/insecure environments
  if (allowInsecure && baseUrl.startsWith('https')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  try {
    const response = await fetch(buildApiUrl(baseUrl, endpoint, token), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jupyter API Error (${response.status}): ${text}`);
    }
    if (response.status === 204) return null;
    return response.json();
  } finally {
    // NODE_TLS_REJECT_UNAUTHORIZED reset is not trivial in async Next.js, 
    // but for dev environments on localhost, this is common.
  }
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

    // If fresh, create a brand-new kernel (optionally delete previous).
    if (fresh) {
      const newKernel = await jupyterRequest(jupyterUrl, '/api/kernels', {
        method: 'POST',
        token: jupyterToken,
        allowInsecure,
        body: { name: 'python3' },
      });
      return NextResponse.json({ ok: true, kernelId: newKernel.id, isNew: true });
    }

    // Try to find an existing idle kernel, otherwise create one.
    let kernelId = null;
    let isNew = false;
    try {
      const kernels = await jupyterRequest(jupyterUrl, '/api/kernels', { 
        token: jupyterToken,
        allowInsecure 
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
      allowInsecure
    });

    return NextResponse.json({ ok: true, kernelId, deleted: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
