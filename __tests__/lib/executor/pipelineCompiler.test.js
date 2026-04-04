import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { compileExecutionGraph } = require('../../../lib/executor/pipelineCompiler.js');
const { generateTransformPythonCode } = require('../../../lib/pythonTemplates/transformNodeTemplate.js');
const { generateLifecyclePythonCode } = require('../../../lib/pythonTemplates/lifecycleNodeTemplate.js');

describe('Pipeline Compiler & Template Generation', () => {
  describe('Transform Python Code Generation', () => {
    it('generates Python code for transform.core.map operation', () => {
      const config = { operation: 'drop_columns', columns: ['salary'] };
      const code = generateTransformPythonCode('transform.core.map', config);

      expect(code).toContain('def apply_map(x):');
      expect(code).toContain('operation == "drop_columns"');
      expect(code).toContain('preserve_schema');
    });

    it('generates Python code for transform.core.join operation', () => {
      const config = { strategy: 'concat', key: '' };
      const code = generateTransformPythonCode('transform.core.join', config);

      expect(code).toContain('def apply_join(left, right, aux=None):');
      expect(code).toContain('strategy == "concat"');
    });

    it('generates Python code for transform.core.route operation', () => {
      const config = { condition: 'age > 18', mode: 'split' };
      const code = generateTransformPythonCode('transform.core.route', config);

      expect(code).toContain('def apply_route(x):');
      expect(code).toContain('eval(condition)');
      expect(code).toContain('result["true"]');
      expect(code).toContain('result["false"]');
    });

    it('returns fallback code for unknown transform', () => {
      const code = generateTransformPythonCode('transform.unknown', {});

      expect(code).toContain('Unknown transform');
      expect(code).toContain('def apply_unknown(x):');
    });

    it('map operation includes all supported operations', () => {
      const config = { operation: 'select_columns' };
      const code = generateTransformPythonCode('transform.core.map', config);

      expect(code).toContain('select_columns');
      expect(code).toContain('drop_columns');
      expect(code).toContain('filter_rows');
      expect(code).toContain('tokenize');
      expect(code).toContain('normalize');
      expect(code).toContain('custom');
    });
  });

  describe('Lifecycle Python Code Generation', () => {
    it('generates Python code for lifecycle.split', () => {
      const config = { train_pct: 70, val_pct: 20, test_pct: 10, shuffle: true };
      const code = generateLifecyclePythonCode('lifecycle.split', config);

      expect(code).toContain('def apply_split(dataset):');
      expect(code).toContain('train_pct');
      expect(code).toContain('val_pct');
      expect(code).toContain('test_pct');
    });

    it('generates Python code for lifecycle.batch_loader', () => {
      const config = { batch_size: 32, shuffle: true };
      const code = generateLifecyclePythonCode('lifecycle.batch_loader', config);

      expect(code).toContain('def apply_batch_loader(dataset):');
      expect(code).toContain('batch_size');
      expect(code).toContain('num_batches');
    });

    it('generates Python code for lifecycle.core.model_builder', () => {
      const config = { family: 'linear_regression', num_outputs: 1, pretrained: false };
      const code = generateLifecyclePythonCode('lifecycle.core.model_builder', config);

      expect(code).toContain('def apply_model_builder(train_data=None):');
      expect(code).toContain('model_type');
      expect(code).toContain('num_outputs');
    });

    it('generates Python code for lifecycle.core.objective', () => {
      const config = { loss_type: 'mse', metrics: ['mae'] };
      const code = generateLifecyclePythonCode('lifecycle.core.objective', config);

      expect(code).toContain('def apply_objective():');
      expect(code).toContain('loss_type');
      expect(code).toContain('metrics');
    });

    it('generates Python code for lifecycle.core.trainer', () => {
      const config = { epochs: 10, learning_rate: 0.001, optimizer: 'adam' };
      const code = generateLifecyclePythonCode('lifecycle.core.trainer', config);

      expect(code).toContain('def apply_trainer(model, objective, train_data=None, val_data=None):');
      expect(code).toContain('epochs');
      expect(code).toContain('learning_rate');
    });

    it('generates Python code for lifecycle.core.evaluator', () => {
      const config = { metrics: ['accuracy', 'f1'] };
      const code = generateLifecyclePythonCode('lifecycle.core.evaluator', config);

      expect(code).toContain('def apply_evaluator(model, objective, test_data=None):');
      expect(code).toContain('metrics');
      expect(code).toContain('predictions');
    });

    it('generates Python code for lifecycle.core.predictor', () => {
      const config = { batch_size: 32, return_probabilities: false };
      const code = generateLifecyclePythonCode('lifecycle.core.predictor', config);

      expect(code).toContain('def apply_predictor(model, test_data=None):');
      expect(code).toContain('batch_size');
      expect(code).toContain('probabilities');
    });

    it('returns fallback code for unknown lifecycle node', () => {
      const code = generateLifecyclePythonCode('lifecycle.unknown', {});

      expect(code).toContain('Unknown lifecycle node');
      expect(code).toContain('def apply_lifecycle_node(inputs=None):');
    });
  });

  describe('Pipeline Compiler', () => {
    it('compiles empty graph with error', () => {
      const result = compileExecutionGraph({ nodes: {}, edges: [] });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('Graph is empty. Add at least one dataset node.');
    });

    it('compiles graph without dataset source with error', () => {
      const result = compileExecutionGraph({
        nodes: { n1: { id: 'n1', type: 'transform.core.map', config: {} } },
        edges: [],
      });

      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('No dataset source node found');
    });

    it('compiles simple CSV dataset node', () => {
      const result = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: { path: 'test.csv' } },
        },
        edges: [],
      });

      expect(result.ok).toBe(true);
      expect(result.code).toContain('def run_pipeline():');
      expect(result.code).toContain('dataset.csv');
      expect(result.metadata.nodeCount).toBe(1);
    });

    it('compiles dataset -> map transform flow', () => {
      const result = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          t1: { id: 't1', type: 'transform.core.map', config: { operation: 'drop_columns' } },
        },
        edges: [{ source: 'd1', target: 't1', sourceHandle: 'out', targetHandle: 'in' }],
      });

      expect(result.ok).toBe(true);
      expect(result.code).toContain('apply_transform');
      expect(result.code).toContain('transform.core.map');
      expect(result.metadata.nodeCount).toBe(2);
    });

    it('compiles dataset -> split -> model_builder flow', () => {
      const result = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 70, val_pct: 20, test_pct: 10 } },
          m1: { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'linear_regression' } },
        },
        edges: [
          { source: 'd1', target: 's1' },
          { source: 's1', target: 'm1' },
        ],
      });

      expect(result.ok).toBe(true);
      expect(result.code).toContain('apply_lifecycle');
      expect(result.code).toContain('lifecycle.split');
      expect(result.code).toContain('lifecycle.core.model_builder');
      expect(result.metadata.nodeCount).toBe(3);
    });

    it('detects cycles in graph', () => {
      const result = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          t1: { id: 't1', type: 'transform.core.map', config: {} },
          t2: { id: 't2', type: 'transform.core.map', config: {} },
        },
        edges: [
          { source: 'd1', target: 't1' },
          { source: 't1', target: 't2' },
          { source: 't2', target: 't1' }, // creates cycle
        ],
      });

      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('Graph contains a cycle');
    });

    it('generates Python with correct topological order', () => {
      const result = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          t1: { id: 't1', type: 'transform.core.map', config: {} },
          t2: { id: 't2', type: 'transform.core.map', config: {} },
        },
        edges: [
          { source: 'd1', target: 't1' },
          { source: 't1', target: 't2' },
        ],
      });

      expect(result.ok).toBe(true);
      const d1Index = result.code.indexOf('d1');
      const t1Index = result.code.indexOf('t1');
      const t2Index = result.code.indexOf('t2');

      expect(d1Index < t1Index).toBe(true);
      expect(t1Index < t2Index).toBe(true);
    });

    it('compiles join with multiple inputs', () => {
      const result = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          d2: { id: 'd2', type: 'dataset.csv', config: {} },
          j1: { id: 'j1', type: 'transform.core.join', config: { strategy: 'concat' } },
        },
        edges: [
          { source: 'd1', target: 'j1', sourceHandle: 'out', targetHandle: 'left' },
          { source: 'd2', target: 'j1', sourceHandle: 'out', targetHandle: 'right' },
        ],
      });

      expect(result.ok).toBe(true);
      expect(result.code).toContain('_inputs_');
      expect(result.code).toContain('apply_transform');
    });

    it('handles datasets with various types (json, csv, image, text)', () => {
      const datasetTypes = ['dataset.csv', 'dataset.json', 'dataset.image_folder', 'dataset.text'];

      datasetTypes.forEach((dsType) => {
        const result = compileExecutionGraph({
          nodes: {
            d1: { id: 'd1', type: dsType, config: {} },
          },
          edges: [],
        });

        expect(result.ok).toBe(true);
        expect(result.code).toContain(dsType);
      });
    });

    it('preserves node metadata in compiled code', () => {
      const result = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: { path: 'data.csv' } },
        },
        edges: [],
      });

      expect(result.ok).toBe(true);
      expect(result.code).toContain("'type': 'dataset.csv'");
      expect(result.code).toContain('node_meta');
    });
  });
});
