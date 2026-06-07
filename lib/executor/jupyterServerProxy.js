function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') throw new Error('Missing jupyterUrl');
  return input.replace(/\/+$/, '');
}

function buildApiUrl(baseUrl, endpoint, token) {
  const url = new URL(String(endpoint).replace(/^\/+/, ''), `${baseUrl}/`);
  if (token) url.searchParams.set('token', token);
  return url;
}

function parseXsrfFromResponse(response) {
  const rawCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  for (const cookie of rawCookies) {
    const match = String(cookie).match(/_xsrf=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

async function fetchXsrfToken(baseUrl, token) {
  // /api/status does not issue _xsrf on Jupyter Server 2.x; page routes do.
  const endpoints = ['/lab', '/tree', '/', '/api/status'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(buildApiUrl(baseUrl, endpoint, token), {
        method: 'GET',
        cache: 'no-store',
      });
      const xsrf = parseXsrfFromResponse(response);
      if (xsrf) return xsrf;
    } catch {
      // try next endpoint
    }
  }
  return null;
}

export async function jupyterRequest(baseUrl, endpoint, { method = 'GET', token = '', body, allowInsecure = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Token ${token}`;

  let xsrf = null;
  if (method !== 'GET' && method !== 'HEAD') {
    xsrf = await fetchXsrfToken(baseUrl, token);
    if (xsrf) {
      headers['X-XSRFToken'] = xsrf;
      headers.Cookie = `_xsrf=${xsrf}`;
    }
  }

  if (allowInsecure && baseUrl.startsWith('https')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const url = buildApiUrl(baseUrl, endpoint, token);
  if (xsrf) url.searchParams.set('_xsrf', xsrf);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    const hint = !token && response.status === 403
      ? " Hint: start Jupyter with a token, or add --ServerApp.disable_check_xsrf=True for local dev."
      : '';
    throw new Error(`Jupyter API Error (${response.status}): ${text}${hint}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export { normalizeBaseUrl, buildApiUrl };
