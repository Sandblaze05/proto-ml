import { getPythonRuntimeCode } from '../pythonTemplates/runtimeHelpers.js';
import { getNodeDef } from '../../nodes/nodeRegistry.js';

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

function normalizeValidationMode(mode) {
  return mode === 'relax' ? 'relax' : 'strict';
}

function normalizeExecutionSeed(seed) {
  if (seed === undefined || seed === null || seed === '') return 42;
  const parsed = Number(seed);
  if (!Number.isFinite(parsed)) return 42;
  return Math.trunc(parsed);
}

function buildIncomingMap(nodeIds, edges) {
  const incoming = Object.fromEntries(nodeIds.map((id) => [id, []]));
  edges.forEach((e) => incoming[e.target]?.push(e));
  Object.values(incoming).forEach((list) => {
    list.sort((a, b) => {
      const aTarget = String(a.targetHandle || '');
      const bTarget = String(b.targetHandle || '');
      if (aTarget !== bTarget) return aTarget.localeCompare(bTarget);

      const aSource = String(a.sourceHandle || '');
      const bSource = String(b.sourceHandle || '');
      if (aSource !== bSource) return aSource.localeCompare(bSource);

      return String(a.source || '').localeCompare(String(b.source || ''));
    });
  });
  return incoming;
}

function normalizePortDefs(ports) {
  return Array.isArray(ports)
    ? ports.filter((port) => port && typeof port.name === 'string' && port.name.trim())
    : [];
}

function inferDefaultPortName(ports, preferred = []) {
  const normalized = normalizePortDefs(ports);
  if (normalized.length === 0) return null;

  for (const candidate of preferred) {
    const found = normalized.find((port) => port.name === candidate);
    if (found) return found.name;
  }

  return normalized[0].name;
}

function inferDefaultSourceHandle(nodeDef) {
  return inferDefaultPortName(nodeDef?.outputs, ['out', 'data', 'rows', 'merged']);
}

function inferDefaultTargetHandle(nodeDef) {
  const allInputs = normalizePortDefs(nodeDef?.inputs);
  if (allInputs.length === 1) return allInputs[0].name;
  return null;
}

function getEdgeTargetHandle(edge, targetNodeDef) {
  if (edge?.targetHandle && typeof edge.targetHandle === 'string') return edge.targetHandle;
  return inferDefaultTargetHandle(targetNodeDef);
}

function collectProvidedInputHandles(inEdges = [], targetNodeDef) {
  const handles = new Set();
  let hasUnnamedInput = false;

  for (const edge of inEdges) {
    const inferredHandle = getEdgeTargetHandle(edge, targetNodeDef);
    if (inferredHandle) {
      handles.add(inferredHandle);
    } else {
      hasUnnamedInput = true;
    }
  }

  return { handles, hasUnnamedInput };
}

function createValidationMessage(nodeId, nodeType, detail) {
  return `[${nodeId} | ${nodeType}] ${detail}`;
}

