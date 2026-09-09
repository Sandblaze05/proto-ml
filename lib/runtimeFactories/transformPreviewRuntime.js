const { getNodeDef, getNodeConfigDefaults, getNodeCacheMetadata } = require('../../nodes/nodeRegistry.js');
const { validateNodeSpec } = require('../runtimeSpec/nodeSpec.js');
const { computeNodeHash, isDeterministic, getSeed, getCacheKey } = require('../runtimeSpec/cacheMetadata.js');
const { DataArtifact } = require('../artifacts/dataArtifact.js');

class TransformPreviewRuntime {
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
    const primary = bindings.in ?? bindings.input ?? bindings.dataset ?? inputs[0];

    if (this.nodeType === 'transform.core.map') {
      return this._runMap(primary);
    }

    if (this.nodeType === 'transform.core.join') {
      return this._runJoin(inputs, bindings);
    }

    if (this.nodeType === 'transform.core.route') {
      return this._runRoute(primary);
    }

    if (this.nodeType === 'transform.tabular.label_encoding') {
      return this._runLabelEncoding(primary);
    }

    if (this.nodeType === 'transform.tabular.one_hot_encoding') {
      return this._runOneHotEncoding(primary);
    }

    if (this.nodeType === 'transform.program.if_else') {
      return this._runIfElse(primary);
    }

    if (this.nodeType === 'transform.program.type_switch') {
      return this._runTypeSwitch(primary);
    }

    if (this.nodeType === 'transform.text.tfidf') {
      return this._runTfidf(primary);
    }

    if (this.nodeType === 'transform.text.count_vectorizer') {
      return this._runCountVectorizer(primary);
    }

    if (this.nodeType === 'transform.text.embedding') {
      return this._runEmbedding(primary);
    }

    if (this.nodeType === 'transform.text.stem_lemmatize') {
      return this._runStemLemmatize(primary);
    }

    return DataArtifact.wrap(primary, {
      datatype: 'tabular',
      nodeId: context.nodeId || null,
      portName: 'out',
      materializationRef: context.materializationRef || null,
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

  _runMap(input) {
    const rows = this._extractRows(input);
    const operation = this.config.operation || 'identity';

    if (operation === 'drop_columns') {
      const columns = Array.isArray(this.config.columns) ? this.config.columns : [];
      const result = rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const next = { ...row };
        columns.forEach((column) => delete next[column]);
        return next;
      });
      return DataArtifact.wrap(result, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `transform.core.map:${operation}`,
      });
    }

