/**
 * Text Dataset Node Definition
 * For NLP tasks — sequence classification, language modeling, etc.
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
    { name: 'out',          datatype: 'any',        shape: [] },
    { name: 'input_ids',     datatype: 'sequence',   shape: ['B', 'max_length'] },
    { name: 'attention_mask', datatype: 'sequence',  shape: ['B', 'max_length'] },
    { name: 'labels',        datatype: 'tensor',     shape: ['B'] },
    { name: 'vocab',         datatype: 'list',        shape: ['vocab_size'] },
  ],

  ports: {
    inputs: [],
    outputs: [
      { name: 'out', datatype: 'any', shape: [], role: 'data' },
      { name: 'input_ids', datatype: 'sequence', shape: ['B', 'max_length'], role: 'data' },
      { name: 'attention_mask', datatype: 'sequence', shape: ['B', 'max_length'], role: 'data' },
      { name: 'labels', datatype: 'tensor', shape: ['B'], role: 'labels' },
      { name: 'vocab', datatype: 'list', shape: ['vocab_size'], role: 'data' },
    ],
  },

  config: {
    defaults: {
      path: '',
      file_format: 'txt',
      text_column: 'text',
      label_column: 'label',
      tokenizer: 'whitespace',
      vocab_size: 30000,
      max_length: 512,
      padding: 'max_length',
      truncation: true,
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
  },
};
