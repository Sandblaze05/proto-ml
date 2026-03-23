class RemoteJupyterRunner {
  constructor(options = {}) {
    this.options = options;
  }

  // Submit a notebook (string) to a remote provider (kaggle/colab) and return a job id.
  // This is a scaffold — provider-specific implementations should be added.
  async submitNotebook(notebookSource, { provider = 'colab', kernel = 'python3', metadata = {} } = {}) {
    // TODO: implement provider integration (Colab/Kaggle APIs, auth, upload)
    // For now, return a fake job id to allow wiring in the executor.
    return `remote-job-${Date.now()}`;
  }

  // Check job status for a submitted job id.
  async checkStatus(jobId) {
    // TODO: poll provider API for real status
    return { jobId, status: 'unknown' };
  }

  // Fetch result or logs for a completed job.
  async fetchResult(jobId) {
    // TODO: download artifacts / notebook outputs
    return { jobId, output: null };
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
