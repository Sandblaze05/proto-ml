import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') throw new Error('Missing jupyterUrl');
  return input.replace(/\/+$/, '');
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || '').replace(/^\/+/, '');
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Execute a single cell of Python code on an existing Jupyter kernel.
 * Returns { status, logs, stdout, stderr, pmlEvent }
 * where pmlEvent is the deserialized { __pml_event, ... } JSON printed by the cell.
 */
async function executeCellOnKernel(baseUrl, token, kernelId, code) {
  const wsBase = baseUrl.replace(/^http/i, 'ws');
  const wsUrl = new URL(normalizeEndpoint(`/api/kernels/${kernelId}/channels`), `${wsBase}/`);
  if (token) wsUrl.searchParams.set('token', token);

  // If we have an XSRF token (likely from a previous REST call), we should pass it.
  // WebSockets to Jupyter don't usually require XSRF if the token is in the URL,
  // but some proxies do.

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl.toString());
    const sessionId = createId();
    const msgId = createId();
    const logs = [];
    let stdoutAcc = '';
    let stderrAcc = '';
    let completed = false;
    let status = 'unknown';
    let pmlEvent = null;

    const timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        try { ws.close(); } catch { /* no-op */ }
        reject(new Error('Execution timeout waiting for Jupyter kernel reply.'));
      }
    }, 180_000);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        header: {
          msg_id: msgId,
          username: 'proto-ml-cell-runner',
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
        const mType = msg?.header?.msg_type;

        // Only handle messages that belong to our request
        if (msg?.parent_header?.msg_id && msg.parent_header.msg_id !== msgId) return;

        if (mType === 'stream') {
          const isStdout = msg?.content?.name !== 'stderr';
          const text = String(msg?.content?.text || '');
          if (isStdout) {
            stdoutAcc += text;
            logs.push({ type: 'stdout', text });
            // Try to extract proto-ml event from any printed JSON line
            for (const line of text.split('\n')) {
              const trimmed = line.trim();
              if (trimmed.startsWith('{') && trimmed.includes('__pml_event')) {
                const parsed = tryParseJson(trimmed);
                if (parsed?.__pml_event) pmlEvent = parsed;
              }
            }
          } else {
            stderrAcc += text;
            logs.push({ type: 'stderr', text });
          }
        } else if (mType === 'display_data' || mType === 'execute_result') {
          const txt = msg?.content?.data?.['text/plain'];
          if (txt) {
            stdoutAcc += txt;
            logs.push({ type: 'stdout', text: String(txt) });
          }
        } else if (mType === 'error') {
          const err = {
            ename: String(msg?.content?.ename || 'Error'),
            evalue: String(msg?.content?.evalue || ''),
            traceback: Array.isArray(msg?.content?.traceback) ? msg.content.traceback : [],
          };
          const errorText = `${err.ename}: ${err.evalue}\n${err.traceback.join('\n')}`.trim();
          stderrAcc += errorText;
          logs.push({ type: 'stderr', text: errorText });
        } else if (mType === 'execute_reply') {
          status = msg?.content?.status || 'unknown';
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            ws.close();
            resolve({ status, logs, stdout: stdoutAcc, stderr: stderrAcc, pmlEvent });
          }
        }
      } catch (parseErr) {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          ws.close();
          reject(new Error(`Failed to parse Jupyter message: ${String(parseErr?.message || parseErr)}`));
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
        resolve({ status: status || 'closed', logs, stdout: stdoutAcc, stderr: stderrAcc, pmlEvent });
      }
    });
  });
}

/**
 * POST /api/jupyter/cell
 *
 * Body: {
 *   jupyterUrl: string,
 *   jupyterToken: string,
 *   kernelId: string,    ← required; obtain via GET /api/jupyter/kernel first
 *   code: string,        ← Python cell code to execute
 *   nodeId?: string,     ← for log tagging
 * }
 *
 * Response: { ok, status, logs, stdout, stderr, pmlEvent }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const jupyterUrl = normalizeBaseUrl(body?.jupyterUrl || '');
    const jupyterToken = String(body?.jupyterToken || '');
    const kernelId = String(body?.kernelId || '');
    const code = String(body?.code || '');
    const nodeId = String(body?.nodeId || 'unknown');

    if (!kernelId) {
      return NextResponse.json({ ok: false, error: 'kernelId is required. Call GET /api/jupyter/kernel first.' }, { status: 400 });
    }
    if (!code.trim()) {
      return NextResponse.json({ ok: false, error: 'code is empty.' }, { status: 400 });
    }

    const allowInsecure = Boolean(body?.allowInsecure);

    // If we are using a Jupyter instance that requires XSRF but no token is provided,
    // we should try to pre-fetch the XSRF cookie here even for the WS connection,
    // or just ensure REST calls (like kernel creation) handled it.
    
    if (allowInsecure && jupyterUrl.startsWith('https')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const result = await executeCellOnKernel(jupyterUrl, jupyterToken, kernelId, code);

    return NextResponse.json({
      ok: result.status === 'ok',
      status: result.status,
      nodeId,
      logs: result.logs,
      stdout: result.stdout,
      stderr: result.stderr,
      pmlEvent: result.pmlEvent,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err || 'Unknown cell execution error') },
      { status: 500 },
    );
  }
}
