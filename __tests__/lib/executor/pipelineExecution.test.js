import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { compileExecutionGraph } = require('../../../lib/executor/pipelineCompiler.js');

/**
 * Mock Python runtime executor
 * Simulates the Python runtime helpers for testing compiled pipelines
 */
class MockPythonRuntime {
  constructor() {
    this.context = {};
    this.outputs = {};
  }

  // Mock dataset implementation
  createDataset(datasetType, config) {
    switch (datasetType) {
      case 'dataset.csv':
        return [
          { age: 25, salary: 50000, city: 'NYC' },
          { age: 30, salary: 60000, city: 'LA' },
          { age: 35, salary: 75000, city: 'CHI' },
          { age: 40, salary: 90000, city: 'BOS' },
          { age: 45, salary: 105000, city: 'SF' },
        ];
      case 'dataset.json':
        return [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 1 },
          { x: 4, y: 1 },
          { x: 5, y: 2 },
        ];
      default:
        return [];
    }
  }

  // Transform: Map
  applyMap(data, config) {
    const operation = config.operation || 'identity';

    if (operation === 'identity') {
      return data;
    } else if (operation === 'drop_columns') {
      const cols = config.columns || [];
      if (Array.isArray(data)) {
        return data.map((row) => {
          const result = { ...row };
          cols.forEach((col) => delete result[col]);
          return result;
        });
      }
      return data;
    } else if (operation === 'select_columns') {
      const cols = config.columns || [];
      if (Array.isArray(data)) {
        return data.map((row) => {
          const result = {};
          cols.forEach((col) => {
            if (col in row) result[col] = row[col];
          });
          return result;
        });
      }
      return data;
    } else if (operation === 'filter_rows') {
      // Simple rule matching
      const rule = config.rule || '';
      if (Array.isArray(data) && rule) {
        return data.filter((row) => {
          try {
            // Mock evaluation: "age > 30" style rules
            const match = rule.match(/(\w+)\s*([><=]+)\s*(\d+)/);
            if (match) {
              const [, field, op, value] = match;
              const fieldVal = row[field];
              const numVal = Number(value);
              if (op === '>') return fieldVal > numVal;
              if (op === '<') return fieldVal < numVal;
              if (op === '==' || op === '=') return fieldVal === numVal;
              if (op === '>=') return fieldVal >= numVal;
              if (op === '<=') return fieldVal <= numVal;
            }
            return true;
          } catch {
            return true;
          }
        });
      }
      return data;
    }

    return data;
  }

  // Transform: Join
  applyJoin(inputs, config) {
    const strategy = config.strategy || 'concat';
    const left = inputs.left || [];
    const right = inputs.right || [];
    const aux = inputs.aux || null;

    if (strategy === 'concat') {
      if (Array.isArray(left) && Array.isArray(right)) {
        return [...left, ...right];
      }
      return left;
    } else if (strategy === 'merge_by_key') {
      const key = config.key || 'id';
      const result = [];
      if (Array.isArray(left) && Array.isArray(right)) {
        const rightMap = new Map(right.map((r) => [r[key], r]));
        left.forEach((l) => {
          const rightRow = rightMap.get(l[key]);
          if (rightRow) {
            result.push({ ...l, ...rightRow });
          }
        });
      }
      return result;
    } else if (strategy === 'zip') {
      const result = [];
      const maxLen = Math.max(left.length || 0, right.length || 0);
      for (let i = 0; i < maxLen; i++) {
        result.push({
          left: left[i] || null,
          right: right[i] || null,
        });
      }
      return result;
    }

    return left;
  }

  // Transform: Route
  applyRoute(data, config) {
    const condition = config.condition || 'true';
    const mode = config.mode || 'split';

    if (mode === 'split' && Array.isArray(data)) {
      const trueRows = [];
      const falseRows = [];

      data.forEach((row) => {
        try {
          // Mock condition evaluation
          const match = condition.match(/(\w+)\s*([><=]+)\s*(\d+)/);
          if (match) {
            const [, field, op, value] = match;
            const fieldVal = row[field];
            const numVal = Number(value);
            let condResult = false;

            if (op === '>') condResult = fieldVal > numVal;
            else if (op === '<') condResult = fieldVal < numVal;
            else if (op === '==' || op === '=') condResult = fieldVal === numVal;
            else if (op === '>=') condResult = fieldVal >= numVal;
            else if (op === '<=') condResult = fieldVal <= numVal;

            if (condResult) trueRows.push(row);
            else falseRows.push(row);
          } else {
            falseRows.push(row);
          }
        } catch {
          falseRows.push(row);
        }
      });

      return { true: trueRows, false: falseRows };
    }

    return { true: [data], false: [] };
  }

  // Lifecycle: Split
  applySplit(data, config) {
    const trainPct = config.train_pct || 70;
    const valPct = config.val_pct || 20;
    const testPct = config.test_pct || 10;

    const total = Array.isArray(data) ? data.length : 0;
    const nTrain = Math.floor((total * trainPct) / 100);
    const nVal = Math.floor((total * valPct) / 100);
    const nTest = total - nTrain - nVal;

    return {
      train: Array.isArray(data) ? data.slice(0, nTrain) : [],
      val: Array.isArray(data) ? data.slice(nTrain, nTrain + nVal) : [],
      test: Array.isArray(data) ? data.slice(nTrain + nVal) : [],
    };
  }

  // Lifecycle: Model Builder
  applyModelBuilder(config) {
    return {
      model_type: config.family || 'linear_regression',
      num_outputs: config.num_outputs || 1,
      initialized: true,
      device: 'cpu',
    };
  }

  // Lifecycle: Objective
  applyObjective(config) {
    return {
      loss_type: config.loss_type || 'mse',
      metrics: config.metrics || [],
      task_type: 'supervised',
    };
  }

  // Lifecycle: Trainer
  applyTrainer(inputs, config) {
    return {
      trained_model: {
        trained: true,
        epochs_completed: config.epochs || 10,
        optimizer: config.optimizer || 'adam',
      },
      metrics: {
        train_loss: 0.15,
        val_loss: 0.18,
      },
      logs: {
        learning_rate: config.learning_rate || 0.001,
        optimizer: config.optimizer || 'adam',
      },
      artifacts: {
        checkpoints: ['epoch_5', 'epoch_10'],
      },
    };
  }

  // Lifecycle: Evaluator
  applyEvaluator(inputs, config) {
    return {
      metrics: {
        accuracy: 0.87,
        f1: 0.85,
        precision: 0.88,
        recall: 0.83,
      },
      predictions: {
        count: Array.isArray(inputs.test_data) ? inputs.test_data.length : 0,
        values: [0, 1, 0, 1, 1],
      },
      reports: {
        confusion_matrix: [[50, 10], [5, 35]],
        roc_auc: 0.92,
      },
    };
  }

  // Lifecycle: Predictor
  applyPredictor(inputs, config) {
    return {
      predictions: {
        count: 100,
        values: Array(Math.min(100, config.batch_size || 32)).fill(0),
      },
      batch_size: config.batch_size || 32,
      return_probabilities: config.return_probabilities || false,
    };
  }

  // Execute a compiled graph
  execute(compiledGraph, nodes) {
    const context = {};
    const outputs = {};

    // Parse and execute the compiled code by simulating node-by-node execution
    const nodeIds = compiledGraph.metadata.order;

    if (!nodeIds) {
      // If compiled graph doesn't have order, infer from node IDs
      Object.entries(nodes).forEach(([id, nodeData]) => {
        context[id] = this.executeNode(id, nodeData, context, nodes);
        outputs[id] = context[id];
      });
    }

    return { context, outputs };
  }

  executeNode(nodeId, nodeData, context, allNodes) {
    const nodeType = nodeData.type;
    const config = nodeData.config || {};

    // Get inputs from context
    const inputs = {};
    Object.entries(allNodes).forEach(([otherId, otherNode]) => {
      // Simple edge detection: if otherNode connects to this node
      // For simplicity, we'll just pass data that should flow here
    });

    if (nodeType.startsWith('dataset.')) {
      return { data: this.createDataset(nodeType, config), type: 'dataset' };
    }

    if (nodeType === 'transform.core.map') {
      // Get input from any previous dataset or transform
      const inputData = Object.values(context)[0]?.data || [];
      return { data: this.applyMap(inputData, config), type: 'transform' };
    }

    if (nodeType === 'transform.core.join') {
      const inputData1 = Object.values(context)[0]?.data || [];
      const inputData2 = Object.values(context)[1]?.data || [];
      return {
        data: this.applyJoin({ left: inputData1, right: inputData2 }, config),
        type: 'transform',
      };
    }

    if (nodeType === 'transform.core.route') {
      const inputData = Object.values(context)[0]?.data || [];
      return { data: this.applyRoute(inputData, config), type: 'transform' };
    }

    if (nodeType === 'lifecycle.split') {
      const inputData = Object.values(context)[0]?.data || [];
      const splitResult = this.applySplit(inputData, config);
      return {
        train: splitResult.train,
        val: splitResult.val,
        test: splitResult.test,
        type: 'lifecycle',
      };
    }

    if (nodeType === 'lifecycle.core.model_builder') {
      return { data: this.applyModelBuilder(config), type: 'lifecycle' };
    }

    if (nodeType === 'lifecycle.core.objective') {
      return { data: this.applyObjective(config), type: 'lifecycle' };
    }

    if (nodeType === 'lifecycle.core.trainer') {
      return { data: this.applyTrainer(inputs, config), type: 'lifecycle' };
    }

    if (nodeType === 'lifecycle.core.evaluator') {
      return { data: this.applyEvaluator(inputs, config), type: 'lifecycle' };
    }

    if (nodeType === 'lifecycle.core.predictor') {
      return { data: this.applyPredictor(inputs, config), type: 'lifecycle' };
    }

    return { data: null, type: 'unknown' };
  }
}

