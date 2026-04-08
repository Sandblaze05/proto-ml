import { describe, it, expect } from 'vitest';
import { DATASET_NODES, LIFECYCLE_NODES, NODE_REGISTRY, getNodeDef, arePortsCompatible, inferPortRole, arePortRolesCompatible, getPrimitiveIntent, PRIMITIVE_INTENTS, registerNodeDef, unregisterNodeDef, hasNodeDef, listNodeDefs } from '../../nodes/nodeRegistry.js';
import { TRANSFORM_NODES } from '../../nodes/transforms/transformRegistry.js';

describe('nodeRegistry', () => {
  it('includes task-agnostic core workflow lifecycle nodes', () => {
    expect(NODE_REGISTRY['lifecycle.core.objective']).toBeDefined();
    expect(NODE_REGISTRY['lifecycle.core.trainer']).toBeDefined();
    expect(NODE_REGISTRY['lifecycle.core.evaluator']).toBeDefined();
    expect(NODE_REGISTRY['lifecycle.core.predictor']).toBeDefined();
    expect(NODE_REGISTRY['lifecycle.core.hyperparameter_tuner']).toBeDefined();
    expect(NODE_REGISTRY['lifecycle.core.exporter']).toBeDefined();
    expect(NODE_REGISTRY['lifecycle.core.feature_engineer']).toBeDefined();
    expect(NODE_REGISTRY['lifecycle.core.ensemble']).toBeDefined();
  });

  it('includes task-agnostic core transform primitives', () => {
    expect(NODE_REGISTRY['transform.core.map']).toBeDefined();
    expect(NODE_REGISTRY['transform.core.join']).toBeDefined();
    expect(NODE_REGISTRY['transform.core.route']).toBeDefined();
  });

  it('supports wildcard datatype compatibility for core nodes', () => {
    expect(arePortsCompatible({ datatype: 'any' }, { datatype: 'tensor' })).toBe(true);
    expect(arePortsCompatible({ datatype: 'dict' }, { datatype: 'any' })).toBe(true);
  });

  it('infers semantic port roles from names and datatypes', () => {
    expect(inferPortRole({ name: 'train_data', datatype: 'any' })).toBe('data');
    expect(inferPortRole({ name: 'loss', datatype: 'loss' })).toBe('objective');
    expect(inferPortRole({ name: 'custom_output', datatype: 'any' })).toBe('any');
    expect(inferPortRole({ name: 'foo', datatype: 'tensor' })).toBe('unknown');
  });

  it('supports role-compatible semantic aliases', () => {
    expect(arePortRolesCompatible({ name: 'labels', datatype: 'tensor' }, { name: 'targets', datatype: 'tensor' })).toBe(true);
    expect(arePortRolesCompatible({ name: 'metrics', datatype: 'dict' }, { name: 'train_data', datatype: 'dict' })).toBe(false);
  });

  it('enforces role compatibility when datatype matches', () => {
    expect(arePortsCompatible(
      { name: 'metrics', datatype: 'dict' },
      { name: 'train_data', datatype: 'dict' },
    )).toBe(false);

    expect(arePortsCompatible(
      { name: 'labels', datatype: 'tensor' },
      { name: 'targets', datatype: 'tensor' },
    )).toBe(true);
  });

  it('maps primitive node types to primitive intents', () => {
    expect(getPrimitiveIntent('dataset.csv')).toBe(PRIMITIVE_INTENTS.DATASOURCE);
    expect(getPrimitiveIntent('transform.core.map')).toBe(PRIMITIVE_INTENTS.MAP);
    expect(getPrimitiveIntent('transform.core.join')).toBe(PRIMITIVE_INTENTS.JOIN);
    expect(getPrimitiveIntent('lifecycle.batch_loader')).toBe(PRIMITIVE_INTENTS.BATCH_LOADER);
    expect(getPrimitiveIntent('lifecycle.core.trainer')).toBe(PRIMITIVE_INTENTS.TRAINER);
    expect(getPrimitiveIntent('some.unknown.node')).toBe(PRIMITIVE_INTENTS.UNKNOWN);
  });

  it('registers and unregisters node definitions for extension flows', () => {
    const type = 'transform.test.runtime_added';
    const def = {
      type,
      kind: 'transform',
      label: 'Runtime Added Transform',
      category: 'test',
      inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
      outputs: [{ name: 'out', datatype: 'any', shape: [] }],
    };

    const registration = registerNodeDef(def);
    expect(registration).toMatchObject({ type, replaced: false });
    expect(hasNodeDef(type)).toBe(true);
    expect(getNodeDef(type)).toEqual(def);
    expect(listNodeDefs().some((entry) => entry.type === type)).toBe(true);

    expect(() => registerNodeDef(def)).toThrow(/already exists/i);
    expect(registerNodeDef({ ...def, label: 'Updated' }, { overwrite: true })).toMatchObject({ replaced: true });

    expect(unregisterNodeDef(type)).toBe(true);
    expect(unregisterNodeDef(type)).toBe(false);
  });
});
