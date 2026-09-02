/**
 * DatabaseDatasetRuntime
 * Handles query execution, schema inspection, and dataset materialization
 * for PostgreSQL, MySQL, SQLite, DuckDB, MongoDB, and Redis.
 */

const dns = require('dns');
const { promisify } = require('util');
const dnsLookup = promisify(dns.lookup);

async function pgConfigFromUri(uri) {
  const url = new URL(uri);
  let resolvedHost = url.hostname;
  try {
    const { address } = await dnsLookup(url.hostname, { family: 4 });
    resolvedHost = address;
  } catch { /* fall back to hostname */ }
  return {
    host: resolvedHost,
    port: Number(url.port) || 5432,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    ssl: { rejectUnauthorized: false },
    family: 4,
  };
}

async function pgConfigFromParams(config) {
  let resolvedHost = config.host || 'localhost';
  try {
    const { address } = await dnsLookup(resolvedHost, { family: 4 });
    resolvedHost = address;
  } catch { /* fall back */ }
  return {
    host: resolvedHost,
    port: Number(config.port) || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl !== false ? { rejectUnauthorized: false } : false,
    family: 4,
  };
}

class DatabaseDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({
      db_type: 'postgresql',
      connection_mode: 'params',
      connection_uri: '',
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      ssl: false,
      table: '',
      query_mode: 'table',
      query: '',
      redis_key_pattern: '',
      redis_data_type: 'hash',
      flatten_nested: true,
      limit: 100,
      target_column: '',
      feature_columns: [],
      features: [],
      column_types: {},
      handle_missing: 'drop',
      mockRows: null,
    }, config);
  }

  _inferNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  _flattenObject(obj, prefix = '', res = {}) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      if (prefix) res[prefix] = obj;
      return res;
    }
    for (const key of Object.keys(obj)) {
      const propName = prefix ? `${prefix}.${key}` : key;
      const val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        this._flattenObject(val, propName, res);
      } else {
        res[propName] = val;
      }
    }
    return res;
  }

  _applyColumnTypes(rows) {
    const types = this.config.column_types || {};
    if (Object.keys(types).length === 0) return rows;

    return rows.map((row) => {
      const next = { ...row };
      for (const [col, dtype] of Object.entries(types)) {
        if (!(col in next)) continue;
        if (dtype === 'string') {
          next[col] = next[col] === null || next[col] === undefined ? '' : String(next[col]);
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
    const strategy = this.config.handle_missing || 'drop';
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
    const missingCounts = {};

    for (const col of columns) {
      const values = rows.map((r) => r[col]);
      let nulls = 0;
      let seenNumber = false;
      let seenDate = false;
      let seenString = false;

      for (const v of values) {
        if (v === null || v === undefined || String(v).trim() === '') {
          nulls += 1;
          continue;
        }
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

      missingCounts[col] = nulls;
      if (seenString || (seenDate && seenNumber)) categorical.push(col);
      else if (seenNumber) numeric.push(col);
      else if (seenDate) datetime.push(col);
      else categorical.push(col);
    }

    return {
      num_rows: rows.length,
      num_columns: columns.length,
      columns,
      numeric_columns: numeric,
      categorical_columns: categorical,
      datetime_columns: datetime,
      missing_counts: missingCounts,
      target_column: targetColumn,
      feature_columns: featureColumns,
      db_type: this.config.db_type,
      database: this.config.database || null,
      table: this.config.table || null,
    };
  }

  /**
   * Attempts live database extraction using available Node.js drivers.
   * If driver is not installed or credentials are unreachable, returns null.
   */
  async _fetchLiveRows(limit = 100) {
    const dbType = (this.config.db_type || 'postgresql').toLowerCase();
    const query = this.config.query?.trim();
    const table = this.config.table?.trim();

    try {
      // ── SQLite ──
      if (dbType === 'sqlite') {
        const dbPath = this.config.database || this.config.host || ':memory:';
        try {
          const sqlite3 = (await import('sqlite3')).default;
          return await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
              if (err) return reject(err);
              const sql = query || (table ? `SELECT * FROM "${table}" LIMIT ${limit}` : null);
              if (!sql) { db.close(); return resolve([]); }
              db.all(sql, [], (queryErr, rows) => {
                db.close();
                if (queryErr) return reject(queryErr);
                resolve(rows || []);
              });
            });
          });
        } catch {
          return null;
        }
      }

      // ── PostgreSQL ──
      if (dbType === 'postgresql' || dbType === 'postgres') {
        try {
          const { Client } = await import('pg');
          const clientConfig = this.config.connection_mode === 'uri' && this.config.connection_uri
            ? await pgConfigFromUri(this.config.connection_uri)
            : await pgConfigFromParams(this.config);
          const client = new Client(clientConfig);
          await client.connect();
          const sql = query || (table ? `SELECT * FROM "${table}" LIMIT ${limit}` : null);
          if (!sql) { await client.end(); return []; }
          const res = await client.query(sql);
          await client.end();
          return res.rows || [];
        } catch {
          return null;
        }
      }

      // ── MySQL ──
      if (dbType === 'mysql' || dbType === 'mariadb') {
        try {
          const mysql = await import('mysql2/promise');
          const conn = this.config.connection_mode === 'uri' && this.config.connection_uri
            ? await mysql.createConnection(this.config.connection_uri)
            : await mysql.createConnection({
                host: this.config.host || 'localhost',
                port: Number(this.config.port) || 3306,
                database: this.config.database,
                user: this.config.username,
                password: this.config.password,
              });
          const sql = query || (table ? `SELECT * FROM \`${table}\` LIMIT ${limit}` : null);
          if (!sql) { await conn.end(); return []; }
          const [rows] = await conn.query(sql);
          await conn.end();
          return rows || [];
        } catch {
          return null;
        }
      }

      // ── MongoDB ──
      if (dbType === 'mongodb' || dbType === 'mongo') {
        try {
          const { MongoClient } = await import('mongodb');
          const uri = this.config.connection_uri || `mongodb://${this.config.host || 'localhost'}:${this.config.port || 27017}`;
          const client = new MongoClient(uri);
          await client.connect();
          const db = client.db(this.config.database || undefined);
          const collName = table || 'records';
          const coll = db.collection(collName);
          let filter = {};
          if (query) {
            try { filter = JSON.parse(query); } catch { filter = {}; }
          }
          const docs = await coll.find(filter).limit(limit).toArray();
          await client.close();

          return docs.map((doc) => {
            const clean = { ...doc };
            if (clean._id) clean._id = String(clean._id);
            return this.config.flatten_nested ? this._flattenObject(clean) : clean;
          });
        } catch {
          return null;
        }
      }

      // ── Redis ──
      if (dbType === 'redis') {
        try {
          const { default: Redis } = await import('ioredis');
          const redis = this.config.connection_uri
            ? new Redis(this.config.connection_uri)
            : new Redis({
                host: this.config.host || 'localhost',
                port: Number(this.config.port) || 6379,
                password: this.config.password || undefined,
              });
          const pattern = this.config.redis_key_pattern || table || '*';
          const keys = await redis.keys(pattern);
          const sampleKeys = keys.slice(0, limit);
          const rows = [];

          for (const key of sampleKeys) {
            const type = await redis.type(key);
            if (type === 'hash') {
              const hashData = await redis.hgetall(key);
              rows.push({ _key: key, ...hashData });
            } else if (type === 'string') {
              const strVal = await redis.get(key);
              try {
                const parsed = JSON.parse(strVal);
                if (typeof parsed === 'object' && parsed !== null) {
                  rows.push({ _key: key, ...(this.config.flatten_nested ? this._flattenObject(parsed) : parsed) });
                } else {
                  rows.push({ _key: key, value: parsed });
                }
              } catch {
                rows.push({ _key: key, value: strVal });
              }
            }
          }
          await redis.quit();
          return rows;
        } catch {
          return null;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Retrieves sample data matching the proto-ml standard tabular dataset interface.
   */
  async getSample(n = 5) {
    let rawRows = null;

    if (Array.isArray(this.config.mockRows) && this.config.mockRows.length > 0) {
      rawRows = this.config.mockRows;
    } else {
      rawRows = await this._fetchLiveRows(n);
    }

    if (!rawRows || rawRows.length === 0) {
      // Preview-safe synthetic row for UI canvas when offline or unconfigured
      const synthetic = [{
        _preview: true,
        _warning: 'Database preview returned synthetic sample. Connect to live database or provide mock rows.',
        db_type: this.config.db_type,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database || null,
        table: this.config.table || null,
        query: this.config.query || null,
      }];

      return Array.isArray(this.config.mockRows) && this.config.mockRows.length === 0
        ? []
        : synthetic.slice(0, n);
    }

    let rows = rawRows.map((r) => (this.config.flatten_nested ? this._flattenObject(r) : { ...r }));
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

    const result = [...previewRows];
    result.rows = previewRows;
    result.features = features;
    result.targets = targets;
    result.columns = columns;
    result.out = previewRows;
    result.metadata = metadata;

    return result;
  }
}

module.exports = DatabaseDatasetRuntime;
