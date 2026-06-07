export function toPythonLiteral(value) {
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

export function nodeIdToSymbol(nodeId) {
  return `n_${String(nodeId).replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

export function topologicalSort(nodesById, edges) {
  const ids = Object.keys(nodesById).sort();
  const inDegree = Object.fromEntries(ids.map((id) => [id, 0]));
  const out = Object.fromEntries(ids.map((id) => [id, []]));

  for (const e of edges) {
    if (!nodesById[e.source] || !nodesById[e.target]) continue;
    out[e.source].push(e.target);
    inDegree[e.target] += 1;
  }

  for (const nodeId of ids) {
    out[nodeId].sort();
  }

  const queue = ids.filter((id) => inDegree[id] === 0).sort();
  const order = [];

  while (queue.length > 0) {
    const cur = queue.shift();
    order.push(cur);
    for (const nxt of out[cur]) {
      inDegree[nxt] -= 1;
      if (inDegree[nxt] === 0) {
        queue.push(nxt);
        queue.sort();
      }
    }
  }

  if (order.length !== ids.length) {
    throw new Error('Graph contains a cycle');
  }

  return order;
}

export function buildIncomingMap(nodeIds, edges) {
  const incoming = new Map(nodeIds.map((id) => [id, []]));
  edges.forEach((e) => {
    const list = incoming.get(e.target);
    if (list) list.push(e);
  });
  for (const list of incoming.values()) {
    list.sort((a, b) => {
      const aTarget = String(a.targetHandle || '');
      const bTarget = String(b.targetHandle || '');
      if (aTarget !== bTarget) return aTarget.localeCompare(bTarget);

      const aSource = String(a.sourceHandle || '');
      const bSource = String(b.sourceHandle || '');
      if (aSource !== bSource) return aSource.localeCompare(bSource);

      return String(a.source || '').localeCompare(String(b.source || ''));
    });
  }
  return incoming;
}

export function buildDependencyMap(order, incomingMap) {
  const dependencyMap = new Map();
  for (const nodeId of order) {
    const deps = (incomingMap.get(nodeId) || []).map((edge) => edge.source).filter(Boolean);
    dependencyMap.set(nodeId, Array.from(new Set(deps)).sort());
  }
  return dependencyMap;
}

export function classifyNode(nodeType = '') {
  if (nodeType.startsWith('dataset.')) return 'dataset';
  if (nodeType.startsWith('transform.')) return 'transform';
  if (nodeType.startsWith('lifecycle.')) return 'lifecycle';
  return 'unknown';
}

export function sanitizeDagName(name) {
  if (name === undefined || name === null || String(name).trim() === '') {
    return 'proto_ml_pipeline';
  }
  let sanitized = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!sanitized) return 'proto_ml_pipeline';
  if (/^\d/.test(sanitized)) sanitized = `_${sanitized}`;
  return sanitized;
}
