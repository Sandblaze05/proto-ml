const JupyterClient = require('./jupyterClient');

/**
 * JupyterNodeRuntime - Wraps JupyterClient to execute individual nodes on a Jupyter kernel.
 * Implements the getSample(n, context) contract for GraphExecutor integration.
 *
 * Node config should contain:
 * - jupyterUrl: Base URL of Jupyter server (e.g., "http://localhost:8888")
 * - jupyterToken: Optional authentication token
 * - kernelId: Optional kernel ID to reuse; if not provided, a new kernel is created
 * - pythonCode: Python code to execute
 * - autoCleanup: Whether to delete the kernel after execution (default: false)
 */

class JupyterNodeRuntime {
  constructor(config = {}) {
    this.config = config;
    this.client = null;
    this.kernelId = null;
    this.createdKernel = false;
  }

  _initClient() {
    if (this.client) return this.client;
    const { jupyterUrl = 'http://localhost:8888', jupyterToken = '' } = this.config;
    this.client = new JupyterClient(jupyterUrl, jupyterToken);
    return this.client;
  }

  _extractRows(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return Object.values(data);
    return [];
  }

  async _ensureKernel() {
    const client = this._initClient();
    
    // Reuse provided kernel ID if available
    if (this.config.kernelId) {
      this.kernelId = this.config.kernelId;
      return this.kernelId;
    }

    // Try to list existing kernels and reuse one
    try {
      const kernels = await client.listKernels();
      if (kernels && kernels.length > 0) {
        this.kernelId = kernels[0].id;
        return this.kernelId;
      }
    } catch (err) {
      // If listing fails, we'll create a new one
    }

    // Create a new kernel
    try {
      const newKernel = await client.startKernel('python3');
      this.kernelId = newKernel.id;
      this.createdKernel = true;
      return this.kernelId;
    } catch (err) {
      throw new Error(`Failed to start Jupyter kernel: ${err.message}`);
    }
  }

  async _executeCode(code) {
    const client = this._initClient();
    const kernelId = await this._ensureKernel();

    return new Promise((resolve, reject) => {
      const outputs = {
        stdout: '',
        stderr: '',
        results: [],
        errors: [],
      };

      const callbacks = {
        onStream: (name, text) => {
          if (name === 'stdout') {
            outputs.stdout += text;
          } else if (name === 'stderr') {
            outputs.stderr += text;
          }
        },
        onDisplayData: (data) => {
          if (data['text/plain']) {
            outputs.results.push(data['text/plain']);
          } else if (data['application/json']) {
            outputs.results.push(data['application/json']);
          }
        },
        onError: (err) => {
          outputs.errors.push({
            ename: err.ename,
            evalue: err.evalue,
            traceback: err.traceback,
          });
        },
        onComplete: (status) => {
          outputs.status = status;
        },
      };

      client
        .executeCode(kernelId, code, callbacks)
        .then(() => resolve(outputs))
        .catch((err) => reject(new Error(`Jupyter execution failed: ${err.message}`)));
    });
  }

  async getSample(n = 5, context = {}) {
    try {
      const { pythonCode = '' } = this.config;

      if (!pythonCode || !pythonCode.trim()) {
        return {
          error: 'No Python code provided in jupyter.execute node config',
          type: 'ConfigError',
          code: pythonCode,
        };
      }

      const outputs = await this._executeCode(pythonCode);

      // Parse stdout as JSON if possible, otherwise return as rows
      let data = [];
      if (outputs.stdout) {
        try {
          // Try to parse as JSON
          data = JSON.parse(outputs.stdout);
          if (!Array.isArray(data)) data = [data];
        } catch {
          // If not JSON, split by lines and return as array
          data = outputs.stdout
            .split('\n')
            .filter((line) => line.trim())
            .slice(0, n);
        }
      }

      // Include results from display_data
      if (outputs.results.length > 0) {
        data = outputs.results.map((r) => {
          try {
            return typeof r === 'string' ? JSON.parse(r) : r;
          } catch {
            return r;
          }
        });
      }

      // Ensure array format and limit to n
      const rows = this._extractRows(data).slice(0, n);

      // If there were errors, include them in the result
      if (outputs.errors.length > 0) {
        return {
          data: rows,
          errors: outputs.errors,
          stdout: outputs.stdout,
          stderr: outputs.stderr,
          status: outputs.status,
          partial: true, // Indicates execution had errors but may have partial results
        };
      }

      return {
        data: rows,
        stdout: outputs.stdout,
        stderr: outputs.stderr,
        status: outputs.status,
      };
    } catch (err) {
      return {
        error: err.message,
        type: 'RuntimeError',
        details: {
          nodeType: 'jupyter.execute',
          config: this.config,
        },
      };
    } finally {
      // Auto-cleanup if configured
      if (this.config.autoCleanup && this.createdKernel && this.kernelId) {
        try {
          const client = this._initClient();
          await client.deleteKernel(this.kernelId);
        } catch (err) {
          console.warn(`Failed to cleanup kernel ${this.kernelId}:`, err.message);
        }
      }
    }
  }
}

module.exports = JupyterNodeRuntime;

