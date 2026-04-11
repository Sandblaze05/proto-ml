class DatabaseDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({
      db_type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      table: '',
      query: '',
      mockRows: [],
    }, config);
  }

  async getSample(n = 5) {
    if (Array.isArray(this.config.mockRows) && this.config.mockRows.length > 0) {
      return this.config.mockRows.slice(0, n);
    }

    // Preview-safe fallback: expose a synthetic row instead of failing hard.
    return [{
      _preview: true,
      _warning: 'Database preview returned synthetic sample. Provide mockRows or a live connector implementation.',
      db_type: this.config.db_type,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database || null,
      table: this.config.table || null,
      query: this.config.query || null,
    }];
  }
}

module.exports = DatabaseDatasetRuntime;
