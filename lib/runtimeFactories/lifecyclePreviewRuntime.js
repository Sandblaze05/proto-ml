const { getNodeDef, getNodeConfigDefaults, getNodeCacheMetadata } = require('../../nodes/nodeRegistry.js');
const { validateNodeSpec } = require('../runtimeSpec/nodeSpec.js');
const { computeNodeHash, isDeterministic, getSeed, getCacheKey } = require('../runtimeSpec/cacheMetadata.js');
const { DataArtifact } = require('../artifacts/dataArtifact.js');

class LifecyclePreviewRuntime {
  constructor(nodeType, config = {}) {
    this.nodeType = nodeType;
    this.config = config;
    this._nodeDef = getNodeDef(nodeType);
    this._validated = false;
    this._validationErrors = [];
  }

  async getSample(n = 5, context = {}) {
    const inputs = Array.isArray(context.inputs) ? context.inputs : [];
    const bindings = context.inputBindings && typeof context.inputBindings === 'object'
      ? context.inputBindings
      : {};

    if (this.nodeType === 'lifecycle.split') {
      return this._split(bindings.dataset ?? inputs[0]);
    }

    if (this.nodeType === 'lifecycle.batch_loader') {
      return this._batch(bindings.dataset ?? inputs[0]);
    }

    if (this.nodeType === 'lifecycle.core.model_builder') {
      const trainData = bindings.train_data ?? inputs[0];
      const trainRows = this._extractRows(trainData);
      return DataArtifact.wrap({
        model: {
          model_type: 'generic',
          family: this.config.family || 'linear_regression',
          pretrained: this.config.pretrained === true,
          num_outputs: Number(this.config.num_outputs || 1),
          observed_train_samples: trainRows.length,
        },
      }, {
        datatype: 'model',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `lifecycle.core.model_builder:${this.config.family || 'linear_regression'}`,
      });
    }

    if (this.nodeType === 'lifecycle.core.objective') {
      const model = bindings.model ?? inputs[0] ?? null;
      const targets = bindings.targets ?? inputs[1] ?? null;
      return DataArtifact.wrap({
        loss: {
          loss_type: this.config.loss || 'auto',
          objective_type: this.config.objective_type || 'supervised',
        },
        metrics_spec: {
          primary_metric: this.config.primary_metric || 'auto',
          has_model: Boolean(model),
          target_count: this._extractRows(targets).length,
        },
      }, {
        datatype: 'dict',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'lifecycle.core.objective',
      });
    }

    if (this.nodeType === 'lifecycle.core.trainer') {
      const modelInput = bindings.model ?? inputs[0] ?? null;
      const trainData = bindings.train_data ?? inputs[1] ?? null;
      const valData = bindings.val_data ?? inputs[2] ?? null;
      const objective = bindings.objective ?? inputs[3] ?? null;
      const trainCount = this._extractRows(trainData).length;
      const valCount = this._extractRows(valData).length;
      const baseline = trainCount > 0 ? 1 / (trainCount + 1) : 1;
      const valPenalty = valCount > 0 ? 1 / (valCount + 1) : baseline;

      return DataArtifact.wrap({
        trained_model: {
          model_type: modelInput?.model_type || 'generic',
          trained: true,
          epochs: Number(this.config.epochs || 20),
          seen_train_samples: trainCount,
        },
        metrics: {
          train_loss: Number(baseline.toFixed(4)),
          val_loss: Number(valPenalty.toFixed(4)),
          primary_metric: Number((1 - baseline).toFixed(4)),
        },
        logs: {
          optimizer: this.config.optimizer || 'auto',
          learning_rate: this.config.learning_rate ?? 0.001,
          objective_present: Boolean(objective),
        },
        artifacts: {
          checkpoints: ['epoch_1.ckpt'],
        },
      }, {
        datatype: 'dict',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `lifecycle.core.trainer:${this.config.epochs || 20}epochs`,
      });
    }

    if (this.nodeType === 'lifecycle.core.evaluator') {
      const modelInput = bindings.model ?? inputs[0] ?? null;
      const evalInput = bindings.eval_data ?? bindings.test_data ?? inputs[1];
      return DataArtifact.wrap({
        metrics: {
          metric_1: 0.8,
          metric_2: 0.74,
          threshold: this.config.threshold ?? 0.5,
        },
        predictions: {
          count: this._extractRows(evalInput).length,
        },
        reports: {
          metrics_requested: Array.isArray(this.config.metrics) ? this.config.metrics : ['auto'],
          has_model: Boolean(modelInput),
        },
      }, {
        datatype: 'dict',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'lifecycle.core.evaluator',
      });
    }

    if (this.nodeType === 'lifecycle.core.predictor') {
      const modelInput = bindings.model ?? inputs[0] ?? null;
      const inferenceInput = bindings.inference_data ?? bindings.test_data ?? inputs[1];
      return DataArtifact.wrap({
        predictions: {
          count: this._extractRows(inferenceInput).length,
          batch_size: Number(this.config.batch_size || 32),
          has_model: Boolean(modelInput),
        },
        confidence_scores: {
          enabled: this.config.return_probabilities !== false,
          threshold: this.config.threshold ?? 0.5,
        },
      }, {
        datatype: 'dict',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'lifecycle.core.predictor',
      });
    }

    if (this.nodeType === 'lifecycle.core.hyperparameter_tuner') {
      const modelInput = bindings.model ?? inputs[0] ?? null;
      const trainData = bindings.train_data ?? inputs[1] ?? null;
      const objective = bindings.objective ?? inputs[2] ?? null;
      const trainCount = this._extractRows(trainData).length;
      return DataArtifact.wrap({
        best_params: {
          method: this.config.method || 'random',
          max_trials: Number(this.config.max_trials || 20),
          metric: this.config.metric || 'accuracy',
        },
        search_report: {
          has_model: Boolean(modelInput),
          has_objective: Boolean(objective),
          observed_train_samples: trainCount,
        },
      }, {
        datatype: 'dict',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `lifecycle.core.hyperparameter_tuner:${this.config.method || 'random'}`,
      });
    }

    if (this.nodeType === 'lifecycle.core.exporter') {
      const modelInput = bindings.model ?? inputs[0] ?? null;
      const artifactsInput = bindings.artifacts ?? inputs[1] ?? null;
      const format = this.config.format || 'onnx';
      const path = this.config.path || 'artifacts/model';
      return DataArtifact.wrap({
        export_manifest: {
          format,
          path,
          include_preprocessing: this.config.include_preprocessing !== false,
          has_model: Boolean(modelInput),
        },
        package: {
          filename: `${path}.${format}`,
          has_artifacts: Boolean(artifactsInput),
        },
      }, {
        datatype: 'dict',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `lifecycle.core.exporter:${format}`,
      });
    }

    if (this.nodeType === 'lifecycle.core.feature_engineer') {
      const dataset = bindings.dataset ?? inputs[0] ?? null;
      const rows = this._extractRows(dataset);
      const result = {
        features: rows.map((row) => {
          if (!row || typeof row !== 'object') return row;
          const numericValues = Object.values(row).filter((value) => typeof value === 'number');
          return {
            ...row,
            feature_sum: numericValues.reduce((acc, value) => acc + value, 0),
          };
        }),
        feature_meta: {
          strategy: this.config.strategy || 'auto',
          max_features: Number(this.config.max_features || 128),
          include_interactions: this.config.include_interactions === true,
        },
      };
      return DataArtifact.wrap(result, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `lifecycle.core.feature_engineer:${this.config.strategy || 'auto'}`,
      });
    }

