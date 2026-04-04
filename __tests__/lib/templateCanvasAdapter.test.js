import { describe, it, expect } from 'vitest';
import { buildCanvasPayloadFromTemplateGraph } from '../../lib/templates/templateCanvasAdapter.js';

describe('templateCanvasAdapter', () => {
  it('builds UI and execution payloads from template graph', () => {
    const graph = {
      nodes: [
        {
          id: 'dataset1',
          type: 'dataset.csv',
          config: { path: '/data/train.csv' },
        },
        {
          id: 'map1',
          type: 'transform.core.map',
          config: { operation: 'drop_columns', columns: ['id'] },
        },
      ],
      edges: [
        {
          source: 'dataset1',
          target: 'map1',
          sourceHandle: 'features',
          targetHandle: 'in',
        },
      ],
    };

    const payload = buildCanvasPayloadFromTemplateGraph(graph, { idPrefix: 'demo' });

    expect(payload.uiNodes).toHaveLength(2);
    expect(payload.uiEdges).toHaveLength(1);

    const datasetNode = payload.uiNodes.find((node) => node.id === 'demo-dataset1');
    const mapNode = payload.uiNodes.find((node) => node.id === 'demo-map1');

    expect(datasetNode?.type).toBe('datasetNode');
    expect(mapNode?.type).toBe('transformNode');

    expect(payload.executionNodesById['demo-dataset1'].type).toBe('dataset.csv');
    expect(payload.executionNodesById['demo-map1'].config.operation).toBe('drop_columns');

    expect(payload.uiEdges[0].source).toBe('demo-dataset1');
    expect(payload.uiEdges[0].target).toBe('demo-map1');
    expect(payload.warnings).toEqual([]);
  });

  it('adds warnings for unknown node types and unresolved edges', () => {
    const graph = {
      nodes: [
        { id: 'a', type: 'custom.unknown', config: { x: 1 } },
      ],
      edges: [
        { source: 'a', target: 'missing' },
      ],
    };

    const payload = buildCanvasPayloadFromTemplateGraph(graph, { preserveIds: true });

    expect(payload.uiNodes).toHaveLength(1);
    expect(payload.uiEdges).toHaveLength(0);
    expect(payload.warnings.join(' ')).toMatch(/unknown node type|unresolved node reference/i);
  });

  it('preserves ids when configured', () => {
    const graph = {
      nodes: [
        { id: 'raw-node', type: 'dataset.json', config: {} },
      ],
      edges: [],
    };

    const payload = buildCanvasPayloadFromTemplateGraph(graph, { preserveIds: true });

    expect(payload.uiNodes[0].id).toBe('raw-node');
    expect(payload.idMap['raw-node']).toBe('raw-node');
  });
});
