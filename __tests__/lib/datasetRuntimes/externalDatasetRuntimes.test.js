import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const DatabaseDatasetRuntime = require('../../../lib/datasetRuntimes/DatabaseDatasetRuntime');
const APIDatasetRuntime = require('../../../lib/datasetRuntimes/APIDatasetRuntime');

describe('external dataset runtimes', () => {
  it('database runtime returns mock rows when configured', async () => {
    const runtime = new DatabaseDatasetRuntime({
      mockRows: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });

    const sample = await runtime.getSample(2);
    expect(sample).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('database runtime provides preview-safe synthetic row without connector', async () => {
    const runtime = new DatabaseDatasetRuntime({ db_type: 'postgresql', table: 'users' });
    const sample = await runtime.getSample(1);

    expect(sample[0]._preview).toBe(true);
    expect(sample[0].table).toBe('users');
  });

  it('api runtime returns mock data when configured', async () => {
    const runtime = new APIDatasetRuntime({
      mockData: [{ id: 'a' }, { id: 'b' }],
    });

    const sample = await runtime.getSample(1);
    expect(sample).toEqual([{ id: 'a' }]);
  });

  it('api runtime provides preview-safe synthetic row without URL', async () => {
    const runtime = new APIDatasetRuntime({ method: 'GET' });
    const sample = await runtime.getSample(1);

    expect(sample[0]._preview).toBe(true);
    expect(sample[0].method).toBe('GET');
  });
});
