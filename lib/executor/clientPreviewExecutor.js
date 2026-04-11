import { previewClientImageUpload, previewClientUpload } from '../clientUploadStore';
import TransformPreviewRuntime from '../runtimeFactories/transformPreviewRuntime';
import LifecyclePreviewRuntime from '../runtimeFactories/lifecyclePreviewRuntime';
import { getNodeDef } from '../../nodes/nodeRegistry';

function normalizeGraph(graph) {
  if (!graph) return { nodes: {}, edges: [] };

  const nodes = Array.isArray(graph.nodes)
    ? graph.nodes.reduce((acc, node) => {
        acc[node.id] = node;
        return acc;
      }, {})
    : (graph.nodes || {});

  const edges = (graph.edges || [])
    .map((edge) => ({
      from: edge.from ?? edge.source,
      to: edge.to ?? edge.target,
      fromPort: edge.fromPort ?? edge.sourceHandle,
      toPort: edge.toPort ?? edge.targetHandle,
    }))
    .filter((edge) => edge.from && edge.to);

  return { nodes, edges };
}

function topologicalSort(model) {
  const nodeIds = Object.keys(model.nodes || {}).sort();
  const inDegree = {};
  const adjacency = {};

  nodeIds.forEach((id) => {
    inDegree[id] = 0;
    adjacency[id] = [];
  });

  for (const edge of model.edges || []) {
    if (!edge.from || !edge.to) continue;
    if (!adjacency[edge.from]) adjacency[edge.from] = [];
    adjacency[edge.from].push(edge.to);
    if (Object.prototype.hasOwnProperty.call(inDegree, edge.to)) {
      inDegree[edge.to] += 1;
    }
  }

  const queue = nodeIds.filter((id) => inDegree[id] === 0).sort();
  const order = [];

  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current);
    for (const next of adjacency[current] || []) {
      inDegree[next] -= 1;
      if (inDegree[next] === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  return order.length === nodeIds.length ? order : nodeIds;
}

function collectUpstream(targetId, model) {
  const reverse = {};
  for (const id of Object.keys(model.nodes || {})) reverse[id] = [];
  for (const edge of model.edges || []) {
    if (edge.from && edge.to) reverse[edge.to].push(edge.from);
  }

  const visited = new Set();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const parent of reverse[current] || []) stack.push(parent);
  }

  return visited;
}

function selectOutputByHandle(output, handle) {
  if (!handle || handle === 'out') {
    if (output && typeof output === 'object' && Object.prototype.hasOwnProperty.call(output, 'out')) {
      return output.out;
    }
    return output;
  }

  if (output && typeof output === 'object') {
    if (Object.prototype.hasOwnProperty.call(output, handle)) {
      return output[handle];
    }

    if (
      output.out
      && typeof output.out === 'object'
      && Object.prototype.hasOwnProperty.call(output.out, handle)
    ) {
      return output.out[handle];
    }
  }

  return output;
}

function collectNodeInputs(model, nodeId, outputs) {
  const incomingEdges = (model.edges || [])
    .filter((edge) => edge.to === nodeId)
    .sort((a, b) => {
      const aTo = String(a.toPort || '');
      const bTo = String(b.toPort || '');
      if (aTo !== bTo) return aTo.localeCompare(bTo);
      const aFrom = String(a.fromPort || '');
      const bFrom = String(b.fromPort || '');
      if (aFrom !== bFrom) return aFrom.localeCompare(bFrom);
      return String(a.from || '').localeCompare(String(b.from || ''));
    });

  const inputs = [];
  const inputBindings = {};

  for (const edge of incomingEdges) {
    const sourceOutput = outputs[edge.from];
    if (sourceOutput === undefined) continue;

    const value = selectOutputByHandle(sourceOutput, edge.fromPort);
    inputs.push(value);

    const bindingKey = edge.toPort || edge.fromPort || `in_${inputs.length - 1}`;
    if (bindingKey && inputBindings[bindingKey] === undefined) {
      inputBindings[bindingKey] = value;
    }
  }

  return { inputs, inputBindings };
}

