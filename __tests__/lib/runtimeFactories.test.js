import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const runtimeFactories = require('../../lib/runtimeFactories');

describe('runtimeFactories extensibility', () => {
  it('registers and resolves a dynamic runtime factory', async () => {
    const nodeType = 'dataset.test.dynamic';
    const factory = () => ({
      getSample: async () => [{ ok: true }],
    });

    const registration = runtimeFactories.register(nodeType, factory);
    expect(registration).toMatchObject({ nodeType, replaced: false });

    const resolved = runtimeFactories.get(nodeType);
    expect(typeof resolved).toBe('function');
    const runtime = resolved({});
    await expect(runtime.getSample(1, {})).resolves.toEqual([{ ok: true }]);

    expect(runtimeFactories.unregister(nodeType)).toBe(true);
    expect(runtimeFactories.unregister(nodeType)).toBe(false);
  });

  it('prevents accidental overwrite unless explicitly allowed', () => {
    const nodeType = 'dataset.test.overwrite';
    const first = () => ({ getSample: async () => ['first'] });
    const second = () => ({ getSample: async () => ['second'] });

    runtimeFactories.register(nodeType, first);
    expect(() => runtimeFactories.register(nodeType, second)).toThrow(/already exists/i);

    const overwriteResult = runtimeFactories.register(nodeType, second, { overwrite: true });
    expect(overwriteResult).toMatchObject({ nodeType, replaced: true });

    const resolved = runtimeFactories.get(nodeType);
    expect(resolved).toBe(second);

    runtimeFactories.unregister(nodeType);
  });

  it('includes dynamic and built-in types in the registry listing', () => {
    const nodeType = 'dataset.test.listed';
    runtimeFactories.register(nodeType, () => ({ getSample: async () => [] }));

    const listed = runtimeFactories.listRegisteredTypes();
    expect(listed).toContain(nodeType);
    expect(listed).toContain('dataset.csv');

    runtimeFactories.unregister(nodeType);
  });
});
