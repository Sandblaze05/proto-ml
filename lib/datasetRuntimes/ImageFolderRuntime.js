const fs = require('fs').promises;
const path = require('path');

class ImageFolderRuntime {
  constructor(config = {}) {
    this.config = Object.assign({ path: '', format: 'jpg', recursive: true, label_strategy: 'folder_name' }, config);
  }

  async _listFiles() {
    const base = path.resolve(process.cwd(), this.config.path || '.');
    const ext = (this.config.format || 'jpg').replace(/^\./, '').toLowerCase();
    const results = [];

    async function walk(dir) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (err) {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (this.config.recursive) await walk.call(this, full);
          continue;
        }
        const fileExt = (path.extname(e.name) || '').replace(/^\./, '').toLowerCase();
        const isJpegAlias = ext === 'jpg' && fileExt === 'jpeg';
        if (fileExt === ext || isJpegAlias) results.push(full);
      }
    }

    await walk.call(this, base);
    return results;
  }

  async getSample(n = 5) {
    // Server-side validation: ensure path exists and is a directory
    const base = path.resolve(process.cwd(), this.config.path || '.');
    try {
      const st = await fs.stat(base);
      if (!st.isDirectory()) {
        throw { type: 'ValidationError', message: 'Configured path is not a directory', details: { path: base } };
      }
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw { type: 'ValidationError', message: 'Configured path does not exist', details: { path: base } };
      }
      // rethrow validation-style objects or other unexpected errors
      throw err;
    }

    const files = await this._listFiles();
    const sample = files.slice(0, n).map((fp) => {
      let label = null;
      if (this.config.label_strategy === 'folder_name') {
        const parts = fp.split(path.sep).filter(Boolean);
        // assume folder before filename is class name
        label = parts[parts.length - 2] || null;
      }
      return { path: fp, label };
    });
    return sample;
  }
}

module.exports = ImageFolderRuntime;
