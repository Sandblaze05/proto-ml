/**
 * nodeCellCompiler.js
 *
 * Compiles individual graph nodes into self-contained Jupyter cell snippets.
 * Each cell reads upstream kernel variables and writes its own output variable.
 *
 * Variable contract:
 *   Output variable for node "abc-123" → _pml_abc_123
 *   This variable is available to all subsequent downstream cells in the same kernel session.
 */

import { getNodeDef } from '../../nodes/nodeRegistry.js';
import { getPythonRuntimeCode } from '../pythonTemplates/runtimeHelpers.js';

// ─── Identifier helpers ────────────────────────────────────────────────────────

/** Convert a node id (potentially containing hyphens/spaces) to a valid Python identifier. */
export function nodeIdToVar(nodeId) {
  return `_pml_${String(nodeId).replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function toPythonLiteral(value) {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${toPythonLiteral(k)}: ${toPythonLiteral(v)}`);
    return `{${entries.join(', ')}}`;
  }
  return 'None';
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

function classifyNode(nodeType = '') {
  if (nodeType.startsWith('dataset.')) return 'dataset';
  if (nodeType.startsWith('transform.')) return 'transform';
  if (nodeType.startsWith('lifecycle.')) return 'lifecycle';
  return 'generic';
}

function mapLifecycleStage(nodeType = '') {
  const map = {
    'lifecycle.split': 'split',
    'lifecycle.batch_loader': 'dataloader',
    'lifecycle.core.model_builder': 'model',
    'lifecycle.core.objective': 'loss',
    'lifecycle.core.trainer': 'training',
    'lifecycle.core.evaluator': 'evaluate',
    'lifecycle.core.predictor': 'predict',
    'lifecycle.core.hyperparameter_tuner': 'hyperparameter_tune',
    'lifecycle.core.exporter': 'export',
    'lifecycle.core.feature_engineer': 'feature_engineer',
    'lifecycle.core.ensemble': 'ensemble',
  };
  return map[nodeType] || nodeType;
}

function normalizeObjectiveConfig(config = {}) {
  const c = { ...config };
  if (!c.task_type && c.objective_type) c.task_type = c.objective_type;
  if (!c.loss_name && c.loss) c.loss_name = c.loss === 'auto' ? 'cross_entropy' : c.loss;
  if (!c.metrics) {
    if (Array.isArray(c.primary_metric)) c.metrics = c.primary_metric;
    else if (typeof c.primary_metric === 'string' && c.primary_metric !== 'auto') c.metrics = [c.primary_metric.trim()];
  }
  if (!c.loss_reduction) c.loss_reduction = 'mean';
  if (c.label_smoothing === undefined) c.label_smoothing = 0.1;
  if (!c.task_type) c.task_type = 'supervised';
  if (!Array.isArray(c.metrics)) c.metrics = [];
  return c;
}

// ─── Bootstrap cell ────────────────────────────────────────────────────────────

/**
 * Returns the Python bootstrap code that must be run ONCE at the start of a pipeline session.
 * Installs all runtime helpers (apply_transform, apply_lifecycle, etc.) into the kernel namespace.
 */
export function compileBootstrapCell() {
  const runtimeCode = getPythonRuntimeCode();
  return [
    '# ── proto-ml: Pipeline Runtime Bootstrap ─────────────────────────────────',
    '# This cell installs runtime helpers used by all subsequent node cells.',
    '# Run exactly once per kernel session.',
    'import json',
    'from collections import defaultdict',
    'from typing import Any, Dict',
    '',
    runtimeCode,
    '',
    '# Bootstrap complete.',
    'print(json.dumps({"__pml_event": "bootstrap_ok"}))',
  ].join('\n');
}

// ─── Node cell compiler ────────────────────────────────────────────────────────

/**
 * Compile a single node into an executable Jupyter cell.
 *
 * @param {object} node        - Full node model: { id, type, config, ... }
 * @param {Array}  inEdges     - Incoming edges for this node: [{ source, sourceHandle, targetHandle }]
 * @returns {{ code: string, outputVar: string }}
 */