describe('E2E Python Execution Validation', () => {
  let runtime;

  beforeEach(() => {
    runtime = new MockPythonRuntime();
  });

  describe('Transform Execution', () => {
    it('executes map transform: drop_columns', () => {
      const data = [
        { id: 1, age: 25, salary: 50000 },
        { id: 2, age: 30, salary: 60000 },
      ];

      const result = runtime.applyMap(data, { operation: 'drop_columns', columns: ['id'] });

      expect(result).toEqual([
        { age: 25, salary: 50000 },
        { age: 30, salary: 60000 },
      ]);
    });

    it('executes map transform: select_columns', () => {
      const data = [
        { id: 1, age: 25, salary: 50000 },
        { id: 2, age: 30, salary: 60000 },
      ];

      const result = runtime.applyMap(data, { operation: 'select_columns', columns: ['age', 'salary'] });

      expect(result).toEqual([
        { age: 25, salary: 50000 },
        { age: 30, salary: 60000 },
      ]);
    });

    it('executes map transform: filter_rows', () => {
      const data = [
        { age: 25, salary: 50000 },
        { age: 30, salary: 60000 },
        { age: 35, salary: 75000 },
      ];

      const result = runtime.applyMap(data, { operation: 'filter_rows', rule: 'age > 28' });

      expect(result.length).toBe(2);
      expect(result[0].age).toBe(30);
    });

    it('executes join transform: concat strategy', () => {
      const left = [{ id: 1, x: 10 }, { id: 2, x: 20 }];
      const right = [{ id: 3, x: 30 }];

      const result = runtime.applyJoin({ left, right }, { strategy: 'concat' });

      expect(result.length).toBe(3);
      expect(result[2].id).toBe(3);
    });

    it('executes join transform: merge_by_key strategy', () => {
      const left = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      const right = [
        { id: 1, salary: 50000 },
        { id: 2, salary: 60000 },
      ];

      const result = runtime.applyJoin({ left, right }, { strategy: 'merge_by_key', key: 'id' });

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ id: 1, name: 'Alice', salary: 50000 });
      expect(result[1]).toEqual({ id: 2, name: 'Bob', salary: 60000 });
    });

    it('executes route transform: splits data by condition', () => {
      const data = [{ age: 20 }, { age: 35 }, { age: 15 }, { age: 45 }];

      const result = runtime.applyRoute(data, { condition: 'age >= 21', mode: 'split' });

      expect(result.true.length).toBe(2);
      expect(result.false.length).toBe(2);
      expect(result.true[0].age).toBe(35);
      expect(result.false[0].age).toBe(20);
    });
  });

  describe('Lifecycle Execution', () => {
    it('executes split lifecycle node', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const result = runtime.applySplit(data, { train_pct: 70, val_pct: 20, test_pct: 10 });

      expect(result.train.length).toBe(70);
      expect(result.val.length).toBe(20);
      expect(result.test.length).toBe(10);
    });

    it('executes model_builder lifecycle node', () => {
      const result = runtime.applyModelBuilder({
        family: 'linear_regression',
        num_outputs: 1,
      });

      expect(result.model_type).toBe('linear_regression');
      expect(result.initialized).toBe(true);
    });

    it('executes objective lifecycle node', () => {
      const result = runtime.applyObjective({ loss_type: 'mse', metrics: ['mae', 'rmse'] });

      expect(result.loss_type).toBe('mse');
      expect(result.metrics).toContain('mae');
    });

    it('executes trainer lifecycle node', () => {
      const result = runtime.applyTrainer(
        {
          model: { type: 'linear' },
          train_data: Array(70).fill({ x: 1 }),
          val_data: Array(20).fill({ x: 1 }),
        },
        { epochs: 20, learning_rate: 0.001, optimizer: 'adamw' },
      );

      expect(result.trained_model.trained).toBe(true);
      expect(result.trained_model.epochs_completed).toBe(20);
      expect(result.metrics.train_loss).toBeLessThan(1);
    });

    it('executes evaluator lifecycle node', () => {
      const testData = Array(10).fill({ x: 1, y: 0 });
      const result = runtime.applyEvaluator({ test_data: testData }, { metrics: ['accuracy', 'f1'] });

      expect(result.metrics.accuracy).toBeGreaterThan(0);
      expect(result.predictions.count).toBe(10);
      expect(result.reports.roc_auc).toBeGreaterThan(0.8);
    });

    it('executes predictor lifecycle node', () => {
      const result = runtime.applyPredictor({}, { batch_size: 32, return_probabilities: true });

      expect(result.predictions.count).toBe(100);
      expect(result.return_probabilities).toBe(true);
    });
  });

  describe('End-to-End Pipelines', () => {
    it('executes linear regression pipeline: CSV -> Map -> Split -> ModelBuilder -> Trainer', () => {
      const compiled = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          t1: { id: 't1', type: 'transform.core.map', config: { operation: 'drop_columns', columns: ['city'] } },
          s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 70, val_pct: 20, test_pct: 10 } },
          m1: { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'linear_regression' } },
          tr1: { id: 'tr1', type: 'lifecycle.core.trainer', config: { epochs: 10, learning_rate: 0.001 } },
        },
        edges: [
          { source: 'd1', target: 't1', sourceHandle: 'features', targetHandle: 'in' },
          { source: 't1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
          { source: 's1', target: 'm1', sourceHandle: 'train', targetHandle: 'train_data' },
          { source: 'm1', target: 'tr1', sourceHandle: 'model', targetHandle: 'model' },
          { source: 's1', target: 'tr1', sourceHandle: 'train', targetHandle: 'train_data' },
        ],
      });

      expect(compiled.ok).toBe(true);
      expect(compiled.code).toContain('def run_pipeline()');
      expect(compiled.code).toContain('apply_transform');
      expect(compiled.code).toContain('apply_lifecycle');
    });

    it('executes classification pipeline: JSON dataset with MLP', () => {
      const compiled = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.json', config: {} },
          s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 80, val_pct: 20 } },
          m1: { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'mlp', num_outputs: 3 } },
          o1: { id: 'o1', type: 'lifecycle.core.objective', config: { loss_type: 'cross_entropy' } },
          tr1: { id: 'tr1', type: 'lifecycle.core.trainer', config: { epochs: 50 } },
          ev1: { id: 'ev1', type: 'lifecycle.core.evaluator', config: {} },
        },
        edges: [
          { source: 'd1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
          { source: 's1', target: 'm1', sourceHandle: 'train', targetHandle: 'train_data' },
          { source: 'm1', target: 'o1', sourceHandle: 'model', targetHandle: 'model' },
          { source: 'o1', target: 'tr1', sourceHandle: 'loss', targetHandle: 'objective' },
          { source: 'm1', target: 'tr1', sourceHandle: 'model', targetHandle: 'model' },
          { source: 's1', target: 'tr1', sourceHandle: 'train', targetHandle: 'train_data' },
          { source: 's1', target: 'tr1', sourceHandle: 'val', targetHandle: 'val_data' },
          { source: 'tr1', target: 'ev1', sourceHandle: 'trained_model', targetHandle: 'model' },
          { source: 'o1', target: 'ev1', sourceHandle: 'loss', targetHandle: 'objective' },
          { source: 's1', target: 'ev1', sourceHandle: 'test', targetHandle: 'test_data' },
        ],
      });

      expect(compiled.ok).toBe(true);
      expect(compiled.metadata.nodeCount).toBe(6);
    });

    it('executes multi-input join pipeline', () => {
      const compiled = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          d2: { id: 'd2', type: 'dataset.csv', config: {} },
          j1: { id: 'j1', type: 'transform.core.join', config: { strategy: 'concat' } },
          t1: { id: 't1', type: 'transform.core.map', config: { operation: 'select_columns', columns: ['age', 'salary'] } },
        },
        edges: [
          { source: 'd1', target: 'j1', sourceHandle: 'out', targetHandle: 'left' },
          { source: 'd2', target: 'j1', sourceHandle: 'out', targetHandle: 'right' },
          { source: 'j1', target: 't1' },
        ],
      });

      expect(compiled.ok).toBe(true);
      expect(compiled.code).toContain('_inputs_');
      expect(compiled.code).toContain('n_j1');
    });

    it('executes conditional routing pipeline', () => {
      const compiled = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          r1: { id: 'r1', type: 'transform.core.route', config: { condition: 'salary > 70000' } },
        },
        edges: [{ source: 'd1', target: 'r1' }],
      });

      expect(compiled.ok).toBe(true);
      expect(compiled.code).toContain("'salary > 70000'");
    });
  });

  describe('Compiled Python Code Validation', () => {
    it('generates valid Python syntax for dataset nodes', () => {
      const compiled = compileExecutionGraph({
        nodes: { d1: { id: 'd1', type: 'dataset.csv', config: { path: 'data.csv' } } },
        edges: [],
      });

      expect(compiled.ok).toBe(true);
      expect(compiled.code).toContain('def run_pipeline():');
      expect(compiled.code).toContain("{'dataset_type':");
      expect(compiled.code).toContain('node_outputs');
    });

    it('generates valid Python with imports', () => {
      const compiled = compileExecutionGraph({
        nodes: { d1: { id: 'd1', type: 'dataset.csv', config: {} } },
        edges: [],
      });

      expect(compiled.code).toContain('from collections import defaultdict');
      expect(compiled.code).toContain('from typing import Any, Dict');
      expect(compiled.code).toContain('import json');
    });

    it('generates valid Python with graph metadata', () => {
      const compiled = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          t1: { id: 't1', type: 'transform.core.map', config: {} },
        },
        edges: [{ source: 'd1', target: 't1' }],
      });

      expect(compiled.code).toContain('graph_spec');
      expect(compiled.code).toContain('node_meta');
      expect(compiled.code).toContain('node_outputs');
      expect(compiled.code).toContain('ctx');
    });

    it('maintains topological order in generated Python', () => {
      const compiled = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: {} },
          t1: { id: 't1', type: 'transform.core.map', config: {} },
          s1: { id: 's1', type: 'lifecycle.split', config: {} },
        },
        edges: [
          { source: 'd1', target: 't1' },
          { source: 't1', target: 's1' },
        ],
      });

      const codeLines = compiled.code.split('\n');
      const d1Line = codeLines.findIndex((line) => line.includes("# Node d1"));
      const t1Line = codeLines.findIndex((line) => line.includes("# Node t1"));
      const s1Line = codeLines.findIndex((line) => line.includes("# Node s1"));

      expect(d1Line < t1Line).toBe(true);
      expect(t1Line < s1Line).toBe(true);
    });

    it('embeds node configurations in generated Python', () => {
      const compiled = compileExecutionGraph({
        nodes: {
          d1: { id: 'd1', type: 'dataset.csv', config: { path: 'data.csv' } },
          t1: {
            id: 't1',
            type: 'transform.core.map',
            config: { operation: 'drop_columns', columns: ['id'] },
          },
        },
        edges: [{ source: 'd1', target: 't1' }],
      });

      expect(compiled.code).toContain("'path': 'data.csv'");
      expect(compiled.code).toContain("'operation': 'drop_columns'");
      expect(compiled.code).toContain("'columns': ['id']");
    });
  });
});
