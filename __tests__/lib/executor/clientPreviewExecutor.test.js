import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/clientUploadStore', () => ({
  previewClientUpload: vi.fn(async (uploadId, options = {}) => {
    const rowsByUpload = {
      leftUpload: [{ id: 'l1' }, { id: 'l2' }],
      rightUpload: [{ id: 'r1' }],
      mainUpload: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    };

    const rows = rowsByUpload[uploadId] || [];
    const n = Number.isFinite(Number(options.n)) ? Number(options.n) : 5;
    return {
      rows: rows.slice(0, n),
      metadata: {
        rows: rows.length,
        columns: Object.keys(rows[0] || {}).length,
        clientOnly: true,
      },
    };
  }),
  previewClientImageUpload: vi.fn(async (uploadId) => ({
    type: 'image',
    count: uploadId ? 1 : 0,
    files: [{ path: 'img/a.png' }],
    clientOnly: true,
  })),
}));

import { previewGraphClient } from '../../../lib/executor/clientPreviewExecutor';

describe('previewGraphClient', () => {
  it('runs join preview completely on client-side runtimes', async () => {
    const graph = {
      nodes: [
        { id: 'left', type: 'dataset.csv', config: { client_upload_id: 'leftUpload' } },
        { id: 'right', type: 'dataset.csv', config: { client_upload_id: 'rightUpload' } },
        { id: 'join', type: 'transform.core.join', config: { strategy: 'concat' } },
      ],
      edges: [
        { source: 'left', target: 'join', sourceHandle: 'rows', targetHandle: 'left' },
        { source: 'right', target: 'join', sourceHandle: 'rows', targetHandle: 'right' },
      ],
    };

    const result = await previewGraphClient(graph, 'join', 5);
    expect(result).toEqual([{ id: 'l1' }, { id: 'l2' }, { id: 'r1' }]);
  });

  it('returns explicit error when csv preview lacks client upload id', async () => {
    const graph = {
      nodes: [{ id: 'csv1', type: 'dataset.csv', config: { path: './left.csv' } }],
      edges: [],
    };

    const result = await previewGraphClient(graph, 'csv1', 5);
    expect(result).toMatchObject({
      type: 'RuntimeError',
      error: expect.stringContaining('client-only'),
    });
  });

  it('fails join preview when required input edges are missing', async () => {
    const graph = {
      nodes: [
        { id: 'left', type: 'dataset.csv', config: { client_upload_id: 'leftUpload' } },
        { id: 'join', type: 'transform.core.join', config: { strategy: 'concat' } },
      ],
      edges: [
        { source: 'left', target: 'join', sourceHandle: 'rows', targetHandle: 'left' },
      ],
    };

    const result = await previewGraphClient(graph, 'join', 5);
    expect(result).toMatchObject({
      type: 'ValidationError',
      error: expect.stringContaining('Missing required input edges'),
      details: {
        nodeType: 'transform.core.join',
      },
    });
    expect(Array.isArray(result?.details?.missingInputs)).toBe(true);
    expect(result.details.missingInputs).toEqual(expect.arrayContaining(['right']));
  });

  it('fails preview when a non-dataset node has no incoming edges', async () => {
    const graph = {
      nodes: [{ id: 'map1', type: 'transform.core.map', config: { operation: 'identity' } }],
      edges: [],
    };

    const result = await previewGraphClient(graph, 'map1', 5);
    expect(result).toMatchObject({
      type: 'ValidationError',
      error: expect.stringContaining('No incoming edge connected'),
      details: {
        nodeType: 'transform.core.map',
      },
    });
  });

  it('fails preview for optional-input lifecycle node when no edges exist', async () => {
    const graph = {
      nodes: [{ id: 'mb1', type: 'lifecycle.core.model_builder', config: { family: 'linear_regression' } }],
      edges: [],
    };

    const result = await previewGraphClient(graph, 'mb1', 5);
    expect(result).toMatchObject({
      type: 'ValidationError',
      error: expect.stringContaining('No incoming edge connected'),
      details: {
        nodeType: 'lifecycle.core.model_builder',
      },
    });
  });

  it('supports lifecycle preview chaining from client dataset rows', async () => {
    const graph = {
      nodes: [
        { id: 'csv1', type: 'dataset.csv', config: { client_upload_id: 'mainUpload' } },
        { id: 'split', type: 'lifecycle.split', config: { train_pct: 50, val_pct: 25, test_pct: 25, shuffle: false } },
      ],
      edges: [{ source: 'csv1', target: 'split', sourceHandle: 'rows', targetHandle: 'dataset' }],
    };

    const result = await previewGraphClient(graph, 'split', 10);
    expect(result.train.length).toBe(2);
    expect(result.val.length).toBe(1);
    expect(result.test.length).toBe(1);
  });
});
