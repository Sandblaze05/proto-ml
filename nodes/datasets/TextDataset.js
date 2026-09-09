/**
 * Text Dataset Node Definition
 * For NLP tasks — sequence classification, language modeling, sentiment analysis, etc.
 * Supports .txt, .md, .jsonl, and .csv text sources with optional vectorization.
 */
export const TextDatasetDef = {
  type: 'dataset.text',
  kind: 'dataset',
  category: 'dataset',
  label: 'Text Dataset',
  icon: 'FileTextIcon',
  color: '#60a5fa',

  inputs: [],

  outputs: [
    { name: 'out',             datatype: 'tabular',   shape: [] },
    { name: 'features',        datatype: 'tensor',    shape: ['B', 'num_features'] },
    { name: 'targets',         datatype: 'tensor',    shape: ['B'] },
    { name: 'columns',         datatype: 'list',      shape: ['num_columns'] },
    { name: 'input_ids',       datatype: 'sequence',  shape: ['B', 'max_length'] },
    { name: 'attention_mask',  datatype: 'sequence',  shape: ['B', 'max_length'] },
    { name: 'vocab',           datatype: 'list',      shape: ['vocab_size'] },
  ],

  ports: {
    inputs: [],
    outputs: [
      { name: 'out', datatype: 'tabular', shape: [], role: 'data' },
      { name: 'features', datatype: 'tensor', shape: ['B', 'num_features'], role: 'data' },
      { name: 'targets', datatype: 'tensor', shape: ['B'], role: 'labels' },
      { name: 'columns', datatype: 'list', shape: ['num_columns'], role: 'data' },
      { name: 'input_ids', datatype: 'sequence', shape: ['B', 'max_length'], role: 'data' },
      { name: 'attention_mask', datatype: 'sequence', shape: ['B', 'max_length'], role: 'data' },
      { name: 'vocab', datatype: 'list', shape: ['vocab_size'], role: 'data' },
    ],
  },

  config: {
    defaults: {
      source_mode: 'file',
      path: '',
      files: [],
      file_format: 'txt',
      header: true,
      encoding: 'utf-8',
      text_column: 'text',
      label_column: 'label',
      target_column: '',
      feature_columns: [],
      tokenizer: 'whitespace',
      vocab_size: 30000,
      max_length: 512,
      padding: 'max_length',
      truncation: true,
      handle_missing: 'drop',
      missing: { strategy: 'drop' },
    },
    schema: {
      dtype: 'int64',
      task: 'nlp',
      input_format: 'text',
    },
  },

  preview: 'dataset.text',
  backend: 'dataset.text',

  cache: {
    version: '1.0.0',
    seed: 42,
    deterministic: true,
  },

  metadata: {
    task: 'nlp',
    vocab_size: null,
    num_samples: null,
    avg_length: null,
    num_classes: null,
    label_distribution: {},
    file_count: null,
  },
};

export default TextDatasetDef;