export function compileNodeCell(node, inEdges = []) {
  const nodeId = node.id;
  const nodeType = node.type || 'unknown';
  const outputVar = nodeIdToVar(nodeId);
  const stage = classifyNode(nodeType);

  const rawConfig = node.config || node.params || {};
  const config = nodeType === 'lifecycle.core.objective'
    ? normalizeObjectiveConfig(rawConfig)
    : rawConfig;

  const lines = [
    `# ── Node: ${nodeId} (${nodeType}) ──────────────────────────────────────────`,
    `_pml_node_cfg = ${toPythonLiteral(config)}`,
    '',
  ];

  // ── Dataset nodes ────────────────────────────────────────────────────────────
  if (stage === 'dataset') {
    lines.push(
      `${outputVar} = {'dataset_type': ${toPythonLiteral(nodeType)}, 'config': _pml_node_cfg}`,
    );
  }

  // ── Transform nodes ──────────────────────────────────────────────────────────
  else if (stage === 'transform') {
    if (inEdges.length === 0) {
      lines.push(`raise ValueError("Transform node ${nodeId} has no upstream input.")`);
    } else if (inEdges.length === 1) {
      const e = inEdges[0];
      const upstreamVar = nodeIdToVar(e.source);
      const handle = e.sourceHandle ? toPythonLiteral(e.sourceHandle) : 'None';
      lines.push(
        `_pml_input = select_output_handle(${upstreamVar}, ${handle})`,
        `${outputVar} = apply_transform(${toPythonLiteral(nodeType)}, _pml_input, _pml_node_cfg)`,
      );
    } else {
      // Multi-input (join-style)
      lines.push(`_pml_inputs = {}`);
      inEdges.forEach((e, idx) => {
        const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
        const upstreamVar = nodeIdToVar(e.source);
        const handle = e.sourceHandle ? toPythonLiteral(e.sourceHandle) : 'None';
        lines.push(`_pml_inputs[${toPythonLiteral(key)}] = select_output_handle(${upstreamVar}, ${handle})`);
      });
      lines.push(`${outputVar} = apply_transform(${toPythonLiteral(nodeType)}, _pml_inputs, _pml_node_cfg)`);
    }
  }

  // ── Lifecycle nodes ───────────────────────────────────────────────────────────
  else if (stage === 'lifecycle') {
    const lcStage = mapLifecycleStage(nodeType);
    lines.push(`_pml_inputs = {}`);
    inEdges.forEach((e, idx) => {
      const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
      const upstreamVar = nodeIdToVar(e.source);
      const handle = e.sourceHandle ? toPythonLiteral(e.sourceHandle) : 'None';
      lines.push(`_pml_inputs[${toPythonLiteral(key)}] = select_output_handle(${upstreamVar}, ${handle})`);
    });
    lines.push(`${outputVar} = apply_lifecycle(${toPythonLiteral(lcStage)}, _pml_inputs, _pml_node_cfg)`);
  }

  // ── Generic nodes ─────────────────────────────────────────────────────────────
  else {
    if (inEdges.length === 0) {
      lines.push(`${outputVar} = apply_node(${toPythonLiteral(nodeType)}, {}, _pml_node_cfg)`);
    } else {
      lines.push(`_pml_inputs = {}`);
      inEdges.forEach((e, idx) => {
        const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
        const upstreamVar = nodeIdToVar(e.source);
        const handle = e.sourceHandle ? toPythonLiteral(e.sourceHandle) : 'None';
        lines.push(`_pml_inputs[${toPythonLiteral(key)}] = select_output_handle(${upstreamVar}, ${handle})`);
      });
      lines.push(`${outputVar} = apply_node(${toPythonLiteral(nodeType)}, _pml_inputs, _pml_node_cfg)`);
    }
  }

  // ── Output reporting ──────────────────────────────────────────────────────────
  lines.push('');
  lines.push('# Report completion to the runner');
  lines.push(`_pml_meta = {`);
  lines.push(`    '__pml_event': 'node_ok',`);
  lines.push(`    'nodeId': ${toPythonLiteral(nodeId)},`);
  lines.push(`    'nodeType': ${toPythonLiteral(nodeType)},`);
  lines.push(`}`);
  lines.push(`print(json.dumps(_pml_meta, default=str))`);

  return { code: lines.join('\n'), outputVar };
}

// ─── Full graph to cell sequence ───────────────────────────────────────────────

/**
 * Topologically sort graph and return an ordered array of { nodeId, node, inEdges, code, outputVar }.
 * Suitable for sequential cell-by-cell execution.
 *
 * @param {{ nodes: object|Array, edges: Array }} graph
 * @returns {{ order: Array<{ nodeId, node, inEdges, code, outputVar }>, errors: string[] }}
 */
export function compilePipelineCells(graph) {
  const edges = normalizeEdges(graph.edges || []);

  const nodesById = Array.isArray(graph.nodes)
    ? Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
    : (graph.nodes || {});

  const nodeIds = Object.keys(nodesById);
  if (nodeIds.length === 0) return { order: [], errors: ['Graph is empty.'] };

  // Topological sort (Kahn's algorithm)
  const inDegree = Object.fromEntries(nodeIds.map((id) => [id, 0]));
  const adj = Object.fromEntries(nodeIds.map((id) => [id, []]));
  const inEdgesMap = Object.fromEntries(nodeIds.map((id) => [id, []]));

  for (const e of edges) {
    if (!nodesById[e.source] || !nodesById[e.target]) continue;
    adj[e.source].push(e.target);
    inEdgesMap[e.target].push(e);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  }

  const queue = nodeIds.filter((id) => inDegree[id] === 0).sort();
  const sorted = [];

  while (queue.length > 0) {
    const cur = queue.shift();
    sorted.push(cur);
    for (const next of (adj[cur] || []).sort()) {
      inDegree[next] -= 1;
      if (inDegree[next] === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  const hasCycle = sorted.length !== nodeIds.length;
  if (hasCycle) return { order: [], errors: ['Graph contains a cycle. Execution requires a DAG.'] };

  const order = sorted.map((nodeId) => {
    const node = nodesById[nodeId];
    const inEdges = inEdgesMap[nodeId] || [];
    const { code, outputVar } = compileNodeCell(node, inEdges);
    return { nodeId, node, inEdges, code, outputVar };
  });

  return { order, errors: [] };
}
