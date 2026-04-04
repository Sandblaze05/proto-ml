import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_SCHEMA_VERSION,
  validatePipelineTemplate,
  instantiatePipelineTemplate,
  mergeTemplateSources,
} from '../../lib/templates/pipelineTemplateService.js';

const baseTemplate = {
  id: 'tabular-train-v1',
  name: 'Tabular Training Starter',
  schemaVersion: TEMPLATE_SCHEMA_VERSION,
  parameters: [
    { name: 'datasetPath', required: true, type: 'string' },
    { name: 'batchSize', required: false, type: 'number', defaultValue: 32 },
  ],
  graph: {
    nodes: [
      {
        id: 'dataset',
        type: 'dataset.csv',
        config: {
          path: '{{datasetPath}}',
          batch_size: '{{batchSize}}',
          label_column: 'target',
        },
      },
      {
        id: 'split',
        type: 'lifecycle.split',
        config: {
          train_pct: 80,
          note: 'source={{datasetPath}}',
        },
      },
    ],
    edges: [
      { source: 'dataset', target: 'split', sourceHandle: 'features', targetHandle: 'dataset' },
    ],
  },
};

describe('pipelineTemplateService', () => {
  it('validates a well-formed template', () => {
    const result = validatePipelineTemplate(baseTemplate);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('instantiates graph placeholders with provided/default parameters', () => {
    const result = instantiatePipelineTemplate(baseTemplate, {
      parameters: {
        datasetPath: '/data/train.csv',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.graph.nodes[0].config.path).toBe('/data/train.csv');
    expect(result.graph.nodes[0].config.batch_size).toBe(32);
    expect(result.graph.nodes[1].config.note).toBe('source=/data/train.csv');
    expect(result.unresolvedParameters).toEqual([]);
  });

  it('returns clear errors when required parameters are missing', () => {
    const result = instantiatePipelineTemplate(baseTemplate, { parameters: {} });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/missing required/i);
    expect(result.unresolvedParameters).toContain('datasetPath');
  });

  it('tracks unresolved placeholders that are not declared parameters', () => {
    const template = {
      ...baseTemplate,
      graph: {
        ...baseTemplate.graph,
        nodes: [
          ...baseTemplate.graph.nodes,
          {
            id: 'map',
            type: 'transform.core.map',
            config: { expression: '{{unknownParam}}' },
          },
        ],
      },
    };

    const result = instantiatePipelineTemplate(template, {
      parameters: { datasetPath: '/tmp/a.csv' },
    });

    expect(result.ok).toBe(true);
    expect(result.unresolvedParameters).toContain('unknownParam');
    expect(result.graph.nodes[2].config.expression).toBe('{{unknownParam}}');
  });

  it('merges template sources with DB override precedence', () => {
    const repoTemplates = [
      { id: 'a', name: 'Repo A' },
      { id: 'b', name: 'Repo B' },
    ];
    const dbTemplates = [
      { id: 'b', name: 'DB B' },
      { id: 'c', name: 'DB C' },
    ];

    const merged = mergeTemplateSources(repoTemplates, dbTemplates);
    expect(merged).toHaveLength(3);
    expect(merged.find((template) => template.id === 'b')?.name).toBe('DB B');
  });
});
