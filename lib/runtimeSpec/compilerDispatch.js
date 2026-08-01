/**
 * CompilerDispatch — Canonical compiler dispatch interface.
 *
 * Maps node types to their Python backend implementations using
 * structured dispatch instead of string prefix matching.
 * Eliminates drift between node definitions, preview JavaScript,
 * Python runtime, and compiler dispatch.
 */

import { validateNodeSpec, VALID_KINDS } from './nodeSpec.js';
import { getCacheMetadata } from './nodeSpec.js';
import { listNodeDefs } from '../../nodes/nodeRegistry.js';

const DEFAULT_LIFECYCLE_STAGE_BY_TYPE = {
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

function getDefaultLifecycleStage(nodeType) {
  return DEFAULT_LIFECYCLE_STAGE_BY_TYPE[nodeType] || null;
}

function seedDispatchFromRegistry(dispatch) {
  for (const def of listNodeDefs()) {
    dispatch.register(
      def.type,
      {
        nodeSpec: def,
        runtimeFactory: null,
        pythonTemplate: null,
      },
      {
        kind: def.kind || 'generic',
        stage: def.kind === 'lifecycle' ? getDefaultLifecycleStage(def.type) : null,
        version: def.cache?.version || '1.0.0',
      },
    );
  }
  return dispatch;
}

/**
 * Canonical dispatch table entry.
 * Each entry maps a node type to its backend implementation.
 */
class DispatchEntry {
  constructor(nodeType, implementation, options = {}) {
    this.nodeType = nodeType;
    this.implementation = implementation;
    this.kind = options.kind || 'generic';
    this.stage = options.stage || null;
    this.version = options.version || '1.0.0';
  }

  get nodeSpec() {
    return this.implementation.nodeSpec;
  }

  get runtimeFactory() {
    return this.implementation.runtimeFactory;
  }

  get pythonTemplate() {
    return this.implementation.pythonTemplate;
  }
}

/**
 * Compiler dispatch registry.
 * Replaces the ad-hoc classifyNode() and mapLifecycleDispatchStage()
 * string prefix matching in pipelineCompiler.js and nodeCellCompiler.js.
 */
class CompilerDispatch {
  constructor() {
    this._entries = new Map();
    this._stageMap = new Map();
    this._kindMap = new Map();
  }

  /**
   * Register a dispatch entry for a node type.
   */
  register(nodeType, implementation, options = {}) {
    if (typeof nodeType !== 'string' || !nodeType.trim()) {
      throw new Error('Invalid dispatch node type: expected non-empty string.');
    }
    if (!implementation || typeof implementation !== 'object') {
      throw new Error(`Invalid dispatch implementation for ${nodeType}: expected object.`);
    }

    const entry = new DispatchEntry(nodeType, implementation, options);
    this._entries.set(nodeType, entry);

    const kind = options.kind || 'generic';
    if (!this._kindMap.has(kind)) {
      this._kindMap.set(kind, new Set());
    }
    this._kindMap.get(kind).add(nodeType);

    const stage = options.stage || null;
    if (stage) {
      if (!this._stageMap.has(stage)) {
        this._stageMap.set(stage, new Set());
      }
      this._stageMap.get(stage).add(nodeType);
    }

    return { nodeType, replaced: this._entries.has(nodeType) };
  }

  /**
   * Unregister a dispatch entry.
   */
  unregister(nodeType) {
    const entry = this._entries.get(nodeType);
    if (!entry) return false;

    this._entries.delete(nodeType);

    const kind = entry.kind;
    const kindSet = this._kindMap.get(kind);
    if (kindSet) {
      kindSet.delete(nodeType);
      if (kindSet.size === 0) this._kindMap.delete(kind);
    }

    const stage = entry.stage;
    if (stage) {
      const stageSet = this._stageMap.get(stage);
      if (stageSet) {
        stageSet.delete(nodeType);
        if (stageSet.size === 0) this._stageMap.delete(stage);
      }
    }

    return true;
  }

  /**
   * Resolve a dispatch entry by node type.
   */
  resolve(nodeType) {
    return this._entries.get(nodeType) || null;
  }

  /**
   * Get the implementation for a node type.
   */
  getImplementation(nodeType) {
    const entry = this._entries.get(nodeType);
    return entry ? entry.implementation : null;
  }

  /**
   * Get the Python template for a node type.
   */
  getPythonTemplate(nodeType) {
    const entry = this._entries.get(nodeType);
    return entry ? entry.pythonTemplate : null;
  }

  /**
   * Get the runtime factory for a node type.
   */
  getRuntimeFactory(nodeType) {
    const entry = this._entries.get(nodeType);
    return entry ? entry.runtimeFactory : null;
  }

  /**
   * Classify a node type by its kind.
   * Replaces the classifyNode() string prefix matching.
   */
  classify(nodeType) {
    const entry = this._entries.get(nodeType);
    if (entry) return entry.kind;

    return 'generic';
  }

  /**
   * Map a lifecycle node type to its dispatch stage.
   * Replaces the mapLifecycleDispatchStage() string mapping.
   */
  mapLifecycleStage(nodeType) {
    const entry = this._entries.get(nodeType);
    if (entry && entry.stage) return entry.stage;

    const fallback = {
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

    return fallback[nodeType] || nodeType;
  }

  /**
   * Get all registered node types for a given kind.
   */
  getTypesByKind(kind) {
    const set = this._kindMap.get(kind);
    return set ? Array.from(set).sort() : [];
  }

  /**
   * Get all registered node types for a given lifecycle stage.
   */
  getTypesByStage(stage) {
    const set = this._stageMap.get(stage);
    return set ? Array.from(set).sort() : [];
  }

  /**
   * List all registered dispatch entries.
   */
  listEntries() {
    return Array.from(this._entries.values());
  }

  /**
   * Check if a node type is registered.
   */
  has(nodeType) {
    return this._entries.has(nodeType);
  }

  /**
   * Validate that all registered dispatch entries have valid node specs.
   */
  validateAll() {
    const results = [];
    for (const [nodeType, entry] of this._entries) {
      const validation = validateNodeSpec(entry.nodeSpec);
      if (!validation.valid) {
        results.push({ nodeType, valid: false, errors: validation.errors });
      } else {
        results.push({ nodeType, valid: true, errors: [] });
      }
    }
    return results;
  }
}

const globalDispatch = seedDispatchFromRegistry(new CompilerDispatch());

export { CompilerDispatch, DispatchEntry };
export default globalDispatch;