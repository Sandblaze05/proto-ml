class GraphExecutor {
  constructor(runtimeFactories = {}) {
    this.runtimeFactories = runtimeFactories;
  }

  async executeTopological(graph, options = {}) {
    const {
      n = 5,
      targetNodeId = null,
      failurePolicy = 'fail-fast',
    } = options;

    const model = this._normalizeGraph(graph);
    const order = this._topologicalSort(model);

    if (targetNodeId && !model.nodes[targetNodeId]) {
      return {
        ok: false,
        status: 'failed',
        order,
        failedNodeId: targetNodeId,
        error: {
          message: `Target node not found: ${targetNodeId}`,
          type: 'TargetNodeNotFound',
        },
        nodeStatuses: {
          [targetNodeId]: {
            status: 'failed',
            error: `Target node not found: ${targetNodeId}`,
            type: 'TargetNodeNotFound',
          },
        },
        nodeResults: {},
      };
    }

    const needed = targetNodeId ? this._collectUpstream(targetNodeId, model) : new Set(order);
    const nodeResults = {};
    const nodeStatuses = {};
    let failedNodeId = null;
    let runError = null;

    for (const nodeId of order) {
      if (!needed.has(nodeId)) continue;

      const node = model.nodes[nodeId];
      if (!node) continue;

      nodeStatuses[nodeId] = {
        status: 'running',
        startedAt: Date.now(),
      };

      const { inputs, inputBindings } = this._collectNodeInputs(model, nodeId, nodeResults);
      const factory = this._resolveFactory(node.type);

      if (!factory) {
        const result = {
          error: `No preview runtime registered for node type: ${node.type}`,
          type: 'RuntimeNotImplemented',
          details: {
            nodeId,
            nodeType: node.type,
            availableNodeTypes: Object.keys(this.runtimeFactories),
          },
        };
        nodeResults[nodeId] = result;
        nodeStatuses[nodeId] = {
          ...nodeStatuses[nodeId],
          status: 'failed',
          completedAt: Date.now(),
          error: result.error,
          type: result.type,
        };
        failedNodeId = nodeId;
        runError = result;
      } else {
        try {
          const runtime = factory(node.config || {});
          if (!runtime || typeof runtime.getSample !== 'function') {
            const result = {
              error: `Runtime for node type ${node.type} does not implement getSample(n)`,
              type: 'RuntimeContractError',
              details: { nodeId, nodeType: node.type },
            };
            nodeResults[nodeId] = result;
            nodeStatuses[nodeId] = {
              ...nodeStatuses[nodeId],
              status: 'failed',
              completedAt: Date.now(),
              error: result.error,
              type: result.type,
            };
            failedNodeId = nodeId;
            runError = result;
          } else {
            const result = await runtime.getSample(n, { inputs, inputBindings, node, graph: model });
            nodeResults[nodeId] = result;

            if (this._isRuntimeErrorResult(result)) {
              nodeStatuses[nodeId] = {
                ...nodeStatuses[nodeId],
                status: 'failed',
                completedAt: Date.now(),
                error: result.error,
                type: result.type || 'RuntimeError',
              };
              failedNodeId = nodeId;
              runError = result;
            } else {
              nodeStatuses[nodeId] = {
                ...nodeStatuses[nodeId],
                status: 'succeeded',
                completedAt: Date.now(),
              };
            }
          }
        } catch (err) {
          const result = {
            error: err?.message || String(err),
            type: err?.type || 'RuntimeError',
            details: err?.details,
          };
          nodeResults[nodeId] = result;
          nodeStatuses[nodeId] = {
            ...nodeStatuses[nodeId],
            status: 'failed',
            completedAt: Date.now(),
            error: result.error,
            type: result.type,
          };
          failedNodeId = nodeId;
          runError = result;
        }
      }

      if (failedNodeId && failurePolicy === 'fail-fast') {
        this._markRemainingAsSkipped(order, needed, nodeStatuses);
        break;
      }
    }

    if (failedNodeId) {
      return {
        ok: false,
        status: 'failed',
        order,
        failedNodeId,
        error: runError,
        nodeStatuses,
        nodeResults,
      };
    }

    return {
      ok: true,
      status: 'succeeded',
      order,
      failedNodeId: null,
      error: null,
      nodeStatuses,
      nodeResults,
    };
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

      const { inputs, inputBindings } = this._collectNodeInputs(model, nodeId, outputs);
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

        outputs[nodeId] = await runtime.getSample(n, { inputs, inputBindings, node, graph: model });
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

  _isRuntimeErrorResult(result) {
    return Boolean(
      result &&
      typeof result === 'object' &&
      typeof result.error === 'string' &&
      result.error.trim().length > 0,
    );
  }

  _markRemainingAsSkipped(order, needed, nodeStatuses) {
    for (const nodeId of order) {
      if (!needed.has(nodeId)) continue;
      if (nodeStatuses[nodeId]) continue;
      nodeStatuses[nodeId] = {
        status: 'skipped',
        startedAt: null,
        completedAt: Date.now(),
        error: null,
        type: null,
      };
    }
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
      inDegree[edge.to] = (inDegree[edge.to] || 0) + 1;
    }

    for (const nodeId of nodeIds) {
      adjacency[nodeId].sort();
    }

    const queue = nodeIds.filter((id) => (inDegree[id] || 0) === 0).sort();
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

      const value = this._selectOutputByHandle(sourceOutput, edge.fromPort);
      inputs.push(value);

      const bindingKey = edge.toPort || edge.fromPort || `in_${inputs.length - 1}`;
      if (bindingKey && inputBindings[bindingKey] === undefined) {
        inputBindings[bindingKey] = value;
      }
    }

    return { inputs, inputBindings };
  }

  _selectOutputByHandle(output, handle) {
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
        output.out &&
        typeof output.out === 'object' &&
        Object.prototype.hasOwnProperty.call(output.out, handle)
      ) {
        return output.out[handle];
      }
    }

    return output;
  }
}

module.exports = GraphExecutor;
