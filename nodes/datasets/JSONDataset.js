/**
 * JSON Dataset Node Definition
 * For structured JSON/JSONL datasets — flexible schema extraction.
 */
export const JSONDatasetDef = {
  type: 'dataset.json',
  category: 'dataset',
  label: 'JSON Dataset',
  icon: 'BracesIcon',
  color: '#fbbf24', // amber

  inputs: [
    { name: 'transform', datatype: 'transform', shape: [], optional: true },
  ],

  outputs: [
    { name: 'data',         datatype: 'tensor',     shape: ['B', 'feature_dim'] },
    { name: 'labels',       datatype: 'tensor',     shape: ['B'] },
    { name: 'schema',       datatype: 'dict',        shape: [] },
    { name: 'train_loader', datatype: 'dataloader', shape: [] },
    { name: 'val_loader',   datatype: 'dataloader', shape: [] },
    { name: 'test_loader',  datatype: 'dataloader', shape: [] },
  ],

  schema: {
    dtype: 'float32',
    task: 'general',
    input_format: 'json',
  },

  defaultConfig: {
    // Source
    path: '',
    file_format: 'json',    // 'json' | 'jsonl'
    data_key: '',           // JSONPath to data array, e.g. "data.records"
    label_key: 'label',
    feature_keys: [],       // [] = infer all numeric keys

    // Loading
    batch_size: 32,
    shuffle: true,
    workers: 2,

    // Preprocessing
    flatten: true,
    normalize: 'none',
    handle_missing: 'drop',

    // Splits
    train_split: 0.7,
    val_split: 0.15,
    test_split: 0.15,

    // Advanced
    cache: 'none',
    streaming: false,
    lazy_loading: true,
  },

  metadata: {
    task: 'general',
    num_samples: null,
    schema_keys: [],
  },
};
