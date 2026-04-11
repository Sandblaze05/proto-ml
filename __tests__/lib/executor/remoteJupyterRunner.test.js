import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const RemoteJupyterRunner = require('../../../lib/executor/remoteJupyterRunner.js');

describe('RemoteJupyterRunner', () => {
  it('submits job and resolves lifecycle status/result', async () => {
    const runner = new RemoteJupyterRunner({ queuedMs: 0, runMs: 0 });

    const submitted = await runner.submitCode('print("hello")', {
      provider: 'colab',
      kernel: 'python3',
      metadata: { test: true },
    });

    expect(submitted.jobId).toBeTruthy();
    expect(submitted.status).toBe('queued');

    const status = await runner.checkStatus(submitted.jobId);
    expect(['queued', 'running', 'succeeded']).toContain(status.status);

    const result = await runner.fetchResult(submitted.jobId);
    expect(result.jobId).toBe(submitted.jobId);
    expect(result.status).toBe('succeeded');
    expect(result.output).toBeTruthy();
  });

  it('cancels an active job', async () => {
    const runner = new RemoteJupyterRunner({ queuedMs: 5000, runMs: 5000 });
    const submitted = await runner.submitCode('print("cancel")');

    const cancelled = await runner.cancelJob(submitted.jobId);
    expect(cancelled.status).toBe('cancelled');

    const status = await runner.checkStatus(submitted.jobId);
    expect(status.status).toBe('cancelled');
  });

  it('stores structured topological run result as final status', async () => {
    const runner = new RemoteJupyterRunner();
    const structured = await runner.submitStructuredResult(
      {
        summary: 'Topological pipeline run completed successfully.',
        execution: {
          ok: true,
          order: ['d1', 't1'],
          nodeStatuses: {
            d1: { status: 'succeeded' },
            t1: { status: 'succeeded' },
          },
        },
      },
      {
        provider: 'local',
        kernel: 'topological',
        status: 'succeeded',
      },
    );

    expect(structured.status).toBe('succeeded');
    const status = await runner.checkStatus(structured.jobId);
    expect(status.status).toBe('succeeded');

    const result = await runner.fetchResult(structured.jobId);
    expect(result.status).toBe('succeeded');
    expect(result.output.execution.order).toEqual(['d1', 't1']);
  });
});
