import { NextResponse } from 'next/server';
import dns from 'dns';
import { promisify } from 'util';

// Force server-side dynamic rendering — prevents Next.js from statically
// bundling native database drivers (sqlite3, mysql2, etc.) that are not installed.
export const dynamic = 'force-dynamic';

// Resolve a hostname to an IPv4 address (avoids ETIMEDOUT on IPv6-only DNS results)
const dnsLookup = promisify(dns.lookup);

/**
 * Parse a postgres URI and return a pg Client config object with the hostname
 * force-resolved to IPv4. This is needed because pg ignores `family:4` when
 * a connectionString is passed — we must build params individually.
 */
async function pgConfigFromUri(uri) {
  const url = new URL(uri);
  const hostname = url.hostname;
  let resolvedHost = hostname;
  try {
    const { address } = await dnsLookup(hostname, { family: 4 });
    resolvedHost = address;
  } catch {
    // fall back to original hostname
  }
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

/**
 * Build a pg config from individual params, also force-resolving to IPv4.
 */
async function pgConfigFromParams(config) {
  const hostname = config.host || 'localhost';
  let resolvedHost = hostname;
  try {
    const { address } = await dnsLookup(hostname, { family: 4 });
    resolvedHost = address;
  } catch {
    // fall back to original hostname
  }
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

function flattenObject(obj, prefix = '', res = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) res[prefix] = obj;
    return res;
  }
  for (const key of Object.keys(obj)) {
    const propName = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      flattenObject(val, propName, res);
    } else {
      res[propName] = val;
    }
  }
  return res;
}