    if (operation === 'select_columns') {
      const columns = Array.isArray(this.config.columns) ? this.config.columns : [];
      const result = rows.map((row) => {
        if (!row || typeof row !== 'object' || columns.length === 0) return row;
        return columns.reduce((acc, key) => {
          acc[key] = row[key];
          return acc;
        }, {});
      });
      return DataArtifact.wrap(result, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `transform.core.map:${operation}`,
      });
    }

    if (operation === 'filter_rows') {
      const field = this.config.field;
      const operator = this.config.operator || '!=';
      const value = this.config.value;
      if (!field) {
        return DataArtifact.wrap(rows, {
          datatype: 'tabular',
          nodeId: this.nodeType,
          portName: 'out',
          materializationRef: `transform.core.map:${operation}`,
        });
      }
      const result = rows.filter((row) => {
        const left = row?.[field];
        if (operator === '==') return left === value;
        if (operator === '!=') return left !== value;
        if (operator === '>') return left > value;
        if (operator === '>=') return left >= value;
        if (operator === '<') return left < value;
        if (operator === '<=') return left <= value;
        return true;
      });
      return DataArtifact.wrap(result, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `transform.core.map:${operation}`,
      });
    }

    if (operation === 'tokenize') {
      return this._runTokenize(input);
    }

    return DataArtifact.wrap(input, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: `transform.core.map:${operation}`,
    });
  }

  _runJoin(inputs, inputBindings = {}) {
    const strategy = this.config.strategy || 'concat';
    const bindings = this._toBindings(inputBindings);
    const leftRaw = bindings.left ?? inputs[0];
    const rightRaw = bindings.right ?? inputs[1];
    const left = this._extractRows(leftRaw);
    const right = this._extractRows(rightRaw);

    if (strategy === 'zip') {
      const size = Math.min(left.length, right.length);
      const result = Array.from({ length: size }, (_, index) => ({ left: left[index], right: right[index] }));
      return DataArtifact.wrap(result, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `transform.core.join:${strategy}`,
      });
    }

    if (strategy === 'merge_by_key') {
      const key = this.config.key;
      if (!key) {
        const result = [...left, ...right];
        return DataArtifact.wrap(result, {
          datatype: 'tabular',
          nodeId: this.nodeType,
          portName: 'out',
          materializationRef: `transform.core.join:${strategy}`,
        });
      }
      const index = new Map(right.map((row) => [row?.[key], row]));
      const result = left.map((row) => ({ ...row, ...(index.get(row?.[key]) || {}) }));
      return DataArtifact.wrap(result, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: `transform.core.join:${strategy}`,
      });
    }

    const result = [...left, ...right];
    return DataArtifact.wrap(result, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: `transform.core.join:${strategy}`,
    });
  }

  _runRoute(input) {
    const rows = this._extractRows(input);
    const condition = String(this.config.condition || 'True').trim();
    const [field, operator, raw] = condition.split(/\s+/);
    const parsedRaw = Number.isNaN(Number(raw)) ? raw : Number(raw);

    const matches = (row) => {
      if (!field || !operator || raw === undefined) return true;
      const value = row?.[field];
      if (operator === '==') return value == parsedRaw; // eslint-disable-line eqeqeq
      if (operator === '!=') return value != parsedRaw; // eslint-disable-line eqeqeq
      if (operator === '>') return value > parsedRaw;
      if (operator === '>=') return value >= parsedRaw;
      if (operator === '<') return value < parsedRaw;
      if (operator === '<=') return value <= parsedRaw;
      return true;
    };

    const truthy = rows.filter(matches);
    const falsy = rows.filter((row) => !matches(row));
    return DataArtifact.wrap({ true: truthy, false: falsy }, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: `transform.core.route:${this.config.mode || 'split'}`,
    });
  }

  _runIfElse(input) {
    const rows = this._extractRows(input);
    const condition = String(this.config.condition || 'True').trim();

    const evaluate = (item) => {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('item', `return Boolean(${condition});`);
        return Boolean(fn(item));
      } catch {
        return false;
      }
    };

    const truthy = rows.filter(evaluate);
    const falsy = rows.filter((row) => !evaluate(row));
    if (this.config.mode === 'gate') {
      return DataArtifact.wrap(truthy.length > 0 ? truthy : falsy, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'transform.program.if_else:gate',
      });
    }
    return DataArtifact.wrap({ true: truthy, false: falsy }, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.program.if_else:split',
    });
  }

  _runTypeSwitch(input) {
    const rows = this._extractRows(input);
    const typeField = String(this.config.type_field || '').trim();
    const fallbackType = String(this.config.fallback_type || 'fallback').trim();

    const buckets = {
      tensor: [],
      sequence: [],
      dict: [],
      fallback: [],
    };

    const inferType = (item) => {
      if (typeField && item && typeof item === 'object' && item[typeField] !== undefined) {
        return String(item[typeField]).toLowerCase();
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) return 'dict';
      if (Array.isArray(item) || typeof item === 'string') return 'sequence';
      return 'tensor';
    };

    rows.forEach((item) => {
      const inferred = inferType(item);
      if (buckets[inferred]) {
        buckets[inferred].push(item);
      } else if (buckets[fallbackType]) {
        buckets[fallbackType].push(item);
      } else {
        buckets.fallback.push(item);
      }
    });

    return DataArtifact.wrap(buckets, {
      datatype: 'dict',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: `transform.program.type_switch:${typeField || 'auto'}`,
    });
  }

  _runTokenize(input) {
    if (Array.isArray(input)) {
      const result = input.map((item) => {
        if (typeof item === 'string') return item.trim() ? item.trim().split(/\s+/) : [];
        return item;
      });
      return DataArtifact.wrap(result, {
        datatype: 'sequence',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'transform.text.tokenize',
      });
    }

    if (typeof input === 'string') {
      const result = input.trim() ? input.trim().split(/\s+/) : [];
      return DataArtifact.wrap(result, {
        datatype: 'sequence',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'transform.text.tokenize',
      });
    }

    return DataArtifact.wrap(input, {
      datatype: 'sequence',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.text.tokenize',
    });
  }

  _runLabelEncoding(input) {
    const rows = this._extractRows(input);
    if (!Array.isArray(rows) || rows.length === 0 || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
      return DataArtifact.wrap(rows, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'transform.tabular.label_encoding',
      });
    }

    const configuredColumns = Array.isArray(this.config.columns) ? this.config.columns : [];
    const targetColumn = String(this.config.target_column || rows[0]?.target_column || '').trim();
    const columns = configuredColumns.length > 0
      ? configuredColumns
      : Object.keys(rows[0]).filter((col) => {
          if (col === targetColumn || String(col).startsWith('_')) return false;
          const values = rows.map((row) => row?.[col]).filter((val) => val !== null && val !== undefined && String(val).trim() !== '');
          if (values.length === 0) return false;
          return values.some((val) => Number.isNaN(Number(val)));
        });

    if (columns.length === 0) {
      return DataArtifact.wrap(rows, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'transform.tabular.label_encoding',
      });
    }

    const encodings = {};
    for (const row of rows) {
      for (const col of columns) {
        if (!encodings[col]) encodings[col] = {};
        const val = String(row?.[col] ?? '');
        if (!(val in encodings[col])) {
          encodings[col][val] = Object.keys(encodings[col]).length;
        }
      }
    }

    const result = rows.map((row) => {
      const next = { ...row };
      for (const col of columns) {
        next[col] = encodings[col][String(row?.[col] ?? '')];
      }
      return next;
    });

    return DataArtifact.wrap(result, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.tabular.label_encoding',
    });
  }

  _runOneHotEncoding(input) {
    const rows = this._extractRows(input);
    if (!Array.isArray(rows) || rows.length === 0 || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
      return DataArtifact.wrap(rows, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'transform.tabular.one_hot_encoding',
      });
    }

    const configuredColumns = Array.isArray(this.config.columns) ? this.config.columns : [];
    const targetColumn = String(this.config.target_column || rows[0]?.target_column || '').trim();
    const columns = configuredColumns.length > 0
      ? configuredColumns
      : Object.keys(rows[0]).filter((col) => {
          if (col === targetColumn || String(col).startsWith('_')) return false;
          const values = rows.map((row) => row?.[col]).filter((val) => val !== null && val !== undefined && String(val).trim() !== '');
          if (values.length === 0) return false;
          return values.some((val) => Number.isNaN(Number(val)));
        });

    if (columns.length === 0) {
      return DataArtifact.wrap(rows, {
        datatype: 'tabular',
        nodeId: this.nodeType,
        portName: 'out',
        materializationRef: 'transform.tabular.one_hot_encoding',
      });
    }

    const uniques = {};
    for (const row of rows) {
      for (const col of columns) {
        if (!uniques[col]) uniques[col] = new Set();
        uniques[col].add(String(row?.[col] ?? ''));
      }
    }

    const result = rows.map((row) => {
      const next = { ...row };
      for (const col of columns) {
        const value = String(row?.[col] ?? '');
        for (const unique of uniques[col]) {
          next[`${col}_${unique}`] = value === unique ? 1 : 0;
        }
        delete next[col];
      }
      return next;
    });

    return DataArtifact.wrap(result, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.tabular.one_hot_encoding',
    });
  }

  _runTfidf(input) {
    const rows = this._extractRows(input);
    const textCol = this.config.text_column || 'text';
    const maxFeatures = Math.min(Number(this.config.max_features) || 5000, 20); // Top 20 for preview

    // Count token frequencies
    const docFreq = {};
    const texts = rows.map((r) => (typeof r === 'string' ? r : String(r?.[textCol] ?? r?.text ?? '')));
    texts.forEach((text) => {
      const seen = new Set(text.toLowerCase().split(/\s+/).filter(Boolean));
      seen.forEach((t) => {
        docFreq[t] = (docFreq[t] || 0) + 1;
      });
    });

    const topTokens = Object.keys(docFreq)
      .sort((a, b) => docFreq[b] - docFreq[a])
      .slice(0, maxFeatures);

    const N = Math.max(1, texts.length);
    const result = rows.map((r, i) => {
      const text = texts[i];
      const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
      const tf = {};
      tokens.forEach((t) => {
        tf[t] = (tf[t] || 0) + 1;
      });

      const rowOut = {};
      topTokens.forEach((token) => {
        const idf = Math.log((1 + N) / (1 + (docFreq[token] || 0))) + 1;
        const score = (tf[token] || 0) * idf;
        rowOut[token] = Math.round(score * 1000) / 1000;
      });

      if (r && typeof r === 'object' && r.label !== undefined) {
        rowOut.label = r.label;
      }
      return rowOut;
    });

    return DataArtifact.wrap(result, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.text.tfidf',
    });
  }

  _runCountVectorizer(input) {
    const rows = this._extractRows(input);
    const textCol = this.config.text_column || 'text';
    const binary = Boolean(this.config.binary);
    const maxFeatures = Math.min(Number(this.config.max_features) || 5000, 20);

    const totalFreq = {};
    const texts = rows.map((r) => (typeof r === 'string' ? r : String(r?.[textCol] ?? r?.text ?? '')));
    texts.forEach((text) => {
      const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
      tokens.forEach((t) => {
        totalFreq[t] = (totalFreq[t] || 0) + 1;
      });
    });

    const topTokens = Object.keys(totalFreq)
      .sort((a, b) => totalFreq[b] - totalFreq[a])
      .slice(0, maxFeatures);

    const result = rows.map((r, i) => {
      const text = texts[i];
      const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
      const counts = {};
      tokens.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });

      const rowOut = {};
      topTokens.forEach((token) => {
        const c = counts[token] || 0;
        rowOut[token] = binary ? (c > 0 ? 1 : 0) : c;
      });

      if (r && typeof r === 'object' && r.label !== undefined) {
        rowOut.label = r.label;
      }
      return rowOut;
    });

    return DataArtifact.wrap(result, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.text.count_vectorizer',
    });
  }

  _runEmbedding(input) {
    const rows = this._extractRows(input);
    const textCol = this.config.text_column || 'text';
    const dim = 16; // 16 dimensions for preview simulation

    const result = rows.map((r) => {
      const text = typeof r === 'string' ? r : String(r?.[textCol] ?? r?.text ?? '');
      const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);

      const rowOut = {};
      for (let d = 0; d < dim; d++) {
        // Deterministic hash-based mock embedding
        let sum = 0;
        tokens.forEach((token, idx) => {
          sum += Math.sin((token.charCodeAt(0) || 0) * (d + 1) + idx);
        });
        const val = tokens.length > 0 ? sum / Math.sqrt(tokens.length) : 0;
        rowOut[`emb_${d}`] = Math.round(val * 1000) / 1000;
      }

      if (r && typeof r === 'object' && r.label !== undefined) {
        rowOut.label = r.label;
      }
      return rowOut;
    });

    return DataArtifact.wrap(result, {
      datatype: 'tabular',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.text.embedding',
    });
  }

  _runStemLemmatize(input) {
    const rows = this._extractRows(input);
    const textCol = this.config.text_column || 'text';

    const stemWord = (word) => {
      let w = String(word).toLowerCase();
      const suffixes = ['ing', 'tion', 'ness', 'ment', 'able', 'ible', 'ous', 'ful', 'less', 'ly', 'ed', 'er', 'es', 's'];
      for (const s of suffixes) {
        if (w.length > s.length + 2 && w.endsWith(s)) {
          return w.slice(0, -s.length);
        }
      }
      return w;
    };

    const result = rows.map((r) => {
      if (typeof r === 'string') {
        return r.split(/\s+/).map(stemWord).join(' ');
      }
      if (r && typeof r === 'object') {
        const text = String(r[textCol] ?? r.text ?? '');
        const stemmed = text.split(/\s+/).map(stemWord).join(' ');
        return {
          ...r,
          [textCol]: stemmed,
          text: stemmed,
        };
      }
      return r;
    });

    return DataArtifact.wrap(result, {
      datatype: 'sequence',
      nodeId: this.nodeType,
      portName: 'out',
      materializationRef: 'transform.text.stem_lemmatize',
    });
  }

  _extractRows(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.rows)) return value.rows;
      if (Array.isArray(value.train)) return value.train;
      if (Array.isArray(value.items)) return value.items;
      if (value instanceof DataArtifact) return this._extractRows(value.value);
    }
    return [];
  }

  _toBindings(inputs) {
    if (inputs && !Array.isArray(inputs) && typeof inputs === 'object') {
      return inputs;
    }
    return {};
  }
}

module.exports = TransformPreviewRuntime;
