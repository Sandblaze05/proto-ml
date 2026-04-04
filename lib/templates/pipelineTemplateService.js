export const TEMPLATE_SCHEMA_VERSION = 1;

const EXACT_PLACEHOLDER_PATTERN = /^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/;
const INLINE_PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) return value.map((item) => deepClone(item));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepClone(v)]));
  }
  return value;
}

function resolveStringPlaceholders(value, params, unresolved) {
  const exact = value.match(EXACT_PLACEHOLDER_PATTERN);
  if (exact) {
    const key = exact[1];
    if (!(key in params)) {
      unresolved.add(key);
      return value;
    }
    return params[key];
  }

  if (!INLINE_PLACEHOLDER_PATTERN.test(value)) return value;

  INLINE_PLACEHOLDER_PATTERN.lastIndex = 0;
  return value.replace(INLINE_PLACEHOLDER_PATTERN, (_, key) => {
    if (!(key in params)) {
      unresolved.add(key);
      return `{{${key}}}`;
    }
    const resolved = params[key];
    if (resolved === null || resolved === undefined) return '';
    if (typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean') {
      return String(resolved);
    }
    return JSON.stringify(resolved);
  });
}

function resolveValue(value, params, unresolved) {
  if (typeof value === 'string') return resolveStringPlaceholders(value, params, unresolved);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, params, unresolved));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, resolveValue(entryValue, params, unresolved)]),
    );
  }
  return value;
}

function normalizeTemplateParameterDefs(parameterDefs = []) {
  return parameterDefs
    .filter((param) => param && typeof param.name === 'string' && param.name.trim())
    .map((param) => ({
      name: param.name.trim(),
      required: Boolean(param.required),
      defaultValue: param.defaultValue,
      type: param.type || 'string',
      description: param.description || '',
    }));
}

export function validatePipelineTemplate(template) {
  const errors = [];

  if (!template || typeof template !== 'object') {
    return { ok: false, errors: ['Template must be an object.'] };
  }

  if (typeof template.id !== 'string' || !template.id.trim()) {
    errors.push('Template `id` must be a non-empty string.');
  }

  if (typeof template.name !== 'string' || !template.name.trim()) {
    errors.push('Template `name` must be a non-empty string.');
  }

  const schemaVersion = template.schemaVersion ?? TEMPLATE_SCHEMA_VERSION;
  if (typeof schemaVersion !== 'number' || schemaVersion <= 0) {
    errors.push('Template `schemaVersion` must be a positive number.');
  }

  if (!template.graph || typeof template.graph !== 'object') {
    errors.push('Template `graph` is required.');
  } else {
    if (!Array.isArray(template.graph.nodes)) {
      errors.push('Template graph must include a `nodes` array.');
    }
    if (!Array.isArray(template.graph.edges)) {
      errors.push('Template graph must include an `edges` array.');
    }

    for (const node of template.graph.nodes || []) {
      if (!node || typeof node !== 'object') {
        errors.push('Template graph contains an invalid node entry.');
        continue;
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        errors.push('Each template node requires a non-empty `id`.');
      }
      if (typeof node.type !== 'string' || !node.type.trim()) {
        errors.push(`Template node ${node.id || '<unknown>'} requires a non-empty \`type\`.`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function instantiatePipelineTemplate(template, options = {}) {
  const validation = validatePipelineTemplate(template);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      graph: null,
      unresolvedParameters: [],
    };
  }

  const templateParams = normalizeTemplateParameterDefs(template.parameters);
  const inputParams = options.parameters || {};

  const resolvedParameters = Object.fromEntries(
    templateParams.map((param) => [
      param.name,
      Object.prototype.hasOwnProperty.call(inputParams, param.name)
        ? inputParams[param.name]
        : param.defaultValue,
    ]),
  );

  const missingRequired = templateParams
    .filter((param) => param.required && (resolvedParameters[param.name] === undefined || resolvedParameters[param.name] === null || resolvedParameters[param.name] === ''))
    .map((param) => param.name);

  if (missingRequired.length > 0) {
    return {
      ok: false,
      errors: [`Missing required template parameters: ${missingRequired.join(', ')}`],
      graph: null,
      unresolvedParameters: missingRequired,
    };
  }

  const graph = deepClone(template.graph);
  const unresolved = new Set();
  const resolvedGraph = resolveValue(graph, resolvedParameters, unresolved);

  return {
    ok: true,
    errors: [],
    graph: resolvedGraph,
    unresolvedParameters: Array.from(unresolved),
    metadata: {
      templateId: template.id,
      templateName: template.name,
      schemaVersion: template.schemaVersion ?? TEMPLATE_SCHEMA_VERSION,
      resolvedParameters,
    },
  };
}

/**
 * Merge repo and DB template sources.
 * For conflicting ids, DB templates override repo templates.
 */
export function mergeTemplateSources(repoTemplates = [], dbTemplates = []) {
  const merged = new Map();

  for (const template of repoTemplates) {
    if (!template || !template.id) continue;
    merged.set(template.id, template);
  }

  for (const template of dbTemplates) {
    if (!template || !template.id) continue;
    merged.set(template.id, template);
  }

  return Array.from(merged.values());
}
