/**
 * API Dataset Node Definition
 * REST/GraphQL API data source with pagination and auth support.
 */
export const APIDatasetDef = {
  type: 'dataset.api',
  kind: 'dataset',
  category: 'dataset',
  label: 'API Dataset',
  icon: 'GlobeIcon',
  color: '#a78bfa',

  inputs: [],

  outputs: [
    { name: 'out',          datatype: 'any',        shape: [] },
    { name: 'data',         datatype: 'tensor',     shape: ['B', 'feature_dim'] },
    { name: 'labels',       datatype: 'tensor',     shape: ['B'] },
    { name: 'raw',          datatype: 'dict',        shape: [] },
  ],

  ports: {
    inputs: [],
    outputs: [
      { name: 'out', datatype: 'any', shape: [], role: 'data' },
      { name: 'data', datatype: 'tensor', shape: ['B', 'feature_dim'], role: 'data' },
      { name: 'labels', datatype: 'tensor', shape: ['B'], role: 'labels' },
      { name: 'raw', datatype: 'dict', shape: [], role: 'data' },
    ],
  },

  config: {
    defaults: {
      url: '',
      method: 'GET',
      api_type: 'rest',
      auth_type: 'none',
      auth_token: '',
      headers: {},
      data_path: 'data',
      label_key: 'label',
      feature_keys: [],
      pagination: true,
      page_param: 'page',
      page_size: 100,
      max_pages: 10,
      retry_attempts: 3,
      timeout_seconds: 30,
    },
    schema: {
      dtype: 'float32',
      task: 'general',
      input_format: 'api',
    },
  },

  preview: 'dataset.api',
  backend: 'dataset.api',

  cache: {
    version: '1.0.0',
    seed: 42,
    deterministic: true,
  },

  metadata: {
    task: 'general',
    num_samples: null,
    endpoint_schema: {},
  },
};
