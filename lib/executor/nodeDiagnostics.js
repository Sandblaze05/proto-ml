import { getNodeDef } from '../../nodes/nodeRegistry.js';
import runtimeFactories from '../runtimeFactories/index.js';

function normalizeNodes(nodes = {}) {
  if (Array.isArray(nodes)) {
    return Object.fromEntries(nodes.map((node) => [node.id, node]));
  }
  return nodes && typeof nodes === 'object' ? nodes : {};
}

function getRequiredInputCount(nodeDef) {
  return (nodeDef?.inputs || []).filter((input) => input && input.optional === false).length;
}

export function buildNodeDiagnostics(graph = {}) {
  const nodesById = normalizeNodes(graph.nodes);
  const diagnostics = {};

  for (const [nodeId, node] of Object.entries(nodesById)) {
    const nodeType = node?.type || 'unknown';
    const nodeDef = getNodeDef(nodeType);
    const requiredInputCount = getRequiredInputCount(nodeDef);
    const hasRuntimeFactory = Boolean(runtimeFactories.get(nodeType));
    const blockers = [];

    if (requiredInputCount > 0) blockers.push('requires_upstream_input');
    if (!hasRuntimeFactory) blockers.push('missing_runtime_factory');

    diagnostics[nodeId] = {
      nodeId,
      nodeType,
      cellRunnable: blockers.length === 0,
      blockers,
      requiredInputCount,
      hasRuntimeFactory,
    };
  }

  const values = Object.values(diagnostics);
  return {
    nodes: diagnostics,
    summary: {
      total: values.length,
      cellRunnable: values.filter((item) => item.cellRunnable).length,
      blocked: values.filter((item) => !item.cellRunnable).length,
    },
  };
}
