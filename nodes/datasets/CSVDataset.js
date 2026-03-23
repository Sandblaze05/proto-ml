/**
 * CSV Dataset Node Definition
 * For tabular data sources — regression, classification from CSV files.
 */
export const CSVDatasetDef = {
  type: 'dataset.csv',
  category: 'dataset',
  label: 'CSV Dataset',
  icon: 'TableIcon',
  color: '#34d399', // emerald

  inputs: [],

  outputs: [
    { name: 'features',     datatype: 'tensor',     shape: ['B', 'num_features'] },
    { name: 'targets',      datatype: 'tensor',     shape: ['B'] },
    { name: 'columns',      datatype: 'list',        shape: ['num_columns'] },
  ],

  schema: {
    dtype: 'float32',
    task: 'tabular',
    input_format: 'csv',
  },

  defaultConfig: {
    // Source
    path: '',
    delimiter: ',',
    header: true,
    target_column: '',
    feature_columns: [],    // [] = all except target
    skip_rows: 0,
    encoding: 'utf-8',

    normalize: 'standard',
    handle_missing: 'drop',
  },

  metadata: {
    task: 'tabular',
    num_features: null,
    num_samples: null,
    column_types: {},
  },
};
