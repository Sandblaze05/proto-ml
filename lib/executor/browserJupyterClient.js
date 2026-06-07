function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Missing Jupyter URL.');
  }
  return input.replace(/\/+$/, '');
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectBalancedJsonObjects(text) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

export function extractStructuredResult(logs) {
  const stdoutText = (Array.isArray(logs) ? logs : [])
    .filter((entry) => entry?.type === 'stdout')
    .map((entry) => String(entry?.text || ''))
    .join('\n');

  if (!stdoutText.trim()) return null;

  const full = tryParseJson(stdoutText.trim());
  if (full && typeof full === 'object') return full;

  const candidates = collectBalancedJsonObjects(stdoutText);
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const parsed = tryParseJson(candidates[i]);
    if (parsed && typeof parsed === 'object') return parsed;
  }

  return null;
}

/**
 * Browser-side Jupyter client that proxies through Next.js API routes
 * (/api/jupyter/kernel, /api/jupyter/cell) to avoid CORS/CSRF 403 errors
 * when calling Jupyter directly from localhost:3000.
 */
export class BrowserJupyterClient {
  constructor(baseUrl, token = '', { allowInsecure = false } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token || '';
    this.allowInsecure = allowInsecure;
  }

  async startKernel({ fresh = false } = {}) {
    const params = new URLSearchParams({
      jupyterUrl: this.baseUrl,
      jupyterToken: this.token,
    });
    if (fresh) params.set('fresh', 'true');
    if (this.allowInsecure) params.set('allowInsecure', 'true');

    const response = await fetch(`/api/jupyter/kernel?${params.toString()}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Kernel start failed (${response.status})`);
    }
    if (!data.kernelId) throw new Error('Kernel creation failed: missing kernel id.');
    return data.kernelId;
  }

  async executeCode(kernelId, code, { username = 'proto-ml-browser', nodeId } = {}) {
    if (!kernelId) throw new Error('Missing Jupyter kernel id.');

    const response = await fetch('/api/jupyter/cell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jupyterUrl: this.baseUrl,
        jupyterToken: this.token,
        kernelId,
        code,
        nodeId: nodeId || username,
        allowInsecure: this.allowInsecure,
      }),
      cache: 'no-store',
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Cell execution failed (${response.status})`);
    }

    return {
      status: data.status || (data.ok ? 'ok' : 'error'),
      logs: Array.isArray(data.logs) ? data.logs : [],
      errors: [],
    };
  }
}
