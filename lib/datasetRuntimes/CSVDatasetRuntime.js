const fs = require('fs').promises;
const path = require('path');

class CSVDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({
      path: '',
      files: [],
      primary: '',
      relations: [],
      delimiter: ',',
      header: true,
      target_column: '',
      feature_columns: [],
      features: [],
      column_types: {},
      handle_missing: 'drop',
      missing: { strategy: 'drop' },
    }, config);
  }

  _splitLine(line, delimiter) {
    // Lightweight split for common CSV content.
    return String(line).split(delimiter).map((v) => v.trim());
  }

  _inferNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async _resolveCsvFiles() {
    const projectRoot = process.cwd();
    const fromConfig = Array.isArray(this.config.files) ? this.config.files : [];
    const resolved = [];

    if (fromConfig.length > 0) {
      for (const rel of fromConfig) {
        const root = this.config.path ? path.resolve(projectRoot, this.config.path) : projectRoot;
        const full = path.resolve(root, rel);
        const relToRoot = path.relative(projectRoot, full);
        if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) continue;
        if (path.extname(full).toLowerCase() !== '.csv') continue;
        resolved.push(full);
      }
      return resolved;
    }

    const target = path.resolve(projectRoot, this.config.path || '.');
    const st = await fs.stat(target);
    if (st.isFile()) {
      if (path.extname(target).toLowerCase() === '.csv') resolved.push(target);
      return resolved;
    }

    const entries = await fs.readdir(target, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (path.extname(entry.name).toLowerCase() !== '.csv') continue;
      resolved.push(path.join(target, entry.name));
    }

    return resolved;
  }

  _parseCsv(raw) {
    const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return { columns: [], rows: [] };

    const delimiter = this.config.delimiter || ',';
    const hasHeader = this.config.header !== false;

    let headers = [];
    let dataStart = 0;
    if (hasHeader) {
      headers = this._splitLine(lines[0], delimiter).map((h, idx) => h || `col_${idx}`);
      dataStart = 1;
    }

    const rows = [];
    for (let i = dataStart; i < lines.length; i++) {
      const cols = this._splitLine(lines[i], delimiter);
      const row = {};
      if (headers.length > 0) {
        headers.forEach((h, idx) => {
          row[h] = cols[idx] ?? '';
        });
      } else {
        cols.forEach((v, idx) => {
          row[`col_${idx}`] = v;
        });
      }
      rows.push(row);
    }

    const columns = headers.length > 0 ? headers : Object.keys(rows[0] || {});
    return { columns, rows };
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

      for (const m of matches) {
        out.push({ ...row, ...m });
        usedRight.add(m);
      }
    }

    if (joinType === 'outer') {
      for (const r of rightRows) {
        if (usedRight.has(r)) continue;
        out.push({ ...r });
      }
    }

    return out;
  }

  _applyColumnTypes(rows) {
    const types = this.config.column_types || {};
    if (!types || typeof types !== 'object') return rows;

    return rows.map((row) => {
      const next = { ...row };
      for (const [col, dtype] of Object.entries(types)) {
        if (!(col in next)) continue;

        if (dtype === 'datetime') {
          const parsed = Date.parse(String(next[col]));
          if (!Number.isNaN(parsed)) next[col] = new Date(parsed).toISOString();
        }

        if (dtype === 'float' || dtype === 'number') {
          const asNumber = this._inferNumber(next[col]);
          if (asNumber !== null) next[col] = asNumber;
        }
      }
      return next;
    });
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
        const nums = rows.map((r) => this._inferNumber(r[col])).filter((n) => n !== null);
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

  _buildMetadata(rows, targetColumn, featureColumns) {
    const columns = Object.keys(rows[0] || {});
    const numeric = [];
    const categorical = [];
    const datetime = [];

    for (const col of columns) {
      const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
      let seenNumber = false;
      let seenDate = false;
      let seenString = false;

      for (const v of values) {
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
    };
  }

  async getSample(n = 5) {
    let csvFiles;
    try {
      csvFiles = await this._resolveCsvFiles();
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'CSV path does not exist', details: { path: this.config.path } };
      }
      throw err;
    }

    if (!Array.isArray(csvFiles) || csvFiles.length === 0) {
      throw { type: 'ValidationError', message: 'No CSV files found', details: { path: this.config.path, files: this.config.files } };
    }

    const tables = {};
    for (const file of csvFiles) {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = this._parseCsv(raw);
      const name = path.parse(file).name;
      tables[name] = parsed.rows;
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

    rows = this._applyColumnTypes(rows);
    rows = this._applyMissing(rows);

    const targetColumn = this.config.target_column || '';
    const requestedFeatures = Array.isArray(this.config.features) && this.config.features.length > 0
      ? this.config.features
      : (Array.isArray(this.config.feature_columns) ? this.config.feature_columns : []);

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
      if (targetColumn && targetColumn in out) {
        out._target = out[targetColumn];
      }
      return out;
    });

    const featureColumns = requestedFeatures.length > 0
      ? requestedFeatures.filter((c) => c !== targetColumn)
      : Object.keys(rows[0] || {}).filter((c) => c !== targetColumn);

    const features = previewRows.map((row) => {
      const next = {};
      for (const col of featureColumns) {
        if (col in row) next[col] = row[col];
      }
      return next;
    });

    const targets = targetColumn
      ? previewRows
          .map((row) => row[targetColumn])
          .filter((value) => value !== undefined)
      : [];

    const columns = Object.keys(previewRows[0] || {});

    const metadata = this._buildMetadata(rows, targetColumn, featureColumns);
    metadata.primary = primary;
    metadata.tables = tableNames;

    return {
      rows: previewRows,
      features,
      targets,
      columns,
      out: previewRows,
      metadata,
    };
  }
}

module.exports = CSVDatasetRuntime;
