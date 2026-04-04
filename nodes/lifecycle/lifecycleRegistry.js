function createLifecycleDef({
  type,
  label,
  category,
  accepts = ['*'],
  produces = ['*'],
  inputs = [],
  outputs = [],
  defaultConfig = {},
  uiSchema = {},
}) {
  return {
    type,
    kind: 'lifecycle',
    category,
    label,
    color: '#ffe066',
    accepts,
    produces,
    inputs,
    outputs,
    defaultConfig,
    uiSchema,
    metadata: { stage: category },
  };
}

export const LIFECYCLE_NODES = [
  createLifecycleDef({
    type: 'lifecycle.split',
    label: 'Split',
    category: 'core-workflow',
    inputs: [{ name: 'dataset', datatype: 'any', shape: [], optional: false }],
    outputs: [
      { name: 'train', datatype: 'any', shape: [] },
      { name: 'val', datatype: 'any', shape: [] },
      { name: 'test', datatype: 'any', shape: [] },
    ],
    defaultConfig: {
      train_pct: 70,
      val_pct: 20,
      test_pct: 10,
      shuffle: true,
    },
    uiSchema: {
      train_pct: { type: 'number', min: 1, max: 98, step: 1 },
      val_pct: { type: 'number', min: 0, max: 98, step: 1 },
      test_pct: { type: 'number', min: 0, max: 98, step: 1 },
      shuffle: { type: 'boolean' },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.batch_loader',
    label: 'Batch Loader',
    category: 'core-workflow',
    inputs: [{ name: 'dataset', datatype: 'any', shape: [], optional: false }],
    outputs: [{ name: 'batches', datatype: 'dataloader', shape: [] }],
    defaultConfig: {
      batch_size: 32,
      shuffle: true,
    },
    uiSchema: {
      batch_size: { type: 'number', min: 1, max: 4096, step: 1 },
      shuffle: { type: 'boolean' },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.model_builder',
    label: 'Model Builder',
    category: 'core-workflow',
    inputs: [
      { name: 'train_data', datatype: 'any', shape: [], optional: true },
      { name: 'config', datatype: 'dict', shape: [], optional: true },
    ],
    outputs: [{ name: 'model', datatype: 'model', shape: [] }],
    defaultConfig: {
      family: 'linear_regression',
      pretrained: false,
      num_outputs: 1,
    },
    uiSchema: {
      family: { type: 'enum', options: ['linear_regression', 'logistic_regression', 'mlp', 'cnn', 'transformer', 'custom'] },
      pretrained: { type: 'boolean' },
      num_outputs: { type: 'number', min: 1, max: 100000, step: 1 },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.objective',
    label: 'Objective',
    category: 'core-workflow',
    inputs: [
      { name: 'model', datatype: 'model', shape: [], optional: true },
      { name: 'targets', datatype: 'any', shape: [], optional: true },
      { name: 'config', datatype: 'dict', shape: [], optional: true },
    ],
    outputs: [
      { name: 'loss', datatype: 'loss', shape: [] },
      { name: 'metrics_spec', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      objective_type: 'supervised',
      loss: 'auto',
      primary_metric: 'auto',
    },
    uiSchema: {
      objective_type: { type: 'enum', options: ['supervised', 'self_supervised', 'custom'] },
      loss: { type: 'string' },
      primary_metric: { type: 'string' },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.trainer',
    label: 'Trainer',
    category: 'core-workflow',
    produces: ['model', 'metrics', 'logs', 'artifacts'],
    inputs: [
      { name: 'model', datatype: 'model', shape: [], optional: false },
      { name: 'train_data', datatype: 'any', shape: [], optional: true },
      { name: 'val_data', datatype: 'any', shape: [], optional: true },
      { name: 'objective', datatype: 'loss', shape: [], optional: true },
    ],
    outputs: [
      { name: 'trained_model', datatype: 'model', shape: [] },
      { name: 'metrics', datatype: 'dict', shape: [] },
      { name: 'logs', datatype: 'dict', shape: [] },
      { name: 'artifacts', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      epochs: 20,
      optimizer: 'auto',
      learning_rate: 0.001,
    },
    uiSchema: {
      epochs: { type: 'number', min: 1, max: 10000, step: 1 },
      optimizer: { type: 'string' },
      learning_rate: { type: 'number', min: 0, max: 10, step: 0.0001 },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.evaluator',
    label: 'Evaluator',
    category: 'core-workflow',
    produces: ['metrics', 'predictions', 'reports'],
    inputs: [
      { name: 'model', datatype: 'model', shape: [], optional: false },
      { name: 'eval_data', datatype: 'any', shape: [], optional: true },
      { name: 'targets', datatype: 'any', shape: [], optional: true },
    ],
    outputs: [
      { name: 'metrics', datatype: 'dict', shape: [] },
      { name: 'predictions', datatype: 'dict', shape: [] },
      { name: 'reports', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      metrics: ['auto'],
      threshold: 0.5,
    },
    uiSchema: {
      metrics: { type: 'array:string' },
      threshold: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.predictor',
    label: 'Predictor',
    category: 'core-workflow',
    produces: ['predictions', 'confidence_scores'],
    inputs: [
      { name: 'model', datatype: 'model', shape: [], optional: false },
      { name: 'inference_data', datatype: 'any', shape: [], optional: true },
    ],
    outputs: [
      { name: 'predictions', datatype: 'dict', shape: [] },
      { name: 'confidence_scores', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      batch_size: 32,
      return_probabilities: true,
      threshold: 0.5,
    },
    uiSchema: {
      batch_size: { type: 'number', min: 1, max: 4096, step: 1 },
      return_probabilities: { type: 'boolean' },
      threshold: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
  }),
];
