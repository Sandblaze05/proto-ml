import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const DatabaseDatasetRuntime = require('../../../lib/datasetRuntimes/DatabaseDatasetRuntime');

describe('DatabaseDatasetRuntime', () => {
  it('instantiates with default configuration', () => {
    const runtime = new DatabaseDatasetRuntime();
    expect(runtime.config.db_type).toBe('postgresql');
    expect(runtime.config.host).toBe('localhost');
    expect(runtime.config.limit).toBe(100);
  });

  it('extracts sample, features, targets, columns, and metadata from mock rows', async () => {
    const mockRows = [
      { id: 1, age: 25, income: 50000, label: 'yes' },
      { id: 2, age: 30, income: 60000, label: 'no' },
      { id: 3, age: 35, income: 75000, label: 'yes' },
    ];

    const runtime = new DatabaseDatasetRuntime({
      db_type: 'postgresql',
      table: 'users',
      mockRows,
      target_column: 'label',
      feature_columns: ['age', 'income'],
    });

    const sample = await runtime.getSample(2);

    expect(sample.rows.length).toBe(2);
    expect(sample.rows[0].age).toBe(25);
    expect(sample.rows[0]._target).toBe('yes');

    expect(sample.features.length).toBe(2);
    expect(sample.features[0]).toEqual({ age: 25, income: 50000 });

    expect(sample.targets).toEqual(['yes', 'no']);
    expect(sample.columns).toContain('age');
    expect(sample.columns).toContain('income');
    expect(sample.columns).toContain('label');

    expect(sample.metadata.db_type).toBe('postgresql');
    expect(sample.metadata.numeric_columns).toContain('age');
    expect(sample.metadata.numeric_columns).toContain('income');
    expect(sample.metadata.categorical_columns).toContain('label');
  });

  it('flattens nested MongoDB document objects', async () => {
    const mockDocs = [
      { _id: 'doc1', user: { name: 'Alice', address: { city: 'NYC' } }, metrics: { score: 95 } },
      { _id: 'doc2', user: { name: 'Bob', address: { city: 'LA' } }, metrics: { score: 88 } },
    ];

    const runtime = new DatabaseDatasetRuntime({
      db_type: 'mongodb',
      table: 'profiles',
      mockRows: mockDocs,
      flatten_nested: true,
    });

    const sample = await runtime.getSample(2);
    expect(sample.rows.length).toBe(2);
    expect(sample.rows[0]['user.name']).toBe('Alice');
    expect(sample.rows[0]['user.address.city']).toBe('NYC');
    expect(sample.rows[0]['metrics.score']).toBe(95);
  });

  it('handles Redis-style hash mock rows', async () => {
    const mockRedis = [
      { _key: 'user:101', age: '28', category: 'premium', active: '1' },
      { _key: 'user:102', age: '42', category: 'standard', active: '0' },
    ];

    const runtime = new DatabaseDatasetRuntime({
      db_type: 'redis',
      redis_key_pattern: 'user:*',
      mockRows: mockRedis,
      target_column: 'active',
    });

    const sample = await runtime.getSample(2);
    expect(sample.rows.length).toBe(2);
    expect(sample.rows[0]._key).toBe('user:101');
    expect(sample.targets).toEqual(['1', '0']);
  });

  it('provides safe preview fallback when offline and unconfigured', async () => {
    const runtime = new DatabaseDatasetRuntime({
      db_type: 'sqlite',
      database: 'non_existent_db.sqlite',
      table: 'test_table',
    });

    const sample = await runtime.getSample(1);
    expect(Array.isArray(sample)).toBe(true);
    expect(sample[0]._preview).toBe(true);
    expect(sample[0].db_type).toBe('sqlite');
    expect(sample[0].table).toBe('test_table');
  });
});
