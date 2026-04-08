class LifecyclePreviewRuntime {
  constructor(nodeType, config = {}) {
    this.nodeType = nodeType;
    this.config = config;
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
      return {
        model_type: 'generic',
        family: this.config.family || 'linear_regression',
        pretrained: this.config.pretrained === true,
        num_outputs: Number(this.config.num_outputs || 1),
      };
    }

    if (this.nodeType === 'lifecycle.core.objective') {
      return {
        loss_type: this.config.loss || 'auto',
        objective_type: this.config.objective_type || 'supervised',
        primary_metric: this.config.primary_metric || 'auto',
      };
    }

    if (this.nodeType === 'lifecycle.core.trainer') {
      return {
        trained_model: {
          model_type: 'generic',
          trained: true,
          epochs: Number(this.config.epochs || 20),
        },
        metrics: {
          train_loss: 0.42,
          val_loss: 0.51,
          primary_metric: 0.78,
        },
        logs: {
          optimizer: this.config.optimizer || 'auto',
          learning_rate: this.config.learning_rate ?? 0.001,
        },
        artifacts: {
          checkpoints: ['epoch_1.ckpt'],
        },
      };
    }

    if (this.nodeType === 'lifecycle.core.evaluator') {
      const evalInput = bindings.eval_data ?? bindings.test ?? inputs[0];
      return {
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
        },
      };
    }

    if (this.nodeType === 'lifecycle.core.predictor') {
      const inferenceInput = bindings.inference_data ?? bindings.test ?? inputs[0];
      return {
        predictions: {
          count: this._extractRows(inferenceInput).length,
          batch_size: Number(this.config.batch_size || 32),
        },
        confidence_scores: {
          enabled: this.config.return_probabilities !== false,
          threshold: this.config.threshold ?? 0.5,
        },
      };
    }

    return {
      node_type: this.nodeType,
      config: this.config,
      inputs,
      status: 'preview_passthrough',
    };
  }

  _split(input) {
    const rows = this._extractRows(input);
    const shuffle = this.config.shuffle !== false;
    const trainPct = Number(this.config.train_pct ?? 70);
    const valPct = Number(this.config.val_pct ?? 20);
    const rowsCopy = rows.slice();
    if (shuffle) rowsCopy.sort(() => Math.random() - 0.5);
    const total = rowsCopy.length;
    const trainCount = Math.max(0, Math.min(total, Math.floor((trainPct / 100) * total)));
    const valCount = Math.max(0, Math.min(total - trainCount, Math.floor((valPct / 100) * total)));
    return {
      train: rowsCopy.slice(0, trainCount),
      val: rowsCopy.slice(trainCount, trainCount + valCount),
      test: rowsCopy.slice(trainCount + valCount),
    };
  }

  _batch(input) {
    const dataset = this._extractRows(input);
    const batchSize = Math.max(1, Number(this.config.batch_size || 32));
    const batches = [];
    for (let index = 0; index < dataset.length; index += batchSize) {
      batches.push(dataset.slice(index, index + batchSize));
    }
    return { batch_size: batchSize, batches };
  }

  _extractRows(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      if (Array.isArray(value.rows)) return value.rows;
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.train)) return value.train;
      if (Array.isArray(value.samples)) return value.samples;
    }
    return [];
  }
}

module.exports = LifecyclePreviewRuntime;
