import { describe, it, expect, vi } from 'vitest';
import { useExecutionStore } from '../../store/useExecutionStore.js';

function resetExecutionStore() {
  useExecutionStore.setState({ nodes: {}, edges: [] });
}

describe('useExecutionStore', () => {
  describe('Store Structure', () => {
    it('should have a Zustand store interface', () => {
      resetExecutionStore();
      const store = useExecutionStore;
      expect(store.getState).toBeDefined();
      expect(store.setState).toBeDefined();
      expect(store.subscribe).toBeDefined();
    });

    it('should initialize with required properties', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();
      expect(state).toHaveProperty('nodes');
      expect(state).toHaveProperty('edges');
      expect(state).toHaveProperty('setExecutionGraph');
      expect(state).toHaveProperty('clearExecutionGraph');
      expect(typeof state.nodes).toBe('object');
      expect(Array.isArray(state.edges)).toBe(true);
    });

    it('should have node management methods', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();
      expect(typeof state.addExecutionNode).toBe('function');
      expect(typeof state.removeExecutionNode).toBe('function');
      expect(typeof state.updateNodeConfig).toBe('function');
      expect(typeof state.updateExecutionNode).toBe('function');
    });

    it('should have edge management methods', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();
      expect(typeof state.addExecutionEdge).toBe('function');
      expect(typeof state.removeExecutionEdge).toBe('function');
      expect(typeof state.validateConnection).toBe('function');
      expect(typeof state.canConnect).toBe('function');
    });
  });

  describe('Store Methods', () => {
    it('should be callable without errors', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();
      
      expect(() => {
        state.addExecutionNode('test-node', { type: 'dataset.csv' });
      }).not.toThrow();
    });

    it('should handle setState operations', () => {
      resetExecutionStore();
      expect(() => {
        useExecutionStore.setState({ nodes: {}, edges: [] });
      }).not.toThrow();
    });

    it('hydrates and clears execution graph using helper actions', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();

      state.setExecutionGraph({
        nodes: {
          a: { type: 'dataset.csv', outputs: ['features'] },
        },
        edges: [{ source: 'a', target: 'b' }],
      });

      let hydrated = useExecutionStore.getState();
      expect(hydrated.nodes.a.type).toBe('dataset.csv');
      expect(hydrated.edges).toHaveLength(1);

      hydrated.clearExecutionGraph();
      hydrated = useExecutionStore.getState();
      expect(hydrated.nodes).toEqual({});
      expect(hydrated.edges).toEqual([]);
    });

    it('returns detailed diagnostics for mismatched handles', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();

      state.addExecutionNode('src', {
        type: 'dataset.csv',
        outputs: [{ name: 'features', datatype: 'tensor' }],
      });
      state.addExecutionNode('tgt', {
        type: 'lifecycle.batch_loader',
        inputs: [{ name: 'dataset', datatype: 'any' }],
      });

      const result = state.validateConnection('src', 'tgt', 'features', 'batches');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PORT_NOT_FOUND');
      expect(state.canConnect('src', 'tgt', 'features', 'batches')).toBe(false);
    });

    it('accepts canonical batch loader input handle', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();

      state.addExecutionNode('src', {
        type: 'dataset.csv',
        outputs: [{ name: 'features', datatype: 'tensor' }],
      });
      state.addExecutionNode('tgt', {
        type: 'lifecycle.batch_loader',
        inputs: [{ name: 'dataset', datatype: 'any' }],
      });

      const result = state.validateConnection('src', 'tgt', 'features', 'dataset');
      expect(result.ok).toBe(true);
      expect(state.canConnect('src', 'tgt', 'features', 'dataset')).toBe(true);
    });

    it('returns capability mismatch diagnostics', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();

      state.addExecutionNode('src', {
        type: 'dataset.csv',
        outputs: [{ name: 'features', datatype: 'tensor' }],
        produces: ['tabular'],
      });
      state.addExecutionNode('tgt', {
        type: 'dataset.image',
        inputs: [{ name: 'images', datatype: 'tensor' }],
        accepts: ['image'],
      });

      const result = state.validateConnection('src', 'tgt');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('CAPABILITY_MISMATCH');
      expect(result.details.suggestedFix).toMatch(/adapter/i);
    });

    it('accepts compatible typed connections', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();

      state.addExecutionNode('src', {
        type: 'dataset.csv',
        outputs: [{ name: 'features', datatype: 'tensor' }],
      });
      state.addExecutionNode('tgt', {
        type: 'transform.core.map',
        inputs: [{ name: 'in', datatype: 'any' }],
      });

      const result = state.validateConnection('src', 'tgt', 'features', 'in');
      expect(result.ok).toBe(true);
      expect(state.canConnect('src', 'tgt', 'features', 'in')).toBe(true);
    });

    it('canConnect is side-effect free for rejected connections', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      state.addExecutionNode('src', {
        type: 'dataset.csv',
        outputs: [{ name: 'features', datatype: 'tensor' }],
      });
      state.addExecutionNode('tgt', {
        type: 'lifecycle.batch_loader',
        inputs: [{ name: 'dataset', datatype: 'any' }],
      });

      expect(state.canConnect('src', 'tgt', 'features', 'batches')).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