    if (this.nodeType === 'lifecycle.core.ensemble') {
      const models = bindings.models ?? inputs[0] ?? [];
      const validationData = bindings.validation_data ?? inputs[1] ?? null;
      const modelList = Array.isArray(models) ? models : [models];
      return DataArtifact.wrap({
        ensemble_model: {
          strategy: this.config.strategy || 'average',
          num_models: modelList.filter(Boolean).length,
        },
        ensemble_metrics: {
          optimized_weights: this.config.optimize_weights === true,
          validation_samples: this._extractRows(validationData).length,
        },
      }, {
        datatype: 'model',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `lifecycle.core.ensemble:${this.config.strategy || 'average'}`,
      });
    }

    return DataArtifact.wrap({
      node_type: this.nodeType,
      config: this.config,
      inputs,
      status: 'preview_passthrough',
    }, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: this.nodeType,
    });
  }

  validateConfig(config = {}) {
    const defaults = this._getDefaults();
    const merged = { ...defaults, ...config };
    const errors = this._validateSchema(merged);

    this._validated = errors.length === 0;
    this._validationErrors = errors;

    return {
      valid: this._validated,
      errors,
      mergedConfig: merged,
    };
  }

  getCacheMetadata() {
    return getNodeCacheMetadata(this.nodeType) || {
      version: '1.0.0',
      seed: 42,
      deterministic: true,
    };
  }

  compile(config = {}) {
    return null;
  }

  _split(input) {
    const rows = this._extractRows(input);
    const shuffle = this.config.shuffle !== false;
    const seed = Number(this.config.seed ?? 42);
    const trainPct = Number(this.config.train_pct ?? 70);
    const valPct = Number(this.config.val_pct ?? 20);
    const rowsCopy = rows.slice();
    if (shuffle) this._seededShuffle(rowsCopy, seed);
    const total = rowsCopy.length;
    const trainCount = Math.max(0, Math.min(total, Math.floor((trainPct / 100) * total)));
    const valCount = Math.max(0, Math.min(total - trainCount, Math.floor((valPct / 100) * total)));
    return DataArtifact.wrap({
      train: rowsCopy.slice(0, trainCount),
      val: rowsCopy.slice(trainCount, trainCount + valCount),
      test: rowsCopy.slice(trainCount + valCount),
    }, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: `lifecycle.split:${trainPct}/${valPct}/${100 - trainPct - valPct}`,
    });
  }

  _batch(input) {
    const dataset = this._extractRows(input);
    const batchSize = Math.max(1, Number(this.config.batch_size || 32));
    const batches = [];
    for (let index = 0; index < dataset.length; index += batchSize) {
      batches.push(dataset.slice(index, index + batchSize));
    }
    return DataArtifact.wrap({ batch_size: batchSize, batches }, {
      datatype: 'dataloader',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: `lifecycle.batch_loader:${batchSize}`,
    });
  }

  _extractRows(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      if (Array.isArray(value.rows)) return value.rows;
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.train)) return value.train;
      if (Array.isArray(value.samples)) return value.samples;
      if (value instanceof DataArtifact) return this._extractRows(value.value);
    }
    return [];
  }

  _seededShuffle(values, seed) {
    const numericSeed = Number.isFinite(seed) ? seed : 42;
    let state = (numericSeed >>> 0) || 42;
    const next = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0x100000000;
    };

    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(next() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
  }
}

module.exports = LifecyclePreviewRuntime;
