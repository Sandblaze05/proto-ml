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
    '',
    'def apply_split(dataset):',
    '    """Partition dataset into train/val/test sets."""',
    '    n = len(dataset) if isinstance(dataset, (list, dict)) else 1000',
    '    n_train = int(n * train_pct / 100)',
    '    n_val = int(n * val_pct / 100)',
    '    n_test = n - n_train - n_val',
    '    return {',
    '        "train": {"size": n_train, "indices": list(range(0, n_train))},',
    '        "val": {"size": n_val, "indices": list(range(n_train, n_train + n_val))},',
    '        "test": {"size": n_test, "indices": list(range(n_train + n_val, n))},',
    '    }',
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
    '    n_batches = (n + batch_size - 1) // batch_size',
    '    return {',
    '        "batch_size": batch_size,',
    '        "num_batches": n_batches,',
    '        "shuffle": shuffle,',
    '        "dataloader": {"batches": n_batches, "batch_size": batch_size},',
    '    }',
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
    '    """Build model architecture."""',
    '    return {',
    '        "model_type": family,',
    '        "num_outputs": num_outputs,',
    '        "pretrained": pretrained,',
    '        "model": {"initialized": True, "device": "cpu"},',
    '    }',
  ];
  return lines.join('\n');
}

function objectiveSnippet(config) {
  const lines = [
    '# Core Lifecycle Objective Node',
    `config = ${pyValue(config)}`,
    'task_type = config.get("task_type") or config.get("objective_type", "supervised")',
    'loss_name = config.get("loss_name") or config.get("loss_type") or config.get("loss", "cross_entropy")',
    'legacy_metric = config.get("primary_metric", "auto")',
    'metrics = config.get("metrics") or ([] if legacy_metric == "auto" else [legacy_metric])',
    '',
    'def apply_objective():',
    '    """Configure loss and metrics."""',
    '    return {',
    '        "loss": loss_name,',
    '        "metrics": metrics,',
    '        "task_type": task_type,',
    '    }',
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
    '    """Train model on data."""',
    '    return {',
    '        "trained_model": {"epochs_completed": epochs, "optimizer": optimizer},',
    '        "metrics": {"train_loss": 0.1, "val_loss": 0.12},',
    '        "logs": {"learning_rate": learning_rate, "optimizer": optimizer},',
    '        "artifacts": {"checkpoints": []},',
    '    }',
  ];
  return lines.join('\n');
}

function evaluatorSnippet(config) {
  const lines = [
    '# Core Lifecycle Evaluator Node',
    `config = ${pyValue(config)}`,
    'metrics_list = config.get("metrics", [])',
    '',
    'def apply_evaluator(model, objective, test_data=None):',
    '    """Evaluate model on test data."""',
    '    return {',
    '        "metrics": {"accuracy": 0.85, "f1": 0.82},',
    '        "predictions": {"count": 100, "shape": [100, 1]},',
    '        "reports": {"confusion_matrix": None, "roc_auc": 0.89},',
    '    }',
  ];
  return lines.join('\n');
}

function predictorSnippet(config) {
  const lines = [
    '# Core Lifecycle Predictor Node',
    `config = ${pyValue(config)}`,
    'batch_size = config.get("batch_size", 32)',
    'return_probabilities = config.get("return_probabilities", False)',
    '',
    'def apply_predictor(model, test_data=None):',
    '    """Generate predictions on new data."""',
    '    return {',
    '        "predictions": {"count": 100, "values": []},',
    '        "batch_size": batch_size,',
    '        "probabilities": return_probabilities,',
    '    }',
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
    '    return {',
    '        "method": method,',
    '        "max_trials": max_trials,',
    '        "metric": metric,',
    '        "best_params": {},',
    '        "search_report": {"status": "stub"},',
    '    }',
  ];
  return lines.join('\n');
}

function exporterSnippet(config) {
  const lines = [
    '# Core Lifecycle Exporter Node',
    `config = ${pyValue(config)}`,
    'fmt = config.get("format", "onnx")',
    'path = config.get("path", "artifacts/model")',
    '',
    'def apply_exporter(model=None, artifacts=None):',
    '    return {',
    '        "export_manifest": {"format": fmt, "path": path},',
    '        "package": {"model_path": f"{path}.{fmt}"},',
    '    }',
  ];
  return lines.join('\n');
}

function featureEngineerSnippet(config) {
  const lines = [
    '# Core Lifecycle Feature Engineer Node',
    `config = ${pyValue(config)}`,
    'strategy = config.get("strategy", "auto")',
    'max_features = config.get("max_features", 128)',
    '',
    'def apply_feature_engineer(dataset):',
    '    return {',
    '        "features": dataset,',
    '        "feature_meta": {"strategy": strategy, "max_features": max_features},',
    '    }',
  ];
  return lines.join('\n');
}

function ensembleSnippet(config) {
  const lines = [
    '# Core Lifecycle Ensemble Node',
    `config = ${pyValue(config)}`,
    'strategy = config.get("strategy", "average")',
    'weights = config.get("weights", [])',
    '',
    'def apply_ensemble(models):',
    '    return {',
    '        "ensemble_model": {"strategy": strategy, "weights": weights},',
    '        "ensemble_metrics": {},',
    '    }',
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
