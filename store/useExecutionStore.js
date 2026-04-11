import { create } from 'zustand';
import { getOutputPort, getInputPort, arePortsCompatible, inferPortRole, getNodeDef } from '../nodes/nodeRegistry';

function connectionResult(ok, code, message, details = {}) {
  return { ok, code, message, details };
}

function nowIso() {
  return new Date().toISOString();
}

export const useExecutionStore = create((set, get) => ({
  // Dictionary of node_id → full execution node model
  nodes: {},
  // List of edges { source, target, sourceHandle, targetHandle }
  edges: [],
  // Runtime execution contract defaults.
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

  setExecutionGraph: ({ nodes = {}, edges = [] } = {}) => {
    set({
      nodes: nodes && typeof nodes === 'object' ? nodes : {},
      edges: Array.isArray(edges) ? edges : [],
    });
  },

  clearExecutionGraph: () => {
    set({ nodes: {}, edges: [] });
  },

  configureExecutionRuntime: ({ mode, failurePolicy } = {}) => {
    set((state) => ({
      executionRuntime: {
        mode: mode === 'one_off_compile' ? 'one_off_compile' : (mode === 'pipeline_topological' ? 'pipeline_topological' : state.executionRuntime.mode),
        failurePolicy: failurePolicy === 'fail-fast' ? 'fail-fast' : state.executionRuntime.failurePolicy,
      },
    }));
  },

  acquireExecutionLock: ({ lockedBy = 'pipeline', runId = null } = {}) => {
    const state = get();
    if (state.executionLock.isLocked) {
      return {
        ok: false,
        reason: 'LOCKED',
        lock: state.executionLock,
      };
    }

    const nextLock = {
      isLocked: true,
      lockedBy,
      runId,
      acquiredAt: nowIso(),
    };
    set({ executionLock: nextLock });
    return { ok: true, lock: nextLock };
  },

  releaseExecutionLock: ({ runId = null } = {}) => {
    const state = get();
    if (!state.executionLock.isLocked) {
      return { ok: true, lock: state.executionLock };
    }

    if (runId && state.executionLock.runId && state.executionLock.runId !== runId) {
      return {
        ok: false,
        reason: 'RUN_MISMATCH',
        lock: state.executionLock,
      };
    }

    const nextLock = {
      isLocked: false,
      lockedBy: null,
      runId: null,
      acquiredAt: null,
    };
    set({ executionLock: nextLock });
    return { ok: true, lock: nextLock };
  },

  beginRun: ({ runId, mode, failurePolicy } = {}) => {
    if (!runId) {
      return { ok: false, reason: 'MISSING_RUN_ID' };
    }

    const state = get();
    const existingStatuses = state.nodeStatuses?.[runId] || {};
    const runRecord = {
      runId,
      mode: mode || state.executionRuntime.mode,
      failurePolicy: failurePolicy || state.executionRuntime.failurePolicy,
      status: 'running',
      startedAt: nowIso(),
      completedAt: null,
      failedNodeId: null,
      error: null,
    };

    set({
      activeRunId: runId,
      runs: {
        ...state.runs,
        [runId]: runRecord,
      },
      nodeStatuses: {
        ...state.nodeStatuses,
        [runId]: existingStatuses,
      },
    });

    return { ok: true, run: runRecord };
  },

  markNodeStatus: ({ runId, nodeId, status, error = null } = {}) => {
    if (!runId || !nodeId || !status) {
      return { ok: false, reason: 'MISSING_FIELDS' };
    }

    const allowed = new Set(['pending', 'running', 'succeeded', 'failed', 'skipped']);
    if (!allowed.has(status)) {
      return { ok: false, reason: 'INVALID_STATUS' };
    }

    const state = get();
    const byRun = state.nodeStatuses?.[runId] || {};
    const prev = byRun[nodeId] || {};
    const nextNodeStatus = {
      ...prev,
      status,
      startedAt: status === 'running' ? (prev.startedAt || nowIso()) : (prev.startedAt || null),
      updatedAt: nowIso(),
      completedAt: status === 'succeeded' || status === 'failed' || status === 'skipped' ? nowIso() : null,
      error,
    };

    set({
      nodeStatuses: {
        ...state.nodeStatuses,
        [runId]: {
          ...byRun,
          [nodeId]: nextNodeStatus,
        },
      },
    });

    return { ok: true, nodeStatus: nextNodeStatus };
  },

  completeRun: ({ runId } = {}) => {
    if (!runId) return { ok: false, reason: 'MISSING_RUN_ID' };
    const state = get();
    const run = state.runs?.[runId];
    if (!run) return { ok: false, reason: 'RUN_NOT_FOUND' };

    const nextRun = {
      ...run,
      status: 'succeeded',
      completedAt: nowIso(),
    };

    set({
      runs: {
        ...state.runs,
        [runId]: nextRun,
      },
      activeRunId: state.activeRunId === runId ? null : state.activeRunId,
    });

    return { ok: true, run: nextRun };
  },

  failRun: ({ runId, failedNodeId = null, error = null } = {}) => {
    if (!runId) return { ok: false, reason: 'MISSING_RUN_ID' };
    const state = get();
    const run = state.runs?.[runId];
    if (!run) return { ok: false, reason: 'RUN_NOT_FOUND' };

    const nextRun = {
      ...run,
      status: 'failed',
      failedNodeId,
      error,
      completedAt: nowIso(),
    };

    set({
      runs: {
        ...state.runs,
        [runId]: nextRun,
      },
      activeRunId: state.activeRunId === runId ? null : state.activeRunId,
    });

    return { ok: true, run: nextRun };
  },

  applyOneOffWriteBack: ({ nodeId, output, metadata = {} } = {}) => {
    if (!nodeId) return { ok: false, reason: 'MISSING_NODE_ID' };

    const state = get();
    const node = state.nodes?.[nodeId];
    if (!node) return { ok: false, reason: 'NODE_NOT_FOUND' };

    const writeBack = {
      output,
      source: 'one_off',
      writtenAt: nowIso(),
      metadata,
    };

    const nextNode = {
      ...node,
      lastOutput: output,
      outputProvenance: writeBack,
    };

    set({
      nodes: {
        ...state.nodes,
        [nodeId]: nextNode,
      },
    });

    return { ok: true, node: nextNode };
  },

  // ── Node Actions ──────────────────────────────────────────────────────────

  /**
   * Add a node to the execution graph.
   * nodeData should include: { type, inputs, outputs, config, schema, metadata }
   */
  addExecutionNode: (id, nodeData) => {
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: nodeData,
      },
    }));
  },

  /**
   * Remove a node and its connected edges from the execution graph.
   */
  removeExecutionNode: (id) => {
    set((state) => {
      const newNodes = { ...state.nodes };
      delete newNodes[id];
      return {
        nodes: newNodes,
        edges: state.edges.filter(
          (edge) => edge.source !== id && edge.target !== id
        ),
      };
    });
  },

  /**
   * Patch a node's config — used by the DatasetNode UI when user changes settings.
   * Merges patch into the node's existing config shallowly.
   */
  updateNodeConfig: (id, configPatch) => {
    set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...existing,
            config: {
              ...(existing.config ?? {}),
              ...configPatch,
            },
          },
        },
      };
    });
  },

  /**
   * Update arbitrary fields on a node's execution model (top-level merge).
   */
  updateExecutionNode: (id, patch) => {
    set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...existing, ...patch },
        },
      };
    });
  },

  // ── Edge Actions ──────────────────────────────────────────────────────────

  addExecutionEdge: (edge) => {
    set((state) => ({
      edges: [...state.edges, edge],
    }));
  },

  removeExecutionEdge: (source, target) => {
    set((state) => ({
      edges: state.edges.filter(
        (e) => !(e.source === source && e.target === target)
      ),
    }));
  },

  // ── Connection Validation ─────────────────────────────────────────────────

  /**
   * Typed port compatibility check.
   *
   * Strategy (in order):
   * 1. Both nodes must exist in the execution store.
   * 2. Source must have outputs; target must have inputs.
   * 3. If a sourceHandle and targetHandle are provided, look up the port
   *    descriptors from the node registry and verify datatype compatibility.
   * 4. If no handle info is provided (old-style connection), fall back to
   *    basic existence check so existing generic nodes still work.
   */
  validateConnection: (sourceId, targetId, sourceHandle, targetHandle) => {
    const state = get();
    const sourceNode = state.nodes[sourceId];
    const targetNode = state.nodes[targetId];

    if (!sourceNode || !targetNode) {
      return connectionResult(false, 'MISSING_NODE', 'Source or target node is missing in execution store.', {
        sourceId,
        targetId,
      });
    }

    const srcOutputs = sourceNode.outputs ?? [];
    const tgtInputs  = targetNode.inputs  ?? [];

    if (srcOutputs.length === 0) {
      return connectionResult(false, 'SOURCE_HAS_NO_OUTPUTS', 'Source node does not expose output ports.', {
        sourceId,
        sourceType: sourceNode.type,
      });
    }
    if (tgtInputs.length === 0) {
      return connectionResult(false, 'TARGET_HAS_NO_INPUTS', 'Target node does not expose input ports.', {
        targetId,
        targetType: targetNode.type,
      });
    }

    // ── Capability validation (domain-level): source.produces must intersect target.accepts ──
    const srcDef = getNodeDef(sourceNode.type);
    const tgtDef = getNodeDef(targetNode.type);
    const srcProduces = sourceNode.produces ?? srcDef?.produces;
    const tgtAccepts = targetNode.accepts ?? tgtDef?.accepts;
    if (Array.isArray(srcProduces) && srcProduces.length > 0 && Array.isArray(tgtAccepts) && tgtAccepts.length > 0) {
      const hasCompatibleDomain = srcProduces.some((d) => d === '*' || tgtAccepts.includes(d) || tgtAccepts.includes('*'));
      if (!hasCompatibleDomain) {
        return connectionResult(false, 'CAPABILITY_MISMATCH', 'Node capability mismatch: source output domain is not accepted by target.', {
          sourceType: sourceNode.type,
          targetType: targetNode.type,
          srcProduces,
          tgtAccepts,
          suggestedFix: 'Insert a compatible adapter transform between source and target.',
        });
      }
    }

    // ── Typed validation (when handles are known) ──
    if (sourceHandle && targetHandle && sourceNode.type && targetNode.type) {
      const sourcePort = getOutputPort(sourceNode.type, sourceHandle);
      const targetPort = getInputPort(targetNode.type, targetHandle);

      if (!sourcePort || !targetPort) {
        return connectionResult(false, 'PORT_NOT_FOUND', 'Referenced source or target handle does not exist on node definition.', {
          sourceType: sourceNode.type,
          targetType: targetNode.type,
          sourceHandle,
          targetHandle,
        });
      }

      if (sourcePort && targetPort) {
        const compatible = arePortsCompatible(sourcePort, targetPort);
        if (compatible) {
          return connectionResult(true, 'OK', 'Connection is compatible.', {
            sourceType: sourceNode.type,
            targetType: targetNode.type,
            sourceHandle,
            targetHandle,
          });
        }

        const sourceRole = inferPortRole(sourcePort);
        const targetRole = inferPortRole(targetPort);
        return connectionResult(false, 'PORT_TYPE_MISMATCH', 'Port datatype or role mismatch.', {
          sourceType: sourceNode.type,
          targetType: targetNode.type,
          sourceHandle,
          targetHandle,
          sourceDatatype: sourcePort.datatype,
          targetDatatype: targetPort.datatype,
          sourceRole,
          targetRole,
          suggestedFix: 'Use an adapter node or choose matching ports.',
        });
      }
    }

    // ── Fallback: basic existence check for generic nodes ──
    return connectionResult(true, 'OK_FALLBACK', 'Connection accepted via generic fallback.', {
      sourceType: sourceNode.type,
      targetType: targetNode.type,
    });
  },

  canConnect: (sourceId, targetId, sourceHandle, targetHandle) => {
    const result = get().validateConnection(sourceId, targetId, sourceHandle, targetHandle);
    return result.ok;
  },
}));
