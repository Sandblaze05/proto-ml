/**
 * JSON Dataset Node Definition
 * For structured JSON/JSONL datasets — flexible schema extraction.
 */
export const JSONDatasetDef = {
  type: 'dataset.json',
  kind: 'dataset',
  category: 'dataset',
  label: 'JSON Dataset',
  icon: 'BracesIcon',
  color: '#fbbf24',

  inputs: [],

  outputs: [
    { name: 'out',          datatype: 'tabular',   shape: [] },
    { name: 'data',         datatype: 'tensor',     shape: ['B', 'feature_dim'] },
    { name: 'labels',       datatype: 'tensor',     shape: ['B'] },
    { name: 'schema',       datatype: 'dict',        shape: [] },
  ],

  ports: {
    inputs: [],
    outputs: [
      { name: 'out', datatype: 'tabular', shape: [], role: 'data' },
      { name: 'data', datatype: 'tensor', shape: ['B', 'feature_dim'], role: 'data' },
      { name: 'labels', datatype: 'tensor', shape: ['B'], role: 'labels' },
      { name: 'schema', datatype: 'dict', shape: [], role: 'data' },
    ],
  },

  config: {
    defaults: {
      path: '',
      file_format: 'json',
      data_key: '',
      label_key: 'label',
      feature_keys: [],
      flatten: true,
      normalize: 'none',
      handle_missing: 'drop',
    },
    schema: {
      dtype: 'float32',
      task: 'general',
      input_format: 'json',
    },
  },

  preview: 'dataset.json',
  backend: 'dataset.json',

  cache: {
    version: '1.0.0',
    seed: 42,
    deterministic: true,
  },

  metadata: {
    task: 'general',
    num_samples: null,
    schema_keys: [],
  },
};
