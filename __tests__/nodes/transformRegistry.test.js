import { describe, it, expect } from 'vitest';
import { TRANSFORM_NODES } from '../../nodes/transforms/transformRegistry.js';

describe('transformRegistry', () => {
  it('exposes primitive transform and programming nodes', () => {
    const types = TRANSFORM_NODES.map((node) => node.type);
    expect(types).toEqual(expect.arrayContaining([
      'transform.core.map',
      'transform.core.join',
      'transform.core.route',
      'transform.program.if_else',
      'transform.program.type_switch',
    ]));
  });

  it('keeps primitive transforms wildcard-compatible', () => {
    TRANSFORM_NODES.forEach((node) => {
      expect(node.accepts).toContain('*');
      expect(node.produces).toContain('*');
      expect(node.kind).toBe('transform');
      expect(Array.isArray(node.inputs)).toBe(true);
      expect(Array.isArray(node.outputs)).toBe(true);
    });
  });

  it('defines core map operations for broad workflows', () => {
    const map = TRANSFORM_NODES.find((node) => node.type === 'transform.core.map');
    expect(map).toBeDefined();
    expect(map.uiSchema.operation.options).toEqual(
      expect.arrayContaining(['identity', 'drop_columns', 'tokenize', 'custom']),
    );
  });

  it('defines programming primitives for low-level branching', () => {
    const ifElse = TRANSFORM_NODES.find((node) => node.type === 'transform.program.if_else');
    const typeSwitch = TRANSFORM_NODES.find((node) => node.type === 'transform.program.type_switch');

    expect(ifElse).toBeDefined();
    expect(ifElse.outputs.map((port) => port.name)).toEqual(expect.arrayContaining(['true', 'false']));

    expect(typeSwitch).toBeDefined();
    expect(typeSwitch.outputs.map((port) => port.name)).toEqual(
      expect.arrayContaining(['tensor', 'sequence', 'dict', 'fallback']),
    );
  });
});
