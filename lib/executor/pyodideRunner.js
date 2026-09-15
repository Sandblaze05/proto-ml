const PYODIDE_VERSION = '0.28.2';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
// The first browser run includes downloading and initializing the Pyodide
// runtime. Keep this separate from the much heavier server-style dependency
// bootstrap so a normal browser graph does not fail at two minutes.
const DEFAULT_TIMEOUT_MS = 300000;

let worker = null;
let requestId = 0;
const pending = new Map();

function createWorker() {
  if (typeof Worker === 'undefined') {
    throw new Error('Pyodide requires a browser Web Worker.');
  }

  const source = `
    let pyodidePromise;
    const loadRuntime = async () => {
      if (!pyodidePromise) {
        importScripts(${JSON.stringify(PYODIDE_URL)});
        pyodidePromise = loadPyodide({ indexURL: ${JSON.stringify(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`)} });
      }
      return pyodidePromise;
    };

    self.onmessage = async (event) => {
      const { id, type, code, datasets, packages = [] } = event.data || {};
      try {
        const pyodide = await loadRuntime();
        if (type === 'run') {
          pyodide.setStdout({ batched: (text) => self.postMessage({ id, type: 'stdout', text }) });
          pyodide.setStderr({ batched: (text) => self.postMessage({ id, type: 'stderr', text }) });

          // Do not call loadPackagesFromImports on the complete generated
          // runtime. The helpers contain optional imports for torch,
          // transformers, and scikit-learn even when the selected graph does
          // not use them, which can trigger a large download or hang a simple
          // CSV/map pipeline. Browser-safe transforms have pure-Python
          // fallbacks; callers can explicitly request packages when needed.
          if (Array.isArray(packages) && packages.length > 0) {
            self.postMessage({ id, type: 'stdout', text: 'Loading Pyodide packages: ' + packages.join(', ') + '...\\n' });
            await pyodide.loadPackage(packages);
          }
          pyodide.globals.set('__pml_client_datasets_json', JSON.stringify(datasets || {}));
          await pyodide.runPythonAsync([
            'import json',
            '__pml_client_datasets = json.loads(__pml_client_datasets_json)',
            code,
          ].join('\\n'));
          self.postMessage({ id, type: 'complete', status: 'ok' });
          return;
        }
        self.postMessage({ id, type: 'ready', status: 'ok' });
      } catch (error) {
        self.postMessage({
          id,
          type: 'complete',
          status: 'error',
          error: String(error && (error.message || error) || 'Pyodide execution failed'),
        });
      }
    };
  `;

  const blob = new Blob([source], { type: 'application/javascript' });
  const created = new Worker(URL.createObjectURL(blob));
  created.addEventListener('message', (event) => {
    const message = event.data || {};
    const request = pending.get(message.id);
    if (!request) return;
    if (message.type === 'stdout' || message.type === 'stderr') {
      request.logs.push({ type: message.type, text: String(message.text || '') });
      return;
    }
    pending.delete(message.id);
    clearTimeout(request.timeoutId);
    if (message.status === 'ok') {
      request.resolve({ status: 'ok', logs: request.logs });
    } else {
      request.reject(new Error(message.error || 'Pyodide execution failed'));
    }
  });
  created.addEventListener('error', (event) => {
    for (const request of pending.values()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error(event.message || 'Pyodide worker failed'));
    }
    pending.clear();
    created.terminate();
    worker = null;
  });
  return created;
}

export function isPyodideAvailable() {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

export function disposePyodideWorker() {
  if (worker) worker.terminate();
  worker = null;
  for (const request of pending.values()) {
    clearTimeout(request.timeoutId);
    request.reject(new Error('Pyodide worker disposed'));
  }
  pending.clear();
}

export function runPythonInPyodide({ code, datasets = {}, packages = [], timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!code || typeof code !== 'string') return Promise.reject(new Error('Pyodide requires Python code.'));
  if (!isPyodideAvailable()) return Promise.reject(new Error('Pyodide is only available in a browser context.'));

  if (!worker) worker = createWorker();
  const id = `pyodide-${Date.now()}-${requestId += 1}`;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pending.delete(id);
      disposePyodideWorker();
      reject(new Error(`Pyodide execution timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    pending.set(id, { resolve, reject, logs: [], timeoutId });
    worker.postMessage({ id, type: 'run', code, datasets, packages });
  });
}
