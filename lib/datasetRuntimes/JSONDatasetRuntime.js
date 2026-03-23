const fs = require('fs').promises;
const path = require('path');

function getByPath(obj, dotPath) {
  if (!dotPath) return obj;
  return String(dotPath)
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

class JSONDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({ path: '', file_format: 'json', data_key: '', label_key: 'label' }, config);
  }

  async _readFile() {
    const filePath = path.resolve(process.cwd(), this.config.path || '.');
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'JSON dataset file does not exist', details: { path: filePath } };
      }
      throw err;
    }
  }

  async getSample(n = 5) {
    const raw = await this._readFile();
    const format = String(this.config.file_format || 'json').toLowerCase();

    if (format === 'jsonl') {
      const rows = [];
      for (const line of raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        try {
          const obj = JSON.parse(line);
          rows.push(obj);
        } catch {
          // Ignore malformed lines in preview mode.
        }
        if (rows.length >= n) break;
      }
      return rows;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw { type: 'ValidationError', message: 'Invalid JSON file format', details: { path: this.config.path } };
    }

    const extracted = getByPath(parsed, this.config.data_key);
    if (Array.isArray(extracted)) return extracted.slice(0, n);
    if (Array.isArray(parsed)) return parsed.slice(0, n);

    return [typeof extracted === 'object' && extracted ? extracted : parsed].slice(0, n);
  }
}

module.exports = JSONDatasetRuntime;
