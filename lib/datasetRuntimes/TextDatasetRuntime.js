const fs = require('fs').promises;
const path = require('path');

class TextDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({
      source_mode: 'file',
      path: '',
      files: [],
      file_format: 'txt',
      encoding: 'utf-8',
      text_column: 'text',
      label_column: 'label',
      header: false,
      target_column: '',
      feature_columns: [],
      handle_missing: 'drop',
      missing: { strategy: 'drop' },
    }, config);
  }

  /**
   * Resolve text files from config — supports single file, explicit file list,
   * and folder scanning (matching CSVDatasetRuntime._resolveCsvFiles pattern).
   */
  async _resolveTextFiles() {
    const projectRoot = process.cwd();
    const fromConfig = Array.isArray(this.config.files) ? this.config.files : [];
    const format = String(this.config.file_format || 'txt').toLowerCase();
    const resolved = [];

    const TEXT_EXTENSIONS = new Set(['.txt', '.text', '.md']);
    const FORMAT_EXTENSIONS = {
      txt: TEXT_EXTENSIONS,
      jsonl: new Set(['.jsonl']),
      csv: new Set(['.csv']),
    };
    const allowedExtensions = FORMAT_EXTENSIONS[format] || TEXT_EXTENSIONS;

    // Explicit file list
    if (fromConfig.length > 0) {
      for (const rel of fromConfig) {
        const root = this.config.path ? path.resolve(projectRoot, this.config.path) : projectRoot;
        const full = path.resolve(root, rel);
        const relToRoot = path.relative(projectRoot, full);
        if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) continue;
        const ext = path.extname(full).toLowerCase();
        if (!allowedExtensions.has(ext)) continue;
        resolved.push(full);
      }
      return resolved;
    }

    // Single file or directory scan
    const target = path.resolve(projectRoot, this.config.path || '.');
    let st;
    try {
      st = await fs.stat(target);
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'Text dataset path does not exist', details: { path: target } };
      }
      throw err;
    }

    if (st.isFile()) {
      resolved.push(target);
      return resolved;
    }

    // Directory scan
    const entries = await fs.readdir(target, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExtensions.has(ext)) continue;
      resolved.push(path.join(target, entry.name));
    }

    return resolved;
  }

  /**
   * Parse a single text file into rows of { text, label, source }.
   */
  _parseFile(raw, filename) {
    const format = String(this.config.file_format || 'txt').toLowerCase();
    const textCol = this.config.text_column || 'text';
    const labelCol = this.config.label_column || 'label';
    const rows = [];

    if (format === 'txt') {
      const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        rows.push({ text: lines[i], label: null, source: filename });
      }
    } else if (format === 'jsonl') {
      const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          rows.push({
            text: obj[textCol] ?? obj.text ?? '',
            label: obj[labelCol] ?? obj.label ?? null,
            source: filename,
          });
        } catch {
          // Skip malformed lines
        }
      }
    } else {
      // CSV fallback
      const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return rows;
      const splitLine = (line) => {
        const cells = [];
        let cell = '';
        let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
          const char = line[index];
          if (char === '"') {
            if (quoted && line[index + 1] === '"') {
              cell += '"';
              index += 1;
            } else {
              quoted = !quoted;
            }
          } else if (char === ',' && !quoted) {
            cells.push(cell.trim());
            cell = '';
          } else {
            cell += char;
          }
        }
        cells.push(cell.trim());
        return cells;
      };
      const hasHeader = this.config.header === true;
      const headers = hasHeader ? splitLine(lines[0]) : [];
      const textIdx = headers.indexOf(textCol);
      const labelIdx = headers.indexOf(labelCol);
      for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        rows.push({
          text: textIdx >= 0 ? cols[textIdx] : cols[0] ?? '',
          label: labelIdx >= 0 ? cols[labelIdx] : (hasHeader ? null : (cols[1] ?? null)),
          source: filename,
        });
      }
    }

    return rows;
  }

  /**
   * Apply missing-value strategy.
   */
  _applyMissing(rows) {
    const strategy = (this.config.missing && this.config.missing.strategy) || this.config.handle_missing || 'drop';
    if (strategy === 'drop' || strategy === 'drop_rows') {
      return rows.filter((row) => row.text && String(row.text).trim() !== '');
    }
    return rows;
  }

  /**
   * Build vocabulary from all text rows.
   */
  _buildVocab(rows) {
    const freq = new Map();
    for (const row of rows) {
      const tokens = String(row.text || '').split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        freq.set(token, (freq.get(token) || 0) + 1);
      }
    }
    // Sort by frequency descending
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.map(([token]) => token);
  }

  /**
   * Build metadata about the text dataset.
   */
  _buildMetadata(rows, vocab, fileCount) {
    const labelColumn = this.config.target_column || this.config.label_column || '';

    // Label distribution
    const labelDist = {};
    let hasLabels = false;
    for (const row of rows) {
      if (row.label !== null && row.label !== undefined && String(row.label).trim() !== '') {
        hasLabels = true;
        const key = String(row.label);
        labelDist[key] = (labelDist[key] || 0) + 1;
      }
    }

    // Average text length (in tokens)
    let totalTokens = 0;
    let totalChars = 0;
    for (const row of rows) {
      const txt = String(row.text || '');
      totalChars += txt.length;
      totalTokens += txt.split(/\s+/).filter(Boolean).length;
    }
    const avgTokenLength = rows.length > 0 ? totalTokens / rows.length : 0;
    const avgCharLength = rows.length > 0 ? totalChars / rows.length : 0;

    return {
      rows: rows.length,
      columns: hasLabels ? 3 : 2,  // text, label?, source
      features: ['text'],
      target: hasLabels ? (labelColumn || 'label') : null,
      vocabSize: vocab.length,
      avgTokenLength: Math.round(avgTokenLength * 10) / 10,
      avgCharLength: Math.round(avgCharLength * 10) / 10,
      numClasses: hasLabels ? Object.keys(labelDist).length : 0,
      labelDistribution: labelDist,
      fileCount,
      file_format: this.config.file_format || 'txt',
    };
  }

  /**
   * getSample — the main entry point for node runtime preview.
   * Returns a structured payload matching the CSVDatasetRuntime interface.
   */
  async getSample(n = 5) {
    let textFiles;
    try {
      textFiles = await this._resolveTextFiles();
    } catch (err) {
      if (err && err.type === 'ValidationError') throw err;
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'Text dataset path does not exist', details: { path: this.config.path } };
      }
      throw err;
    }

    if (!Array.isArray(textFiles) || textFiles.length === 0) {
      throw { type: 'ValidationError', message: 'No text files found', details: { path: this.config.path, files: this.config.files } };
    }

    let allRows = [];
    for (const file of textFiles) {
      const raw = await fs.readFile(file, this.config.encoding || 'utf8');
      const filename = path.parse(file).base;
      const parsed = this._parseFile(raw, filename);
      allRows = allRows.concat(parsed);
    }

    allRows = this._applyMissing(allRows);
    const vocab = this._buildVocab(allRows);
    const metadata = this._buildMetadata(allRows, vocab, textFiles.length);

    const targetColumn = this.config.target_column || this.config.label_column || 'label';
    const previewRows = allRows.slice(0, n).map((row) => {
      const out = { text: row.text, label: row.label, source: row.source };
      if (row.label !== null && row.label !== undefined) {
        out._target = row.label;
      }
      return out;
    });

    const features = previewRows.map((row) => ({ text: row.text }));
    const targets = previewRows
      .map((row) => row.label)
      .filter((v) => v !== null && v !== undefined);
    const columns = metadata.target
      ? ['text', targetColumn, 'source']
      : ['text', 'source'];

    return {
      rows: previewRows,
      out: previewRows,
      features,
      targets,
      columns,
      vocab: vocab.slice(0, 500),
      metadata,
    };
  }
}

module.exports = TextDatasetRuntime;
