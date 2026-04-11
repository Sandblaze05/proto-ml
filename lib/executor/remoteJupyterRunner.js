class RemoteJupyterRunner {
  constructor(options = {}) {
    this.options = options;
  }

  static jobs = new Map();

  static FINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

  _makeJobId() {
    return `remote-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _withTiming(job) {
    const startedAt = job.startedAt || job.createdAt;
    const now = Date.now();
    return {
      ...job,
      elapsedMs: Math.max(0, now - startedAt),
      updatedAt: now,
    };
  }

  _resolveStatus(job) {
    if (!job) return null;
    if (RemoteJupyterRunner.FINAL_STATUSES.has(job.status)) return job;

    const now = Date.now();
    const queuedMs = this.options.queuedMs ?? 250;
    const runMs = this.options.runMs ?? 1000;
    const age = now - job.createdAt;

    if (age < queuedMs) return this._withTiming({ ...job, status: 'queued' });
    if (age < queuedMs + runMs) return this._withTiming({ ...job, status: 'running', startedAt: job.startedAt || now });

    return this._withTiming({
      ...job,
      status: 'succeeded',
      completedAt: job.completedAt || now,
      result: job.result || {
        summary: 'Execution finished in simulated runner.',
        artifacts: [],
        metrics: {},
      },
    });
  }

  _upsertResolved(job) {
    const resolved = this._resolveStatus(job);
    if (resolved) {
      RemoteJupyterRunner.jobs.set(resolved.jobId, resolved);
    }
    return resolved;
  }

  async submitCode(pythonCode, { provider = 'colab', kernel = 'python3', metadata = {} } = {}) {
    const jobId = this._makeJobId();
    const now = Date.now();

    const job = {
      jobId,
      status: 'queued',
      provider,
      kernel,
      metadata,
      codeSize: typeof pythonCode === 'string' ? pythonCode.length : 0,
      createdAt: now,
      updatedAt: now,
      logs: ['Job submitted to remote runner.'],
      result: null,
    };

    RemoteJupyterRunner.jobs.set(jobId, job);
    return this._withTiming(job);
  }

  async submitStructuredResult(result, { provider = 'local', kernel = 'topological', metadata = {}, status = 'succeeded' } = {}) {
    const jobId = this._makeJobId();
    const now = Date.now();
    const normalizedStatus = status === 'failed' ? 'failed' : 'succeeded';

    const job = {
      jobId,
      status: normalizedStatus,
      provider,
      kernel,
      metadata,
      codeSize: 0,
      createdAt: now,
      startedAt: now,
      completedAt: now,
      updatedAt: now,
      logs: [
        `Structured run persisted with status: ${normalizedStatus}.`,
      ],
      result,
    };

    RemoteJupyterRunner.jobs.set(jobId, job);
    return this._withTiming(job);
  }

  // Submit a notebook (string) to a remote provider (kaggle/colab) and return a job id.
  // This is a scaffold — provider-specific implementations should be added.
  async submitNotebook(notebookSource, { provider = 'colab', kernel = 'python3', metadata = {} } = {}) {
    return this.submitCode(JSON.stringify(notebookSource || {}), { provider, kernel, metadata });
  }

  // Check job status for a submitted job id.
  async checkStatus(jobId) {
    const job = RemoteJupyterRunner.jobs.get(jobId);
    if (!job) return { jobId, status: 'not_found' };
    return this._upsertResolved(job);
  }

  // Fetch result or logs for a completed job.
  async fetchResult(jobId) {
    const status = await this.checkStatus(jobId);
    if (!status || status.status === 'not_found') return { jobId, status: 'not_found' };
    if (!RemoteJupyterRunner.FINAL_STATUSES.has(status.status)) {
      return {
        jobId,
        status: status.status,
        output: null,
        message: 'Job is not complete yet.',
      };
    }

    return {
      jobId,
      status: status.status,
      output: status.result,
      logs: status.logs || [],
      metadata: status.metadata || {},
      completedAt: status.completedAt || null,
    };
  }

  async cancelJob(jobId) {
    const job = RemoteJupyterRunner.jobs.get(jobId);
    if (!job) return { jobId, status: 'not_found' };
    if (RemoteJupyterRunner.FINAL_STATUSES.has(job.status)) {
      return this._withTiming(job);
    }

    const cancelled = this._withTiming({
      ...job,
      status: 'cancelled',
      cancelledAt: Date.now(),
      logs: [...(job.logs || []), 'Job cancelled by user.'],
    });
    RemoteJupyterRunner.jobs.set(jobId, cancelled);
    return cancelled;
  }

  // Helper: transform a graph and target node into a small runnable notebook snippet
  buildPreviewNotebook(graph, targetNodeId, sampleCount = 5) {
    // Minimal notebook that imports JSON and prints a preview placeholder.
    const nb = {
      cells: [
        {
          cell_type: 'code',
          metadata: { language: 'python' },
          source: [
            "# Auto-generated preview notebook\n",
            "print('Preview for node', '" + String(targetNodeId) + "')\n",
            "print('This notebook should be replaced with a real executor.')\n",
          ],
        },
      ],
    };
    return nb;
  }
}

module.exports = RemoteJupyterRunner;
