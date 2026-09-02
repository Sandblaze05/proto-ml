import { describe, it, expect } from 'vitest';
import { generateDatasetPythonCode } from '../../../lib/pythonTemplates/datasetNodeTemplate.js';

describe('database Python code template generator', () => {
  it('generates SQLite ingestion code', () => {
    const code = generateDatasetPythonCode('dataset.database', {
      db_type: 'sqlite',
      database: './data/mydb.sqlite',
      table: 'sales',
      target_column: 'amount',
    });

    expect(code).toContain('import sqlite3');
    expect(code).toContain('./data/mydb.sqlite');
    expect(code).toContain('SELECT * FROM "sales"');
    expect(code).toContain("target_col = 'amount'");
  });

  it('generates MongoDB ingestion code with nested flattening', () => {
    const code = generateDatasetPythonCode('dataset.database', {
      db_type: 'mongodb',
      connection_mode: 'uri',
      connection_uri: 'mongodb://localhost:27017/analytics',
      database: 'analytics',
      table: 'events',
      query: '{"status": "complete"}',
      flatten_nested: true,
    });

    expect(code).toContain('import pymongo');
    expect(code).toContain('pd.json_normalize');
    expect(code).toContain('mongodb://localhost:27017/analytics');
    expect(code).toContain('events');
  });

  it('generates Redis ingestion code with key pattern', () => {
    const code = generateDatasetPythonCode('dataset.database', {
      db_type: 'redis',
      connection_mode: 'uri',
      connection_uri: 'redis://localhost:6379/0',
      redis_key_pattern: 'user:*',
      target_column: 'label',
    });

    expect(code).toContain('import redis');
    expect(code).toContain('redis://localhost:6379/0');
    expect(code).toContain('user:*');
    expect(code).toContain('hgetall');
  });

  it('generates PostgreSQL ingestion code with sqlalchemy', () => {
    const code = generateDatasetPythonCode('dataset.database', {
      db_type: 'postgresql',
      host: 'db.internal',
      port: 5432,
      database: 'prod_db',
      username: 'app_user',
      table: 'customers',
    });

    expect(code).toContain('from sqlalchemy import create_engine');
    expect(code).toContain('postgresql+psycopg2://app_user:');
    expect(code).toContain('db.internal:5432/prod_db');
  });
});
