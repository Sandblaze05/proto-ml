class TransformPreviewRuntime {
  constructor(nodeType, config = {}) {
    this.nodeType = nodeType;
    this.config = config;
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

    if (this.nodeType === 'transform.program.if_else') {
      return this._runIfElse(primary);
    }

    if (this.nodeType === 'transform.program.type_switch') {
      return this._runTypeSwitch(primary);
    }

    return primary;
  }

  _runMap(input) {
    const rows = this._extractRows(input);
    const operation = this.config.operation || 'identity';

    if (operation === 'drop_columns') {
      const columns = Array.isArray(this.config.columns) ? this.config.columns : [];
      return rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const next = { ...row };
        columns.forEach((column) => delete next[column]);
        return next;
      });
    }

    if (operation === 'select_columns') {
      const columns = Array.isArray(this.config.columns) ? this.config.columns : [];
      return rows.map((row) => {
        if (!row || typeof row !== 'object' || columns.length === 0) return row;
        return columns.reduce((acc, key) => {
          acc[key] = row[key];
          return acc;
        }, {});
      });
    }

    if (operation === 'filter_rows') {
      const field = this.config.field;
      const operator = this.config.operator || '!=';
      const value = this.config.value;
      if (!field) return rows;
      return rows.filter((row) => {
        const left = row?.[field];
        if (operator === '==') return left === value;
        if (operator === '!=') return left !== value;
        if (operator === '>') return left > value;
        if (operator === '>=') return left >= value;
        if (operator === '<') return left < value;
        if (operator === '<=') return left <= value;
        return true;
      });
    }

    if (operation === 'tokenize') {
      return this._runTokenize(input);
    }

    return input;
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
      return Array.from({ length: size }, (_, index) => ({ left: left[index], right: right[index] }));
    }

    if (strategy === 'merge_by_key') {
      const key = this.config.key;
      if (!key) return [...left, ...right];
      const index = new Map(right.map((row) => [row?.[key], row]));
      return left.map((row) => ({ ...row, ...(index.get(row?.[key]) || {}) }));
    }

    return [...left, ...right];
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
    return { true: truthy, false: falsy };
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
      return truthy.length > 0 ? truthy : falsy;
    }
    return { true: truthy, false: falsy };
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

    return buckets;
  }

  _runTokenize(input) {
    if (Array.isArray(input)) {
      return input.map((item) => {
        if (typeof item === 'string') return item.trim() ? item.trim().split(/\s+/) : [];
        return item;
      });
    }

    if (typeof input === 'string') return input.trim() ? input.trim().split(/\s+/) : [];
    return input;
  }

  _extractRows(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.rows)) return value.rows;
      if (Array.isArray(value.train)) return value.train;
      if (Array.isArray(value.items)) return value.items;
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
