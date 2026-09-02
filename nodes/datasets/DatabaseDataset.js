/**
 * Database Dataset Node Definition
 * SQL/NoSQL database connector — query-driven data extraction.
 */
export const DatabaseDatasetDef = {
  type: 'dataset.database',
  kind: 'dataset',
  category: 'dataset',
  label: 'Database Dataset',
  icon: 'DatabaseIcon',
  color: '#f87171',

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
      db_type: 'postgresql',
      connection_mode: 'params',
      connection_uri: '',
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      ssl: false,
      table: '',
      query_mode: 'table',
      query: '',
      redis_key_pattern: '',
      redis_data_type: 'hash',
      flatten_nested: true,
      limit: 100,
      target_column: '',
      feature_columns: [],
      chunk_size: 10000,
      normalize: 'standard',
      handle_missing: 'drop',
    },
    schema: {
      dtype: 'float32',
      task: 'tabular',
      input_format: 'database',
    },
  },

  preview: 'dataset.database',
  backend: 'dataset.database',

  cache: {
    version: '1.0.0',
    seed: 42,
    deterministic: true,
  },

  metadata: {
    task: 'tabular',
    num_features: null,
    num_samples: null,
    table_schema: {},
  },
};
