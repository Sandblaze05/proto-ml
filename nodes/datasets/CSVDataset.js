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

  inputs: [
    { name: 'transform', datatype: 'transform', shape: [], optional: true },
  ],

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

    // Loading
    batch_size: 64,
    shuffle: true,
    workers: 2,

    // Preprocessing
    normalize: 'standard',   // 'standard' | 'minmax' | 'none'
    handle_missing: 'drop',  // 'drop' | 'mean' | 'median' | 'zero'
    categorical_encoding: 'onehot', // 'onehot' | 'label' | 'none'

    // Splits
    train_split: 0.7,
    val_split: 0.15,
    test_split: 0.15,

    // Advanced
    cache: 'none',
    streaming: false,
  },

  metadata: {
    task: 'tabular',
    num_features: null,
    num_samples: null,
    column_types: {},
  },
};
