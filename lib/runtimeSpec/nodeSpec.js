/**
 * NodeSpec — Canonical node definition schema.
 *
 * Every node implementation MUST conform to this shape. It unifies the
 * port contract, config validation, preview reference, backend reference,
 * and cache metadata into a single specification so that node definitions,
 * preview JavaScript, Python runtime, compiler dispatch, and tests cannot drift.
 */

const VALID_KINDS = Object.freeze(['dataset', 'transform', 'lifecycle', 'generic']);
const VALID_PORT_ROLES = Object.freeze([
  'data', 'dataset', 'model', 'objective', 'metrics', 'predictions',
  'config', 'labels', 'targets', 'unknown', 'any',
]);

function assertValidPort(port, context) {
  if (!port || typeof port !== 'object') {
    throw new Error(`Invalid port in ${context}: expected object.`);
  }
  if (typeof port.name !== 'string' || !port.name.trim()) {
    throw new Error(`Invalid port in ${context}: 'name' must be a non-empty string.`);
  }
  if (typeof port.datatype !== 'string' || !port.datatype.trim()) {
    throw new Error(`Invalid port in ${context}: 'datatype' must be a non-empty string.`);
  }
}

function assertValidConfigSchema(config, context) {
  if (!config || typeof config !== 'object') {
    throw new Error(`Invalid config in ${context}: expected object.`);
  }
}

function assertValidCacheMetadata(cache, context) {
  if (!cache || typeof cache !== 'object') {
    throw new Error(`Invalid cache metadata in ${context}: expected object.`);
  }
  if (typeof cache.version !== 'string' || !cache.version.trim()) {
    throw new Error(`Invalid cache metadata in ${context}: 'version' must be a non-empty string.`);
  }
}

/**
 * Validate a node definition against the canonical NodeSpec schema.
 * Returns an object with `valid` (boolean) and `errors` (string array).
 */
export function validateNodeSpec(def) {
  const errors = [];

  if (!def || typeof def !== 'object') {
    return { valid: false, errors: ['Node definition must be an object.'] };
  }

  if (typeof def.type !== 'string' || !def.type.trim()) {
    errors.push('Missing or invalid required field: type (non-empty string).');
  }

  if (!VALID_KINDS.includes(def.kind)) {
    errors.push(`Invalid or missing 'kind'. Must be one of: ${VALID_KINDS.join(', ')}.`);
  }

  if (typeof def.label !== 'string' || !def.label.trim()) {
    errors.push('Missing or invalid required field: label (non-empty string).');
  }

  // Ports
  const ports = def.ports;
  if (!ports || typeof ports !== 'object') {
    errors.push('Missing or invalid required field: ports (object with inputs and outputs).');
  } else {
    if (!Array.isArray(ports.inputs)) {
      errors.push('ports.inputs must be an array.');
    } else {
      ports.inputs.forEach((p, i) => {
        try { assertValidPort(p, `ports.inputs[${i}]`); } catch (e) { errors.push(e.message); }
      });
    }
    if (!Array.isArray(ports.outputs)) {
      errors.push('ports.outputs must be an array.');
    } else {
      ports.outputs.forEach((p, i) => {
        try { assertValidPort(p, `ports.outputs[${i}]`); } catch (e) { errors.push(e.message); }
      });
    }
  }

  // Config
  if (!def.config || typeof def.config !== 'object') {
    errors.push('Missing or invalid required field: config (object with defaults and schema).');
  } else {
    assertValidConfigSchema(def.config, 'config');
    if (!def.config.defaults || typeof def.config.defaults !== 'object') {
      errors.push('config.defaults must be an object.');
    }
    if (def.config.schema !== undefined && def.config.schema !== null && typeof def.config.schema !== 'object') {
      errors.push('config.schema must be an object or null.');
    }
  }

  // Preview
  if (typeof def.preview !== 'function' && typeof def.preview !== 'string') {
    errors.push('Missing or invalid required field: preview (function or string reference).');
  }

  // Backend
  if (typeof def.backend !== 'function' && typeof def.backend !== 'string') {
    errors.push('Missing or invalid required field: backend (function or string reference).');
  }

  // Cache metadata
  if (!def.cache || typeof def.cache !== 'object') {
    errors.push('Missing or invalid required field: cache (object with version).');
  } else {
    assertValidCacheMetadata(def.cache, 'cache');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a canonical node definition from a partial spec, filling in defaults.
 */
export function createNodeSpec(partial) {
  const defaults = {
    kind: 'generic',
    category: 'custom',
    label: partial.type || 'unknown',
    ports: {
      inputs: [],
      outputs: [],
    },
    config: {
      defaults: {},
      schema: null,
    },
    preview: null,
    backend: null,
    cache: {
      version: '1.0.0',
      seed: 42,
      deterministic: true,
    },
  };

  const merged = {
    ...defaults,
    ...partial,
    ports: {
      ...defaults.ports,
      ...(partial.ports || {}),
      inputs: Array.isArray(partial?.ports?.inputs) ? partial.ports.inputs : defaults.ports.inputs,
      outputs: Array.isArray(partial?.ports?.outputs) ? partial.ports.outputs : defaults.ports.outputs,
    },
    config: {
      ...defaults.config,
      ...(partial.config || {}),
      defaults: {
        ...defaults.config.defaults,
        ...(partial.config?.defaults || {}),
      },
    },
    cache: {
      ...defaults.cache,
      ...(partial.cache || {}),
    },
  };

  const validation = validateNodeSpec(merged);
  if (!validation.valid) {
    throw new Error(`Invalid NodeSpec: ${validation.errors.join(' ')}`);
  }

  return Object.freeze(merged);
}

/**
 * Extract the port contract from a node spec.
 */
export function getPortContract(nodeSpec) {
  return {
    inputs: nodeSpec.ports.inputs.map((p) => ({
      name: p.name,
      datatype: p.datatype,
      shape: p.shape ?? [],
      role: p.role ?? 'unknown',
      optional: p.optional ?? false,
    })),
    outputs: nodeSpec.ports.outputs.map((p) => ({
      name: p.name,
      datatype: p.datatype,
      shape: p.shape ?? [],
      role: p.role ?? 'unknown',
    })),
  };
}

/**
 * Extract the config schema from a node spec.
 */
export function getConfigSchema(nodeSpec) {
  return {
    defaults: { ...nodeSpec.config.defaults },
    schema: nodeSpec.config.schema ?? null,
  };
}

/**
 * Extract the cache metadata from a node spec.
 */
export function getCacheMetadata(nodeSpec) {
  return {
    version: nodeSpec.cache.version,
    seed: nodeSpec.cache.seed ?? 42,
    deterministic: nodeSpec.cache.deterministic ?? true,
  };
}

export { VALID_KINDS, VALID_PORT_ROLES };