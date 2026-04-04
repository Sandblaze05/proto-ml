import { create } from 'zustand';
import { getOutputPort, getInputPort, arePortsCompatible, inferPortRole, getNodeDef } from '../nodes/nodeRegistry';

function connectionResult(ok, code, message, details = {}) {
  return { ok, code, message, details };
}

export const useExecutionStore = create((set, get) => ({
  // Dictionary of node_id → full execution node model
  nodes: {},
  // List of edges { source, target, sourceHandle, targetHandle }
  edges: [],

  setExecutionGraph: ({ nodes = {}, edges = [] } = {}) => {
    set({
      nodes: nodes && typeof nodes === 'object' ? nodes : {},
      edges: Array.isArray(edges) ? edges : [],
    });
  },

  clearExecutionGraph: () => {
    set({ nodes: {}, edges: [] });
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
    if (!result.ok) {
      console.warn('[ExecutionStore] canConnect: rejected connection.', result);
    }
    return result.ok;
  },
}));
