import { getNodeDef } from '../../nodes/nodeRegistry.js';
import { generateDatasetPythonCode } from '../pythonTemplates/datasetNodeTemplate.js';
import { generateTransformPythonCode } from '../pythonTemplates/transformNodeTemplate.js';
import { generateLifecyclePythonCode } from '../pythonTemplates/lifecycleNodeTemplate.js';

function inferKind(nodeType = '', nodeDef) {
  if (nodeDef?.kind) return nodeDef.kind;
  if (nodeType.startsWith('dataset.')) return 'dataset';
  if (nodeType.startsWith('transform.')) return 'transform';
  if (nodeType.startsWith('lifecycle.')) return 'lifecycle';
  return 'generic';
}

function inferPythonCode(nodeType, kind, config) {
  if (kind === 'dataset') return generateDatasetPythonCode(nodeType, config);
  if (kind === 'lifecycle') return generateLifecyclePythonCode(nodeType, config);
  if (kind === 'transform') return generateTransformPythonCode(nodeType, config);
  return '';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildPosition(index, node) {
  if (node?.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
    return { x: node.position.x, y: node.position.y };
  }
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: 120 + column * 280,
    y: 120 + row * 180,
  };
}

/**
 * Convert a template graph into UI + execution payloads.
 * The output can be applied directly using useUIStore.setNodes/setEdges and useExecutionStore.addExecutionNode.
 */
export function buildCanvasPayloadFromTemplateGraph(graph, options = {}) {
  const nodes = ensureArray(graph?.nodes);
  const edges = ensureArray(graph?.edges);
  const prefix = options.idPrefix || 'tpl';
  const preserveIds = options.preserveIds === true;

  const idMap = {};
  const warnings = [];
  const uiNodes = [];
  const executionNodesById = {};

  nodes.forEach((node, index) => {
    if (!node || typeof node.id !== 'string' || typeof node.type !== 'string') {
      warnings.push(`Skipping invalid template node at index ${index}.`);
      return;
    }

    const nodeId = preserveIds ? node.id : `${prefix}-${node.id}`;
    idMap[node.id] = nodeId;

    const def = getNodeDef(node.type);
    const kind = inferKind(node.type, def);
    const inputs = (def?.inputs || []).map((port) => port.name);
    const outputs = (def?.outputs || []).map((port) => port.name);
    const config = { ...(def?.defaultConfig || {}), ...(node.config || {}) };
    const pythonCode = inferPythonCode(node.type, kind, config);

    if (!def) {
      warnings.push(`Unknown node type in template: ${node.type}`);
    }

    const nodeModel = {
      type: node.type,
      label: node.label || def?.label || node.type,
      inputs,
      outputs,
      config,
      params: config,
      uiSchema: { ...(def?.uiSchema || {}) },
      accepts: def?.accepts || [],
      produces: def?.produces || [],
      kind,
      category: def?.category,
      metadata: { ...(def?.metadata || {}), ...(node.metadata || {}) },
      pythonCode,
    };

    uiNodes.push({
      id: nodeId,
      type: kind === 'dataset' ? 'datasetNode' : 'transformNode',
      position: buildPosition(index, node),
      zIndex: 100,
      data: { nodeModel },
    });

    executionNodesById[nodeId] = {
      type: node.type,
      label: nodeModel.label,
      inputs,
      outputs,
      config,
      uiSchema: nodeModel.uiSchema,
      accepts: nodeModel.accepts,
      produces: nodeModel.produces,
      kind,
      category: nodeModel.category,
      metadata: nodeModel.metadata,
      pythonCode,
    };
  });

  const uiEdges = edges
    .map((edge, index) => {
      const source = idMap[edge.source];
      const target = idMap[edge.target];
      if (!source || !target) {
        warnings.push(`Skipping edge ${edge.source} -> ${edge.target}: unresolved node reference.`);
        return null;
      }
      return {
        id: edge.id || `e-${source}-${target}-${index}`,
        source,
        target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      };
    })
    .filter(Boolean);

  return {
    uiNodes,
    uiEdges,
    executionNodesById,
    idMap,
    warnings,
  };
}
