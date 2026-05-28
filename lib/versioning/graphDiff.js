/**
 * graphDiff.js — Structural diff engine for pipeline graphs.
 *
 * Compares two graph snapshots (nodes[] + edges[]) and produces a detailed
 * change report suitable for both programmatic consumption and visual overlay.
 *
 * Node identity is based on the stable `id` field.
 * Changes are classified as: added, removed, modified, moved, unchanged.
 */

// --------------------------------------------------------------------------
// Non-compilable / visual-only node types — excluded from semantic comparison
// but still tracked for position diffs.
// --------------------------------------------------------------------------
const VISUAL_ONLY_TYPES = new Set(['annotationNode', 'shapeNode']);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (!deepEqual(a[keysA[i]], b[keysB[i]])) return false;
  }
  return true;
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Extract the semantic model from a ReactFlow node for comparison.
 */
function extractNodeModel(node) {
  const model = node?.data?.nodeModel || {};
  return {
    type: model.type || node?.type || '',
    label: model.label || '',
    config: model.config || model.params || {},
    pythonCode: model.pythonCode || '',
    inputs: Array.isArray(model.inputs)
      ? (typeof model.inputs[0] === 'string' ? model.inputs : model.inputs.map((p) => p?.name || ''))
      : [],
    outputs: Array.isArray(model.outputs)
      ? (typeof model.outputs[0] === 'string' ? model.outputs : model.outputs.map((p) => p?.name || ''))
      : [],
    kind: model.kind || '',
    schema: model.schema || null,
    metadata: model.metadata || null,
  };
}

/**
 * Build a canonical edge key for set-based comparison.
 */
function edgeKey(edge) {
  return `${edge.source || ''}|${edge.sourceHandle || ''}|${edge.target || ''}|${edge.targetHandle || ''}`;
}

// --------------------------------------------------------------------------
// Field-level node diff
// --------------------------------------------------------------------------

/**
 * Compare two node models and return a map of changed fields.
 *
 * @param {Object} before - extractNodeModel() output from the "before" node
 * @param {Object} after  - extractNodeModel() output from the "after" node
 * @returns {Object} changedFields — keys are field names, values are { before, after }
 */
export function diffNodeFields(before, after) {
  const changes = {};

  if (before.type !== after.type) {
    changes.type = { before: before.type, after: after.type };
  }

  if (before.label !== after.label) {
    changes.label = { before: before.label, after: after.label };
  }

  if (!deepEqual(before.config, after.config)) {
    changes.config = { before: before.config, after: after.config };
  }

  if (before.pythonCode !== after.pythonCode) {
    changes.code = { before: before.pythonCode, after: after.pythonCode };
  }

  if (!arraysEqual(before.inputs, after.inputs)) {
    changes.inputs = { before: before.inputs, after: after.inputs };
  }

  if (!arraysEqual(before.outputs, after.outputs)) {
    changes.outputs = { before: before.outputs, after: after.outputs };
  }

  if (before.kind !== after.kind) {
    changes.kind = { before: before.kind, after: after.kind };
  }

  return changes;
}

/**
 * Check if a node's position changed.
 */
function positionChanged(nodeA, nodeB) {
  const posA = nodeA?.position || { x: 0, y: 0 };
  const posB = nodeB?.position || { x: 0, y: 0 };
  return posA.x !== posB.x || posA.y !== posB.y;
}

// --------------------------------------------------------------------------
// Line-level code diff (for Python code comparison)
// --------------------------------------------------------------------------

/**
 * Simple line-level diff using longest common subsequence.
 * Returns an array of { type: 'add'|'remove'|'same', line: string }.
 *
 * @param {string} textA - "before" text
 * @param {string} textB - "after" text
 * @returns {Object[]} diff lines
 */
export function diffCodeLines(textA = '', textB = '') {
  const linesA = String(textA).split('\n');
  const linesB = String(textB).split('\n');

  // LCS table
  const m = linesA.length;
  const n = linesB.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      result.unshift({ type: 'same', line: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', line: linesB[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'remove', line: linesA[i - 1] });
      i--;
    }
  }

  return result;
}

// --------------------------------------------------------------------------
// Main diff function
// --------------------------------------------------------------------------

/**
 * Compute a full structural diff between two graph snapshots.
 *
 * @param {Object}   graphA          - { nodes: [], edges: [] } — the "before" state
 * @param {Object}   graphB          - { nodes: [], edges: [] } — the "after" state
 * @param {Object}   [options={}]
 * @param {boolean}  [options.includePositionChanges=true]  - Track position-only moves
 * @param {boolean}  [options.includeAnnotations=false]     - Include annotation/shape nodes
 * @returns {import('./types').GraphDiff}
 */
