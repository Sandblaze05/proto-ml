/**
 * Minimal Jupyter API Client for browser-based execution.
 * Allows connecting to an standard Jupyter Server via its URL and Token,
 * creating a Python kernel, and streaming execution logs.
 */

class JupyterClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token || '';
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Token ${this.token}` } : {}),
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) // support colab ngrok sometimes
    };
  }

  async getFetchOptions(method = 'GET', body = null) {
    const opts = {
      method,
      headers: this.getHeaders(),
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    return opts;
  }

  async request(endpoint, options = {}) {
    // try to fetch, if it is local, it might not need credentials, but we pass headers
    const url = new URL(endpoint, this.baseUrl);
    // append token as query param since some setups block Auth headers due to CORS preflight
    if (this.token) {
      url.searchParams.set('token', this.token);
    }

    const response = await fetch(url.toString(), {
      ...options,
      // mode: 'cors',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jupyter API Error (${response.status}): ${text}`);
    }

    if (response.status !== 204) {
      return response.json();
    }
    return null;
  }

  async listKernels() {
    return this.request('/api/kernels');
  }

  async startKernel(name = 'python3') {
    return this.request('/api/kernels', await this.getFetchOptions('POST', { name }));
  }

  async deleteKernel(kernelId) {
    return this.request(`/api/kernels/${kernelId}`, await this.getFetchOptions('DELETE'));
  }

  // Generate a random UUID-like string
  static uuid() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Execute Python code and stream results via callbacks.
   */
  async executeCode(kernelId, code, callbacks) {
    return new Promise((resolve, reject) => {
      let wsUrl = this.baseUrl.replace(/^http/, 'ws');
      let wsEndpoint = `${wsUrl}/api/kernels/${kernelId}/channels`;
      if (this.token) {
        wsEndpoint += `?token=${encodeURIComponent(this.token)}`;
      }

      const ws = new WebSocket(wsEndpoint);
      const sessionId = JupyterClient.uuid();
      const msgId = JupyterClient.uuid();

      let hasResolved = false;

      ws.onopen = () => {
        if (callbacks.onConnected) callbacks.onConnected();

        const payload = {
          header: {
            msg_id: msgId,
            username: 'proto-ml-client',
            session: sessionId,
            msg_type: 'execute_request',
            version: '5.3',
          },
          parent_header: {},
          metadata: {},
          content: {
            code: code,
            silent: false,
            store_history: true,
            user_expressions: {},
            allow_stdin: false,
            stop_on_error: true,
          },
          channel: 'shell'
        };

        ws.send(JSON.stringify(payload));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const msgType = msg.header.msg_type;

          // Only process messages that are responses to our execution
          if (msg.parent_header && msg.parent_header.msg_id !== msgId) {
            return;
          }

          if (msgType === 'stream') {
            const name = msg.content.name; // stdout or stderr
            const text = msg.content.text;
            if (callbacks.onStream) callbacks.onStream(name, text);
          } else if (msgType === 'execute_result' || msgType === 'display_data') {
            const data = msg.content.data;
            if (callbacks.onDisplayData) callbacks.onDisplayData(data);
          } else if (msgType === 'error') {
            const ename = msg.content.ename;
            const evalue = msg.content.evalue;
            const traceback = msg.content.traceback || [];
            if (callbacks.onError) callbacks.onError({ ename, evalue, traceback });
          } else if (msgType === 'execute_reply') {
            const status = msg.content.status;
            if (status === 'ok' || status === 'error') {
              if (callbacks.onComplete) callbacks.onComplete(status);
              if (!hasResolved) {
                hasResolved = true;
                ws.close();
                resolve({ status });
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse Jupyter WS message", e, event.data);
        }
      };

      ws.onerror = (err) => {
        if (callbacks.onError) callbacks.onError({ ename: 'WebSocket Error', evalue: 'Connection failed', traceback: [String(err)] });
        if (!hasResolved) {
          hasResolved = true;
          reject(new Error("WebSocket error"));
        }
      };

      ws.onclose = () => {
        if (!hasResolved) {
          hasResolved = true;
          resolve({ status: 'closed' });
        }
      };
    });
  }
}

// Export for CommonJS and ES modules
module.exports = JupyterClient;
module.exports.JupyterClient = JupyterClient;

