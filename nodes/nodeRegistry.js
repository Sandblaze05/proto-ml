/**
 * Node Registry — central source of truth for all node types.
 * Maps type string → node definition object.
 * Used by NodePalette (to build node models) and useExecutionStore (for typed validation).
 */
import { ImageFolderDatasetDef } from './datasets/ImageFolderDataset.js';
import { CSVDatasetDef }         from './datasets/CSVDataset.js';
import { TextDatasetDef }        from './datasets/TextDataset.js';
import { JSONDatasetDef }        from './datasets/JSONDataset.js';
import { DatabaseDatasetDef }    from './datasets/DatabaseDataset.js';
import { APIDatasetDef }         from './datasets/APIDataset.js';
import { TRANSFORM_NODES }       from './transforms/transformRegistry.js';
import { LIFECYCLE_NODES }       from './lifecycle/lifecycleRegistry.js';

// --- Dataset Nodes ---
export const DATASET_NODES = [
  { ...ImageFolderDatasetDef, kind: 'dataset', accepts: [], produces: ['image'] },
  { ...CSVDatasetDef, kind: 'dataset', accepts: [], produces: ['tabular'] },
  { ...TextDatasetDef, kind: 'dataset', accepts: [], produces: ['text'] },
  { ...JSONDatasetDef, kind: 'dataset', accepts: [], produces: ['tabular'] },
  { ...DatabaseDatasetDef, kind: 'dataset', accepts: [], produces: ['tabular'] },
  { ...APIDatasetDef, kind: 'dataset', accepts: [], produces: ['tabular'] },
];

export { TRANSFORM_NODES };
export { LIFECYCLE_NODES };

// --- Full registry map: type → definition ---
const BASE_NODE_DEFS = [...DATASET_NODES, ...TRANSFORM_NODES, ...LIFECYCLE_NODES];

export const NODE_REGISTRY = Object.fromEntries(BASE_NODE_DEFS.map((def) => [def.type, def]));

function assertValidNodeDef(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('Invalid node definition: expected object.');
  }
  if (typeof def.type !== 'string' || !def.type.trim()) {
    throw new Error('Invalid node definition: `type` must be a non-empty string.');
  }
}

/**
 * Register a node definition at runtime.
 * Used by plugin-style extensions and feature-flagged node packs.
 */
export function registerNodeDef(def, options = {}) {
  assertValidNodeDef(def);
  const { overwrite = false } = options;
  const type = def.type;
  const exists = Boolean(NODE_REGISTRY[type]);

  if (exists && !overwrite) {
    throw new Error(`Node definition already exists for type: ${type}`);
  }

  NODE_REGISTRY[type] = def;
  return { type, replaced: exists };
}

/**
 * Unregister a runtime-added node definition.
 * Returns true when removed, false when the node type is not present.
 */
export function unregisterNodeDef(type) {
  if (!NODE_REGISTRY[type]) return false;
  delete NODE_REGISTRY[type];
  return true;
}

export function hasNodeDef(type) {
  return Boolean(NODE_REGISTRY[type]);
}

export function listNodeDefs() {
  return Object.values(NODE_REGISTRY);
}

export const PRIMITIVE_INTENTS = Object.freeze({
  DATASOURCE: 'datasource',
  MAP: 'map',
  JOIN: 'join',
  ROUTE: 'route',
  SPLIT: 'split',
  BATCH_LOADER: 'batch_loader',
  MODEL_BUILDER: 'model_builder',
  OBJECTIVE: 'objective',
  TRAINER: 'trainer',
  EVALUATOR: 'evaluator',
  UNKNOWN: 'unknown',
});

/**
 * Map any existing node type to the canonical primitive intent.
 * This is migration scaffolding for keeping legacy node strings loadable
 * while converging authoring UX on a compact primitive vocabulary.
 */
export function getPrimitiveIntent(nodeType) {
  if (!nodeType || typeof nodeType !== 'string') return PRIMITIVE_INTENTS.UNKNOWN;

  if (nodeType.startsWith('dataset.')) return PRIMITIVE_INTENTS.DATASOURCE;
  if (nodeType === 'transform.core.map') return PRIMITIVE_INTENTS.MAP;
  if (nodeType === 'transform.core.join') return PRIMITIVE_INTENTS.JOIN;
  if (nodeType === 'transform.core.route') return PRIMITIVE_INTENTS.ROUTE;
  if (nodeType === 'lifecycle.split') return PRIMITIVE_INTENTS.SPLIT;
  if (nodeType === 'lifecycle.batch_loader') return PRIMITIVE_INTENTS.BATCH_LOADER;
  if (nodeType === 'lifecycle.core.model_builder') return PRIMITIVE_INTENTS.MODEL_BUILDER;
  if (nodeType === 'lifecycle.core.objective') return PRIMITIVE_INTENTS.OBJECTIVE;
  if (nodeType === 'lifecycle.core.trainer') return PRIMITIVE_INTENTS.TRAINER;
  if (nodeType === 'lifecycle.core.evaluator' || nodeType === 'lifecycle.core.predictor') return PRIMITIVE_INTENTS.EVALUATOR;

  return PRIMITIVE_INTENTS.UNKNOWN;
}

