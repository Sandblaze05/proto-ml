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

function composeSnippet(config) {
  return [
    '# Transform Compose Node',
    `config = ${pyValue(config)}`,
    'transform_nodes = config.get("transforms", [])',
    'def apply_compose(x, runtime):',
    '    for node_id in transform_nodes:',
    '        x = runtime.apply_transform(node_id, x)',
    '    return x',
  ].join('\n');
}

function customPythonSnippet(config) {
  return [
    '# Custom Python Transform Node',
    `config = ${pyValue(config)}`,
    '# User code is expected to define transform(x) or __call__(x)',
    'user_code = config.get("code", "def transform(x):\\n    return x")',
    'runtime = config.get("runtime", "cpu")',
    'dependencies = config.get("dependencies", [])',
    'print("Custom transform runtime:", runtime)',
    'print("Dependencies:", dependencies)',
    '# executor will compile user_code and call it safely in sandbox mode',
  ].join('\n');
}

function conditionSnippet(config) {
  return [
    '# Conditional Transform Node',
    `config = ${pyValue(config)}`,
    'field = config.get("field")',
    'operator = config.get("operator", ">")',
    'threshold = config.get("value")',
    'def route(sample):',
    '    val = sample.get(field)',
    '    ok = eval(f"val {operator} threshold")',
    '    return "true" if ok else "false"',
  ].join('\n');
}

function genericSnippet(nodeType, config) {
  return [
    `# Auto-generated transform template for ${nodeType}`,
    `config = ${pyValue(config)}`,
    '# executor maps node type to backend implementation (torchvision/sklearn/custom)',
    `transform_type = ${pyString(nodeType)}`,
    'def apply_transform(x):',
    '    # TODO: executor runtime binding',
    '    return x',
  ].join('\n');
}

export function generateTransformPythonCode(nodeType, config = {}) {
  if (nodeType === 'transform.pipeline.compose') return composeSnippet(config);
  if (nodeType === 'transform.pipeline.custom_python') return customPythonSnippet(config);
  if (nodeType === 'transform.pipeline.condition') return conditionSnippet(config);
  return genericSnippet(nodeType, config);
}
