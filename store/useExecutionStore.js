import { create } from 'zustand';
import { getOutputPort, getInputPort, arePortsCompatible, inferPortRole, getNodeDef } from '../nodes/nodeRegistry';
import { RUN, VALID_RUN_MODES } from '../lib/executor/executionContract';

function connectionResult(ok, code, message, details = {}) {
  return { ok, code, message, details };
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePortName(port) {
  if (typeof port === 'string') return port;
  if (port && typeof port.name === 'string') return port.name;
  return '';
}

function portFromNodeModel(node, direction, handle) {
  if (!node || !handle) return null;

  const portMap = direction === 'output' ? node.portMap?.outputs : node.portMap?.inputs;
  if (portMap && portMap[handle]) return portMap[handle];

  const registryPort = direction === 'output'
    ? getOutputPort(node.type, handle)
    : getInputPort(node.type, handle);
  if (registryPort) return registryPort;

  const localPorts = direction === 'output' ? node.outputs : node.inputs;
  const match = Array.isArray(localPorts)
    ? localPorts.find((port) => normalizePortName(port) === handle)
    : null;

  if (!match) return null;
  return typeof match === 'string' ? { name: match, datatype: 'any' } : match;
}

function nodeLabel(node, fallback) {
  return node?.label || getNodeDef(node?.type)?.label || node?.type || fallback;
}

export const useExecutionStore = create((set, get) => ({
  // Dictionary of node_id → full execution node model
  nodes: {},
  // List of edges { source, target, sourceHandle, targetHandle }
  edges: [],
  // Runtime execution contract defaults.
  // "Run pipeline" is solely one_off_compile / Jupyter execution. The synthetic
  // PREVIEW path is served separately via /api/graph/preview and is never a run.
  executionRuntime: {
    mode: RUN,
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
        mode: VALID_RUN_MODES.includes(mode) ? mode : state.executionRuntime.mode,
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

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const key = `proto_ml_session_output_${nodeId}`;
        window.sessionStorage.setItem(key, JSON.stringify(writeBack));
      } catch {
        // Ignore storage quota limits
      }
    }

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
    if (!sourceId || !targetId) {
      return connectionResult(false, 'MISSING_ENDPOINT', 'Start and end nodes are required.');
    }
    if (sourceId === targetId) {
      return connectionResult(false, 'SELF_CONNECTION', 'A node cannot connect to itself.');
    }

    const sourceNode = state.nodes[sourceId];
    const targetNode = state.nodes[targetId];
    if (!sourceNode || !targetNode) {
      return connectionResult(false, 'UNKNOWN_NODE', 'Both nodes must be registered before they can be connected.');
    }

    const sourceDef = getNodeDef(sourceNode.type);
    const targetDef = getNodeDef(targetNode.type);
    const sourceProduces = sourceNode.produces ?? sourceDef?.produces;
    const targetAccepts = targetNode.accepts ?? targetDef?.accepts;
    if (Array.isArray(sourceProduces) && sourceProduces.length > 0 && Array.isArray(targetAccepts) && targetAccepts.length > 0) {
      const hasCompatibleDomain = sourceProduces.some((domain) => (
        domain === '*' || targetAccepts.includes(domain) || targetAccepts.includes('*')
      ));
      if (!hasCompatibleDomain) {
        return connectionResult(false, 'CAPABILITY_MISMATCH', `${nodeLabel(targetNode, targetId)} does not accept ${sourceProduces.join(', ')} data.`, {
          suggestedFix: 'Insert a compatible adapter transform between these nodes.',
        });
      }
    }

    if (!sourceHandle || !targetHandle) {
      return connectionResult(false, 'MISSING_HANDLE', 'Connect a named output port to a named input port.');
    }

    const sourcePort = portFromNodeModel(sourceNode, 'output', sourceHandle);
    const targetPort = portFromNodeModel(targetNode, 'input', targetHandle);
    if (!sourcePort || !targetPort) {
      return connectionResult(false, 'PORT_NOT_FOUND', 'Referenced source or target handle does not exist on node definition.', {
        sourceType: sourceNode.type,
        targetType: targetNode.type,
        sourceHandle,
        targetHandle,
      });
    }

    const duplicateInput = state.edges.some((edge) => (
      edge.target === targetId &&
      edge.targetHandle === targetHandle &&
      !(edge.source === sourceId && edge.sourceHandle === sourceHandle)
    ));
    if (duplicateInput) {
      return connectionResult(false, 'INPUT_ALREADY_CONNECTED', `Input "${targetHandle}" already has a connection.`, {
        suggestedFix: 'Remove the existing edge first.',
      });
    }

    const duplicateEdge = state.edges.some((edge) => (
      edge.source === sourceId &&
      edge.target === targetId &&
      edge.sourceHandle === sourceHandle &&
      edge.targetHandle === targetHandle
    ));
    if (duplicateEdge) {
      return connectionResult(false, 'DUPLICATE_EDGE', 'That exact connection already exists.');
    }

    if (!arePortsCompatible(sourcePort, targetPort)) {
      const sourceType = sourcePort.datatype || inferPortRole(sourcePort);
      const targetType = targetPort.datatype || inferPortRole(targetPort);
      return connectionResult(
        false,
        'INCOMPATIBLE_PORTS',
        `"${sourceHandle}" (${sourceType}) cannot feed "${targetHandle}" (${targetType}).`,
      );
    }

    return connectionResult(true, 'OK', 'Connection allowed.', {
      sourceRole: inferPortRole(sourcePort),
      targetRole: inferPortRole(targetPort),
    });
  },

  canConnect: (sourceId, targetId, sourceHandle, targetHandle) => {
    const result = get().validateConnection(sourceId, targetId, sourceHandle, targetHandle);
    return result.ok;
  },
}));
