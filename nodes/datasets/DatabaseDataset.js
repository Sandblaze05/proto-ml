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
    { name: 'train_loader', datatype: 'dataloader', shape: [] },
    { name: 'val_loader',   datatype: 'dataloader', shape: [] },
    { name: 'test_loader',  datatype: 'dataloader', shape: [] },
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

    // Loading
    batch_size: 64,
    shuffle: true,
    workers: 2,
    chunk_size: 10000,            // Rows fetched per chunk

    // Preprocessing
    normalize: 'standard',
    handle_missing: 'drop',

    // Splits
    train_split: 0.7,
    val_split: 0.15,
    test_split: 0.15,

    // Advanced
    cache: 'disk',
    streaming: true,
  },

  metadata: {
    task: 'tabular',
    num_features: null,
    num_samples: null,
    table_schema: {},
  },
};
