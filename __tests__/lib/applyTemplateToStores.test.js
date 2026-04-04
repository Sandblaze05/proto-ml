import { describe, it, expect, vi } from 'vitest';
import { applyTemplateGraphToStores } from '../../lib/templates/applyTemplateToStores.js';

describe('applyTemplateToStores', () => {
  it('applies template graph to both UI and execution stores', () => {
    const uiStore = {
      saveToHistory: vi.fn(),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
    };

    const executionStore = {
      setExecutionGraph: vi.fn(),
    };

    const payload = applyTemplateGraphToStores({
      graph: {
        nodes: [
          { id: 'd1', type: 'dataset.csv', config: { path: '/data.csv' } },
          { id: 't1', type: 'transform.core.map', config: { operation: 'identity' } },
        ],
        edges: [
          { source: 'd1', target: 't1', sourceHandle: 'features', targetHandle: 'in' },
        ],
      },
      uiStore,
      executionStore,
      options: { idPrefix: 'demo' },
    });

    expect(payload.uiNodes).toHaveLength(2);
    expect(payload.uiEdges).toHaveLength(1);

    expect(uiStore.saveToHistory).toHaveBeenCalledTimes(1);
    expect(uiStore.setNodes).toHaveBeenCalledWith(payload.uiNodes);
    expect(uiStore.setEdges).toHaveBeenCalledWith(payload.uiEdges);

    expect(executionStore.setExecutionGraph).toHaveBeenCalledWith({
      nodes: payload.executionNodesById,
      edges: [
        {
          source: 'demo-d1',
          target: 'demo-t1',
          sourceHandle: 'features',
          targetHandle: 'in',
        },
      ],
    });
  });

  it('throws clear errors when stores do not implement required methods', () => {
    expect(() => {
      applyTemplateGraphToStores({
        graph: { nodes: [], edges: [] },
        uiStore: { setNodes: () => {} },
        executionStore: { setExecutionGraph: () => {} },
      });
    }).toThrow(/uiStore/i);

    expect(() => {
      applyTemplateGraphToStores({
        graph: { nodes: [], edges: [] },
        uiStore: { setNodes: () => {}, setEdges: () => {} },
        executionStore: {},
      });
    }).toThrow(/executionStore/i);
  });
});
