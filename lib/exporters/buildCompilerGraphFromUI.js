const NON_COMPILABLE_TYPES = ['annotationNode', 'shapeNode'];

export function buildCompilerGraphFromUI(uiNodes = [], uiEdges = []) {
  const filteredNodes = (uiNodes || []).filter((n) => !NON_COMPILABLE_TYPES.includes(n.type));

  const nodesById = filteredNodes.reduce((acc, node) => {
    const model = node?.data?.nodeModel || {};
    acc[node.id] = {
      id: node.id,
      type: model.type || node.type || 'unknown',
      config: model.config || model.params || {},
      pythonCode: model.pythonCode || model.execution_code || '',
      label: model.label || model.type || node.type || node.id,
    };
    return acc;
  }, {});

  const normalizedEdges = (uiEdges || [])
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }))
    .filter((e) => nodesById[e.source] && nodesById[e.target]);

  return { nodes: nodesById, edges: normalizedEdges };
}
