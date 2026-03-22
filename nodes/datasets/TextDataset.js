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

  inputs: [
    { name: 'tokenizer',  datatype: 'tokenizer', shape: [], optional: true },
    { name: 'transform',  datatype: 'transform', shape: [], optional: true },
  ],

  outputs: [
    { name: 'input_ids',     datatype: 'sequence',   shape: ['B', 'max_length'] },
    { name: 'attention_mask', datatype: 'sequence',  shape: ['B', 'max_length'] },
    { name: 'labels',        datatype: 'tensor',     shape: ['B'] },
    { name: 'vocab',         datatype: 'list',        shape: ['vocab_size'] },
    { name: 'train_loader',  datatype: 'dataloader', shape: [] },
    { name: 'val_loader',    datatype: 'dataloader', shape: [] },
    { name: 'test_loader',   datatype: 'dataloader', shape: [] },
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

    // Loading
    batch_size: 32,
    shuffle: true,
    workers: 4,

    // Splits
    train_split: 0.8,
    val_split: 0.1,
    test_split: 0.1,

    // Advanced
    cache: 'none',
    streaming: false,
  },

  metadata: {
    task: 'nlp',
    vocab_size: null,
    num_samples: null,
    avg_length: null,
    num_classes: null,
  },
};
