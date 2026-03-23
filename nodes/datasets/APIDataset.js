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

    // Advanced
    retry_attempts: 3,
    timeout_seconds: 30,
  },

  metadata: {
    task: 'general',
    num_samples: null,
    endpoint_schema: {},
  },
};