function computeColumnProfiles(rows) {
  if (!rows || rows.length === 0) return { columns: [], profile: {} };
  const columns = Object.keys(rows[0] || {});
  const profile = {};

  for (const col of columns) {
    const values = rows.map((r) => r[col]);
    let nullCount = 0;
    let numericCount = 0;
    let dateCount = 0;
    let stringCount = 0;

    for (const v of values) {
      if (v === null || v === undefined || String(v).trim() === '') {
        nullCount++;
        continue;
      }
      const num = Number(v);
      if (!Number.isNaN(num)) {
        numericCount++;
        continue;
      }
      const dt = Date.parse(String(v));
      if (!Number.isNaN(dt)) {
        dateCount++;
        continue;
      }
      stringCount++;
    }

    let inferred = 'string';
    if (numericCount > 0 && dateCount === 0 && stringCount === 0) inferred = 'number';
    else if (dateCount > 0 && numericCount === 0 && stringCount === 0) inferred = 'datetime';
    else if (numericCount > 0 && stringCount > 0) inferred = 'mixed';

    profile[col] = {
      type: inferred,
      nullCount,
      totalCount: rows.length,
      sampleValues: values.slice(0, 5),
    };
  }

  return { columns, profile };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action = 'inspect', config = {} } = body;
    const dbType = (config.db_type || 'postgresql').toLowerCase();

    // ── 1. Action: Test Connection ──
    if (action === 'test_connection') {
      // SQLite
      if (dbType === 'sqlite') {
        const dbPath = config.database || config.host || ':memory:';
        try {
          const sqlite3 = (await import('sqlite3')).default;
          await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
              if (err) return reject(err);
              db.close();
              resolve(true);
            });
          });
          return NextResponse.json({ ok: true, message: `Connected successfully to SQLite database: ${dbPath}` });
        } catch (err) {
          return NextResponse.json({ ok: false, error: err.message || 'SQLite driver not installed or failed to connect. Run: npm install sqlite3' }, { status: 400 });
        }
      }

      // PostgreSQL
      if (dbType === 'postgresql' || dbType === 'postgres') {
        try {
          const { Client } = await import('pg');
          const clientConfig = config.connection_mode === 'uri' && config.connection_uri
            ? await pgConfigFromUri(config.connection_uri)
            : await pgConfigFromParams(config);
          const client = new Client(clientConfig);
          await client.connect();
          await client.query('SELECT 1');
          await client.end();
          return NextResponse.json({ ok: true, message: 'Connected successfully to PostgreSQL database.' });
        } catch (err) {
          return NextResponse.json({ ok: false, error: err.message || 'Failed to connect to PostgreSQL database.' }, { status: 400 });
        }
      }

      // MySQL
      if (dbType === 'mysql' || dbType === 'mariadb') {
        try {
          const mysql = await import('mysql2/promise');
          const conn = config.connection_mode === 'uri' && config.connection_uri
            ? await mysql.createConnection(config.connection_uri)
            : await mysql.createConnection({
                host: config.host || 'localhost',
                port: Number(config.port) || 3306,
                database: config.database,
                user: config.username,
                password: config.password,
              });
          await conn.query('SELECT 1');
          await conn.end();
          return NextResponse.json({ ok: true, message: 'Connected successfully to MySQL database.' });
        } catch (err) {
          return NextResponse.json({ ok: false, error: err.message || 'MySQL driver not installed or failed to connect. Run: npm install mysql2' }, { status: 400 });
        }
      }

      // MongoDB
      if (dbType === 'mongodb' || dbType === 'mongo') {
        try {
          const { MongoClient } = await import('mongodb');
          const uri = config.connection_uri || `mongodb://${config.host || 'localhost'}:${config.port || 27017}`;
          const client = new MongoClient(uri);
          await client.connect();
          await client.db(config.database || undefined).command({ ping: 1 });
          await client.close();
          return NextResponse.json({ ok: true, message: 'Connected successfully to MongoDB cluster.' });
        } catch (err) {
          return NextResponse.json({ ok: false, error: err.message || 'MongoDB driver not installed or failed to connect. Run: npm install mongodb' }, { status: 400 });
        }
      }

      // Redis
      if (dbType === 'redis') {
        try {
          const { default: Redis } = await import('ioredis');
          const redis = config.connection_uri
            ? new Redis(config.connection_uri)
            : new Redis({
                host: config.host || 'localhost',
                port: Number(config.port) || 6379,
                password: config.password || undefined,
              });
          const res = await redis.ping();
          await redis.quit();
          return NextResponse.json({ ok: true, message: `Connected successfully to Redis server (PONG: ${res}).` });
        } catch (err) {
          return NextResponse.json({ ok: false, error: err.message || 'ioredis driver not installed or failed to connect. Run: npm install ioredis' }, { status: 400 });
        }
      }

      return NextResponse.json({ ok: true, message: `Validated configuration format for ${dbType}.` });
    }

    // ── 2. Action: List Tables / Collections / Keys ──
    if (action === 'list_tables') {
      let tables = [];

      if (dbType === 'sqlite') {
        const dbPath = config.database || config.host || ':memory:';
        try {
          const sqlite3 = (await import('sqlite3')).default;
          tables = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
              if (err) return reject(err);
              db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (qErr, rows) => {
                db.close();
                if (qErr) return reject(qErr);
                resolve((rows || []).map((r) => r.name));
              });
            });
          });
        } catch { tables = []; }
      } else if (dbType === 'postgresql' || dbType === 'postgres') {
        try {
          const { Client } = await import('pg');
          const clientConfig = config.connection_mode === 'uri' && config.connection_uri
            ? await pgConfigFromUri(config.connection_uri)
            : await pgConfigFromParams(config);
          const client = new Client(clientConfig);
          await client.connect();
          const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
          await client.end();
          tables = res.rows.map((r) => r.table_name);
        } catch { tables = []; }
      } else if (dbType === 'mysql' || dbType === 'mariadb') {
        try {
          const mysql = await import('mysql2/promise');
          const conn = config.connection_mode === 'uri' && config.connection_uri
            ? await mysql.createConnection(config.connection_uri)
            : await mysql.createConnection({
                host: config.host || 'localhost',
                port: Number(config.port) || 3306,
                database: config.database,
                user: config.username,
                password: config.password,
              });
          const [rows] = await conn.query('SHOW TABLES');
          await conn.end();
          tables = (rows || []).map((r) => Object.values(r)[0]);
        } catch { tables = []; }
      } else if (dbType === 'mongodb' || dbType === 'mongo') {
        try {
          const { MongoClient } = await import('mongodb');
          const uri = config.connection_uri || `mongodb://${config.host || 'localhost'}:${config.port || 27017}`;
          const client = new MongoClient(uri);
          await client.connect();
          const collections = await client.db(config.database || undefined).listCollections().toArray();
          await client.close();
          tables = collections.map((c) => c.name);
        } catch { tables = []; }
      } else if (dbType === 'redis') {
        try {
          const { default: Redis } = await import('ioredis');
          const redis = config.connection_uri
            ? new Redis(config.connection_uri)
            : new Redis({
                host: config.host || 'localhost',
                port: Number(config.port) || 6379,
                password: config.password || undefined,
              });
          const keys = await redis.keys('*');
          await redis.quit();
          // Extract prefix patterns (e.g. "users:*", "orders:*")
          const prefixes = new Set();
          keys.forEach((k) => {
            if (k.includes(':')) prefixes.add(k.split(':')[0] + ':*');
            else prefixes.add(k);
          });
          tables = Array.from(prefixes);
        } catch { tables = []; }
      }

      return NextResponse.json({ ok: true, tables, db_type: dbType });
    }

    // ── 3. Action: Inspect / Sample Rows ──
    const DatabaseDatasetRuntime = require('../../../../lib/datasetRuntimes/DatabaseDatasetRuntime');
    const runtime = new DatabaseDatasetRuntime(config);
    const sample = await runtime.getSample(config.limit || 50);

    const { columns, profile } = computeColumnProfiles(sample.rows || []);

    return NextResponse.json({
      ok: true,
      data: sample.rows || [],
      columns: sample.columns || columns,
      profile,
      metadata: sample.metadata || {},
      features: sample.features || [],
      targets: sample.targets || [],
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Database inspection failed.' },
      { status: 500 }
    );
  }
}
