import { buildCanvasPayloadFromTemplateGraph } from './templateCanvasAdapter.js';

function normalizeExecutionEdges(uiEdges = []) {
  return uiEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));
}

/**
 * Apply a template graph to UI and execution stores in one step.
 * Expects minimal store-like interfaces to keep this helper framework-agnostic.
 */
export function applyTemplateGraphToStores({
  graph,
  uiStore,
  executionStore,
  options = {},
}) {
  if (!uiStore || typeof uiStore.setNodes !== 'function' || typeof uiStore.setEdges !== 'function') {
    throw new Error('applyTemplateGraphToStores requires a uiStore with setNodes/setEdges methods.');
  }
  if (!executionStore || typeof executionStore.setExecutionGraph !== 'function') {
    throw new Error('applyTemplateGraphToStores requires an executionStore with setExecutionGraph method.');
  }

  const payload = buildCanvasPayloadFromTemplateGraph(graph, options);

  if (typeof uiStore.saveToHistory === 'function') {
    uiStore.saveToHistory();
  }

  uiStore.setNodes(payload.uiNodes);
  uiStore.setEdges(payload.uiEdges);

  executionStore.setExecutionGraph({
    nodes: payload.executionNodesById,
    edges: normalizeExecutionEdges(payload.uiEdges),
  });

  return payload;
}
