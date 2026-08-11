import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getPythonRuntimeCode } from '../../../lib/pythonTemplates/runtimeHelpers.js';

describe('Python CSV training runtime', () => {
  it('persists a preprocessing pipeline that predicts categorical and missing CSV values', () => {
    const driver = `
import tempfile

train_rows = [
    {'age': '21', 'city': 'Pune', 'purchased': '0'},
    {'age': '35', 'city': 'Mumbai', 'purchased': '1'},
    {'age': '', 'city': 'Pune', 'purchased': '0'},
    {'age': '47', 'city': 'Delhi', 'purchased': '1'},
]
result = _lifecycle_training(
    {
        'model': {'family': 'logistic_regression', 'backend': 'sklearn', 'task_type': 'classification'},
        'train_data': {'data': train_rows, 'target_column': 'purchased'},
    },
    {'artifact_dir': tempfile.mkdtemp(), 'run_id': 'csv_pipeline_test'}
)
trained_model = result['trained_model']
assert trained_model['artifact_type'] == 'sklearn_pipeline'
assert trained_model['categorical_columns'] == ['city']
assert trained_model['numeric_columns'] == ['age']
tuning = _lifecycle_hyperparameter_tune(
    {
        'model': {'family': 'logistic_regression', 'backend': 'sklearn', 'task_type': 'classification'},
        'train_data': {'data': train_rows, 'target_column': 'purchased'},
    },
    {'method': 'grid', 'param_grid': {'C': [0.5, 1.0]}, 'metric': 'accuracy'}
)
assert tuning['search_report']['trial_count'] == 2
assert 'C' in tuning['best_params']
ensemble = _lifecycle_ensemble({'models': [trained_model, trained_model]}, {})['ensemble_model']
assert ensemble['artifact_type'] == 'sklearn_ensemble'
prediction = _lifecycle_predict(
    {
        'model': ensemble,
        'inference_data': {'data': [{'age': '', 'city': 'Unknown city'}]},
    },
    {}
)
assert prediction['predictions']['has_model'] is True
assert len(prediction['predictions']['labels']) == 1
print('runtime-csv-pipeline-ok')
`;
    const result = spawnSync('python', ['-'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
      input: `${getPythonRuntimeCode()}\n${driver}`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('runtime-csv-pipeline-ok');
  }, 35000);
});
