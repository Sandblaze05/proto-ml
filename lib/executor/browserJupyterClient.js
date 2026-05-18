function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Missing Jupyter URL.');
  }
  return input.replace(/\/+$/, '');
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || '').replace(/^\/+/, '');
}

function buildApiUrl(baseUrl, endpoint, token) {
  const url = new URL(normalizeEndpoint(endpoint), `${baseUrl}/`);
  if (token) {
    url.searchParams.set('token', token);
  }
  return url;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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

export class BrowserJupyterClient {
  constructor(baseUrl, token = '') {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token || '';
  }

  async request(endpoint, { method = 'GET', body } = {}) {
    const response = await fetch(buildApiUrl(this.baseUrl, endpoint, this.token), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jupyter API Error (${response.status}): ${text}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async startKernel({ fresh = false, name = 'python3' } = {}) {
    if (!fresh) {
      const kernels = await this.request('/api/kernels');
      if (Array.isArray(kernels) && kernels[0]?.id) return kernels[0].id;
    }

    const kernel = await this.request('/api/kernels', {
      method: 'POST',
      body: { name },
    });
    if (!kernel?.id) throw new Error('Kernel creation failed: missing kernel id.');
    return kernel.id;
  }

  async executeCode(kernelId, code, { username = 'proto-ml-browser', timeoutMs = 120000 } = {}) {
    if (!kernelId) throw new Error('Missing Jupyter kernel id.');

    const wsBase = this.baseUrl.replace(/^http/i, 'ws');
    const wsUrl = new URL(normalizeEndpoint(`/api/kernels/${kernelId}/channels`), `${wsBase}/`);
    if (this.token) wsUrl.searchParams.set('token', this.token);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl.toString());
      const sessionId = createId();
      const msgId = createId();
      const logs = [];
      const errors = [];
      let completed = false;
      let status = 'unknown';

      const finish = (nextStatus) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeoutId);
        try {
          ws.close();
        } catch {
          // no-op
        }
        resolve({ status: nextStatus || status, logs, errors });
      };

      const fail = (error) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeoutId);
        try {
          ws.close();
        } catch {
          // no-op
        }
        reject(error);
      };

      const timeoutId = setTimeout(() => {
        fail(new Error('Execution timeout while waiting for Jupyter kernel reply.'));
      }, timeoutMs);

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({
          header: {
            msg_id: msgId,
            username,
            session: sessionId,
            msg_type: 'execute_request',
            version: '5.3',
          },
          parent_header: {},
          metadata: {},
          content: {
            code,
            silent: false,
            store_history: true,
            user_expressions: {},
            allow_stdin: false,
            stop_on_error: true,
          },
          channel: 'shell',
        }));
      });

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data.toString());
          const msgType = msg?.header?.msg_type;
          if (msg?.parent_header?.msg_id && msg.parent_header.msg_id !== msgId) return;

          if (msgType === 'stream') {
            logs.push({
              type: msg?.content?.name === 'stderr' ? 'stderr' : 'stdout',
              text: String(msg?.content?.text || ''),
            });
          } else if (msgType === 'display_data' || msgType === 'execute_result') {
            const text = msg?.content?.data?.['text/plain'];
            if (text) logs.push({ type: 'stdout', text: String(text) });
          } else if (msgType === 'error') {
            const err = {
              ename: String(msg?.content?.ename || 'Error'),
              evalue: String(msg?.content?.evalue || ''),
              traceback: Array.isArray(msg?.content?.traceback) ? msg.content.traceback : [],
            };
            errors.push(err);
            logs.push({ type: 'stderr', text: `${err.ename}: ${err.evalue}\n${err.traceback.join('\n')}`.trim() });
          } else if (msgType === 'execute_reply') {
            status = msg?.content?.status || 'unknown';
            finish(status);
          }
        } catch (error) {
          fail(new Error(`Failed to parse Jupyter message: ${String(error?.message || error)}`));
        }
      });

      ws.addEventListener('error', () => {
        fail(new Error('WebSocket error while connecting directly to Jupyter.'));
      });

      ws.addEventListener('close', () => {
        if (!completed) finish(status || 'closed');
      });
    });
  }
}
