import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../store/useUIStore.js';

function resetUIStore() {
  useUIStore.setState({
    nodes: [],
    edges: [],
    nodeExecutionState: {},
    jupyterSession: { url: 'http://localhost:8888', token: '', kernelId: null }
  });
}

describe('useUIStore', () => {
  beforeEach(() => {
    resetUIStore();
  });

  describe('nodeExecutionState', () => {
    it('initializes with empty execution state', () => {
      const state = useUIStore.getState();
      expect(state.nodeExecutionState).toEqual({});
    });

    it('sets and updates execution state for a specific node', () => {
      // 1. Initial set
      useUIStore.getState().setNodeExecutionState('node1', { status: 'running' });
      let state = useUIStore.getState();
      expect(state.nodeExecutionState['node1']).toMatchObject({ status: 'running', logs: [], error: null });

      // 2. Patch update
      useUIStore.getState().setNodeExecutionState('node1', { 
        status: 'success', 
        logs: [{ type: 'stdout', text: 'Output' }] 
      });
      state = useUIStore.getState();
      expect(state.nodeExecutionState['node1'].status).toBe('success');
      expect(state.nodeExecutionState['node1'].logs).toHaveLength(1);
    });

    it('updates multiple different nodes without colliding', () => {
      useUIStore.getState().setNodeExecutionState('nodeA', { status: 'running' });
      useUIStore.getState().setNodeExecutionState('nodeB', { status: 'idle' });
      
      const state = useUIStore.getState();
      expect(state.nodeExecutionState['nodeA'].status).toBe('running');
      expect(state.nodeExecutionState['nodeB'].status).toBe('idle');
    });

    it('clears all node execution states', () => {
      useUIStore.getState().setNodeExecutionState('nodeA', { status: 'running' });
      useUIStore.getState().setNodeExecutionState('nodeB', { status: 'idle' });
      
      let state = useUIStore.getState();
      expect(Object.keys(state.nodeExecutionState).length).toBe(2);

      useUIStore.getState().clearNodeExecutionStates();
      
      state = useUIStore.getState();
      expect(state.nodeExecutionState).toEqual({});
    });
  });

  describe('jupyterSession', () => {
    it('initializes with default values', () => {
      const state = useUIStore.getState();
      expect(state.jupyterSession).toEqual({
        url: 'http://localhost:8888',
        token: '',
        kernelId: null
      });
    });

    it('partially updates jupyterSession settings', () => {
      useUIStore.getState().setJupyterSession({ url: 'https://remote.jupyter' });
      
      let state = useUIStore.getState();
      expect(state.jupyterSession.url).toBe('https://remote.jupyter');
      expect(state.jupyterSession.token).toBe(''); // unchanged
      expect(state.jupyterSession.kernelId).toBe(null); // unchanged

      useUIStore.getState().setJupyterSession({ kernelId: 'abcd-1234' });
      state = useUIStore.getState();
      expect(state.jupyterSession.kernelId).toBe('abcd-1234');
    });
  });
});
