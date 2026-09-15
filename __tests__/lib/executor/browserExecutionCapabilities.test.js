import { describe, expect, it } from 'vitest';
import {
  BROWSER_EXECUTION,
  getBrowserNodeCapability,
  resolveBrowserPreviewCapability,
} from '../../../lib/executor/browserExecutionCapabilities.js';

describe('browser execution capabilities', () => {
  it('allows uploaded data through pure transforms', () => {
    const result = resolveBrowserPreviewCapability({
      nodes: [
        { id: 'data', type: 'dataset.csv', config: { client_upload_id: 'upload-1' } },
        { id: 'map', type: 'transform.core.map', config: { operation: 'drop_columns', columns: ['secret'] } },
      ],
      edges: [{ source: 'data', target: 'map' }],
    }, 'map');

    expect(result.location).toBe(BROWSER_EXECUTION.BROWSER);
    expect(result.blockers).toEqual([]);
  });

  it('recognizes canvas client upload aliases', () => {
    expect(getBrowserNodeCapability({
      type: 'dataset.csv',
      config: { uploadId: 'upload-1', path: 'client://upload-1' },
    })).toMatchObject({
      location: BROWSER_EXECUTION.BROWSER,
      reason: 'uploaded_dataset',
    });
  });

  it('reports backend data access as an explainable blocker', () => {
    const result = resolveBrowserPreviewCapability({
      nodes: [{ id: 'data', type: 'dataset.database', config: {} }],
      edges: [],
    }, 'data');

    expect(result).toMatchObject({
      location: BROWSER_EXECUTION.BACKEND,
      reason: 'graph_contains_backend_nodes',
      blockers: [{ reason: 'dataset_requires_backend_access', nodeType: 'dataset.database' }],
    });
  });

  it('keeps lifecycle and custom expression nodes backend-bound', () => {
    expect(getBrowserNodeCapability({
      type: 'lifecycle.split',
      config: {},
    })).toMatchObject({
      location: BROWSER_EXECUTION.BACKEND,
      reason: 'node_requires_python_runtime',
    });
    expect(getBrowserNodeCapability({
      type: 'transform.core.map',
      config: { operation: 'custom' },
    })).toMatchObject({
      location: BROWSER_EXECUTION.BACKEND,
      reason: 'custom_expression_requires_backend',
    });
  });

  it('keeps credentialed API access backend-bound', () => {
    expect(getBrowserNodeCapability({
      type: 'dataset.api',
      config: { url: 'https://example.test/data', auth_type: 'bearer', auth_token: 'secret' },
    })).toMatchObject({
      location: BROWSER_EXECUTION.BACKEND,
      reason: 'credentialed_api_requires_backend_access',
    });
  });

  it('only evaluates the target upstream slice', () => {
    const result = resolveBrowserPreviewCapability({
      nodes: [
        { id: 'data', type: 'dataset.csv', config: { client_upload_id: 'upload-1' } },
        { id: 'map', type: 'transform.core.map', config: {} },
        { id: 'unrelated', type: 'dataset.database', config: {} },
      ],
      edges: [{ source: 'data', target: 'map' }],
    }, 'map');

    expect(result.location).toBe(BROWSER_EXECUTION.BROWSER);
    expect(result.nodes.map((node) => node.nodeId)).not.toContain('unrelated');
  });
});