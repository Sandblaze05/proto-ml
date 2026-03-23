import { create } from 'zustand';
import { getOutputPort, getInputPort, arePortsCompatible, getNodeDef } from '../nodes/nodeRegistry';

export const useExecutionStore = create((set, get) => ({
  // Dictionary of node_id → full execution node model
  nodes: {},
  // List of edges { source, target, sourceHandle, targetHandle }
  edges: [],

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
  canConnect: (sourceId, targetId, sourceHandle, targetHandle) => {
    const state = get();
    const sourceNode = state.nodes[sourceId];
    const targetNode = state.nodes[targetId];

    if (!sourceNode || !targetNode) {
      console.warn('[ExecutionStore] canConnect: missing node in store.', { sourceId, targetId });
      return false;
    }

    const srcOutputs = sourceNode.outputs ?? [];
    const tgtInputs  = targetNode.inputs  ?? [];

    if (srcOutputs.length === 0) {
      console.warn('[ExecutionStore] canConnect: source has no outputs.', sourceId);
      return false;
    }
    if (tgtInputs.length === 0) {
      console.warn('[ExecutionStore] canConnect: target has no inputs.', targetId);
      return false;
    }

    // ── Capability validation (domain-level): source.produces must intersect target.accepts ──
    const srcDef = getNodeDef(sourceNode.type);
    const tgtDef = getNodeDef(targetNode.type);
    const srcProduces = sourceNode.produces ?? srcDef?.produces;
    const tgtAccepts = targetNode.accepts ?? tgtDef?.accepts;
    if (Array.isArray(srcProduces) && srcProduces.length > 0 && Array.isArray(tgtAccepts) && tgtAccepts.length > 0) {
      const hasCompatibleDomain = srcProduces.some((d) => tgtAccepts.includes(d));
      if (!hasCompatibleDomain) {
        console.warn('[ExecutionStore] canConnect: capability mismatch.', {
          sourceType: sourceNode.type,
          targetType: targetNode.type,
          srcProduces,
          tgtAccepts,
        });
        return false;
      }
    }

    // ── Typed validation (when handles are known) ──
    if (sourceHandle && targetHandle && sourceNode.type && targetNode.type) {
      const sourcePort = getOutputPort(sourceNode.type, sourceHandle);
      const targetPort = getInputPort(targetNode.type, targetHandle);

      if (sourcePort && targetPort) {
        const compatible = arePortsCompatible(sourcePort, targetPort);
        if (!compatible) {
          console.warn(
            `[ExecutionStore] canConnect: TYPED MISMATCH — ` +
            `${sourceNode.type}:${sourceHandle}(${sourcePort.datatype}) → ` +
            `${targetNode.type}:${targetHandle}(${targetPort.datatype})`
          );
        }
        return compatible;
      }
    }

    // ── Fallback: basic existence check for generic nodes ──
    return true;
  },
}));
