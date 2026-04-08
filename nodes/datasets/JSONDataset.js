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

  inputs: [],

  outputs: [
    { name: 'out',          datatype: 'any',        shape: [] },
    { name: 'data',         datatype: 'tensor',     shape: ['B', 'feature_dim'] },
    { name: 'labels',       datatype: 'tensor',     shape: ['B'] },
    { name: 'schema',       datatype: 'dict',        shape: [] },
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

    // Lightweight source normalization only
    flatten: true,
    normalize: 'none',
    handle_missing: 'drop',
  },

  metadata: {
    task: 'general',
    num_samples: null,
    schema_keys: [],
  },
};
