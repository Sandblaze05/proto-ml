import { describe, it, expect } from 'vitest';
import { useExecutionStore } from '../../store/useExecutionStore.js';

describe('useExecutionStore', () => {
  describe('Store Structure', () => {
    it('should have a Zustand store interface', () => {
      const store = useExecutionStore;
      expect(store.getState).toBeDefined();
      expect(store.setState).toBeDefined();
      expect(store.subscribe).toBeDefined();
    });

    it('should initialize with required properties', () => {
      const state = useExecutionStore.getState();
      expect(state).toHaveProperty('nodes');
      expect(state).toHaveProperty('edges');
      expect(typeof state.nodes).toBe('object');
      expect(Array.isArray(state.edges)).toBe(true);
    });

    it('should have node management methods', () => {
      const state = useExecutionStore.getState();
      expect(typeof state.addExecutionNode).toBe('function');
      expect(typeof state.removeExecutionNode).toBe('function');
      expect(typeof state.updateNodeConfig).toBe('function');
      expect(typeof state.updateExecutionNode).toBe('function');
    });

    it('should have edge management methods', () => {
      const state = useExecutionStore.getState();
      expect(typeof state.addExecutionEdge).toBe('function');
      expect(typeof state.removeExecutionEdge).toBe('function');
    });
  });

  describe('Store Methods', () => {
    it('should be callable without errors', () => {
      const state = useExecutionStore.getState();
      
      expect(() => {
        state.addExecutionNode('test-node', { type: 'dataset.csv' });
      }).not.toThrow();
    });

    it('should handle setState operations', () => {
      expect(() => {
        useExecutionStore.setState({ nodes: {}, edges: [] });
      }).not.toThrow();
    });
  });
});
