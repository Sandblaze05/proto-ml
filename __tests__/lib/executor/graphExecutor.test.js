import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const GraphExecutor = require('../../../lib/executor/graphExecutor.js');
const runtimeFactories = require('../../../lib/runtimeFactories');

describe('GraphExecutor preview', () => {
  const createExecutorWithDatasetMock = (datasetType, getSampleImpl) => new GraphExecutor({
    get: (nodeType) => {
      if (nodeType === datasetType) {
        return () => ({ getSample: getSampleImpl });
      }
      return runtimeFactories.get(nodeType);
    },
  });

  it('returns RuntimeNotImplemented when no runtime factory exists', async () => {
    const executor = new GraphExecutor({});
    const graph = {
      nodes: [{ id: 'n1', type: 'dataset.csv', config: {} }],
      edges: [],
    };

    const result = await executor.preview(graph, 'n1', 3);

    expect(result).toMatchObject({
      type: 'RuntimeNotImplemented',
      details: { nodeId: 'n1', nodeType: 'dataset.csv' },
    });
  });

  it('returns runtime sample when runtime getSample exists', async () => {
    const getSample = vi.fn().mockResolvedValue([{ row: 1 }]);
    const executor = createExecutorWithDatasetMock('dataset.csv', getSample);
    const graph = {
      nodes: [{ id: 'n1', type: 'dataset.csv', config: {} }],
      edges: [],
    };

    const result = await executor.preview(graph, 'n1', 5);

    expect(getSample).toHaveBeenCalledWith(5, expect.any(Object));
    expect(result).toEqual([{ row: 1 }]);
  });

  it('returns TargetNodeNotFound for unknown target id', async () => {
    const executor = new GraphExecutor({});
    const graph = {
      nodes: [{ id: 'n1', type: 'dataset.csv', config: {} }],
      edges: [],
    };

    const result = await executor.preview(graph, 'missing-node', 2);

    expect(result).toMatchObject({
      type: 'TargetNodeNotFound',
      details: { targetNodeId: 'missing-node' },
    });
  });

  it('executes core map drop_columns operation', async () => {
    const executor = createExecutorWithDatasetMock('dataset.csv', async () => ([
      { age: 30, salary: 1000, city: 'A' },
      { age: 35, salary: 2000, city: 'B' },
    ]));

    const graph = {
      nodes: [
        { id: 'd1', type: 'dataset.csv', config: {} },
        { id: 't1', type: 'transform.core.map', config: { operation: 'drop_columns', columns: ['salary'] } },
      ],
      edges: [{ source: 'd1', target: 't1' }],
    };

    const result = await executor.preview(graph, 't1', 5);

    expect(result).toEqual([
      { age: 30, city: 'A' },
      { age: 35, city: 'B' },
    ]);
  });

  it('executes core join concatenation', async () => {
    const executor = new GraphExecutor({
      get: (nodeType) => {
        if (nodeType === 'dataset.left') return () => ({ getSample: async () => [{ id: 1 }, { id: 2 }] });
        if (nodeType === 'dataset.right') return () => ({ getSample: async () => [{ id: 3 }] });
        return runtimeFactories.get(nodeType);
      },
    });

    const graph = {
      nodes: [
        { id: 'l', type: 'dataset.left', config: {} },
        { id: 'r', type: 'dataset.right', config: {} },
        { id: 'j', type: 'transform.core.join', config: { strategy: 'concat' } },
      ],
      edges: [
        { source: 'l', target: 'j' },
        { source: 'r', target: 'j' },
      ],
    };

    const result = await executor.preview(graph, 'j', 5);
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('executes lifecycle split and returns train/val/test buckets', async () => {
    const executor = createExecutorWithDatasetMock('dataset.csv', async () => ([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]));

    const graph = {
      nodes: [
        { id: 'd1', type: 'dataset.csv', config: {} },
        { id: 's1', type: 'lifecycle.split', config: { train_pct: 60, val_pct: 20, test_pct: 20, shuffle: false } },
      ],
      edges: [{ source: 'd1', target: 's1' }],
    };

    const result = await executor.preview(graph, 's1', 5);

    expect(result.train.length).toBe(3);
    expect(result.val.length).toBe(1);
    expect(result.test.length).toBe(1);
  });

  it('executes lifecycle split deterministically with the same seed', async () => {
    const executor = createExecutorWithDatasetMock('dataset.csv', async () => ([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
      { id: 6 },
    ]));

    const graph = {
      nodes: [
        { id: 'd1', type: 'dataset.csv', config: {} },
        {
          id: 's1',
          type: 'lifecycle.split',
          config: { train_pct: 50, val_pct: 25, test_pct: 25, shuffle: true, seed: 1234 },
        },
      ],
      edges: [{ source: 'd1', target: 's1' }],
    };

    const first = await executor.preview(graph, 's1', 6);
    const second = await executor.preview(graph, 's1', 6);

    expect(first).toEqual(second);
  });

  it('executes primitive model-builder to trainer flow', async () => {
    const executor = createExecutorWithDatasetMock('dataset.csv', async () => ([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]));

    const graph = {
      nodes: [
        { id: 'd1', type: 'dataset.csv', config: {} },
        { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'linear_regression', num_outputs: 1 } },
        { id: 't1', type: 'lifecycle.core.trainer', config: { epochs: 5, learning_rate: 0.01 } },
      ],
      edges: [
        { source: 'd1', target: 'm1' },
        { source: 'm1', target: 't1' },
        { source: 'd1', target: 't1' },
      ],
    };

    const result = await executor.preview(graph, 't1', 3);

    expect(result).toMatchObject({
      trained_model: { trained: true, epochs: 5 },
      metrics: { train_loss: expect.any(Number) },
      logs: { learning_rate: 0.01 },
    });
  });

  it('routes edge payload by sourceHandle deterministically', async () => {
    const executor = new GraphExecutor({
      get: (nodeType) => {
        if (nodeType === 'dataset.left') {
          return () => ({
            getSample: async () => ({
              rows: [{ id: 'wrong' }],
              features: [{ id: 'expected-left' }],
            }),
          });
        }
        if (nodeType === 'dataset.right') {
          return () => ({
            getSample: async () => ({
              rows: [{ id: 'expected-right' }],
            }),
          });
        }
        return runtimeFactories.get(nodeType);
      },
    });

    const graph = {
      nodes: [
        { id: 'l', type: 'dataset.left', config: {} },
        { id: 'r', type: 'dataset.right', config: {} },
        { id: 'j', type: 'transform.core.join', config: { strategy: 'concat' } },
      ],
      edges: [
        { source: 'l', target: 'j', sourceHandle: 'features', targetHandle: 'left' },
        { source: 'r', target: 'j', sourceHandle: 'rows', targetHandle: 'right' },
      ],
    };

    const result = await executor.preview(graph, 'j', 5);
    expect(result).toEqual([{ id: 'expected-left' }, { id: 'expected-right' }]);
  });

  it('executes full graph in topological order with node statuses', async () => {
    const executor = createExecutorWithDatasetMock('dataset.csv', async () => ([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ]));

    const graph = {
      nodes: [
        { id: 'd1', type: 'dataset.csv', config: {} },
        { id: 't1', type: 'transform.core.map', config: { operation: 'identity' } },
        { id: 's1', type: 'lifecycle.split', config: { train_pct: 50, val_pct: 50, test_pct: 0, shuffle: false } },
      ],
      edges: [
        { source: 'd1', target: 't1', sourceHandle: 'out', targetHandle: 'in' },
        { source: 't1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
      ],
    };

    const run = await executor.executeTopological(graph, { failurePolicy: 'fail-fast' });
    expect(run.ok).toBe(true);
    expect(run.status).toBe('succeeded');
    expect(run.order).toEqual(['d1', 't1', 's1']);
    expect(run.nodeStatuses.d1.status).toBe('succeeded');
    expect(run.nodeStatuses.t1.status).toBe('succeeded');
    expect(run.nodeStatuses.s1.status).toBe('succeeded');
  });

  it('stops fail-fast and marks remaining nodes as skipped', async () => {
    const executor = new GraphExecutor({
      get: (nodeType) => {
        if (nodeType === 'dataset.csv') {
          return () => ({ getSample: async () => [{ x: 1 }] });
        }
        if (nodeType === 'transform.core.map') {
          return () => ({ getSample: async () => ({ error: 'forced transform failure', type: 'RuntimeError' }) });
        }
        return runtimeFactories.get(nodeType);
      },
    });

    const graph = {
      nodes: [
        { id: 'd1', type: 'dataset.csv', config: {} },
        { id: 't1', type: 'transform.core.map', config: { operation: 'identity' } },
        { id: 's1', type: 'lifecycle.split', config: { train_pct: 50, val_pct: 50, test_pct: 0, shuffle: false } },
      ],
      edges: [
        { source: 'd1', target: 't1', sourceHandle: 'out', targetHandle: 'in' },
        { source: 't1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
      ],
    };

    const run = await executor.executeTopological(graph, { failurePolicy: 'fail-fast' });
    expect(run.ok).toBe(false);
    expect(run.status).toBe('failed');
    expect(run.failedNodeId).toBe('t1');
    expect(run.nodeStatuses.d1.status).toBe('succeeded');
    expect(run.nodeStatuses.t1.status).toBe('failed');
    expect(run.nodeStatuses.s1.status).toBe('skipped');
  });
});
