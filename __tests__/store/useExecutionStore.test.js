import { describe, it, expect, vi } from 'vitest';
import { useExecutionStore } from '../../store/useExecutionStore.js';

function resetExecutionStore() {
  useExecutionStore.setState({
    nodes: {},
    edges: [],
    executionRuntime: {
      mode: 'pipeline_topological',
      failurePolicy: 'fail-fast',
    },
    executionLock: {
      isLocked: false,
      lockedBy: null,
      runId: null,
      acquiredAt: null,
    },
    activeRunId: null,
    runs: {},
    nodeStatuses: {},
  });
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
      expect(state).toHaveProperty('executionRuntime');
      expect(state).toHaveProperty('executionLock');
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
      expect(typeof state.configureExecutionRuntime).toBe('function');
      expect(typeof state.acquireExecutionLock).toBe('function');
      expect(typeof state.releaseExecutionLock).toBe('function');
      expect(typeof state.beginRun).toBe('function');
      expect(typeof state.markNodeStatus).toBe('function');
      expect(typeof state.completeRun).toBe('function');
      expect(typeof state.failRun).toBe('function');
      expect(typeof state.applyOneOffWriteBack).toBe('function');
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

    it('tracks run lifecycle and node statuses for fail-fast orchestration', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();

      state.beginRun({ runId: 'run-1', mode: 'pipeline_topological', failurePolicy: 'fail-fast' });
      state.markNodeStatus({ runId: 'run-1', nodeId: 'd1', status: 'running' });
      state.markNodeStatus({ runId: 'run-1', nodeId: 'd1', status: 'succeeded' });
      state.markNodeStatus({ runId: 'run-1', nodeId: 't1', status: 'failed', error: 'boom' });
      state.failRun({ runId: 'run-1', failedNodeId: 't1', error: 'boom' });

      const next = useExecutionStore.getState();
      expect(next.activeRunId).toBeNull();
      expect(next.runs['run-1'].status).toBe('failed');
      expect(next.runs['run-1'].failedNodeId).toBe('t1');
      expect(next.nodeStatuses['run-1'].d1.status).toBe('succeeded');
      expect(next.nodeStatuses['run-1'].t1.status).toBe('failed');
    });

    it('enforces execution lock and supports one-off write-back', () => {
      resetExecutionStore();
      const state = useExecutionStore.getState();

      state.addExecutionNode('n1', { type: 'transform.core.map', config: {} });
      const lock = state.acquireExecutionLock({ lockedBy: 'pipeline', runId: 'run-2' });
      expect(lock.ok).toBe(true);

      const secondLock = useExecutionStore.getState().acquireExecutionLock({ lockedBy: 'one_off', runId: 'run-3' });
      expect(secondLock.ok).toBe(false);

      const release = useExecutionStore.getState().releaseExecutionLock({ runId: 'run-2' });
      expect(release.ok).toBe(true);

      const writeBack = useExecutionStore.getState().applyOneOffWriteBack({
        nodeId: 'n1',
        output: { rows: [{ a: 1 }] },
        metadata: { mode: 'one_off_compile' },
      });

      expect(writeBack.ok).toBe(true);
      const next = useExecutionStore.getState();
      expect(next.nodes.n1.lastOutput).toEqual({ rows: [{ a: 1 }] });
      expect(next.nodes.n1.outputProvenance.source).toBe('one_off');
    });
  });
});
