/**
 * graphHash.js — Canonical graph hashing for change detection.
 *
 * Produces a deterministic SHA-256 hex digest from the semantic content of a
 * pipeline graph (nodes + edges), stripping visual-only fields like positions,
 * selection state, and annotation nodes so that two graphs that differ only
 * in layout produce the same hash.
 *
 * Used to:
 *   1. Fast-check "has anything meaningful changed?" before creating a commit.
 *   2. De-duplicate identical graph states across branches.
 */

// --------------------------------------------------------------------------
// Non-compilable node types that are excluded from the semantic hash.
// --------------------------------------------------------------------------
const VISUAL_ONLY_TYPES = new Set(['annotationNode', 'shapeNode']);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Deeply sort an object's keys so that JSON.stringify produces a stable string
 * regardless of insertion order.
 */
function deepSortKeys(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = deepSortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Extract the semantic identity of a node — everything except position,
 * selection state, measured dimensions, and GSAP internals.
 */
function canonicalNode(node) {
  const model = node?.data?.nodeModel || {};
  return {
    id: node.id,
    type: model.type || node.type || '',
    label: model.label || '',
    config: deepSortKeys(model.config || model.params || {}),
    pythonCode: model.pythonCode || '',
    inputs: Array.isArray(model.inputs)
      ? (typeof model.inputs[0] === 'string' ? [...model.inputs].sort() : model.inputs.map(p => p?.name || '').sort())
      : [],
    outputs: Array.isArray(model.outputs)
      ? (typeof model.outputs[0] === 'string' ? [...model.outputs].sort() : model.outputs.map(p => p?.name || '').sort())
      : [],
    kind: model.kind || '',
  };
}

/**
 * Extract the canonical identity of an edge.
 */
function canonicalEdge(edge) {
  return {
    source: edge.source || '',
    target: edge.target || '',
    sourceHandle: edge.sourceHandle || '',
    targetHandle: edge.targetHandle || '',
  };
}

// --------------------------------------------------------------------------
// SHA-256 implementation
// --------------------------------------------------------------------------

/**
 * Compute SHA-256 hex digest of a string.
 * Uses SubtleCrypto when available (browser + Node 18+), falls back to a
 * synchronous pure-JS implementation otherwise.
 */
let _sha256;

// -- Pure-JS synchronous SHA-256 fallback ----------------------------------
function sha256Sync(message) {
  const utf8 = new TextEncoder().encode(message);

  // Pre-processing
  const msgBitLen = utf8.length * 8;
  const msgLen = utf8.length;
  const totalLen = msgLen + 1 + 8; // original + 0x80 byte + 8-byte length
  const blockCount = Math.ceil(totalLen / 64);
  const blocks = new Uint8Array(blockCount * 64);
  blocks.set(utf8);
  blocks[msgLen] = 0x80;
  const view = new DataView(blocks.buffer);
  view.setUint32(blocks.length - 4, msgBitLen, false);

  // Initial hash values
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  // Round constants
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const W = new Uint32Array(64);

  for (let i = 0; i < blockCount; i++) {
    const offset = i * 64;
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(offset + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
      const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Async SHA-256 using SubtleCrypto (fast, native).
 */
async function sha256Async(message) {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const data = new TextEncoder().encode(message);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256Sync(message);
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Build the canonical JSON string for a graph (deterministic, position-free).
 * Exported so callers can inspect what gets hashed in tests.
 *
 * @param {Object[]} nodes - ReactFlow nodes array
 * @param {Object[]} edges - ReactFlow edges array
 * @returns {string}
 */
export function buildCanonicalPayload(nodes = [], edges = []) {
  const filteredNodes = (nodes || []).filter(
    (n) => n && !VISUAL_ONLY_TYPES.has(n.type),
  );

  const canonicalNodes = filteredNodes
    .map(canonicalNode)
    .sort((a, b) => a.id.localeCompare(b.id));

  const canonicalEdges = (edges || [])
    .map(canonicalEdge)
    .sort((a, b) => {
      const aKey = `${a.source}:${a.sourceHandle}->${a.target}:${a.targetHandle}`;
      const bKey = `${b.source}:${b.sourceHandle}->${b.target}:${b.targetHandle}`;
      return aKey.localeCompare(bKey);
    });

  return JSON.stringify({ nodes: canonicalNodes, edges: canonicalEdges });
}

/**
 * Compute the SHA-256 hash of a graph's canonical form.
 * Synchronous — suitable for hot paths.
 *
 * @param {Object[]} nodes
 * @param {Object[]} edges
 * @returns {string} 64-char hex SHA-256 digest
 */
export function computeGraphHash(nodes = [], edges = []) {
  return sha256Sync(buildCanonicalPayload(nodes, edges));
}

/**
 * Async variant — uses native SubtleCrypto when available for better perf.
 *
 * @param {Object[]} nodes
 * @param {Object[]} edges
 * @returns {Promise<string>} 64-char hex SHA-256 digest
 */
export async function computeGraphHashAsync(nodes = [], edges = []) {
  return sha256Async(buildCanonicalPayload(nodes, edges));
}

/**
 * Quick equality check: are two graphs semantically identical?
 *
 * @param {Object[]} nodesA
 * @param {Object[]} edgesA
 * @param {Object[]} nodesB
 * @param {Object[]} edgesB
 * @returns {boolean}
 */
export function graphsEqual(nodesA, edgesA, nodesB, edgesB) {
  return buildCanonicalPayload(nodesA, edgesA) === buildCanonicalPayload(nodesB, edgesB);
}
