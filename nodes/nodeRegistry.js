/**
 * Node Registry — central source of truth for all node types.
 * Maps type string → node definition object.
 * Used by NodePalette (to build node models) and useExecutionStore (for typed validation).
 */
import { ImageFolderDatasetDef } from './datasets/ImageFolderDataset';
import { CSVDatasetDef }         from './datasets/CSVDataset';
import { TextDatasetDef }        from './datasets/TextDataset';
import { JSONDatasetDef }        from './datasets/JSONDataset';
import { DatabaseDatasetDef }    from './datasets/DatabaseDataset';
import { APIDatasetDef }         from './datasets/APIDataset';

// --- Dataset Nodes ---
export const DATASET_NODES = [
  ImageFolderDatasetDef,
  CSVDatasetDef,
  TextDatasetDef,
  JSONDatasetDef,
  DatabaseDatasetDef,
  APIDatasetDef,
];

// --- Full registry map: type → definition ---
export const NODE_REGISTRY = Object.fromEntries(
  [...DATASET_NODES].map(def => [def.type, def])
);

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

  // Exact match always works
  if (sourcePort.datatype === targetPort.datatype) return true;

  // tensor → dataloader is not directly compatible (must go through a loader)
  // sequence → tensor is not compatible (NLP output ≠ vision input)
  // All other cross-type connections are blocked

  return false;
}
