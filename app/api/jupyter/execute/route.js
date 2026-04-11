import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Missing jupyterUrl');
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

async function jupyterRequest(baseUrl, endpoint, { method = 'GET', token = '', body } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

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

  if (response.status === 204) {
    return null;
  }

  return response.json();
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
      if (depth === 0) {
        start = i;
      }
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

function extractStructuredResult(logs) {
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
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  }

  return null;
}

async function executeOverKernelChannel(baseUrl, token, kernelId, code) {
  const wsBase = baseUrl.replace(/^http/i, 'ws');
  const wsUrl = new URL(normalizeEndpoint(`/api/kernels/${kernelId}/channels`), `${wsBase}/`);
  if (token) {
    wsUrl.searchParams.set('token', token);
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl.toString());
    const sessionId = createId();
    const msgId = createId();
    const logs = [];
    const errors = [];
    let completed = false;
    let status = 'unknown';

    const timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        try {
          ws.close();
        } catch {
          // no-op
        }
        reject(new Error('Execution timeout while waiting for Jupyter kernel reply.'));
      }
    }, 120000);

    ws.addEventListener('open', () => {
      const payload = {
        header: {
          msg_id: msgId,
          username: 'proto-ml-server',
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
      };

      ws.send(JSON.stringify(payload));
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        const msgType = msg?.header?.msg_type;
        if (msg?.parent_header?.msg_id && msg.parent_header.msg_id !== msgId) {
          return;
        }

        if (msgType === 'stream') {
          logs.push({
            type: msg?.content?.name === 'stderr' ? 'stderr' : 'stdout',
            text: String(msg?.content?.text || ''),
          });
        } else if (msgType === 'display_data' || msgType === 'execute_result') {
          const txt = msg?.content?.data?.['text/plain'];
          if (txt) {
            logs.push({ type: 'stdout', text: String(txt) });
          }
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
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            ws.close();
            resolve({ status, logs, errors });
          }
        }
      } catch (error) {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          ws.close();
          reject(new Error(`Failed to parse Jupyter message: ${String(error?.message || error)}`));
        }
      }
    });

    ws.addEventListener('error', () => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        reject(new Error('WebSocket error while connecting to Jupyter kernel channel.'));
      }
    });

    ws.addEventListener('close', () => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        resolve({ status: status || 'closed', logs, errors });
      }
    });
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const jupyterUrl = normalizeBaseUrl(body?.jupyterUrl || '');
    const jupyterToken = String(body?.jupyterToken || '');
    const code = String(body?.code || '');

    if (!code.trim()) {
      return NextResponse.json({ error: 'Missing code payload.' }, { status: 400 });
    }

    const systemLogs = [{ type: 'system', text: `Connecting to Jupyter at ${jupyterUrl}...` }];
    systemLogs.push({ type: 'system', text: 'Fetching kernels...' });

    const kernels = await jupyterRequest(jupyterUrl, '/api/kernels', { token: jupyterToken });
    let kernelId = '';

    if (Array.isArray(kernels) && kernels.length > 0) {
      kernelId = kernels[0].id;
      systemLogs.push({ type: 'system', text: `Reusing existing kernel ${kernelId}...` });
    } else {
      systemLogs.push({ type: 'system', text: 'Starting new kernel...' });
      const newKernel = await jupyterRequest(jupyterUrl, '/api/kernels', {
        method: 'POST',
        token: jupyterToken,
        body: { name: 'python3' },
      });
      kernelId = newKernel?.id;
    }

    if (!kernelId) {
      throw new Error('Kernel creation failed: missing kernel id.');
    }

    systemLogs.push({ type: 'system', text: `Executing compiled pipeline...\n${'-'.repeat(40)}` });

    const execution = await executeOverKernelChannel(jupyterUrl, jupyterToken, kernelId, code);
    const tailLog = {
      type: execution.status === 'ok' ? 'system' : 'stderr',
      text: `\n${'-'.repeat(40)}\nExecution finished with status: ${execution.status}`,
    };

    const allLogs = [...systemLogs, ...execution.logs, tailLog];

    return NextResponse.json({
      ok: execution.status === 'ok',
      status: execution.status,
      logs: allLogs,
      structuredResult: extractStructuredResult(allLogs),
      errors: execution.errors,
      kernelId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error?.message || error || 'Unknown execution error'),
      },
      { status: 500 },
    );
  }
}