function validateGraphSemantics({ nodesById, order, incoming, mode }) {
  const errors = [];
  const warnings = [];

  const pushIssue = (message) => {
    if (mode === 'strict') errors.push(message);
    else warnings.push(message);
  };

  for (const nodeId of order) {
    const outEdges = Object.entries(incoming)
      .flatMap(([targetId, inEdges]) => inEdges.map((edge) => ({ ...edge, _targetId: targetId })))
      .filter((edge) => edge.source === nodeId);

    if (outEdges.length === 0) continue;

    const sourceNode = nodesById[nodeId] || {};
    const sourceType = sourceNode.type || 'unknown';
    const sourceDef = getNodeDef(sourceType);
    const sourceOutputs = normalizePortDefs(sourceDef?.outputs);
    const sourceOutputNames = new Set(sourceOutputs.map((port) => port.name));

    for (const edge of outEdges) {
      const targetNode = nodesById[edge._targetId] || {};
      const targetType = targetNode.type || 'unknown';
      const targetDef = getNodeDef(targetType);
      const targetInputs = normalizePortDefs(targetDef?.inputs);
      const targetInputNames = new Set(targetInputs.map((port) => port.name));

      if (sourceDef) {
        if (edge.sourceHandle) {
          if (!sourceOutputNames.has(edge.sourceHandle)) {
            pushIssue(createValidationMessage(
              nodeId,
              sourceType,
              `Edge to ${edge._targetId} references unknown source handle '${edge.sourceHandle}'.`,
            ));
          }
        } else {
          const inferredSourceHandle = inferDefaultSourceHandle(sourceDef);
          if (!inferredSourceHandle) {
            pushIssue(createValidationMessage(
              nodeId,
              sourceType,
              `Edge to ${edge._targetId} is missing source handle and no deterministic default output is available.`,
            ));
          }
        }
      }

      if (targetDef) {
        if (edge.targetHandle) {
          if (!targetInputNames.has(edge.targetHandle)) {
            pushIssue(createValidationMessage(
              edge._targetId,
              targetType,
              `Edge from ${nodeId} references unknown target handle '${edge.targetHandle}'.`,
            ));
          }
        } else {
          const inferredTargetHandle = inferDefaultTargetHandle(targetDef);
          if (!inferredTargetHandle) {
            pushIssue(createValidationMessage(
              edge._targetId,
              targetType,
              `Edge from ${nodeId} is missing target handle and no deterministic default input is available.`,
            ));
          }
        }
      }
    }
  }

  for (const nodeId of order) {
    const node = nodesById[nodeId] || {};
    const nodeType = node.type || 'unknown';
    const stage = classifyNode(nodeType);
    const inEdges = incoming[nodeId] || [];
    const nodeDef = getNodeDef(nodeType);

    if (!nodeDef) {
      warnings.push(createValidationMessage(nodeId, nodeType, 'No registered node definition found. Falling back to generic compilation behavior.'));
    }

    if ((stage === 'transform' || stage === 'lifecycle') && inEdges.length === 0) {
      pushIssue(createValidationMessage(nodeId, nodeType, 'Node has no upstream input.'));
    }

    const requiredInputs = (nodeDef?.inputs || []).filter((port) => port && port.optional === false);
    if (requiredInputs.length === 0) continue;

    const { handles: providedHandles, hasUnnamedInput } = collectProvidedInputHandles(inEdges, nodeDef);

    if (providedHandles.size === 0 && hasUnnamedInput && inEdges.length >= requiredInputs.length) {
      continue;
    }

    if (providedHandles.size === 0 && hasUnnamedInput && inEdges.length < requiredInputs.length) {
      pushIssue(createValidationMessage(
        nodeId,
        nodeType,
        `Node has ${inEdges.length} unnamed upstream inputs but requires at least ${requiredInputs.length} required input(s): ${requiredInputs.map((p) => p.name).join(', ')}.`,
      ));
      continue;
    }

    const missingRequired = requiredInputs
      .map((port) => port.name)
      .filter((name) => !providedHandles.has(name));

    if (missingRequired.length > 0) {
      pushIssue(createValidationMessage(
        nodeId,
        nodeType,
        `Missing required input handle(s): ${missingRequired.join(', ')}.`,
      ));
    }
  }

  return { errors, warnings };
}

function topologicalSort(nodesById, edges) {
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

  return { order, hasCycle: order.length !== ids.length };
}

function buildDependencyMap(order, incoming) {
  const dependencyMap = {};
  for (const nodeId of order) {
    const deps = (incoming[nodeId] || []).map((edge) => edge.source).filter(Boolean);
    dependencyMap[nodeId] = Array.from(new Set(deps)).sort();
  }
  return dependencyMap;
}

function classifyNode(nodeType = '') {
  if (nodeType.startsWith('dataset.')) return 'dataset';
  if (nodeType.startsWith('transform.')) return 'transform';
  if (nodeType.startsWith('lifecycle.')) return 'lifecycle';
  
  return 'generic';
}

function normalizeObjectiveConfig(config = {}) {
  const normalized = { ...config };

  if (!normalized.task_type && normalized.objective_type) {
    normalized.task_type = normalized.objective_type;
  }

  if (!normalized.loss_name && normalized.loss) {
    normalized.loss_name = normalized.loss === 'auto' ? 'cross_entropy' : normalized.loss;
  }

  if (!normalized.metrics) {
    if (Array.isArray(normalized.primary_metric)) {
      normalized.metrics = normalized.primary_metric;
    } else if (typeof normalized.primary_metric === 'string' && normalized.primary_metric !== 'auto' && normalized.primary_metric.trim()) {
      normalized.metrics = [normalized.primary_metric.trim()];
    }
  }

  if (!normalized.loss_reduction) normalized.loss_reduction = 'mean';
  if (normalized.label_smoothing === undefined) normalized.label_smoothing = 0.1;
  if (!normalized.task_type) normalized.task_type = 'supervised';
  if (!Array.isArray(normalized.metrics)) normalized.metrics = [];

  return normalized;
}

function normalizeNodeConfig(nodeType = '', config = {}) {
  if (nodeType === 'lifecycle.core.objective') {
    return normalizeObjectiveConfig(config);
  }
  return config || {};
}

