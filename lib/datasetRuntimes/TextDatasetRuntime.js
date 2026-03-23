const fs = require('fs').promises;
const path = require('path');

class TextDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({ path: '', file_format: 'txt', text_column: 'text', label_column: 'label' }, config);
  }

  async _readFile() {
    const filePath = path.resolve(process.cwd(), this.config.path || '.');
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'Text dataset file does not exist', details: { path: filePath } };
      }
      throw err;
    }
  }

  async getSample(n = 5) {
    const raw = await this._readFile();
    const format = String(this.config.file_format || 'txt').toLowerCase();

    if (format === 'txt') {
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, n)
        .map((text, idx) => ({ index: idx, text }));
    }

    if (format === 'jsonl') {
      const rows = [];
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          rows.push({
            text: obj[this.config.text_column] ?? obj.text ?? '',
            label: obj[this.config.label_column] ?? obj.label ?? null,
          });
        } catch {
          // Ignore malformed lines in preview mode.
        }
        if (rows.length >= n) break;
      }
      return rows;
    }

    // csv fallback for text datasets
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    const textIdx = headers.indexOf(this.config.text_column);
    const labelIdx = headers.indexOf(this.config.label_column);
    const rows = [];

    for (let i = 1; i < lines.length && rows.length < n; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      rows.push({
        text: textIdx >= 0 ? cols[textIdx] : cols[0] ?? '',
        label: labelIdx >= 0 ? cols[labelIdx] : null,
      });
    }

    return rows;
  }
}

module.exports = TextDatasetRuntime;
