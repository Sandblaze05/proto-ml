const fs = require('fs').promises;
const path = require('path');

function getByPath(obj, dotPath) {
  if (!dotPath) return obj;
  return String(dotPath)
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class JSONDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({
      path: '',
      files: [],
      primary: '',
      relations: [],
      file_format: 'json',
      data_key: '',
      label_key: 'label',
      target_column: '',
      feature_keys: [],
      feature_columns: [],
      features: [],
      required_fields: [],
      flatten: true,
      handle_missing: 'drop',
      missing: { strategy: 'drop' },
    }, config);
  }

  _inferNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  _flattenValue(value, prefix = '', out = {}) {
    if (!this.config.flatten) {
      if (prefix) out[prefix] = value;
      return out;
    }

    if (Array.isArray(value)) {
      if (prefix) {
        out[prefix] = value.every((item) => item === null || typeof item !== 'object')
          ? value.join('|')
          : JSON.stringify(value);
      }
      return out;
    }

    if (isPlainObject(value)) {
      for (const [key, nested] of Object.entries(value)) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        this._flattenValue(nested, nextPrefix, out);
      }
      return out;
    }

    if (prefix) out[prefix] = value;
    return out;
  }

  _flattenRow(row) {
    if (isPlainObject(row)) return this._flattenValue(row);
    return { value: row };
  }

  async _resolveJsonFiles() {
    const projectRoot = process.cwd();
    const fromConfig = Array.isArray(this.config.files) ? this.config.files : [];
    const format = String(this.config.file_format || 'json').toLowerCase();
    const expectedExt = format === 'jsonl' ? '.jsonl' : '.json';
    const resolved = [];

    if (fromConfig.length > 0) {
      for (const rel of fromConfig) {
        const root = this.config.path ? path.resolve(projectRoot, this.config.path) : projectRoot;
        const full = path.resolve(root, rel);
        const relToRoot = path.relative(projectRoot, full);
        if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) continue;
        if (path.extname(full).toLowerCase() !== expectedExt) continue;
        resolved.push(full);
      }
      return resolved;
    }

    const target = path.resolve(projectRoot, this.config.path || '.');
    const st = await fs.stat(target);
    if (st.isFile()) {
      if (path.extname(target).toLowerCase() === expectedExt) resolved.push(target);
      return resolved;
    }

    const entries = await fs.readdir(target, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (path.extname(entry.name).toLowerCase() !== expectedExt) continue;
      resolved.push(path.join(target, entry.name));
    }

    return resolved;
  }

  _parseJson(raw, filePath) {
    const format = String(this.config.file_format || 'json').toLowerCase();
    const records = [];

    if (format === 'jsonl') {
      const lines = String(raw).split(/\r?\n/);
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const parsed = JSON.parse(trimmed);
          records.push(parsed);
        } catch {
          throw {
            type: 'ValidationError',
            message: 'Invalid JSONL file format',
            details: { path: filePath, line: idx + 1 },
          };
        }
      });
      return records;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw { type: 'ValidationError', message: 'Invalid JSON file format', details: { path: filePath } };
    }

    const extracted = getByPath(parsed, this.config.data_key);
    if (Array.isArray(extracted)) return extracted;
    if (Array.isArray(parsed) && !this.config.data_key) return parsed;
    if (!this.config.data_key && isPlainObject(parsed) && Array.isArray(parsed.data)) return parsed.data;
    if (isPlainObject(extracted)) return [extracted];
    if (!this.config.data_key && isPlainObject(parsed)) return [parsed];

    throw {
      type: 'ValidationError',
      message: 'JSON dataset data_key must resolve to an object or array',
      details: { path: filePath, data_key: this.config.data_key },
    };
  }

  _validateRows(rows, columns) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw { type: 'ValidationError', message: 'JSON dataset contains no records', details: { path: this.config.path } };
    }

    const targetColumn = this.config.target_column || '';
    const required = new Set(Array.isArray(this.config.required_fields) ? this.config.required_fields : []);
    if (targetColumn) required.add(targetColumn);

    const requestedFeatures = this._requestedFeatures();
    requestedFeatures.forEach((field) => required.add(field));

    const missingRequired = Array.from(required).filter((field) => !columns.includes(field));
    if (missingRequired.length > 0) {
      throw {
        type: 'ValidationError',
        message: 'JSON dataset is missing required field(s)',
        details: { missing: missingRequired, columns },
      };
    }
  }

  _applyMissing(rows) {
    const strategy = (this.config.missing && this.config.missing.strategy) || this.config.handle_missing || 'drop';
    if (strategy === 'drop' || strategy === 'drop_rows') {
      return rows.filter((row) => !Object.values(row).some((v) => v === null || v === undefined || String(v).trim() === ''));
    }

    if (strategy === 'mean') {
      const means = {};
      const allColumns = Object.keys(rows[0] || {});
      for (const col of allColumns) {
        const nums = rows.map((r) => this._inferNumber(r[col])).filter((num) => num !== null);
        if (nums.length > 0) means[col] = nums.reduce((a, b) => a + b, 0) / nums.length;
      }

      return rows.map((row) => {
        const out = { ...row };
        for (const [col, mean] of Object.entries(means)) {
          const isMissing = out[col] === null || out[col] === undefined || String(out[col]).trim() === '';
          if (isMissing) out[col] = mean;
        }
        return out;
      });
    }

    return rows;
  }

  _mergeRows(leftRows, rightRows, key, joinType = 'left') {
    const map = new Map();
    for (const row of rightRows) {
      const k = row[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(row);
    }

    const out = [];
    const usedRight = new Set();

    for (const row of leftRows) {
      const k = row[key];
      const matches = map.get(k) || [];
      if (matches.length === 0) {
        if (joinType === 'left' || joinType === 'outer') out.push({ ...row });
        continue;
      }

      for (const match of matches) {
        out.push({ ...row, ...match });
        usedRight.add(match);
      }
    }

    if (joinType === 'outer') {
      for (const row of rightRows) {
        if (usedRight.has(row)) continue;
        out.push({ ...row });
      }
    }

    return out;
  }

  _requestedFeatures() {
    if (Array.isArray(this.config.features) && this.config.features.length > 0) return this.config.features;
    if (Array.isArray(this.config.feature_columns) && this.config.feature_columns.length > 0) return this.config.feature_columns;
    if (Array.isArray(this.config.feature_keys)) return this.config.feature_keys;
    return [];
  }

  _buildMetadata(rows, targetColumn, featureColumns, tableNames) {
    const columns = Object.keys(rows[0] || {});
    const numeric = [];
    const categorical = [];
    const datetime = [];
    const missingCounts = {};

    for (const col of columns) {
      const values = rows.map((row) => row[col]);
      const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
      missingCounts[col] = values.length - nonEmpty.length;

      let seenNumber = false;
      let seenDate = false;
      let seenString = false;
      for (const v of nonEmpty) {
        const asNum = this._inferNumber(v);
        if (asNum !== null) {
          seenNumber = true;
          continue;
        }
        const asDate = Date.parse(String(v));
        if (!Number.isNaN(asDate)) {
          seenDate = true;
          continue;
        }
        seenString = true;
      }

      if (seenString) categorical.push(col);
      else if (seenDate && !seenNumber) datetime.push(col);
      else if (seenNumber) numeric.push(col);
    }

    return {
      rows: rows.length,
      columns: columns.length,
      features: featureColumns,
      target: targetColumn || null,
      numeric,
      categorical,
      datetime,
      missing_counts: missingCounts,
      tables: tableNames,
      flattened: this.config.flatten !== false,
    };
  }

  async getSample(n = 5) {
    let jsonFiles;
    try {
      jsonFiles = await this._resolveJsonFiles();
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'JSON path does not exist', details: { path: this.config.path } };
      }
      throw err;
    }

    if (!Array.isArray(jsonFiles) || jsonFiles.length === 0) {
      throw { type: 'ValidationError', message: 'No JSON files found', details: { path: this.config.path, files: this.config.files } };
    }

    const tables = {};
    for (const file of jsonFiles) {
      const raw = await fs.readFile(file, 'utf8');
      const parsedRows = this._parseJson(raw, file).map((row) => this._flattenRow(row));
      tables[path.parse(file).name] = parsedRows;
    }

    const tableNames = Object.keys(tables);
    const primary = this.config.primary && tables[this.config.primary] ? this.config.primary : tableNames[0];
    let rows = [...(tables[primary] || [])];

    const relations = Array.isArray(this.config.relations) ? this.config.relations : [];
    for (const rel of relations) {
      const right = rel?.right;
      const on = rel?.on;
      const joinType = rel?.type || 'left';
      if (!right || !on || !tables[right]) continue;
      rows = this._mergeRows(rows, tables[right], on, joinType);
    }

    let columns = Object.keys(rows[0] || {});
    this._validateRows(rows, columns);

    rows = this._applyMissing(rows);

    const targetColumn = this.config.target_column || (columns.includes(this.config.label_key) ? this.config.label_key : '');
    const requestedFeatures = this._requestedFeatures();
    if (requestedFeatures.length > 0) {
      rows = rows.map((row) => {
        const picked = {};
        for (const col of requestedFeatures) {
          if (col in row) picked[col] = row[col];
        }
        if (targetColumn && targetColumn in row) picked[targetColumn] = row[targetColumn];
        return picked;
      });
    }

    const previewRows = rows.slice(0, n).map((row) => {
      const out = { ...row };
      if (targetColumn && targetColumn in out) out._target = out[targetColumn];
      return out;
    });

    columns = Object.keys(previewRows[0] || {});
    const featureColumns = requestedFeatures.length > 0
      ? requestedFeatures.filter((col) => col !== targetColumn)
      : Object.keys(rows[0] || {}).filter((col) => col !== targetColumn);

    const features = previewRows.map((row) => {
      const next = {};
      for (const col of featureColumns) {
        if (col in row) next[col] = row[col];
      }
      return next;
    });

    const targets = targetColumn
      ? previewRows.map((row) => row[targetColumn]).filter((value) => value !== undefined)
      : [];

    const metadata = this._buildMetadata(rows, targetColumn, featureColumns, tableNames);
    metadata.primary = primary;

    return {
      rows: previewRows,
      features,
      data: features,
      targets,
      labels: targets,
      columns,
      schema: metadata,
      out: previewRows,
      metadata,
    };
  }
}

module.exports = JSONDatasetRuntime;
