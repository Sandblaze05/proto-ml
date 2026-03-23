function pyString(v) {
  const s = String(v ?? '');
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function pyValue(v) {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'None';
  if (typeof v === 'string') return pyString(v);
  if (Array.isArray(v)) return `[${v.map((it) => pyValue(it)).join(', ')}]`;
  if (typeof v === 'object') {
    const entries = Object.entries(v).map(([k, val]) => `${pyString(k)}: ${pyValue(val)}`);
    return `{${entries.join(', ')}}`;
  }
  return pyString(String(v));
}

export function generateLifecyclePythonCode(nodeType, config = {}) {
  return [
    `# Auto-generated lifecycle template for ${nodeType}`,
    `config = ${pyValue(config)}`,
    `node_type = ${pyString(nodeType)}`,
    'def run_node(inputs):',
    '    # TODO: bind lifecycle runtime execution',
    '    return {"node_type": node_type, "config": config, "inputs": inputs}',
  ].join('\n');
}
