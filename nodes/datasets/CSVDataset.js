/**
 * CSV Dataset Node Definition
 * For tabular data sources — regression, classification from CSV files.
 */
export const CSVDatasetDef = {
  type: 'dataset.csv',
  kind: 'dataset',
  category: 'dataset',
  label: 'CSV Dataset',
  icon: 'TableIcon',
  color: '#34d399',

  inputs: [],

  outputs: [
    { name: 'out',          datatype: 'tabular',   shape: [] },
    { name: 'features',     datatype: 'tensor',     shape: ['B', 'num_features'] },
    { name: 'targets',      datatype: 'tensor',     shape: ['B'] },
    { name: 'columns',      datatype: 'list',        shape: ['num_columns'] },
  ],

  ports: {
    inputs: [],
    outputs: [
      { name: 'out', datatype: 'tabular', shape: [], role: 'data' },
      { name: 'features', datatype: 'tensor', shape: ['B', 'num_features'], role: 'data' },
      { name: 'targets', datatype: 'tensor', shape: ['B'], role: 'labels' },
      { name: 'columns', datatype: 'list', shape: ['num_columns'], role: 'data' },
    ],
  },

  config: {
    defaults: {
      source: 'local',
      source_mode: 'folder',
      path: '',
      files: [],
      primary: '',
      relations: [],
      delimiter: ',',
      header: true,
      target_column: '',
      feature_columns: [],
      features: [],
      column_types: {},
      skip_rows: 0,
      encoding: 'utf-8',
      normalize: 'none',
      handle_missing: 'drop',
      missing: { strategy: 'drop' },
      preprocessing: {},
    },
    schema: {
      dtype: 'float32',
      task: 'tabular',
      input_format: 'csv',
    },
  },

  preview: 'dataset.csv',
  backend: 'dataset.csv',

  cache: {
    version: '1.0.0',
    seed: 42,
    deterministic: true,
  },

  metadata: {
    task: 'tabular',
    num_features: null,
    num_samples: null,
    column_types: {},
    target: null,
    tables: [],
  },
};
