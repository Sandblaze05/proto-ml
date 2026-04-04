class GraphExecutor {
  constructor(runtimeFactories = {}) {
    this.runtimeFactories = runtimeFactories;
  }

  async preview(graph, targetNodeId, n = 5) {
    const model = this._normalizeGraph(graph);
    if (!model.nodes[targetNodeId]) {
      return {
        error: `Target node not found: ${targetNodeId}`,
        type: 'TargetNodeNotFound',
        details: { targetNodeId },
      };
    }

    const order = this._topologicalSort(model);
    const needed = this._collectUpstream(targetNodeId, model);
    const outputs = {};

    for (const nodeId of order) {
      if (!needed.has(nodeId)) continue;
      const node = model.nodes[nodeId];
      if (!node) continue;

      const inputs = this._collectNodeInputs(model, nodeId, outputs);
      const factory = this._resolveFactory(node.type);

      if (!factory) {
        outputs[nodeId] = {
          error: `No preview runtime registered for node type: ${node.type}`,
          type: 'RuntimeNotImplemented',
          details: {
            nodeId,
            nodeType: node.type,
            availableNodeTypes: Object.keys(this.runtimeFactories),
          },
        };
        continue;
      }

      try {
        const runtime = factory(node.config || {});
        if (!runtime || typeof runtime.getSample !== 'function') {
          outputs[nodeId] = {
            error: `Runtime for node type ${node.type} does not implement getSample(n)`,
            type: 'RuntimeContractError',
            details: { nodeId, nodeType: node.type },
          };
          continue;
        }

        outputs[nodeId] = await runtime.getSample(n, { inputs, node, graph: model });
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

  _resolveFactory(nodeType) {
    if (typeof this.runtimeFactories.get === 'function') {
      return this.runtimeFactories.get(nodeType);
    }
    return this.runtimeFactories[nodeType];
  }

  _normalizeGraph(graph) {
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

  _topologicalSort(model) {
    const nodeIds = Object.keys(model.nodes || {});
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
      inDegree[edge.to] = (inDegree[edge.to] || 0) + 1;
    }

    const queue = nodeIds.filter((id) => (inDegree[id] || 0) === 0);
    const order = [];

    while (queue.length > 0) {
      const current = queue.shift();
      order.push(current);
      for (const next of adjacency[current] || []) {
        inDegree[next] -= 1;
        if (inDegree[next] === 0) queue.push(next);
      }
    }

    return order.length === nodeIds.length ? order : nodeIds;
  }

  _collectUpstream(targetId, model) {
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

  _collectNodeInputs(model, nodeId, outputs) {
    return (model.edges || [])
      .filter((edge) => edge.to === nodeId)
      .map((edge) => outputs[edge.from])
      .filter((value) => value !== undefined);
  }
}

module.exports = GraphExecutor;
