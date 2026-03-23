function toPythonLiteral(value) {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map((v) => toPythonLiteral(v)).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${toPythonLiteral(k)}: ${toPythonLiteral(v)}`);
    return `{${entries.join(', ')}}`;
  }
  return 'None';
}

function nodeIdToSymbol(nodeId) {
  return `n_${String(nodeId).replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function normalizeEdges(edges = []) {
  return edges
    .map((e) => ({
      source: e.source ?? e.from,
      target: e.target ?? e.to,
      sourceHandle: e.sourceHandle ?? e.fromPort,
      targetHandle: e.targetHandle ?? e.toPort,
    }))
    .filter((e) => e.source && e.target);
}

function topologicalSort(nodesById, edges) {
  const ids = Object.keys(nodesById);
  const inDegree = Object.fromEntries(ids.map((id) => [id, 0]));
  const out = Object.fromEntries(ids.map((id) => [id, []]));

  for (const e of edges) {
    if (!nodesById[e.source] || !nodesById[e.target]) continue;
    out[e.source].push(e.target);
    inDegree[e.target] += 1;
  }

  const queue = ids.filter((id) => inDegree[id] === 0);
  const order = [];

  while (queue.length > 0) {
    const cur = queue.shift();
    order.push(cur);
    for (const nxt of out[cur]) {
      inDegree[nxt] -= 1;
      if (inDegree[nxt] === 0) queue.push(nxt);
    }
  }

  return { order, hasCycle: order.length !== ids.length };
}

function classifyNode(nodeType = '') {
  if (nodeType.startsWith('dataset.')) return 'dataset';
  if (nodeType.startsWith('transform.')) return 'transform';
  if (nodeType.startsWith('lifecycle.')) return nodeType.split('.')[1] || 'lifecycle';
  if (nodeType.startsWith('train.') || nodeType.includes('cnn') || nodeType.includes('transformer')) return 'train';
  return 'generic';
}

export function compileExecutionGraph({ nodes = {}, edges = [] } = {}) {
  const nodesById = Array.isArray(nodes)
    ? Object.fromEntries(nodes.map((n) => [n.id, n]))
    : (nodes || {});
  const normalizedEdges = normalizeEdges(edges);

  const nodeIds = Object.keys(nodesById);
  if (nodeIds.length === 0) {
    return {
      ok: false,
      errors: ['Graph is empty. Add at least one dataset node.'],
      code: '',
      metadata: { nodeCount: 0, edgeCount: 0 },
    };
  }

  const { order, hasCycle } = topologicalSort(nodesById, normalizedEdges);
  const errors = [];
  if (hasCycle) errors.push('Graph contains a cycle. Compiler requires a DAG.');

  const datasets = order.filter((id) => classifyNode(nodesById[id]?.type) === 'dataset');
  if (datasets.length === 0) errors.push('No dataset source node found. Add a dataset.* node as source.');

  if (errors.length) {
    return {
      ok: false,
      errors,
      code: '',
      metadata: { nodeCount: nodeIds.length, edgeCount: normalizedEdges.length },
    };
  }

  const incoming = Object.fromEntries(nodeIds.map((id) => [id, []]));
  normalizedEdges.forEach((e) => incoming[e.target]?.push(e));

  const sectionImports = new Set([
    'from collections import defaultdict',
    'from typing import Any, Dict',
  ]);

  const sectionDefs = [
    'def apply_transform(transform_type: str, x: Any, config: Dict[str, Any]) -> Any:',
    '    # TODO: bind transform_type to real runtime implementation',
    '    return x',
    '',
    'def apply_lifecycle(stage: str, inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:',
    '    # TODO: bind lifecycle nodes (split/dataloader/model/loss/training) to runtime implementations',
    '    return {"stage": stage, "inputs": inputs, "config": config}',
    '',
    'def apply_node(node_type: str, inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:',
    '    # TODO: bind generic nodes to runtime implementations',
    '    return {"node_type": node_type, "inputs": inputs, "config": config}',
  ];

  const sectionBody = [];
  sectionBody.push('ctx = defaultdict(dict)');
  sectionBody.push('node_meta = {}');

  for (const nodeId of order) {
    const node = nodesById[nodeId] || {};
    const nodeType = node.type || 'unknown';
    const stage = classifyNode(nodeType);
    const symbol = nodeIdToSymbol(nodeId);
    const cfgSymbol = `${symbol}_config`;

    sectionBody.push('');
    sectionBody.push(`# Node ${nodeId} (${nodeType})`);
    sectionBody.push(`${cfgSymbol} = ${toPythonLiteral(node.config || {})}`);
    sectionBody.push(`node_meta['${nodeId}'] = {'type': ${toPythonLiteral(nodeType)}, 'stage': ${toPythonLiteral(stage)}}`);

    if (node.pythonCode) {
      sectionBody.push('# Template reference (for traceability):');
      const lines = String(node.pythonCode).split('\n').slice(0, 6);
      lines.forEach((l) => sectionBody.push(`#   ${l}`));
    }

    const inEdges = incoming[nodeId] || [];

    if (stage === 'dataset') {
      sectionBody.push(`ctx['${nodeId}']['out'] = {'dataset_type': ${toPythonLiteral(nodeType)}, 'config': ${cfgSymbol}}`);
      continue;
    }

    if (stage === 'transform') {
      if (inEdges.length === 0) {
        sectionBody.push(`raise ValueError('Transform node ${nodeId} has no input source')`);
      } else {
        const upstream = inEdges[0].source;
        sectionBody.push(`ctx['${nodeId}']['out'] = apply_transform(${toPythonLiteral(nodeType)}, ctx['${upstream}']['out'], ${cfgSymbol})`);
      }
      continue;
    }

    if (['split', 'dataloader', 'model', 'loss', 'training'].includes(stage)) {
      sectionBody.push(`_inputs_${symbol} = {}`);
      inEdges.forEach((e, idx) => {
        const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
        sectionBody.push(`_inputs_${symbol}[${toPythonLiteral(key)}] = ctx['${e.source}']['out']`);
      });
      sectionBody.push(`ctx['${nodeId}']['out'] = apply_lifecycle(${toPythonLiteral(stage)}, _inputs_${symbol}, ${cfgSymbol})`);
      continue;
    }

    // generic/train stages
    if (inEdges.length === 0) {
      sectionBody.push(`ctx['${nodeId}']['out'] = apply_node(${toPythonLiteral(nodeType)}, {}, ${cfgSymbol})`);
    } else {
      sectionBody.push(`_inputs_${symbol} = {}`);
      inEdges.forEach((e, idx) => {
        const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
        sectionBody.push(`_inputs_${symbol}[${toPythonLiteral(key)}] = ctx['${e.source}']['out']`);
      });
      sectionBody.push(`ctx['${nodeId}']['out'] = apply_node(${toPythonLiteral(nodeType)}, _inputs_${symbol}, ${cfgSymbol})`);
    }
  }

  sectionBody.push('');
  sectionBody.push(`# Pipeline outputs (leaf nodes) available in ctx`);
  sectionBody.push('compiled_result = dict(ctx)');

  const code = [
    '# AUTO-GENERATED PIPELINE CODE',
    '# This code is compiled from the visual execution graph.',
    '',
    ...Array.from(sectionImports),
    '',
    ...sectionDefs,
    '',
    ...sectionBody,
    '',
  ].join('\n');

  const metadata = {
    nodeCount: nodeIds.length,
    edgeCount: normalizedEdges.length,
    order,
    datasetCount: datasets.length,
  };

  return { ok: true, errors: [], code, metadata };
}
