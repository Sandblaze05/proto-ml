/**
 * Database Dataset Node Definition
 * SQL/NoSQL database connector — query-driven data extraction.
 */
export const DatabaseDatasetDef = {
  type: 'dataset.database',
  category: 'dataset',
  label: 'Database Dataset',
  icon: 'DatabaseIcon',
  color: '#f87171', // red

  inputs: [],

  outputs: [
    { name: 'features',     datatype: 'tensor',     shape: ['B', 'num_features'] },
    { name: 'targets',      datatype: 'tensor',     shape: ['B'] },
    { name: 'columns',      datatype: 'list',        shape: ['num_columns'] },
  ],

  schema: {
    dtype: 'float32',
    task: 'tabular',
    input_format: 'database',
  },

  defaultConfig: {
    // Connection
    db_type: 'postgresql',        // 'postgresql' | 'mysql' | 'sqlite' | 'mongodb'
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',

    // Query
    table: '',
    query: '',                    // Custom SQL query (overrides table)
    target_column: '',
    feature_columns: [],

    chunk_size: 10000,
    normalize: 'standard',
    handle_missing: 'drop',
  },

  metadata: {
    task: 'tabular',
    num_features: null,
    num_samples: null,
    table_schema: {},
  },
};