function mapLifecycleDispatchStage(nodeType = '') {
  const lifecycleStageMap = {
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
  return lifecycleStageMap[nodeType] || nodeType;
}

function indentLines(lines, level = 1) {
  const prefix = '    '.repeat(level);
  return lines.map((line) => (line ? `${prefix}${line}` : ''));
}

export function compileExecutionGraph({ nodes = {}, edges = [] } = {}, options = {}) {
  const validationMode = normalizeValidationMode(options.validationMode);
  const executionSeed = normalizeExecutionSeed(options.seed);
  const validateOnly = options.validateOnly === true;
  const nodesById = Array.isArray(nodes)
    ? Object.fromEntries(nodes.map((n) => [n.id, n]))
    : (nodes || {});
  const normalizedEdges = normalizeEdges(edges);

  const nodeIds = Object.keys(nodesById);
  if (nodeIds.length === 0) {
    return {
      ok: false,
      errors: ['Graph is empty. Add at least one dataset node.'],
      warnings: [],
      code: '',
      metadata: { nodeCount: 0, edgeCount: 0, validationMode },
    };
  }

  const { order, hasCycle } = topologicalSort(nodesById, normalizedEdges);
  const errors = [];
  if (hasCycle) errors.push('Graph contains a cycle. Compiler requires a DAG.');

  const datasets = order.filter((id) => classifyNode(nodesById[id]?.type) === 'dataset');
  if (datasets.length === 0) errors.push('No dataset source node found. Add a dataset.* node as source.');

  const incoming = buildIncomingMap(nodeIds, normalizedEdges);
  const semanticValidation = validateGraphSemantics({
    nodesById,
    order,
    incoming,
    mode: validationMode,
  });
  errors.push(...semanticValidation.errors);

  const warnings = [...semanticValidation.warnings];

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      code: '',
      metadata: {
        nodeCount: nodeIds.length,
        edgeCount: normalizedEdges.length,
        datasetCount: datasets.length,
        validationMode,
      },
    };
  }

  if (validateOnly) {
    const dependencyMap = buildDependencyMap(order, incoming);
    return {
      ok: true,
      errors: [],
      warnings,
      code: '',
      metadata: {
        nodeCount: nodeIds.length,
        edgeCount: normalizedEdges.length,
        order,
        dependencyMap,
        datasetCount: datasets.length,
        validationMode,
      },
    };
  }

  const sectionImports = new Set([
    'from collections import defaultdict',
    'from typing import Any, Dict',
    'import json',
    'import random',
  ]);

  // Runtime code includes all transform, lifecycle, and generic node implementations
  const runtimeCode = getPythonRuntimeCode();
  const runtimeDefs = runtimeCode.split('\n');
  
  // Add the run_pipeline function signature and initialization
  const sectionDefs = [
    ...runtimeDefs,
    '',
    'def run_pipeline():',
    '    ctx = defaultdict(dict)',
    '    node_meta = {}',
    '    node_outputs = {}',
    `    graph_spec = ${toPythonLiteral({
      nodeCount: nodeIds.length,
      edgeCount: normalizedEdges.length,
      order,
      datasets,
    })}`,
    `    execution_seed = ${toPythonLiteral(executionSeed)}`,
    '    random.seed(execution_seed)',
    '    try:',
    '        np.random.seed(execution_seed)',
    '    except Exception:',
    '        pass',
    '',
  ];

  const sectionBody = [];

  for (const nodeId of order) {
    const node = nodesById[nodeId] || {};
    const nodeType = node.type || 'unknown';
    const nodeDef = getNodeDef(nodeType);
    const nodeConfig = normalizeNodeConfig(nodeType, node.config || {});
    const stage = classifyNode(nodeType);
    const symbol = nodeIdToSymbol(nodeId);
    const cfgSymbol = `${symbol}_config`;
    const lifecycleStage = mapLifecycleDispatchStage(nodeType);

    sectionBody.push('');
    sectionBody.push(`# Node ${nodeId} (${nodeType})`);
    sectionBody.push(`${cfgSymbol} = ${toPythonLiteral(nodeConfig)}`);
    sectionBody.push(`node_meta['${nodeId}'] = {'type': ${toPythonLiteral(nodeType)}, 'stage': ${toPythonLiteral(stage)}}`);

    if (node.pythonCode) {
      sectionBody.push('# Template reference (for traceability):');
      const lines = String(node.pythonCode).split('\n').slice(0, 6);
      lines.forEach((l) => sectionBody.push(`#   ${l}`));
    }

    const inEdges = incoming[nodeId] || [];

    if (stage === 'dataset') {
      const outputHandles = normalizePortDefs(nodeDef?.outputs)
        .map((port) => port.name)
        .filter(Boolean);
      const uniqueHandles = Array.from(new Set(['out', ...outputHandles]));

      sectionBody.push(`_dataset_${symbol} = {'dataset_type': ${toPythonLiteral(nodeType)}, 'config': ${cfgSymbol}}`);
      sectionBody.push(`ctx['${nodeId}']['out'] = {'out': _dataset_${symbol}}`);
      uniqueHandles
        .filter((handle) => handle !== 'out')
        .forEach((handle) => {
          sectionBody.push(`ctx['${nodeId}']['out'][${toPythonLiteral(handle)}] = {'dataset_type': ${toPythonLiteral(nodeType)}, 'config': ${cfgSymbol}, 'handle': ${toPythonLiteral(handle)}}`);
        });
      sectionBody.push(`node_outputs['${nodeId}'] = ctx['${nodeId}']['out']`);
      continue;
    }

    if (stage === 'transform') {
      if (inEdges.length === 0) {
        sectionBody.push(`raise ValueError('Transform node ${nodeId} has no input source')`);
      } else if (inEdges.length === 1) {
        // Single input transform (map, route)
        const upstream = inEdges[0].source;
        const sourceHandle = inEdges[0].sourceHandle;
        sectionBody.push(`ctx['${nodeId}']['out'] = apply_transform(${toPythonLiteral(nodeType)}, select_output_handle(ctx['${upstream}']['out'], ${toPythonLiteral(sourceHandle)}), ${cfgSymbol})`);
        sectionBody.push(`node_outputs['${nodeId}'] = ctx['${nodeId}']['out']`);
      } else {
        // Multi-input transform (join)
        sectionBody.push(`_inputs_${symbol} = {}`);
        inEdges.forEach((e, idx) => {
          const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
          sectionBody.push(`_inputs_${symbol}[${toPythonLiteral(key)}] = select_output_handle(ctx['${e.source}']['out'], ${toPythonLiteral(e.sourceHandle)})`);
        });
        sectionBody.push(`ctx['${nodeId}']['out'] = apply_transform(${toPythonLiteral(nodeType)}, _inputs_${symbol}, ${cfgSymbol})`);
        sectionBody.push(`node_outputs['${nodeId}'] = ctx['${nodeId}']['out']`);
      }
      continue;
    }

    if (stage === 'lifecycle') {
      sectionBody.push(`_inputs_${symbol} = {}`);
      inEdges.forEach((e, idx) => {
        const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
        sectionBody.push(`_inputs_${symbol}[${toPythonLiteral(key)}] = select_output_handle(ctx['${e.source}']['out'], ${toPythonLiteral(e.sourceHandle)})`);
      });
      sectionBody.push(`ctx['${nodeId}']['out'] = apply_lifecycle(${toPythonLiteral(lifecycleStage)}, _inputs_${symbol}, ${cfgSymbol})`);
      sectionBody.push(`node_outputs['${nodeId}'] = ctx['${nodeId}']['out']`);
      continue;
    }

    // generic/train stages
    if (inEdges.length === 0) {
      sectionBody.push(`ctx['${nodeId}']['out'] = apply_node(${toPythonLiteral(nodeType)}, {}, ${cfgSymbol})`);
    } else {
      sectionBody.push(`_inputs_${symbol} = {}`);
      inEdges.forEach((e, idx) => {
        const key = e.targetHandle || e.sourceHandle || `in_${idx}`;
        sectionBody.push(`_inputs_${symbol}[${toPythonLiteral(key)}] = select_output_handle(ctx['${e.source}']['out'], ${toPythonLiteral(e.sourceHandle)})`);
      });
      sectionBody.push(`ctx['${nodeId}']['out'] = apply_node(${toPythonLiteral(nodeType)}, _inputs_${symbol}, ${cfgSymbol})`);
      sectionBody.push(`node_outputs['${nodeId}'] = ctx['${nodeId}']['out']`);
    }
  }

  sectionBody.push('');
  sectionBody.push(`# Pipeline outputs (leaf nodes) available in ctx`);
  sectionBody.push('compiled_result = {');
  sectionBody.push(`    'graph_spec': graph_spec,`);
  sectionBody.push(`    'node_meta': dict(node_meta),`);
  sectionBody.push(`    'node_outputs': dict(node_outputs),`);
  sectionBody.push(`    'ctx': dict(ctx),`);
  sectionBody.push('}');
  sectionBody.push('return compiled_result');

  const code = [
    '# AUTO-GENERATED PIPELINE CODE',
    '# This code is compiled from the visual execution graph.',
    '# Entry point: run_pipeline() returns a structured result for standalone execution.',
    '',
    ...Array.from(sectionImports),
    '',
    ...sectionDefs,
    '',
    ...indentLines(sectionBody),
    'if __name__ == "__main__":',
    '    result = run_pipeline()',
    '    print("Pipeline compiled and executed.")',
    '    print(json.dumps(result.get("graph_spec", {}), indent=2, default=str))',
    '',
  ].join('\n');

  const metadata = {
    nodeCount: nodeIds.length,
    edgeCount: normalizedEdges.length,
    order,
    dependencyMap: buildDependencyMap(order, incoming),
    datasetCount: datasets.length,
    validationMode,
    executionSeed,
  };

  return { ok: true, errors: [], warnings, code, metadata };
}
