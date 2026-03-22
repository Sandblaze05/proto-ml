/**
 * API Dataset Node Definition
 * REST/GraphQL API data source with pagination and auth support.
 */
export const APIDatasetDef = {
  type: 'dataset.api',
  category: 'dataset',
  label: 'API Dataset',
  icon: 'GlobeIcon',
  color: '#a78bfa', // violet

  inputs: [],

  outputs: [
    { name: 'data',         datatype: 'tensor',     shape: ['B', 'feature_dim'] },
    { name: 'labels',       datatype: 'tensor',     shape: ['B'] },
    { name: 'raw',          datatype: 'dict',        shape: [] },
    { name: 'train_loader', datatype: 'dataloader', shape: [] },
    { name: 'val_loader',   datatype: 'dataloader', shape: [] },
    { name: 'test_loader',  datatype: 'dataloader', shape: [] },
  ],

  schema: {
    dtype: 'float32',
    task: 'general',
    input_format: 'api',
  },

  defaultConfig: {
    // Endpoint
    url: '',
    method: 'GET',               // 'GET' | 'POST'
    api_type: 'rest',            // 'rest' | 'graphql'

    // Auth
    auth_type: 'none',           // 'none' | 'bearer' | 'api_key' | 'basic'
    auth_token: '',
    headers: {},

    // Data extraction
    data_path: 'data',           // JSONPath to the records array
    label_key: 'label',
    feature_keys: [],

    // Pagination
    pagination: true,
    page_param: 'page',
    page_size: 100,
    max_pages: 10,

    // Loading
    batch_size: 32,
    shuffle: false,
    workers: 1,

    // Splits
    train_split: 0.7,
    val_split: 0.15,
    test_split: 0.15,

    // Advanced
    cache: 'disk',
    retry_attempts: 3,
    timeout_seconds: 30,
    streaming: false,
  },

  metadata: {
    task: 'general',
    num_samples: null,
    endpoint_schema: {},
  },
};
