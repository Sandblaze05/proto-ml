const fs = require('fs').promises;
const path = require('path');

class CSVDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({ path: '', delimiter: ',', header: true, target_column: '' }, config);
  }

  _splitLine(line, delimiter) {
    // Lightweight split for common CSV content.
    return String(line).split(delimiter).map((v) => v.trim());
  }

  async getSample(n = 5) {
    const filePath = path.resolve(process.cwd(), this.config.path || '.');
    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'CSV file does not exist', details: { path: filePath } };
      }
      throw err;
    }

    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const delimiter = this.config.delimiter || ',';
    let headers = [];
    let dataStart = 0;
    if (this.config.header) {
      headers = this._splitLine(lines[0], delimiter);
      dataStart = 1;
    }

    const out = [];
    for (let i = dataStart; i < lines.length && out.length < n; i++) {
      const cols = this._splitLine(lines[i], delimiter);
      const row = {};
      if (headers.length > 0) {
        headers.forEach((h, idx) => {
          row[h || `col_${idx}`] = cols[idx] ?? '';
        });
      } else {
        cols.forEach((val, idx) => {
          row[`col_${idx}`] = val;
        });
      }

      if (this.config.target_column && this.config.target_column in row) {
        row._target = row[this.config.target_column];
      }

      out.push(row);
    }

    return out;
  }
}

module.exports = CSVDatasetRuntime;
