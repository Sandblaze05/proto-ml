import { describe, it, expect } from 'vitest';
import { BUILTIN_PIPELINE_TEMPLATES, getBuiltinTemplateById } from '../../lib/templates/builtinTemplates.js';
import { instantiatePipelineTemplate } from '../../lib/templates/pipelineTemplateService.js';

describe('builtinTemplates', () => {
  it('exposes at least one starter template', () => {
    expect(Array.isArray(BUILTIN_PIPELINE_TEMPLATES)).toBe(true);
    expect(BUILTIN_PIPELINE_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('resolves and instantiates the tabular starter template', () => {
    const template = getBuiltinTemplateById('builtin.tabular-starter');
    expect(template).toBeDefined();

    const instance = instantiatePipelineTemplate(template, {
      parameters: {
        datasetPath: '/tmp/train.csv',
      },
    });

    expect(instance.ok).toBe(true);
    expect(instance.graph.nodes.length).toBeGreaterThan(3);
    const datasetNode = instance.graph.nodes.find((node) => node.id === 'dataset');
    expect(datasetNode?.config.path).toBe('/tmp/train.csv');
  });
});
