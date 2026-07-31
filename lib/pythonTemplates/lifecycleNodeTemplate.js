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

function splitSnippet(config) {
  const lines = [
    '# Core Lifecycle Split Node',
    `config = ${pyValue(config)}`,
    'train_pct = config.get("train_pct", 70)',
    'val_pct = config.get("val_pct", 20)',
    'test_pct = config.get("test_pct", 10)',
    'shuffle = config.get("shuffle", True)',
    'seed = config.get("seed", 42)',
    '',
    'def apply_split(dataset):',
    '    """Partition dataset into train/val/test splits."""',
    '    return apply_lifecycle("split", {"dataset": dataset}, config)',
  ];
  return lines.join('\n');
}

function batchLoaderSnippet(config) {
  const lines = [
    '# Core Lifecycle Batch Loader Node',
    `config = ${pyValue(config)}`,
    'batch_size = config.get("batch_size", 32)',
    'shuffle = config.get("shuffle", True)',
    '',
    'def apply_batch_loader(dataset):',
    '    """Create batches from dataset."""',
    '    n = len(dataset) if isinstance(dataset, (list, dict)) else 1000',
    '    num_batches = (n + batch_size - 1) // batch_size',
    '    return apply_lifecycle("batch_loader", {"dataset": dataset}, config)',
  ];
  return lines.join('\n');
}

function modelBuilderSnippet(config) {
  const lines = [
    '# Core Lifecycle Model Builder Node',
    `config = ${pyValue(config)}`,
    'family = config.get("family", "linear_regression")',
    'num_outputs = config.get("num_outputs", 1)',
    'pretrained = config.get("pretrained", False)',
    '',
    'def apply_model_builder(train_data=None):',
    '    """Build a model from training data."""',
    '    model_type = family',
    '    return apply_lifecycle("model_builder", {"train_data": train_data}, config)',
  ];
  return lines.join('\n');
}

function objectiveSnippet(config) {
  const lines = [
    '# Core Lifecycle Objective Node',
    `config = ${pyValue(config)}`,
    'task_type = config.get("objective_type") or config.get("task_type", "supervised")',
    'loss_name = config.get("loss_name") or config.get("loss_type") or config.get("loss", "cross_entropy")',
    'metrics = config.get("metrics") or []',
    '',
    'def apply_objective():',
    '    """Configure loss function and evaluation metrics."""',
    '    return apply_lifecycle("objective", {}, config)',
  ];
  return lines.join('\n');
}

function trainerSnippet(config) {
  const lines = [
    '# Core Lifecycle Trainer Node',
    `config = ${pyValue(config)}`,
    'epochs = config.get("epochs", 10)',
    'learning_rate = config.get("learning_rate", 0.001)',
    'optimizer = config.get("optimizer", "adam")',
    '',
    'def apply_trainer(model, objective, train_data=None, val_data=None):',
    '    """Train a model on the provided data."""',
    '    return apply_lifecycle("trainer", {"model": model, "objective": objective, "train_data": train_data, "val_data": val_data}, config)',
  ];
  return lines.join('\n');
}

function evaluatorSnippet(config) {
  const lines = [
    '# Core Lifecycle Evaluator Node',
    `config = ${pyValue(config)}`,
    'metrics_list = config.get("metrics", ["auto"])',
    'threshold = config.get("threshold", 0.5)',
    '',
    'def apply_evaluator(model, objective, test_data=None):',
    '    """Evaluate model predictions against ground truth."""',
    '    return apply_lifecycle("evaluator", {"model": model, "objective": objective, "eval_data": test_data}, config)',
  ];
  return lines.join('\n');
}

function predictorSnippet(config) {
  const lines = [
    '# Core Lifecycle Predictor Node',
    `config = ${pyValue(config)}`,
    'batch_size = config.get("batch_size", 32)',
    'return_probabilities = config.get("return_probabilities", True)',
    'threshold = config.get("threshold", 0.5)',
    '',
    'def apply_predictor(model, test_data=None):',
    '    """Run inference on new data."""',
    '    return apply_lifecycle("predictor", {"model": model, "inference_data": test_data}, config)',
  ];
  return lines.join('\n');
}

