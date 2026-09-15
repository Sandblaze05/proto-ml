import { describe, expect, it } from 'vitest';
import { generateDatasetPythonCode } from '../../../lib/pythonTemplates/datasetNodeTemplate.js';

describe('API dataset pipeline support', () => {
  it('generates a usable API-to-tabular Python template', () => {
    const code = generateDatasetPythonCode('dataset.api', {
      url: 'https://example.test/items',
      data_path: 'results.items',
      target_column: 'label',
      feature_keys: ['age', 'score'],
    });

    expect(code).toContain('pd.json_normalize(records)');
    expect(code).toContain('get_by_path(payload, data_path)');
    expect(code).not.toContain('TODO: extract nested payload');
  });
});