/**
 * Lookup a node definition by its type string.
 * Returns undefined if not found — callers should handle this case.
 */
export function getNodeDef(type) {
  return NODE_REGISTRY[type];
}

/**
 * Get the output port descriptor for a given node type + port name.
 * Returns undefined if the port or node doesn't exist.
 */
export function getOutputPort(nodeType, portName) {
  const def = NODE_REGISTRY[nodeType];
  if (!def) return undefined;
  return def.outputs.find(o => o.name === portName);
}

/**
 * Get the input port descriptor for a given node type + port name.
 */
export function getInputPort(nodeType, portName) {
  const def = NODE_REGISTRY[nodeType];
  if (!def) return undefined;
  return def.inputs.find(i => i.name === portName);
}

const PORT_ROLE_NAME_MAP = {
  data: 'data',
  dataset: 'data',
  in: 'data',
  input: 'data',
  out: 'data',
  output: 'data',
  features: 'data',
  labels: 'labels',
  targets: 'targets',
  train: 'data',
  val: 'data',
  test: 'data',
  train_data: 'data',
  val_data: 'data',
  eval_data: 'data',
  inference_data: 'data',
  model: 'model',
  trained_model: 'model',
  objective: 'objective',
  loss: 'objective',
  metrics: 'metrics',
  metrics_spec: 'metrics',
  predictions: 'predictions',
  confidence_scores: 'predictions',
  reports: 'reports',
  logs: 'logs',
  artifacts: 'artifacts',
  config: 'config',
};

const PORT_ROLE_DATATYPE_MAP = {
  model: 'model',
  loss: 'objective',
  dataloader: 'data',
  objective: 'objective',
  string: 'config',
};

/**
 * Infer semantic role for a port from explicit role, name, and datatype.
 * This keeps existing node defs backward-compatible while introducing
 * role-aware validation for primitive-style workflows.
 */
export function inferPortRole(port) {
  if (!port) return 'unknown';
  if (typeof port.role === 'string' && port.role.trim()) return port.role.trim();

  const name = String(port.name || '').trim().toLowerCase();
  if (name && PORT_ROLE_NAME_MAP[name]) return PORT_ROLE_NAME_MAP[name];

  const datatype = String(port.datatype || '').trim().toLowerCase();
  if (datatype && PORT_ROLE_DATATYPE_MAP[datatype]) return PORT_ROLE_DATATYPE_MAP[datatype];

  if (datatype === 'any') return 'any';
  return 'unknown';
}

export function arePortRolesCompatible(sourcePort, targetPort) {
  const sourceRole = inferPortRole(sourcePort);
  const targetRole = inferPortRole(targetPort);

  if (sourceRole === 'any' || targetRole === 'any') return true;
  if (sourceRole === 'unknown' || targetRole === 'unknown') return true;
  if (sourceRole === targetRole) return true;

  // Common semantic aliases used in ML pipelines.
  if (sourceRole === 'labels' && targetRole === 'targets') return true;
  if (sourceRole === 'targets' && targetRole === 'labels') return true;

  return false;
}

/**
 * Port compatibility check.
 * Returns true if sourcePort.datatype is compatible with targetPort.datatype.
 *
 * Compatibility matrix (can be extended):
 *   tensor    → tensor  ✅
 *   dataloader → dataloader ✅
 *   sequence  → sequence ✅
 *   list      → list ✅
 *   Cross-type mismatches ❌ (explicit exceptions below)
 */
export function arePortsCompatible(sourcePort, targetPort) {
  if (!sourcePort || !targetPort) return false;

  // Wildcard datatype can connect to/from any typed port.
  if (sourcePort.datatype === 'any' || targetPort.datatype === 'any') return true;

  // Exact match always works
  if (sourcePort.datatype === targetPort.datatype) {
    return arePortRolesCompatible(sourcePort, targetPort);
  }

  // tensor → dataloader is not directly compatible (must go through a loader)
  // sequence → tensor is not compatible (NLP output ≠ vision input)
  // All other cross-type connections are blocked

  return false;
}
