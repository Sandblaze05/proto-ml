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
  const normalizedOutputs = Array.isArray(outputs) ? outputs : [];
  const hasOutPort = normalizedOutputs.some((port) => port && port.name === 'out');
  return {
    type,
    kind: 'lifecycle',
    category,
    label,
    color: '#ffe066',
    accepts,
    produces,
    inputs,
    outputs: hasOutPort
      ? normalizedOutputs
      : [{ name: 'out', datatype: 'any', shape: [] }, ...normalizedOutputs],
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
      alpha: 1.0,
      l1_ratio: 0.5,
      n_estimators: 100,
      n_neighbors: 5,
      max_depth: null,
      C: 1.0,
      kernel: 'rbf',
      probability: true,
      max_iter: 10000,
    },
    uiSchema: {
      family: { type: 'enum', options: ['linear_regression', 'ridge_regression', 'lasso_regression', 'elastic_net', 'logistic_regression', 'random_forest_regressor', 'random_forest_classifier', 'gradient_boosting_regressor', 'gradient_boosting_classifier', 'decision_tree_regressor', 'decision_tree_classifier', 'knn_regressor', 'knn_classifier', 'svr', 'svc', 'naive_bayes'] },
      pretrained: { type: 'boolean', showWhen: { field: 'family', in: [] } },
      num_outputs: { type: 'number', min: 1, max: 100000, step: 1, showWhen: { field: 'family', in: [] } },
      alpha: { type: 'number', min: 0, max: 1000, step: 0.01, showWhen: { field: 'family', in: ['ridge_regression', 'lasso_regression', 'elastic_net'] } },
      l1_ratio: { type: 'number', min: 0, max: 1, step: 0.01, showWhen: { field: 'family', in: ['elastic_net'] } },
      n_estimators: { type: 'number', min: 1, max: 10000, step: 1, showWhen: { field: 'family', in: ['random_forest_regressor', 'random_forest_classifier', 'gradient_boosting_regressor', 'gradient_boosting_classifier'] } },
      n_neighbors: { type: 'number', min: 1, max: 1000, step: 1, showWhen: { field: 'family', in: ['knn_regressor', 'knn_classifier'] } },
      max_depth: { type: 'number', min: 1, max: 1000, step: 1, showWhen: { field: 'family', in: ['random_forest_regressor', 'random_forest_classifier', 'gradient_boosting_regressor', 'gradient_boosting_classifier', 'decision_tree_regressor', 'decision_tree_classifier'] } },
      C: { type: 'number', min: 0.0001, max: 1000, step: 0.1, showWhen: { field: 'family', in: ['logistic_regression', 'svr', 'svc'] } },
      kernel: { type: 'enum', options: ['rbf', 'linear', 'poly', 'sigmoid'], showWhen: { field: 'family', in: ['svr', 'svc'] } },
      probability: { type: 'boolean', showWhen: { field: 'family', in: ['svc'] } },
      max_iter: { type: 'number', min: 100, max: 100000, step: 100, showWhen: { field: 'family', in: ['logistic_regression', 'lasso_regression', 'elastic_net'] } },
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
      { name: 'test_data', datatype: 'any', shape: [], optional: true },
      { name: 'objective', datatype: 'loss', shape: [], optional: true },
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
      { name: 'test_data', datatype: 'any', shape: [], optional: true },
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
  createLifecycleDef({
    type: 'lifecycle.core.hyperparameter_tuner',
    label: 'Hyperparameter Tuner',
    category: 'core-workflow',
    inputs: [
      { name: 'model', datatype: 'model', shape: [], optional: true },
      { name: 'train_data', datatype: 'any', shape: [], optional: true },
      { name: 'objective', datatype: 'loss', shape: [], optional: true },
    ],
    outputs: [
      { name: 'best_params', datatype: 'dict', shape: [] },
      { name: 'search_report', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      method: 'random',
      max_trials: 20,
      metric: 'accuracy',
    },
    uiSchema: {
      method: { type: 'enum', options: ['random', 'grid', 'bayesian'] },
      max_trials: { type: 'number', min: 1, max: 1000, step: 1 },
      metric: { type: 'string' },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.exporter',
    label: 'Exporter',
    category: 'core-workflow',
    inputs: [
      { name: 'model', datatype: 'model', shape: [], optional: false },
      { name: 'artifacts', datatype: 'dict', shape: [], optional: true },
    ],
    outputs: [
      { name: 'export_manifest', datatype: 'dict', shape: [] },
      { name: 'package', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      format: 'joblib',
      path: 'artifacts/model',
      include_preprocessing: true,
    },
    uiSchema: {
      format: { type: 'enum', options: ['onnx', 'torchscript', 'pickle', 'joblib'] },
      path: { type: 'string' },
      include_preprocessing: { type: 'boolean' },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.feature_engineer',
    label: 'Feature Engineer',
    category: 'core-workflow',
    inputs: [
      { name: 'dataset', datatype: 'any', shape: [], optional: false },
      { name: 'config', datatype: 'dict', shape: [], optional: true },
    ],
    outputs: [
      { name: 'features', datatype: 'any', shape: [] },
      { name: 'feature_meta', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      strategy: 'auto',
      max_features: 128,
      include_interactions: false,
    },
    uiSchema: {
      strategy: { type: 'enum', options: ['auto', 'manual', 'polynomial', 'hashing'] },
      max_features: { type: 'number', min: 1, max: 100000, step: 1 },
      include_interactions: { type: 'boolean' },
    },
  }),
  createLifecycleDef({
    type: 'lifecycle.core.ensemble',
    label: 'Ensemble',
    category: 'core-workflow',
    inputs: [
      { name: 'models', datatype: 'any', shape: [], optional: false },
      { name: 'validation_data', datatype: 'any', shape: [], optional: true },
    ],
    outputs: [
      { name: 'ensemble_model', datatype: 'model', shape: [] },
      { name: 'ensemble_metrics', datatype: 'dict', shape: [] },
    ],
    defaultConfig: {
      strategy: 'average',
      weights: [],
      optimize_weights: false,
    },
    uiSchema: {
      strategy: { type: 'enum', options: ['average', 'vote', 'stacking'] },
      weights: { type: 'array:number', label: 'Weights' },
      optimize_weights: { type: 'boolean' },
    },
  }),
];
