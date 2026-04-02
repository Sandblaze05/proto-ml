import { describe, it, expect } from 'vitest';
import { buildDatasetMetadata, inferType, profileColumns } from '../../lib/clientUploadStore.js';

describe('clientUploadStore analysis helpers', () => {
  it('infers common column types', () => {
    expect(inferType(['1', '2', '3'])).toBe('number');
    expect(inferType(['true', 'false', 'yes'])).toBe('boolean');
    expect(inferType(['2024-01-01', '2024-02-01'])).toBe('datetime');
    expect(inferType(['cat', 'dog', 'bird'])).toBe('string');
    expect(inferType([])).toBe('unknown');
  });

  it('profiles rows with numeric, categorical, and missing metadata', () => {
    const rows = [
      { age: '18', country: 'US', active: 'true' },
      { age: '21', country: 'US', active: 'false' },
      { age: '30', country: 'CA', active: 'true' },
      { age: '', country: 'CA', active: '' },
    ];

    const analysis = profileColumns(rows, ['age', 'country', 'active']);

    expect(analysis.stats.rows).toBe(4);
    expect(analysis.stats.columns).toBe(3);
    expect(analysis.stats.missingCells).toBe(2);
    expect(analysis.profile.age.dtype).toBe('number');
    expect(analysis.profile.age.stats.min).toBe(18);
    expect(analysis.profile.country.kind).toBe('categorical');
    expect(analysis.profile.active.dtype).toBe('boolean');
  });

  it('builds dataset metadata with schema and recommendations', () => {
    const profile = {
      age: { name: 'age', dtype: 'number', kind: 'numeric', nullCount: 0, unique: 3 },
      country: { name: 'country', dtype: 'string', kind: 'categorical', nullCount: 1, unique: 2 },
    };

    const metadata = buildDatasetMetadata({
      uploadId: 'upload_123',
      sourceType: 'csv',
      primary: 'people',
      tables: ['people'],
      columns: ['age', 'country'],
      profile,
      stats: { rows: 4, columns: 2, missingCells: 1, duplicateRows: 0 },
      preview: [{ age: '18', country: 'US' }],
      targetColumn: 'age',
      features: ['country'],
      missingStrategy: 'drop',
      totalBytes: 1024,
      sampled: true,
      sampledBytes: 512,
      taskSuggestion: 'regression',
      joinSuggestions: [],
    });

    expect(metadata.datasetId).toBe('upload_123');
    expect(metadata.schema.columns).toHaveLength(2);
    expect(metadata.schema.columnTypes.age).toBe('number');
    expect(metadata.stats.sampled).toBe(true);
    expect(metadata.taskSuggestion).toBe('regression');
    expect(metadata.recommendations.length).toBeGreaterThan(0);
  });
});