function hyperparameterTunerSnippet(config) {
  const lines = [
    '# Core Lifecycle Hyperparameter Tuner Node',
    `config = ${pyValue(config)}`,
    'method = config.get("method", "random")',
    'max_trials = config.get("max_trials", 20)',
    'metric = config.get("metric", "accuracy")',
    '',
    'def apply_hyperparameter_tuner(model=None, objective=None, train_data=None):',
    '    """Search for best hyperparameters."""',
    '    return apply_lifecycle("hyperparameter_tuner", {"model": model, "objective": objective, "train_data": train_data}, config)',
  ];
  return lines.join('\n');
}

function exporterSnippet(config) {
  const lines = [
    '# Core Lifecycle Exporter Node',
    `config = ${pyValue(config)}`,
    'fmt = config.get("format", "joblib")',
    'path = config.get("path", "artifacts/model")',
    'include_preprocessing = config.get("include_preprocessing", True)',
    '',
    'def apply_exporter(model=None, artifacts=None):',
    '    """Export trained model and artifacts."""',
    '    return apply_lifecycle("exporter", {"model": model, "artifacts": artifacts}, config)',
  ];
  return lines.join('\n');
}

function featureEngineerSnippet(config) {
  const lines = [
    '# Core Lifecycle Feature Engineer Node',
    `config = ${pyValue(config)}`,
    'strategy = config.get("strategy", "auto")',
    'max_features = config.get("max_features", 128)',
    'include_interactions = config.get("include_interactions", False)',
    '',
    'def apply_feature_engineer(dataset):',
    '    """Engineer features from raw data."""',
    '    return apply_lifecycle("feature_engineer", {"dataset": dataset}, config)',
  ];
  return lines.join('\n');
}

function ensembleSnippet(config) {
  const lines = [
    '# Core Lifecycle Ensemble Node',
    `config = ${pyValue(config)}`,
    'strategy = config.get("strategy", "average")',
    'weights = config.get("weights", [])',
    'optimize_weights = config.get("optimize_weights", False)',
    '',
    'def apply_ensemble(models, validation_data=None):',
    '    """Combine multiple models into an ensemble."""',
    '    return apply_lifecycle("ensemble", {"models": models, "validation_data": validation_data}, config)',
  ];
  return lines.join('\n');
}

export function generateLifecyclePythonCode(nodeType, config = {}) {
  if (nodeType === 'lifecycle.split') return splitSnippet(config);
  if (nodeType === 'lifecycle.batch_loader') return batchLoaderSnippet(config);
  if (nodeType === 'lifecycle.core.model_builder') return modelBuilderSnippet(config);
  if (nodeType === 'lifecycle.core.objective') return objectiveSnippet(config);
  if (nodeType === 'lifecycle.core.trainer') return trainerSnippet(config);
  if (nodeType === 'lifecycle.core.evaluator') return evaluatorSnippet(config);
  if (nodeType === 'lifecycle.core.predictor') return predictorSnippet(config);
  if (nodeType === 'lifecycle.core.hyperparameter_tuner') return hyperparameterTunerSnippet(config);
  if (nodeType === 'lifecycle.core.exporter') return exporterSnippet(config);
  if (nodeType === 'lifecycle.core.feature_engineer') return featureEngineerSnippet(config);
  if (nodeType === 'lifecycle.core.ensemble') return ensembleSnippet(config);
  // Fallback for unknown lifecycle nodes
  return [
    `# Unknown lifecycle node: ${nodeType}`,
    `config = ${pyValue(config)}`,
    'def apply_lifecycle_node(inputs=None):',
    '    return {"config": config}',
  ].join('\n');
}
