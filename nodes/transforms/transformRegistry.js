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
  const normalizedOutputs = Array.isArray(outputs) ? outputs : [];
  const hasOutPort = normalizedOutputs.some((port) => port && port.name === 'out');
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
    outputs: hasOutPort
      ? normalizedOutputs
      : [{ name: 'out', datatype: 'any', shape: [] }, ...normalizedOutputs],
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
  createTransformDef({
    type: 'transform.tabular.drop_columns',
    label: 'Drop Columns',
    category: 'tabular',
    defaultConfig: {
      columns: [],
    },
    uiSchema: {
      columns: { type: 'array:string', label: 'Columns' },
    },
  }),
  createTransformDef({
    type: 'transform.tabular.fill_missing',
    label: 'Fill Missing',
    category: 'tabular',
    defaultConfig: {
      strategy: 'mean',
      columns: [],
      fill_value: 0,
    },
    uiSchema: {
      strategy: { type: 'enum', options: ['mean', 'median', 'mode', 'constant'] },
      columns: { type: 'array:string', label: 'Columns' },
      fill_value: { type: 'number', label: 'Fill Value' },
    },
  }),
  createTransformDef({
    type: 'transform.tabular.standard_scaler',
    label: 'Standard Scaler',
    category: 'tabular',
    defaultConfig: {
      columns: [],
    },
    uiSchema: {
      columns: { type: 'array:string', label: 'Columns' },
    },
  }),
  createTransformDef({
    type: 'transform.tabular.minmax_scaler',
    label: 'MinMax Scaler',
    category: 'tabular',
    defaultConfig: {
      columns: [],
      min_value: 0,
      max_value: 1,
    },
    uiSchema: {
      columns: { type: 'array:string', label: 'Columns' },
      min_value: { type: 'number', label: 'Min' },
      max_value: { type: 'number', label: 'Max' },
    },
  }),
  createTransformDef({
    type: 'transform.tabular.label_encoding',
    label: 'Label Encoding',
    category: 'tabular',
    defaultConfig: {
      columns: [],
    },
    uiSchema: {
      columns: { type: 'array:string', label: 'Columns' },
    },
  }),
  createTransformDef({
    type: 'transform.tabular.one_hot_encoding',
    label: 'One-Hot Encoding',
    category: 'tabular',
    defaultConfig: {
      columns: [],
    },
    uiSchema: {
      columns: { type: 'array:string', label: 'Columns' },
    },
  }),
  createTransformDef({
    type: 'transform.image.resize',
    label: 'Resize',
    category: 'image',
    defaultConfig: {
      size: [224, 224],
    },
    uiSchema: {
      size: { type: 'array:number', label: 'Size [H, W]' },
    },
  }),
  createTransformDef({
    type: 'transform.image.normalize',
    label: 'Normalize',
    category: 'image',
    defaultConfig: {
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    },
    uiSchema: {
      mean: { type: 'array:number', label: 'Mean' },
      std: { type: 'array:number', label: 'Std' },
    },
  }),
  createTransformDef({
    type: 'transform.image.grayscale',
    label: 'Grayscale',
    category: 'image',
    defaultConfig: {
      num_output_channels: 1,
    },
    uiSchema: {
      num_output_channels: { type: 'enum', options: [1, 3] },
    },
  }),
  createTransformDef({
    type: 'transform.image.center_crop',
    label: 'Center Crop',
    category: 'image',
    defaultConfig: {
      size: [224, 224],
    },
    uiSchema: {
      size: { type: 'array:number', label: 'Size [H, W]' },
    },
  }),
  createTransformDef({
    type: 'transform.image.random_flip',
    label: 'Random Flip',
    category: 'image',
    defaultConfig: {
      direction: 'horizontal',
      p: 0.5,
    },
    uiSchema: {
      direction: { type: 'enum', options: ['horizontal', 'vertical', 'both'] },
      p: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
  }),
  createTransformDef({
    type: 'transform.image.color_jitter',
    label: 'Color Jitter',
    category: 'image',
    defaultConfig: {
      brightness: 0.2,
      contrast: 0.2,
      saturation: 0.2,
      hue: 0.0,
    },
    uiSchema: {
      brightness: { type: 'number', min: 0, max: 1, step: 0.01 },
      contrast: { type: 'number', min: 0, max: 1, step: 0.01 },
      saturation: { type: 'number', min: 0, max: 1, step: 0.01 },
      hue: { type: 'number', min: -0.5, max: 0.5, step: 0.01 },
    },
  }),
  createTransformDef({
    type: 'transform.image.gaussian_blur',
    label: 'Gaussian Blur',
    category: 'image',
    defaultConfig: {
      kernel_size: 3,
      sigma: [0.1, 2.0],
    },
    uiSchema: {
      kernel_size: { type: 'number', min: 1, max: 15, step: 2 },
      sigma: { type: 'array:number', label: 'Sigma Range' },
    },
  }),
  createTransformDef({
    type: 'transform.image.random_rotation',
    label: 'Random Rotation',
    category: 'image',
    defaultConfig: {
      degrees: 30,
      p: 1,
    },
    uiSchema: {
      degrees: { type: 'number', min: 0, max: 360, step: 1 },
      p: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
  }),
  createTransformDef({
    type: 'transform.text.lowercase',
    label: 'Lowercase',
    category: 'text',
    defaultConfig: {},
    uiSchema: {},
  }),
  createTransformDef({
    type: 'transform.text.remove_punctuation',
    label: 'Remove Punctuation',
    category: 'text',
    defaultConfig: {},
    uiSchema: {},
  }),
  createTransformDef({
    type: 'transform.text.tokenize',
    label: 'Tokenize',
    category: 'text',
    defaultConfig: {
      separator: ' ',
    },
    uiSchema: {
      separator: { type: 'string', label: 'Separator' },
    },
  }),
  createTransformDef({
    type: 'transform.text.stopword_removal',
    label: 'Stopword Removal',
    category: 'text',
    defaultConfig: {
      stopwords: [],
    },
    uiSchema: {
      stopwords: { type: 'array:string', label: 'Stopwords' },
    },
  }),
  createTransformDef({
    type: 'transform.text.truncation',
    label: 'Truncation',
    category: 'text',
    defaultConfig: {
      max_length: 512,
    },
    uiSchema: {
      max_length: { type: 'number', min: 1, max: 32768, step: 1 },
    },
  }),
];
