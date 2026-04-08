import { describe, it, expect } from 'vitest';
import { getPythonRuntimeCode } from '../../lib/pythonTemplates/runtimeHelpers.js';
import { TRANSFORM_NODES } from '../../nodes/transforms/transformRegistry.js';
import { LIFECYCLE_NODES } from '../../nodes/lifecycle/lifecycleRegistry.js';

function extractDispatchLiterals(block, variableName) {
  const escaped = variableName.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s*==\\s*'([^']+)'`, 'g');
  const out = new Set();
  let match = regex.exec(block);
  while (match) {
    out.add(match[1]);
    match = regex.exec(block);
  }
  return out;
}

function extractFunctionBlock(code, marker) {
  const start = code.indexOf(marker);
  if (start < 0) return '';
  const next = code.indexOf('\n\ndef ', start + marker.length);
  return next > start ? code.slice(start, next) : code.slice(start);
}

function toLifecycleStage(nodeType) {
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

describe('runtime dispatch parity', () => {
  it('ensures registry transform nodes have runtime dispatch coverage', () => {
    const runtime = getPythonRuntimeCode();
    const transformBlock = extractFunctionBlock(runtime, 'def apply_transform(');
    const dispatched = extractDispatchLiterals(transformBlock, 'transform_type');

    const registryTypes = TRANSFORM_NODES.map((node) => node.type);
    const missing = registryTypes.filter((type) => !dispatched.has(type));

    expect(missing).toEqual([]);
  });

  it('flags newly added runtime transforms that lack registry nodes', () => {
    const runtime = getPythonRuntimeCode();
    const transformBlock = extractFunctionBlock(runtime, 'def apply_transform(');
    const dispatched = extractDispatchLiterals(transformBlock, 'transform_type');

    const registryTypes = new Set(TRANSFORM_NODES.map((node) => node.type));

    // Runtime-only helpers that are intentionally not exposed in the palette.
    const allowedRuntimeOnly = new Set([
      'transform.image.to_tensor',
      'transform.image.pad',
      'transform.image.random_crop',
      'transform.image.random_horizontal_flip',
      'transform.image.random_vertical_flip',
      'transform.image.random_erasing',
      'transform.image.random_affine',
      'transform.image.perspective_transform',
      'transform.image.cutmix',
      'transform.image.mixup',
      'transform.text.tokenization',
      'transform.text.padding',
      'transform.pipeline.compose',
    ]);

    const unregistered = Array.from(dispatched)
      .filter((type) => !registryTypes.has(type))
      .filter((type) => !allowedRuntimeOnly.has(type));

    expect(unregistered).toEqual([]);
  });

  it('ensures lifecycle registry nodes map to available runtime stages', () => {
    const runtime = getPythonRuntimeCode();
    const lifecycleBlock = extractFunctionBlock(runtime, 'def apply_lifecycle(');
    const stages = extractDispatchLiterals(lifecycleBlock, 'stage');

    const neededStages = LIFECYCLE_NODES.map((node) => toLifecycleStage(node.type));
    const missing = neededStages.filter((stage) => !stages.has(stage));

    expect(missing).toEqual([]);
  });
});
