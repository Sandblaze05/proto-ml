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
];

export function getBuiltinTemplateById(templateId) {
  return BUILTIN_PIPELINE_TEMPLATES.find((template) => template.id === templateId);
}
