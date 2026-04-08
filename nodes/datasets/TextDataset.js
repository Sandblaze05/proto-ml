/**
 * Text Dataset Node Definition
 * For NLP tasks — sequence classification, language modeling, etc.
 */
export const TextDatasetDef = {
  type: 'dataset.text',
  category: 'dataset',
  label: 'Text Dataset',
  icon: 'FileTextIcon',
  color: '#60a5fa', // blue

  inputs: [],

  outputs: [
    { name: 'out',          datatype: 'any',        shape: [] },
    { name: 'input_ids',     datatype: 'sequence',   shape: ['B', 'max_length'] },
    { name: 'attention_mask', datatype: 'sequence',  shape: ['B', 'max_length'] },
    { name: 'labels',        datatype: 'tensor',     shape: ['B'] },
    { name: 'vocab',         datatype: 'list',        shape: ['vocab_size'] },
  ],

  schema: {
    dtype: 'int64',
    task: 'nlp',
    input_format: 'text',
  },

  defaultConfig: {
    // Source
    path: '',
    file_format: 'txt',           // 'txt' | 'csv' | 'jsonl'
    text_column: 'text',
    label_column: 'label',

    // Tokenization
    tokenizer: 'whitespace',      // 'whitespace' | 'bpe' | 'wordpiece' | 'custom'
    vocab_size: 30000,
    max_length: 512,
    padding: 'max_length',
    truncation: true,

  },

  metadata: {
    task: 'nlp',
    vocab_size: null,
    num_samples: null,
    avg_length: null,
    num_classes: null,
  },
};
