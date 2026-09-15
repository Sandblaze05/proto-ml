import { TEMPLATE_SCHEMA_VERSION } from './pipelineTemplateService.js';

export const BUILTIN_PIPELINE_TEMPLATES = [
  {
    id: 'builtin.tabular-starter',
    name: 'Tabular Starter (CSV -> Map -> Split -> Trainer)',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    parameters: [
      {
        name: 'datasetPath',
        required: false,
        type: 'string',
        defaultValue: './data/uploads/sample.csv',
        description: 'Path to CSV dataset',
      },
      {
        name: 'dropColumns',
        required: false,
        type: 'array:string',
        defaultValue: ['id'],
        description: 'Columns to drop in initial map transform',
      },
    ],
    graph: {
      nodes: [
        {
          id: 'dataset',
          type: 'dataset.csv',
          config: {
            path: '{{datasetPath}}',
            target_column: 'target',
          },
        },
        {
          id: 'map',
          type: 'transform.core.map',
          config: {
            operation: 'drop_columns',
            columns: '{{dropColumns}}',
          },
        },
        {
          id: 'split',
          type: 'lifecycle.split',
          config: {
            train_pct: 70,
            val_pct: 20,
            test_pct: 10,
            shuffle: true,
          },
        },
        {
          id: 'model',
          type: 'lifecycle.core.model_builder',
          config: {
            family: 'linear_regression',
            num_outputs: 1,
          },
        },
        {
          id: 'objective',
          type: 'lifecycle.core.objective',
          config: {
            objective_type: 'supervised',
            loss: 'auto',
            primary_metric: 'auto',
          },
        },
        {
          id: 'trainer',
          type: 'lifecycle.core.trainer',
          config: {
            epochs: 20,
            optimizer: 'auto',
            learning_rate: 0.001,
          },
        },
      ],
      edges: [
        { source: 'dataset', target: 'map', sourceHandle: 'features', targetHandle: 'in' },
        { source: 'map', target: 'split', sourceHandle: 'out', targetHandle: 'dataset' },
        { source: 'split', target: 'model', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'model', target: 'objective', sourceHandle: 'model', targetHandle: 'model' },
        { source: 'model', target: 'trainer', sourceHandle: 'model', targetHandle: 'model' },
        { source: 'split', target: 'trainer', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'split', target: 'trainer', sourceHandle: 'val', targetHandle: 'val_data' },
        { source: 'objective', target: 'trainer', sourceHandle: 'loss', targetHandle: 'objective' },
      ],
    },
  },
  {
    id: 'builtin.nlp-text-classifier',
    name: 'NLP Text Classifier (Text -> TF-IDF -> Split -> Multinomial NB)',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    parameters: [
      {
        name: 'datasetPath',
        required: false,
        type: 'string',
        defaultValue: './data/uploads/sentiment_data.csv',
        description: 'Path to text dataset file (.csv, .jsonl, .txt)',
      },
      {
        name: 'textColumn',
        required: false,
        type: 'string',
        defaultValue: 'text',
        description: 'Name of the text feature column',
      },
      {
        name: 'labelColumn',
        required: false,
        type: 'string',
        defaultValue: 'label',
        description: 'Name of the label/target column',
      },
      {
        name: 'maxFeatures',
        required: false,
        type: 'number',
        defaultValue: 5000,
        description: 'Maximum TF-IDF features to extract',
      },
    ],
    graph: {
      nodes: [
        {
          id: 'dataset',
          type: 'dataset.text',
          position: { x: 100, y: 160 },
          config: {
            path: '{{datasetPath}}',
            source_mode: 'file',
            text_column: '{{textColumn}}',
            label_column: '{{labelColumn}}',
            target_column: '{{labelColumn}}',
            vectorizer: 'none',
          },
        },
        {
          id: 'tfidf',
          type: 'transform.text.tfidf',
          position: { x: 420, y: 160 },
          config: {
            max_features: '{{maxFeatures}}',
            ngram_range: '1,2',
            sublinear_tf: true,
          },
        },
        {
          id: 'split',
          type: 'lifecycle.split',
          position: { x: 740, y: 160 },
          config: {
            train_pct: 80,
            val_pct: 20,
            test_pct: 0,
            shuffle: true,
          },
        },
        {
          id: 'model',
          type: 'lifecycle.core.model_builder',
          position: { x: 1060, y: 80 },
          config: {
            family: 'multinomial_nb',
            alpha: 1.0,
          },
        },
        {
          id: 'objective',
          type: 'lifecycle.core.objective',
          position: { x: 1060, y: 260 },
          config: {
            objective_type: 'supervised',
            loss: 'auto',
            primary_metric: 'accuracy',
          },
        },
        {
          id: 'trainer',
          type: 'lifecycle.core.trainer',
          position: { x: 1380, y: 160 },
          config: {
            epochs: 10,
            optimizer: 'auto',
            learning_rate: 0.01,
          },
        },
      ],
      edges: [
        { source: 'dataset', target: 'tfidf', sourceHandle: 'features', targetHandle: 'in' },
        { source: 'tfidf', target: 'split', sourceHandle: 'out', targetHandle: 'dataset' },
        { source: 'split', target: 'model', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'model', target: 'objective', sourceHandle: 'model', targetHandle: 'model' },
        { source: 'model', target: 'trainer', sourceHandle: 'model', targetHandle: 'model' },
        { source: 'split', target: 'trainer', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'split', target: 'trainer', sourceHandle: 'val', targetHandle: 'val_data' },
        { source: 'objective', target: 'trainer', sourceHandle: 'loss', targetHandle: 'objective' },
      ],
    },
  },
  {
    id: 'builtin.type-aware-routing',
    name: 'Type-Aware Routing (CSV -> Type Switch -> If/Else)',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    parameters: [
      {
        name: 'datasetPath',
        required: false,
        type: 'string',
        defaultValue: './data/uploads/sample.csv',
        description: 'Path to CSV dataset',
      },
      {
        name: 'ifCondition',
        required: false,
        type: 'string',
        defaultValue: 'item.get("value", 0) > 0',
        description: 'Condition used by If / Else primitive',
      },
    ],
    graph: {
      nodes: [
        {
          id: 'dataset',
          type: 'dataset.csv',
          config: {
            path: '{{datasetPath}}',
          },
        },
        {
          id: 'switch',
          type: 'transform.program.type_switch',
          config: {
            type_field: '',
            fallback_type: 'fallback',
          },
        },
        {
          id: 'ifelse',
          type: 'transform.program.if_else',
          config: {
            condition: '{{ifCondition}}',
            mode: 'split',
          },
        },
      ],
      edges: [
        { source: 'dataset', target: 'switch', sourceHandle: 'features', targetHandle: 'in' },
        { source: 'switch', target: 'ifelse', sourceHandle: 'fallback', targetHandle: 'in' },
      ],
    },
  },
  {
    id: 'builtin.join-two-csv',
    name: 'Join Two CSVs',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    parameters: [
      {
        name: 'leftPath',
        required: false,
        type: 'string',
        defaultValue: './data/uploads/left.csv',
      },
      {
        name: 'rightPath',
        required: false,
        type: 'string',
        defaultValue: './data/uploads/right.csv',
      },
      {
        name: 'joinKey',
        required: false,
        type: 'string',
        defaultValue: 'id',
      },
    ],
    graph: {
      nodes: [
        { id: 'left', type: 'dataset.csv', config: { path: '{{leftPath}}' } },
        { id: 'right', type: 'dataset.csv', config: { path: '{{rightPath}}' } },
        {
          id: 'join',
          type: 'transform.core.join',
          config: {
            strategy: 'merge_by_key',
            key: '{{joinKey}}',
            axis: 0,
          },
        },
      ],
      edges: [
        { source: 'left', target: 'join', sourceHandle: 'features', targetHandle: 'left' },
        { source: 'right', target: 'join', sourceHandle: 'features', targetHandle: 'right' },
      ],
    },
  },
  {
    id: 'builtin.api-tabular-starter',
    name: 'API Product Price Regression (API -> Split -> Trainer)',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    parameters: [
      { name: 'endpointUrl', required: false, type: 'string', defaultValue: 'https://dummyjson.com/products?limit=100', description: 'Public JSON API endpoint returning records' },
      { name: 'dataPath', required: false, type: 'string', defaultValue: 'products', description: 'Dot path to the records array' },
      { name: 'targetColumn', required: false, type: 'string', defaultValue: 'price', description: 'Numeric field to predict' },
    ],
    graph: {
      nodes: [
        { id: 'api', type: 'dataset.api', position: { x: 100, y: 180 }, config: {
          url: '{{endpointUrl}}', method: 'GET', data_path: '{{dataPath}}', pagination: false,
          target_column: '{{targetColumn}}', feature_keys: ['rating', 'stock', 'discountPercentage', 'minimumOrderQuantity'], flatten: true,
        } },
        { id: 'split', type: 'lifecycle.split', position: { x: 500, y: 180 }, config: { train_pct: 70, val_pct: 20, test_pct: 10, shuffle: true } },
        { id: 'model', type: 'lifecycle.core.model_builder', position: { x: 830, y: 90 }, config: { family: 'linear_regression', num_outputs: 1 } },
        { id: 'objective', type: 'lifecycle.core.objective', position: { x: 830, y: 270 }, config: { objective_type: 'supervised', loss: 'auto', primary_metric: 'r2' } },
        { id: 'trainer', type: 'lifecycle.core.trainer', position: { x: 1160, y: 180 }, config: { epochs: 10, optimizer: 'auto', learning_rate: 0.01 } },
      ],
      edges: [
        { source: 'api', target: 'split', sourceHandle: 'out', targetHandle: 'dataset' },
        { source: 'split', target: 'model', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'model', target: 'objective', sourceHandle: 'model', targetHandle: 'model' },
        { source: 'model', target: 'trainer', sourceHandle: 'model', targetHandle: 'model' },
        { source: 'split', target: 'trainer', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'split', target: 'trainer', sourceHandle: 'val', targetHandle: 'val_data' },
        { source: 'objective', target: 'trainer', sourceHandle: 'loss', targetHandle: 'objective' },
      ],
    },
  },
];

export function getBuiltinTemplateById(templateId) {
  return BUILTIN_PIPELINE_TEMPLATES.find((template) => template.id === templateId);
}
