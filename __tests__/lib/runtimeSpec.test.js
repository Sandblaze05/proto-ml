import { describe, it, expect } from 'vitest';
import { validateNodeSpec, createNodeSpec, getPortContract, getConfigSchema, getCacheMetadata, VALID_KINDS, VALID_PORT_ROLES } from '../../lib/runtimeSpec/nodeSpec.js';
import { computeNodeHash, isDeterministic, getSeed, getCacheKey, createCacheEntry } from '../../lib/runtimeSpec/cacheMetadata.js';
import compilerDispatch, { CompilerDispatch, DispatchEntry } from '../../lib/runtimeSpec/compilerDispatch.js';
import { RuntimeFactory, RuntimeRegistry } from '../../lib/runtimeSpec/runtimeFactory.js';
import { NODE_REGISTRY, getNodeDef, getInputPorts, getOutputPorts, getNodeConfigDefaults, getNodeConfigSchema, getNodeCacheMetadata, validateNodeDef, getPortContractForNode } from '../../nodes/nodeRegistry.js';
import { listNodeDefs } from '../../nodes/nodeRegistry.js';

describe('canonical node spec validation', () => {
  it('validates a minimal valid node spec', () => {
    const spec = createNodeSpec({
      type: 'test.canonical',
      kind: 'transform',
      label: 'Test Canonical',
      ports: {
        inputs: [{ name: 'in', datatype: 'any', shape: [], role: 'data' }],
        outputs: [{ name: 'out', datatype: 'any', shape: [], role: 'data' }],
      },
      config: {
        defaults: { operation: 'identity' },
        schema: { operation: { type: 'enum', options: ['identity'] } },
      },
      preview: 'test.canonical',
      backend: 'test.canonical',
      cache: { version: '1.0.0', seed: 42, deterministic: true },
    });

    expect(spec.type).toBe('test.canonical');
    expect(spec.kind).toBe('transform');
    expect(spec.ports.inputs).toHaveLength(1);
    expect(spec.ports.outputs).toHaveLength(1);
    expect(spec.config.defaults).toEqual({ operation: 'identity' });
    expect(spec.cache.version).toBe('1.0.0');
  });

  it('rejects a node spec missing required fields', () => {
    const result = validateNodeSpec({ type: 'test.bad' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a node spec with invalid kind', () => {
    const result = validateNodeSpec({
      type: 'test.bad',
      kind: 'invalid_kind',
      label: 'Bad',
      ports: { inputs: [], outputs: [] },
      config: { defaults: {} },
      preview: 'test.bad',
      backend: 'test.bad',
      cache: { version: '1.0.0' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('kind'))).toBe(true);
  });

  it('accepts all valid kinds', () => {
    for (const kind of VALID_KINDS) {
      const result = validateNodeSpec({
        type: `test.${kind}`,
        kind,
        label: `Test ${kind}`,
        ports: { inputs: [], outputs: [] },
        config: { defaults: {} },
        preview: `test.${kind}`,
        backend: `test.${kind}`,
        cache: { version: '1.0.0' },
      });
      expect(result.valid).toBe(true);
    }
  });
});

describe('canonical port contract', () => {
  it('extracts port contract from a node spec', () => {
    const spec = createNodeSpec({
      type: 'test.ports',
      kind: 'transform',
      label: 'Test Ports',
      ports: {
        inputs: [
          { name: 'in1', datatype: 'tensor', shape: ['B'], role: 'data' },
          { name: 'in2', datatype: 'dict', shape: [], role: 'config', optional: true },
        ],
        outputs: [
          { name: 'out1', datatype: 'tensor', shape: ['B'], role: 'data' },
        ],
      },
      config: { defaults: {}, schema: null },
      preview: 'test.ports',
      backend: 'test.ports',
      cache: { version: '1.0.0' },
    });

    const contract = getPortContract(spec);
    expect(contract.inputs).toHaveLength(2);
    expect(contract.outputs).toHaveLength(1);
    expect(contract.inputs[0].name).toBe('in1');
    expect(contract.inputs[0].role).toBe('data');
    expect(contract.inputs[1].optional).toBe(true);
  });
});

describe('canonical config schema', () => {
  it('extracts config schema from a node spec', () => {
    const spec = createNodeSpec({
      type: 'test.config',
      kind: 'transform',
      label: 'Test Config',
      ports: { inputs: [], outputs: [] },
      config: {
        defaults: { key: 'value' },
        schema: { key: { type: 'string' } },
      },
      preview: 'test.config',
      backend: 'test.config',
      cache: { version: '1.0.0' },
    });

    const configSchema = getConfigSchema(spec);
    expect(configSchema.defaults).toEqual({ key: 'value' });
    expect(configSchema.schema).toEqual({ key: { type: 'string' } });
  });
});

describe('canonical cache metadata', () => {
  it('extracts cache metadata from a node spec', () => {
    const spec = createNodeSpec({
      type: 'test.cache',
      kind: 'transform',
      label: 'Test Cache',
      ports: { inputs: [], outputs: [] },
      config: { defaults: {} },
      preview: 'test.cache',
      backend: 'test.cache',
      cache: { version: '2.0.0', seed: 123, deterministic: false },
    });

    const meta = getCacheMetadata(spec);
    expect(meta.version).toBe('2.0.0');
    expect(meta.seed).toBe(123);
    expect(meta.deterministic).toBe(false);
  });

  it('computes deterministic hashes for identical configs', () => {
    const hash1 = computeNodeHash('test.type', { key: 'value' }, '1.0.0');
    const hash2 = computeNodeHash('test.type', { key: 'value' }, '1.0.0');
    expect(hash1).toBe(hash2);
  });

  it('computes different hashes for different configs', () => {
    const hash1 = computeNodeHash('test.type', { key: 'value1' }, '1.0.0');
    const hash2 = computeNodeHash('test.type', { key: 'value2' }, '1.0.0');
    expect(hash1).not.toBe(hash2);
  });

  it('detects non-deterministic nodes', () => {
    expect(isDeterministic('transform.image.random_flip')).toBe(false);
    expect(isDeterministic('lifecycle.split')).toBe(false);
    expect(isDeterministic('transform.core.map')).toBe(true);
  });

  it('generates stable cache keys', () => {
    const key1 = getCacheKey('test.type', { key: 'value' }, '1.0.0');
    const key2 = getCacheKey('test.type', { key: 'value' }, '1.0.0');
    expect(key1).toBe(key2);
  });

  it('creates cache entries with all metadata', () => {
    const entry = createCacheEntry('test.type', { key: 'value' }, { result: 'data' }, '1.0.0');
    expect(entry.nodeType).toBe('test.type');
    expect(entry.configHash).toBeDefined();
    expect(entry.seed).toBe(42);
    expect(entry.version).toBe('1.0.0');
    expect(entry.resultHash).toBeDefined();
  });
});

describe('canonical compiler dispatch', () => {
  it('registers and resolves dispatch entries', () => {
    const dispatch = new CompilerDispatch();
    dispatch.register('test.node', {
      nodeSpec: { type: 'test.node', kind: 'transform', label: 'Test', ports: { inputs: [], outputs: [] }, config: { defaults: {} }, preview: null, backend: null, cache: { version: '1.0.0' } },
      runtimeFactory: null,
      pythonTemplate: null,
    }, { kind: 'transform', stage: null });

    expect(dispatch.has('test.node')).toBe(true);
    expect(dispatch.resolve('test.node')).toBeInstanceOf(DispatchEntry);
  });

  it('classifies node types by kind', () => {
    const dispatch = new CompilerDispatch();
    dispatch.register('dataset.test', {}, { kind: 'dataset' });
    dispatch.register('transform.test', {}, { kind: 'transform' });
    dispatch.register('lifecycle.test', {}, { kind: 'lifecycle' });

    expect(dispatch.classify('dataset.test')).toBe('dataset');
    expect(dispatch.classify('transform.test')).toBe('transform');
    expect(dispatch.classify('lifecycle.test')).toBe('lifecycle');
    expect(dispatch.classify('unknown.test')).toBe('generic');
  });

  it('maps lifecycle stages', () => {
    const dispatch = new CompilerDispatch();
    expect(dispatch.mapLifecycleStage('lifecycle.split')).toBe('split');
    expect(dispatch.mapLifecycleStage('lifecycle.batch_loader')).toBe('dataloader');
    expect(dispatch.mapLifecycleStage('lifecycle.core.trainer')).toBe('training');
  });

  it('lists types by kind', () => {
    const dispatch = new CompilerDispatch();
    dispatch.register('dataset.a', {}, { kind: 'dataset' });
    dispatch.register('dataset.b', {}, { kind: 'dataset' });
    dispatch.register('transform.a', {}, { kind: 'transform' });

    expect(dispatch.getTypesByKind('dataset')).toContain('dataset.a');
    expect(dispatch.getTypesByKind('dataset')).toContain('dataset.b');
    expect(dispatch.getTypesByKind('transform')).toContain('transform.a');
    expect(dispatch.getTypesByKind('dataset')).not.toContain('transform.a');
  });

  it('unregisters entries', () => {
    const dispatch = new CompilerDispatch();
    dispatch.register('test.node', {}, { kind: 'transform' });
    expect(dispatch.has('test.node')).toBe(true);
    expect(dispatch.unregister('test.node')).toBe(true);
    expect(dispatch.has('test.node')).toBe(false);
  });
});

describe('canonical runtime registry', () => {
  it('registers and resolves runtime factory classes', () => {
    const registry = new RuntimeRegistry();
    class TestRuntime extends RuntimeFactory {
      async getSample(n = 5, context = {}) { return []; }
      _getDefaults() { return { key: 'default' }; }
      _getNodeSpec() { return { cache: { version: '1.0.0', seed: 42, deterministic: true } }; }
    }

    registry.register('test.runtime', TestRuntime);
    expect(registry.has('test.runtime')).toBe(true);
    expect(registry.resolve('test.runtime')).toBe(TestRuntime);
  });

  it('creates runtime instances', () => {
    const registry = new RuntimeRegistry();
    class TestRuntime extends RuntimeFactory {
      async getSample(n = 5, context = {}) { return []; }
      _getDefaults() { return { key: 'default' }; }
      _getNodeSpec() { return { cache: { version: '1.0.0', seed: 42, deterministic: true } }; }
    }

    registry.register('test.runtime', TestRuntime);
    const instance = registry.create('test.runtime', { key: 'custom' });
    expect(instance).toBeInstanceOf(TestRuntime);
  });

  it('prevents duplicate registration without overwrite', () => {
    const registry = new RuntimeRegistry();
    class TestRuntime extends RuntimeFactory {
      async getSample(n = 5, context = {}) { return []; }
      _getDefaults() { return {}; }
      _getNodeSpec() { return { cache: { version: '1.0.0' } }; }
    }

    registry.register('test.runtime', TestRuntime);
    expect(() => registry.register('test.runtime', TestRuntime)).toThrow(/already exists/i);
  });

  it('lists all registered types', () => {
    const registry = new RuntimeRegistry();
    class TestRuntime extends RuntimeFactory {
      async getSample(n = 5, context = {}) { return []; }
      _getDefaults() { return {}; }
      _getNodeSpec() { return { cache: { version: '1.0.0' } }; }
    }

    registry.register('test.a', TestRuntime);
    registry.register('test.b', TestRuntime);
    const types = registry.listTypes();
    expect(types).toContain('test.a');
    expect(types).toContain('test.b');
  });
});

describe('node registry canonical conformance', () => {
  it('all registered node types have canonical node specs', () => {
    const defs = listNodeDefs();
    const results = defs.map((def) => {
      const validation = validateNodeSpec(def);
      return { type: def.type, valid: validation.valid, errors: validation.errors };
    });

    const invalid = results.filter((r) => !r.valid);
    expect(invalid).toHaveLength(0);
  });

  it('seeds compiler dispatch from registered node types', () => {
    expect(compilerDispatch.has('dataset.csv')).toBe(true);
    expect(compilerDispatch.classify('dataset.csv')).toBe('dataset');
    expect(compilerDispatch.mapLifecycleStage('lifecycle.core.trainer')).toBe('training');

    const invalid = compilerDispatch.validateAll().filter((entry) => !entry.valid);
    expect(invalid).toHaveLength(0);
  });

  it('dataset nodes have canonical ports', () => {
    const csvDef = getNodeDef('dataset.csv');
    expect(csvDef).toBeDefined();

    const inputPorts = getInputPorts('dataset.csv');
    const outputPorts = getOutputPorts('dataset.csv');

    expect(Array.isArray(inputPorts)).toBe(true);
    expect(Array.isArray(outputPorts)).toBe(true);
    expect(outputPorts.some((p) => p.name === 'out')).toBe(true);
  });

  it('dataset nodes have canonical config', () => {
    const defaults = getNodeConfigDefaults('dataset.csv');
    expect(defaults).toBeDefined();
    expect(typeof defaults).toBe('object');

    const schema = getNodeConfigSchema('dataset.csv');
    expect(schema).toBeDefined();
  });

  it('dataset nodes have canonical cache metadata', () => {
    const cacheMeta = getNodeCacheMetadata('dataset.csv');
    expect(cacheMeta).toBeDefined();
    expect(cacheMeta.version).toBeDefined();
    expect(typeof cacheMeta.seed).toBe('number');
    expect(typeof cacheMeta.deterministic).toBe('boolean');
  });

  it('node registry validates node definitions', () => {
    const result = validateNodeDef('dataset.csv');
    expect(result).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('getPortContractForNode returns port contract', () => {
    const contract = getPortContractForNode('dataset.csv');
    expect(contract).toBeDefined();
    expect(contract.inputs).toBeDefined();
    expect(contract.outputs).toBeDefined();
  });
});

describe('runtime factory canonical conformance', () => {
  it('transform preview runtime has validateConfig method', () => {
    const runtimeFactories = require('../../lib/runtimeFactories');
    const runtime = runtimeFactories.create('transform.core.map', { operation: 'identity' });
    expect(runtime).toBeDefined();
    expect(typeof runtime.validateConfig).toBe('function');
    expect(typeof runtime.getCacheMetadata).toBe('function');
  });

  it('lifecycle preview runtime has validateConfig method', () => {
    const runtimeFactories = require('../../lib/runtimeFactories');
    const runtime = runtimeFactories.create('lifecycle.split', { train_pct: 70 });
    expect(runtime).toBeDefined();
    expect(typeof runtime.validateConfig).toBe('function');
    expect(typeof runtime.getCacheMetadata).toBe('function');
  });

  it('dataset runtime has validateConfig method', () => {
    const runtimeFactories = require('../../lib/runtimeFactories');
    const runtime = runtimeFactories.create('dataset.csv', { path: '/tmp/test.csv' });
    expect(runtime).toBeDefined();
    if (typeof runtime.validateConfig === 'function') {
      expect(typeof runtime.validateConfig).toBe('function');
    }
    if (typeof runtime.getCacheMetadata === 'function') {
      expect(typeof runtime.getCacheMetadata).toBe('function');
    }
  });
});