function countIncomingEdges(model, nodeId) {
  return (model?.edges || []).filter((edge) => edge.to === nodeId).length;
}

async function runDatasetNode(node, n) {
  const config = node?.config || {};

  if (node.type === 'dataset.csv') {
    if (!config.client_upload_id) {
      throw new Error('CSV preview is client-only. Upload files to this node first.');
    }

    return previewClientUpload(config.client_upload_id, {
      ...config,
      n,
    });
  }

  if (node.type === 'dataset.image') {
    if (!config.client_upload_id) {
      throw new Error('Image preview is client-only. Upload files to this node first.');
    }

    return previewClientImageUpload(config.client_upload_id, {
      ...config,
      n,
    });
  }

  throw new Error(`Client preview runtime not available for node type: ${node.type}`);
}

async function runNode(node, context, n) {
  if (!node || !node.type) {
    throw new Error('Invalid node in preview graph');
  }

  if (node.type.startsWith('dataset.')) {
    return runDatasetNode(node, n);
  }

  if (node.type.startsWith('transform.')) {
    const runtime = new TransformPreviewRuntime(node.type, node.config || {});
    return runtime.getSample(n, context);
  }

  if (node.type.startsWith('lifecycle.')) {
    const runtime = new LifecyclePreviewRuntime(node.type, node.config || {});
    return runtime.getSample(n, context);
  }

  if (node.type === 'jupyter.execute') {
    throw new Error('Use pipeline run with configured Jupyter runtime for jupyter.execute nodes.');
  }

  throw new Error(`No client preview runtime registered for node type: ${node.type}`);
}

function validateRequiredInputs(node, inputBindings) {
  const nodeDef = getNodeDef(node?.type);
  const requiredInputs = (nodeDef?.inputs || []).filter((input) => input && input.optional !== true);
  if (requiredInputs.length === 0) return;

  const missingInputs = requiredInputs
    .map((input) => String(input.name || '').trim())
    .filter((name) => name.length > 0)
    .filter((name) => inputBindings[name] === undefined);

  if (missingInputs.length > 0) {
    throw {
      type: 'ValidationError',
      message: `Missing required input edges: ${missingInputs.join(', ')}`,
      details: {
        nodeId: node?.id,
        nodeType: node?.type,
        missingInputs,
      },
    };
  }
}

function validateEdgeAccessPolicy(node, incomingEdgeCount) {
  const nodeType = String(node?.type || '');
  const isDatasetNode = nodeType.startsWith('dataset.');

  // Source datasets are allowed to read from local/client sources without upstream edges.
  if (isDatasetNode) return;

  if (incomingEdgeCount <= 0) {
    throw {
      type: 'ValidationError',
      message: 'No incoming edge connected. This node cannot access data without upstream links.',
      details: {
        nodeId: node?.id,
        nodeType: node?.type,
        incomingEdgeCount,
      },
    };
  }
}

export async function previewGraphClient(graph, targetNodeId, n = 5) {
  const model = normalizeGraph(graph);

  if (!model.nodes[targetNodeId]) {
    return {
      error: `Target node not found: ${targetNodeId}`,
      type: 'TargetNodeNotFound',
      details: { targetNodeId },
    };
  }

  const order = topologicalSort(model);
  const needed = collectUpstream(targetNodeId, model);
  const outputs = {};

  for (const nodeId of order) {
    if (!needed.has(nodeId)) continue;

    const node = model.nodes[nodeId];
    if (!node) continue;

    const { inputs, inputBindings } = collectNodeInputs(model, nodeId, outputs);
    const incomingEdgeCount = countIncomingEdges(model, nodeId);

    try {
      validateEdgeAccessPolicy(node, incomingEdgeCount);
      validateRequiredInputs(node, inputBindings);
      outputs[nodeId] = await runNode(node, {
        inputs,
        inputBindings,
        node,
        graph: model,
      }, n);
    } catch (err) {
      outputs[nodeId] = {
        error: err?.message || String(err),
        type: err?.type || 'RuntimeError',
        details: err?.details,
      };
    }
  }

  return outputs[targetNodeId];
}
