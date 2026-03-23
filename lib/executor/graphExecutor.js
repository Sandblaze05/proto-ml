class GraphExecutor {
  constructor(runtimeFactories = {}) {
    this.runtimeFactories = runtimeFactories;
  }

  // Public: return a small sample for the given target node by resolving upstream nodes.
  async preview(graph, targetNodeId, n = 5) {
    const model = this._normalizeGraph(graph);
    const order = this._topologicalSort(model);
    const needed = this._collectUpstream(targetNodeId, model);

    const outputs = {};

    for (const nodeId of order) {
      if (!needed.has(nodeId)) continue;
      const node = model.nodes[nodeId];
      if (!node) continue;

      const factory = this.runtimeFactories[node.type];
      if (factory) {
        try {
          const runtime = factory(node.config || {});
          if (runtime && typeof runtime.getSample === 'function') {
            outputs[nodeId] = await runtime.getSample(n);
            continue;
          }
        } catch (err) {
          outputs[nodeId] = {
            error: err?.message || String(err),
            type: err?.type || 'RuntimeError',
            details: err?.details,
          };
          continue;
        }
      }

      // Fallback mock sample when no runtime is available
      outputs[nodeId] = this._mockSample(nodeId, node.config, n);
    }

    return outputs[targetNodeId];
  }

  // PRIVATE HELPERS
  _normalizeGraph(graph) {
    // Expected shape: { nodes: { id: { type, config } }, edges: [{ from, to, fromPort, toPort }] }
    if (!graph) return { nodes: {}, edges: [] };
    const nodes = Array.isArray(graph.nodes)
      ? graph.nodes.reduce((acc, n) => { acc[n.id] = n; return acc; }, {})
      : (graph.nodes || {});
    const edges = (graph.edges || []).map((e) => ({
      from: e.from ?? e.source,
      to: e.to ?? e.target,
      fromPort: e.fromPort ?? e.sourceHandle,
      toPort: e.toPort ?? e.targetHandle,
    })).filter((e) => e.from && e.to);
    return { nodes, edges };
  }

  _topologicalSort(model) {
    const nodes = Object.keys(model.nodes || {});
    const inDegree = {};
    const adj = {};
    nodes.forEach((id) => { inDegree[id] = 0; adj[id] = []; });

    for (const e of model.edges || []) {
      if (!e.from || !e.to) continue;
      if (!adj[e.from]) adj[e.from] = [];
      adj[e.from].push(e.to);
      inDegree[e.to] = (inDegree[e.to] || 0) + 1;
    }

    const queue = nodes.filter((id) => (inDegree[id] || 0) === 0);
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      for (const to of adj[id] || []) {
        inDegree[to] -= 1;
        if (inDegree[to] === 0) queue.push(to);
      }
    }

    // If cycle exists, return nodes in insertion order as best-effort
    if (order.length !== nodes.length) return nodes;
    return order;
  }

  _collectUpstream(targetId, model) {
    const revAdj = {};
    for (const id of Object.keys(model.nodes || {})) revAdj[id] = [];
    for (const e of model.edges || []) {
      if (e.from && e.to) revAdj[e.to].push(e.from);
    }
    const visited = new Set();
    const stack = [targetId];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || visited.has(cur)) continue;
      visited.add(cur);
      for (const p of revAdj[cur] || []) stack.push(p);
    }
    return visited;
  }

  _mockSample(nodeId, config = {}, n = 5) {
    const preview = [];
    for (let i = 0; i < n; i++) {
      preview.push({
        _preview: true,
        nodeId,
        index: i,
        config: this._shallowConfig(config),
      });
    }
    return preview;
  }

  _shallowConfig(config) {
    if (!config || typeof config !== 'object') return config;
    const keys = Object.keys(config).slice(0, 6);
    const out = {};
    for (const k of keys) out[k] = config[k];
    return out;
  }
}

module.exports = GraphExecutor;
