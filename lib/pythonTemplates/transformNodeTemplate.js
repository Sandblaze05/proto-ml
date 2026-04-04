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

function mapSnippet(config) {
  const operation = config.operation || 'identity';
  const expression = config.expression || '';
  const lines = [
    '# Core Map Transform',
    `config = ${pyValue(config)}`,
    'operation = config.get("operation", "identity")',
    'expression = config.get("expression", "")',
    'preserve_schema = config.get("preserve_schema", True)',
    '',
    'def apply_map(x):',
    '    if operation == "identity":',
    '        return x',
    '    elif operation == "select_columns":',
    '        cols = config.get("columns", [])',
    '        if isinstance(x, dict) and "data" in x:',
    '            df = x["data"]',
    '            return {**x, "data": df[cols] if hasattr(df, "__getitem__") else df}',
    '        return x',
    '    elif operation == "drop_columns":',
    '        cols = config.get("columns", [])',
    '        if isinstance(x, dict) and "data" in x:',
    '            df = x["data"]',
    '            return {**x, "data": {k: v for k, v in df.items() if k not in cols} if isinstance(df, dict) else df}',
    '        return x',
    '    elif operation == "filter_rows":',
    '        rule = config.get("rule", "(x > 0)")',
    '        # TODO: apply_filter(x, rule)',
    '        return x',
    '    elif operation == "tokenize":',
    '        field = config.get("field", "")',
    '        # TODO: tokenize(x[field])',
    '        return x',
    '    elif operation == "normalize":',
    '        fields = config.get("fields", [])',
    '        # TODO: normalize(x, fields)',
    '        return x',
    '    elif operation == "custom":',
    '        code = config.get("code", "")',
    '        # TODO: exec_safe(code, x)',
    '        return x',
    '    return x',
  ];
  return lines.join('\n');
}

function joinSnippet(config) {
  const strategy = config.strategy || 'concat';
  const lines = [
    '# Core Join Transform',
    `config = ${pyValue(config)}`,
    'strategy = config.get("strategy", "concat")',
    'key = config.get("key", "")',
    '',
    'def apply_join(left, right, aux=None):',
    '    if strategy == "concat":',
    '        # Concatenate inputs horizontally or vertically',
    '        if isinstance(left, dict) and isinstance(right, dict):',
    '            result = {**left}',
    '            for k, v in right.items():',
    '                if k not in result:',
    '                    result[k] = v',
    '            return result',
    '        return left',
    '    elif strategy == "merge_by_key":',
    '        # Merge on specified key column',
    '        # TODO: merge_on_key(left, right, key)',
    '        return left',
    '    elif strategy == "zip":',
    '        # Zip inputs element-wise',
    '        # TODO: zip_inputs(left, right)',
    '        return left',
    '    elif strategy == "overlay":',
    '        # Layer inputs with priority',
    '        # TODO: overlay_inputs(left, right, aux)',
    '        return left',
    '    return left',
  ];
  return lines.join('\n');
}

function routeSnippet(config) {
  const lines = [
    '# Core Route Transform',
    `config = ${pyValue(config)}`,
    'condition = config.get("condition", "true")',
    'mode = config.get("mode", "split")',
    '',
    'def apply_route(x):',
    '    result = {"true": [], "false": []}',
    '    if mode == "split":',
    '        # Evaluate condition for each row',
    '        try:',
    '            ok = eval(condition)',
    '            if ok:',
    '                result["true"] = [x] if not isinstance(x, list) else x',
    '            else:',
    '                result["false"] = [x] if not isinstance(x, list) else x',
    '        except Exception as e:',
    '            print(f"Route condition error: {e}")',
    '            result["false"] = [x]',
    '    return result',
  ];
  return lines.join('\n');
}

function ifElseSnippet(config) {
  const lines = [
    '# Programming Primitive: If / Else',
    `config = ${pyValue(config)}`,
    'condition = config.get("condition", "True")',
    'mode = config.get("mode", "split")',
    '',
    'def apply_if_else(x):',
    '    result = {"true": [], "false": []}',
    '    items = x if isinstance(x, list) else [x]',
    '    for item in items:',
    '        safe_locals = {"item": item, "x": item}',
    '        try:',
    '            ok = bool(eval(condition, {}, safe_locals))',
    '        except Exception:',
    '            ok = False',
    '        if ok:',
    '            result["true"].append(item)',
    '        else:',
    '            result["false"].append(item)',
    '    if mode == "gate":',
    '        return result["true"] if len(result["true"]) > 0 else result["false"]',
    '    return result',
  ];
  return lines.join('\n');
}

function typeSwitchSnippet(config) {
  const lines = [
    '# Programming Primitive: Type Switch',
    `config = ${pyValue(config)}`,
    'type_field = config.get("type_field", "")',
    'fallback_type = config.get("fallback_type", "fallback")',
    '',
    'def _infer_type(item):',
    '    if type_field and isinstance(item, dict) and type_field in item:',
    '        return str(item.get(type_field)).lower()',
    '    if isinstance(item, dict):',
    '        return "dict"',
    '    if isinstance(item, (list, tuple, str)):',
    '        return "sequence"',
    '    return "tensor"',
    '',
    'def apply_type_switch(x):',
    '    result = {"tensor": [], "sequence": [], "dict": [], "fallback": []}',
    '    items = x if isinstance(x, list) else [x]',
    '    for item in items:',
    '        t = _infer_type(item)',
    '        if t in result:',
    '            result[t].append(item)',
    '        else:',
    '            result[fallback_type if fallback_type in result else "fallback"].append(item)',
    '    return result',
  ];
  return lines.join('\n');
}

export function generateTransformPythonCode(nodeType, config = {}) {
  if (nodeType === 'transform.core.map') return mapSnippet(config);
  if (nodeType === 'transform.core.join') return joinSnippet(config);
  if (nodeType === 'transform.core.route') return routeSnippet(config);
  if (nodeType === 'transform.program.if_else') return ifElseSnippet(config);
  if (nodeType === 'transform.program.type_switch') return typeSwitchSnippet(config);
  // Fallback for unknown transforms
  return [
    `# Unknown transform: ${nodeType}`,
    `config = ${pyValue(config)}`,
    'def apply_unknown(x):',
    '    return x',
  ].join('\n');
}
