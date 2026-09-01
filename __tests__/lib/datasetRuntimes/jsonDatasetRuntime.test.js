import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const JSONDatasetRuntime = require('../../../lib/datasetRuntimes/JSONDatasetRuntime');

describe('JSONDatasetRuntime', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proto-ml-json-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('flattens JSON records into CSV-style tabular output', async () => {
    const filePath = path.join(tmpDir, 'customers.json');
    await fs.writeFile(filePath, JSON.stringify({
      data: {
        records: [
          { id: 1, profile: { age: 30, city: 'LA' }, label: 'yes' },
          { id: 2, profile: { age: 41, city: 'NYC' }, label: 'no' },
        ],
      },
    }));

    const runtime = new JSONDatasetRuntime({
      path: filePath,
      data_key: 'data.records',
      target_column: 'label',
      features: ['id', 'profile.age', 'profile.city'],
      missing: { strategy: 'none' },
    });

    const sample = await runtime.getSample(5);

    expect(sample.rows).toEqual([
      { id: 1, 'profile.age': 30, 'profile.city': 'LA', label: 'yes', _target: 'yes' },
      { id: 2, 'profile.age': 41, 'profile.city': 'NYC', label: 'no', _target: 'no' },
    ]);
    expect(sample.features).toEqual([
      { id: 1, 'profile.age': 30, 'profile.city': 'LA' },
      { id: 2, 'profile.age': 41, 'profile.city': 'NYC' },
    ]);
    expect(sample.targets).toEqual(['yes', 'no']);
    expect(sample.columns).toEqual(['id', 'profile.age', 'profile.city', 'label', '_target']);
    expect(sample.out).toBe(sample.rows);
    expect(sample.metadata.features).toEqual(['id', 'profile.age', 'profile.city']);
    expect(sample.metadata.target).toBe('label');
  });

  it('validates required fields after flattening', async () => {
    const filePath = path.join(tmpDir, 'records.json');
    await fs.writeFile(filePath, JSON.stringify([{ id: 1, nested: { present: true } }]));

    const runtime = new JSONDatasetRuntime({
      path: filePath,
      required_fields: ['nested.present', 'nested.missing'],
      missing: { strategy: 'none' },
    });

    await expect(runtime.getSample(5)).rejects.toMatchObject({
      type: 'ValidationError',
      message: 'JSON dataset is missing required field(s)',
      details: { missing: ['nested.missing'] },
    });
  });

  it('keeps default payload.data extraction compatibility', async () => {
    const filePath = path.join(tmpDir, 'wrapped.json');
    await fs.writeFile(filePath, JSON.stringify({
      data: [
        { id: 1, score: 10 },
        { id: 2, score: 20 },
      ],
    }));

    const runtime = new JSONDatasetRuntime({
      path: filePath,
      missing: { strategy: 'none' },
    });

    const sample = await runtime.getSample(5);

    expect(sample.rows).toEqual([
      { id: 1, score: 10 },
      { id: 2, score: 20 },
    ]);
    expect(sample.features).toEqual([
      { id: 1, score: 10 },
      { id: 2, score: 20 },
    ]);
  });

  it('reports malformed JSONL lines instead of silently skipping them', async () => {
    const filePath = path.join(tmpDir, 'records.jsonl');
    await fs.writeFile(filePath, '{"id":1}\n{bad json}\n');

    const runtime = new JSONDatasetRuntime({
      path: filePath,
      file_format: 'jsonl',
      missing: { strategy: 'none' },
    });

    await expect(runtime.getSample(5)).rejects.toMatchObject({
      type: 'ValidationError',
      message: 'Invalid JSONL file format',
      details: { line: 2 },
    });
  });
});