export function computeGraphDiff(graphA, graphB, options = {}) {
  const {
    includePositionChanges = true,
    includeAnnotations = false,
  } = options;

  const nodesA = (graphA?.nodes || []).filter(
    (n) => includeAnnotations || !VISUAL_ONLY_TYPES.has(n?.type),
  );
  const nodesB = (graphB?.nodes || []).filter(
    (n) => includeAnnotations || !VISUAL_ONLY_TYPES.has(n?.type),
  );

  const mapA = new Map(nodesA.map((n) => [n.id, n]));
  const mapB = new Map(nodesB.map((n) => [n.id, n]));

  const addedNodes = [];
  const removedNodes = [];
  const modifiedNodes = [];
  const movedNodes = [];
  const unchangedNodes = [];

  // Nodes in B but not in A → added
  for (const [id, nodeB] of mapB) {
    if (!mapA.has(id)) {
      addedNodes.push({
        nodeId: id,
        status: 'added',
        before: null,
        after: nodeB,
        changes: {},
      });
    }
  }

  // Nodes in A but not in B → removed
  for (const [id, nodeA] of mapA) {
    if (!mapB.has(id)) {
      removedNodes.push({
        nodeId: id,
        status: 'removed',
        before: nodeA,
        after: null,
        changes: {},
      });
    }
  }

  // Nodes in both → check for modifications
  for (const [id, nodeA] of mapA) {
    if (!mapB.has(id)) continue;
    const nodeB = mapB.get(id);

    const modelA = extractNodeModel(nodeA);
    const modelB = extractNodeModel(nodeB);
    const fieldChanges = diffNodeFields(modelA, modelB);
    const hasMoved = includePositionChanges && positionChanged(nodeA, nodeB);
    const hasSemanticChanges = Object.keys(fieldChanges).length > 0;

    if (hasSemanticChanges) {
      const entry = {
        nodeId: id,
        status: 'modified',
        before: nodeA,
        after: nodeB,
        changes: fieldChanges,
      };
      if (hasMoved) {
        entry.changes.position = {
          before: nodeA.position,
          after: nodeB.position,
        };
      }
      modifiedNodes.push(entry);
    } else if (hasMoved) {
      movedNodes.push({
        nodeId: id,
        status: 'moved',
        before: nodeA,
        after: nodeB,
        changes: {
          position: {
            before: nodeA.position,
            after: nodeB.position,
          },
        },
      });
    } else {
      unchangedNodes.push({
        nodeId: id,
        status: 'unchanged',
        before: nodeA,
        after: nodeB,
        changes: {},
      });
    }
  }

  // ---------- Edge diff ----------
  const edgesA = (graphA?.edges || []).map((e) => ({
    ...e,
    _key: edgeKey(e),
  }));
  const edgesB = (graphB?.edges || []).map((e) => ({
    ...e,
    _key: edgeKey(e),
  }));

  const edgeSetA = new Set(edgesA.map((e) => e._key));
  const edgeSetB = new Set(edgesB.map((e) => e._key));

  const addedEdges = edgesB.filter((e) => !edgeSetA.has(e._key)).map(({ _key, ...rest }) => rest);
  const removedEdges = edgesA.filter((e) => !edgeSetB.has(e._key)).map(({ _key, ...rest }) => rest);

  // ---------- Summary ----------
  const totalChanges =
    addedNodes.length +
    removedNodes.length +
    modifiedNodes.length +
    movedNodes.length +
    addedEdges.length +
    removedEdges.length;

  const topologyChanged =
    addedNodes.length > 0 ||
    removedNodes.length > 0 ||
    addedEdges.length > 0 ||
    removedEdges.length > 0;

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    movedNodes,
    unchangedNodes,

    addedEdges,
    removedEdges,

    summary: {
      totalChanges,
      topologyChanged,
      nodesAdded: addedNodes.length,
      nodesRemoved: removedNodes.length,
      nodesModified: modifiedNodes.length,
      nodesMoved: movedNodes.length,
      nodesUnchanged: unchangedNodes.length,
      edgesAdded: addedEdges.length,
      edgesRemoved: removedEdges.length,
    },
  };
}

/**
 * Build a map of nodeId → diff status for efficient canvas overlay rendering.
 *
 * @param {Object} diff - Result of computeGraphDiff()
 * @returns {Map<string, { status: string, changes: Object }>}
 */
export function buildDiffStatusMap(diff) {
  const map = new Map();

  for (const entry of diff.addedNodes) {
    map.set(entry.nodeId, { status: 'added', changes: entry.changes });
  }
  for (const entry of diff.removedNodes) {
    map.set(entry.nodeId, { status: 'removed', changes: entry.changes });
  }
  for (const entry of diff.modifiedNodes) {
    map.set(entry.nodeId, { status: 'modified', changes: entry.changes });
  }
  for (const entry of diff.movedNodes) {
    map.set(entry.nodeId, { status: 'moved', changes: entry.changes });
  }
  for (const entry of diff.unchangedNodes) {
    map.set(entry.nodeId, { status: 'unchanged', changes: {} });
  }

  return map;
}

/**
 * Build a set of edge keys that were added or removed for overlay rendering.
 *
 * @param {Object} diff
 * @returns {{ addedEdgeKeys: Set<string>, removedEdgeKeys: Set<string> }}
 */
export function buildEdgeDiffSets(diff) {
  return {
    addedEdgeKeys: new Set(diff.addedEdges.map(edgeKey)),
    removedEdgeKeys: new Set(diff.removedEdges.map(edgeKey)),
  };
}
