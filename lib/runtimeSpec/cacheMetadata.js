/**
 * CacheMetadata — Determinism and cache metadata utilities.
 *
 * Provides deterministic hashing, version tracking, and seed management
 * so that node execution results can be cached and reproduced.
 */

import { createHash } from 'crypto';

/**
 * Compute a deterministic SHA-256 hash from a node definition and config.
 * Strips non-semantic fields (positions, selection state) so that
 * layout-only changes do not invalidate the cache.
 */
export function computeNodeHash(nodeType, config, version) {
  const canonical = JSON.stringify({
    type: nodeType,
    config: canonicalizeValue(config),
    version: version || '1.0.0',
  }, sortKeys);

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Deep-sort an object's keys for stable JSON serialization.
 */
function sortKeys(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).sort().reduce((sorted, k) => {
      sorted[k] = value[k];
      return sorted;
    }, {});
  }
  return value;
}

/**
 * Recursively canonicalize a value for hashing.
 * Sorts object keys and normalizes arrays.
 */
function canonicalizeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalizeValue(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Get the version string for a node type.
 * Falls back to '1.0.0' if not found.
 */
export function getNodeVersion(nodeType) {
  if (typeof nodeType !== 'string' || !nodeType.trim()) return '1.0.0';
  return nodeType;
}

/**
 * Check whether a node type is deterministic (same config → same output).
 */
export function isDeterministic(nodeType, config = {}) {
  const nonDeterministicOps = [
    'transform.image.random_flip',
    'transform.image.random_rotation',
    'transform.image.random_crop',
    'transform.image.random_erasing',
    'transform.image.random_affine',
    'transform.image.random_horizontal_flip',
    'transform.image.random_vertical_flip',
    'lifecycle.split',
  ];

  if (nonDeterministicOps.includes(nodeType)) return false;

  const shuffle = config.shuffle;
  if (shuffle === true) return false;

  return true;
}

/**
 * Get the deterministic seed for a node type and config.
 */
export function getSeed(nodeType, config = {}) {
  const baseSeed = 42;
  if (typeof config.seed === 'number' && Number.isFinite(config.seed)) {
    return Math.trunc(config.seed);
  }
  return baseSeed;
}

/**
 * Generate a cache key for a node execution.
 * Combines node type, config hash, and seed.
 */
export function getCacheKey(nodeType, config, version) {
  const configHash = computeNodeHash(nodeType, config, version);
  const seed = getSeed(nodeType, config);
  return `${nodeType}:${configHash}:${seed}`;
}

/**
 * Create a cache entry metadata object.
 */
export function createCacheEntry(nodeType, config, result, version) {
  return {
    nodeType,
    configHash: computeNodeHash(nodeType, config, version),
    seed: getSeed(nodeType, config),
    version: version || '1.0.0',
    deterministic: isDeterministic(nodeType, config),
    timestamp: Date.now(),
    resultHash: computeNodeHash(nodeType, result, version),
  };
}

const cacheMetadata = {
  computeNodeHash,
  getNodeVersion,
  isDeterministic,
  getSeed,
  getCacheKey,
  createCacheEntry,
};

export default cacheMetadata;