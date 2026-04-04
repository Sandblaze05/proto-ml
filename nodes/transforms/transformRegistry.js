function createTransformDef({
  type,
  label,
  category,
  accepts = ['*'],
  produces = ['*'],
  inputs = [{ name: 'in', datatype: 'any', shape: [], optional: false }],
  outputs = [{ name: 'out', datatype: 'any', shape: [] }],
  defaultConfig = {},
  uiSchema = {},
}) {
  return {
    type,
    domain: 'core',
    kind: 'transform',
    category,
    level: 1,
    label,
    color: '#67e8f9',
    accepts,
    produces,
    inputs,
    outputs,
    defaultConfig,
    uiSchema,
    metadata: { domain: 'core' },
  };
}

export const TRANSFORM_NODES = [
  createTransformDef({
    type: 'transform.core.map',
    label: 'Map',
    category: 'core',
    inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
    outputs: [{ name: 'out', datatype: 'any', shape: [] }],
    defaultConfig: {
      operation: 'identity',
      expression: '',
      preserve_schema: true,
    },
    uiSchema: {
      operation: { type: 'enum', options: ['identity', 'select_columns', 'drop_columns', 'filter_rows', 'tokenize', 'normalize', 'custom'] },
      expression: { type: 'string', label: 'Expression / Rule' },
      preserve_schema: { type: 'boolean', label: 'Preserve Schema' },
    },
  }),
  createTransformDef({
    type: 'transform.core.join',
    label: 'Join',
    category: 'core',
    inputs: [
      { name: 'left', datatype: 'any', shape: [], optional: false },
      { name: 'right', datatype: 'any', shape: [], optional: false },
      { name: 'aux', datatype: 'any', shape: [], optional: true },
    ],
    outputs: [{ name: 'merged', datatype: 'any', shape: [] }],
    defaultConfig: {
      strategy: 'concat',
      key: '',
      axis: 0,
    },
    uiSchema: {
      strategy: { type: 'enum', options: ['concat', 'merge_by_key', 'zip', 'overlay'] },
      key: { type: 'string', label: 'Join Key' },
      axis: { type: 'number', min: 0, max: 4, step: 1, label: 'Axis' },
    },
  }),
  createTransformDef({
    type: 'transform.core.route',
    label: 'Route',
    category: 'core',
    inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
    outputs: [
      { name: 'true', datatype: 'any', shape: [] },
      { name: 'false', datatype: 'any', shape: [] },
    ],
    defaultConfig: {
      condition: 'True',
      mode: 'split',
    },
    uiSchema: {
      condition: { type: 'string', label: 'Condition' },
      mode: { type: 'enum', options: ['split', 'gate'] },
    },
  }),
  createTransformDef({
    type: 'transform.program.if_else',
    label: 'If / Else',
    category: 'programming',
    inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
    outputs: [
      { name: 'true', datatype: 'any', shape: [] },
      { name: 'false', datatype: 'any', shape: [] },
    ],
    defaultConfig: {
      condition: 'True',
      mode: 'split',
    },
    uiSchema: {
      condition: { type: 'string', label: 'Condition' },
      mode: { type: 'enum', options: ['split', 'gate'] },
    },
  }),
  createTransformDef({
    type: 'transform.program.type_switch',
    label: 'Type Switch',
    category: 'programming',
    inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
    outputs: [
      { name: 'tensor', datatype: 'any', shape: [] },
      { name: 'sequence', datatype: 'any', shape: [] },
      { name: 'dict', datatype: 'any', shape: [] },
      { name: 'fallback', datatype: 'any', shape: [] },
    ],
    defaultConfig: {
      type_field: '',
      fallback_type: 'fallback',
    },
    uiSchema: {
      type_field: { type: 'string', label: 'Type Field (optional)' },
      fallback_type: { type: 'enum', options: ['fallback', 'dict', 'sequence', 'tensor'] },
    },
  }),
];
