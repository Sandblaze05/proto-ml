/**
 * RuntimeFactory — Canonical runtime factory base class.
 *
 * Every runtime implementation (preview, dataset, transform, lifecycle)
 * MUST conform to this interface. It provides:
 *   - getSample(n, context) — preview function
 *   - validateConfig(config) — config validation with defaults
 *   - getCacheMetadata() — determinism/cache metadata
 *   - compile(config) — optional Python backend code generation
 */

import { getCacheMetadata } from './nodeSpec.js';

export class RuntimeFactory {
  constructor(nodeType, config = {}) {
    if (new.target === RuntimeFactory) {
      throw new Error('RuntimeFactory is abstract and cannot be instantiated directly.');
    }
    this.nodeType = nodeType;
    this.config = config;
    this._validated = false;
    this._validationErrors = [];
  }

  /**
   * Preview function — returns a synthetic sample of n items.
   * Subclasses MUST implement this.
   */
  async getSample(n = 5, context = {}) {
    throw new Error(`RuntimeFactory.getSample() must be implemented by subclass for node type "${this.nodeType}".`);
  }

  /**
   * Validate a config object against the node's config schema.
   * Returns { valid, errors, mergedConfig }.
   */
  validateConfig(config = {}) {
    const defaults = this._getDefaults();
    const merged = { ...defaults, ...config };
    const errors = this._validateSchema(merged);

    this._validated = errors.length === 0;
    this._validationErrors = errors;

    return {
      valid: this._validated,
      errors,
      mergedConfig: merged,
    };
  }

  /**
   * Return determinism/cache metadata for this node type.
   */
  getCacheMetadata() {
    return getCacheMetadata(this._getNodeSpec());
  }

  /**
   * Optional: compile the node config into Python backend code.
   * Subclasses may override this for executable backend implementations.
   */
  compile(config = {}) {
    return null;
  }

  /**
   * Subclasses must return their default config.
   */
  _getDefaults() {
    return {};
  }

  /**
   * Subclasses may override to provide config schema validation.
   */
  _validateSchema(config) {
    return [];
  }

  /**
   * Subclasses must return their node spec for cache metadata lookup.
   */
  _getNodeSpec() {
    return {
      cache: {
        version: '1.0.0',
        seed: 42,
        deterministic: true,
      },
    };
  }
}

/**
 * Factory registry that maps node types to their canonical RuntimeFactory subclasses.
 * Replaces the ad-hoc dynamicFactories/exactFactories pattern in runtimeFactories/index.js.
 */
class RuntimeRegistry {
  constructor() {
    this._factories = new Map();
    this._dynamicFactories = new Map();
  }

  /**
   * Register a RuntimeFactory class (not an instance) for a node type.
   */
  register(nodeType, factoryClass, options = {}) {
    if (typeof nodeType !== 'string' || !nodeType.trim()) {
      throw new Error('Invalid runtime factory type: expected non-empty string.');
    }
    if (typeof factoryClass !== 'function') {
      throw new Error(`Invalid runtime factory for ${nodeType}: expected a class constructor.`);
    }

    const { overwrite = false } = options;
    const existing = this._factories.get(nodeType) || this._dynamicFactories.get(nodeType);

    if (existing && !overwrite) {
      throw new Error(`Runtime factory already exists for node type: ${nodeType}`);
    }

    this._factories.set(nodeType, factoryClass);
    return { nodeType, replaced: Boolean(existing) };
  }

  /**
   * Register a dynamic factory function for a node type.
   * Dynamic factories return an object with getSample(), validateConfig(), etc.
   */
  registerDynamic(nodeType, factoryFn, options = {}) {
    if (typeof nodeType !== 'string' || !nodeType.trim()) {
      throw new Error('Invalid runtime factory type: expected non-empty string.');
    }
    if (typeof factoryFn !== 'function') {
      throw new Error(`Invalid runtime factory for ${nodeType}: expected function.`);
    }

    const { overwrite = false } = options;
    const existing = this._factories.get(nodeType) || this._dynamicFactories.get(nodeType);

    if (existing && !overwrite) {
      throw new Error(`Runtime factory already exists for node type: ${nodeType}`);
    }

    this._dynamicFactories.set(nodeType, factoryFn);
    return { nodeType, replaced: Boolean(existing) };
  }

  /**
   * Unregister a runtime factory.
   */
  unregister(nodeType) {
    if (this._factories.has(nodeType)) {
      this._factories.delete(nodeType);
      return true;
    }
    if (this._dynamicFactories.has(nodeType)) {
      this._dynamicFactories.delete(nodeType);
      return true;
    }
    return false;
  }

  /**
   * Resolve a factory for a node type.
   * Returns the factory class or dynamic factory function, or undefined.
   */
  resolve(nodeType) {
    if (this._factories.has(nodeType)) {
      return this._factories.get(nodeType);
    }
    if (this._dynamicFactories.has(nodeType)) {
      return this._dynamicFactories.get(nodeType);
    }
    return undefined;
  }

  /**
   * Create a runtime instance for a node type with the given config.
   */
  create(nodeType, config = {}) {
    const factory = this.resolve(nodeType);
    if (!factory) return undefined;

    if (typeof factory === 'function' && factory.prototype && factory.prototype.getSample) {
      return new factory(config);
    }

    if (typeof factory === 'function') {
      return factory(config);
    }

    return undefined;
  }

  /**
   * List all registered node types.
   */
  listTypes() {
    return Array.from(new Set([
      ...Array.from(this._factories.keys()),
      ...Array.from(this._dynamicFactories.keys()),
    ])).sort();
  }

  /**
   * Check if a node type has a registered runtime factory.
   */
  has(nodeType) {
    return this._factories.has(nodeType) || this._dynamicFactories.has(nodeType);
  }
}

const globalRegistry = new RuntimeRegistry();

export { RuntimeRegistry };
export default globalRegistry;