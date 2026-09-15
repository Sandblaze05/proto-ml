import { getNodeDef } from '../../nodes/nodeRegistry.js';

export const BROWSER_EXECUTION = Object.freeze({
  BROWSER: 'browser',
  BACKEND: 'backend',
});

const BROWSER_DATASETS = new Set([
  'dataset.csv',
  'dataset.text',
]);

const BROWSER_TRANSFORMS = new Set([
  'transform.core.map',
  'transform.core.join',
  'transform.core.route',
  'transform.program.if_else',
  'transform.program.type_switch',
  'transform.tabular.label_encoding',
  'transform.tabular.one_hot_encoding',
  'transform.text.tokenize',
  'transform.text.tfidf',
  'transform.text.count_vectorizer',
  'transform.text.embedding',
  'transform.text.stem_lemmatize',
]);

function normalizeGraph(graph) {
  const nodes = Array.isArray(graph?.nodes)
    ? Object.fromEntries(graph.nodes.map((node) => [node.id, node]))
    : (graph?.nodes || {});
  const edges = (graph?.edges || [])
    .map((edge) => ({
      from: edge.from ?? edge.source,
      to: edge.to ?? edge.target,
    }))
    .filter((edge) => edge.from && edge.to);
  return { nodes, edges };
}

function collectUpstream(model, targetNodeId) {
  const parents = {};
  for (const nodeId of Object.keys(model.nodes)) parents[nodeId] = [];
  for (const edge of model.edges) {
    if (parents[edge.to]) parents[edge.to].push(edge.from);
  }

  const result = new Set();
  const pending = [targetNodeId];
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId || result.has(nodeId)) continue;
    result.add(nodeId);
    pending.push(...(parents[nodeId] || []));
  }
  return result;
}

function backend(reason, details = {}) {
  return {
    location: BROWSER_EXECUTION.BACKEND,
    reason,
    ...details,
  };
}

export function getBrowserNodeCapability(node) {
  const nodeType = String(node?.type || '');
  const nodeDef = getNodeDef(nodeType);
  const config = node?.config || {};

  if (!nodeDef) {
    return backend('unknown_node_type', { nodeType });
  }

  if (nodeDef.kind === 'dataset') {
    const hasClientUpload = Boolean(
      config.client_upload_id
      || config.uploadId
      || (typeof config.path === 'string' && config.path.startsWith('client://')),
    );
    if (BROWSER_DATASETS.has(nodeType) && hasClientUpload) {
      return { location: BROWSER_EXECUTION.BROWSER, reason: 'uploaded_dataset' };
    }
    if (nodeType === 'dataset.api') {
      if (!config.auth_type || config.auth_type === 'none') {
        return { location: BROWSER_EXECUTION.BROWSER, reason: 'public_browser_fetch_possible' };
      }
      return backend('credentialed_api_requires_backend_access', { nodeType });
    }
    return backend('dataset_requires_backend_access', { nodeType });
  }

  if (nodeDef.kind === 'transform' && BROWSER_TRANSFORMS.has(nodeType)) {
    if (nodeType === 'transform.core.map' && config.operation === 'custom') {
      return backend('custom_expression_requires_backend', { nodeType });
    }
    return { location: BROWSER_EXECUTION.BROWSER, reason: 'pure_browser_transform' };
  }

  return backend('node_requires_python_runtime', { nodeType });
}

export function resolveBrowserPreviewCapability(graph, targetNodeId) {
  const model = normalizeGraph(graph);
  if (!model.nodes[targetNodeId]) {
    return backend('target_node_not_found', { targetNodeId, nodes: [] });
  }

  const needed = collectUpstream(model, targetNodeId);
  const nodes = [];
  for (const nodeId of needed) {
    const node = model.nodes[nodeId];
    const capability = getBrowserNodeCapability(node);
    nodes.push({ nodeId, nodeType: node.type, ...capability });
  }

  const blockers = nodes.filter((node) => node.location === BROWSER_EXECUTION.BACKEND);
  if (blockers.length > 0) {
    return {
      location: BROWSER_EXECUTION.BACKEND,
      reason: 'graph_contains_backend_nodes',
      targetNodeId,
      nodes,
      blockers,
    };
  }

  return {
    location: BROWSER_EXECUTION.BROWSER,
    reason: 'graph_is_browser_eligible',
    targetNodeId,
    nodes,
    blockers: [],
  };
}
