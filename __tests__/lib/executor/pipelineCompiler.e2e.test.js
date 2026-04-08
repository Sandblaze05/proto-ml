import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { compileExecutionGraph } = require('../../../lib/executor/pipelineCompiler.js');

describe('E2E Pipeline Compilation - Canonical Workflows', () => {
  it('compiles linear regression pipeline: CSV -> Map -> Split -> ModelBuilder -> Trainer -> Evaluator', () => {
    const result = compileExecutionGraph({
      nodes: {
        // Dataset
        d1: { id: 'd1', type: 'dataset.csv', config: { path: 'data.csv' } },
        
        // Transform: drop unnecessary columns
        t1: { id: 't1', type: 'transform.core.map', config: { operation: 'drop_columns', columns: ['id', 'name'] } },
        
        // Lifecycle: split into train/val/test
        s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 70, val_pct: 15, test_pct: 15 } },
        
        // Lifecycle: build linear regression model
        m1: { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'linear_regression', num_outputs: 1 } },
        
        // Lifecycle: define loss and metrics
        o1: { id: 'o1', type: 'lifecycle.core.objective', config: { loss_type: 'mse', metrics: ['mae'] } },
        
        // Lifecycle: train model
        tr1: { id: 'tr1', type: 'lifecycle.core.trainer', config: { epochs: 20, learning_rate: 0.001, optimizer: 'adamw' } },
        
        // Lifecycle: evaluate model
        e1: { id: 'e1', type: 'lifecycle.core.evaluator', config: { metrics: ['mse', 'mae'] } },
      },
      edges: [
        // CSV -> Map
        { source: 'd1', target: 't1', sourceHandle: 'out', targetHandle: 'in' },
        
        // Map -> Split
        { source: 't1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
        
        // Split outputs to ModelBuilder
        { source: 's1', target: 'm1', sourceHandle: 'train', targetHandle: 'train_data' },
        
        // ModelBuilder -> Objective
        { source: 'm1', target: 'o1', sourceHandle: 'model', targetHandle: 'model' },
        
        // Objective & ModelBuilder -> Trainer
        { source: 'o1', target: 'tr1', sourceHandle: 'loss', targetHandle: 'objective' },
        { source: 'm1', target: 'tr1', sourceHandle: 'model', targetHandle: 'model' },
        { source: 's1', target: 'tr1', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 's1', target: 'tr1', sourceHandle: 'val', targetHandle: 'val_data' },
        
        // Trainer -> Evaluator
        { source: 'tr1', target: 'e1', sourceHandle: 'trained_model', targetHandle: 'model' },
        { source: 'o1', target: 'e1', sourceHandle: 'loss', targetHandle: 'objective' },
        { source: 's1', target: 'e1', sourceHandle: 'test', targetHandle: 'test_data' },
      ],
    });

    // Validate compilation succeeded
    expect(result.ok).toBe(true);
    expect(result.code).toBeTruthy();
    expect(result.code).toContain('def run_pipeline():');
    expect(result.code).toContain('dataset.csv');
    expect(result.metadata.nodeCount).toBe(7);
    
    // Validate all node types are rendered
    expect(result.code).toContain('transform.core.map');
    expect(result.code).toContain('lifecycle.split');
    expect(result.code).toContain('lifecycle.core.model_builder');
    expect(result.code).toContain('lifecycle.core.objective');
    expect(result.code).toContain('lifecycle.core.trainer');
    expect(result.code).toContain('lifecycle.core.evaluator');
    
    // Validate execution order (topological sort)
    const d1Idx = result.code.indexOf('d1');
    const t1Idx = result.code.indexOf('t1');
    const s1Idx = result.code.indexOf('s1');
    const m1Idx = result.code.indexOf('m1');
    const tr1Idx = result.code.indexOf('tr1');
    const e1Idx = result.code.indexOf('e1');
    
    expect(d1Idx < t1Idx).toBe(true);
    expect(t1Idx < s1Idx).toBe(true);
    expect(s1Idx < m1Idx).toBe(true);
  });

  it('compiles multi-modal join pipeline: Join two CSV datasets', () => {
    const result = compileExecutionGraph({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: 'features.csv' } },
        d2: { id: 'd2', type: 'dataset.csv', config: { path: 'targets.csv' } },
        j1: { id: 'j1', type: 'transform.core.join', config: { strategy: 'merge_by_key', key: 'id' } },
      },
      edges: [
        { source: 'd1', target: 'j1', sourceHandle: 'out', targetHandle: 'left' },
        { source: 'd2', target: 'j1', sourceHandle: 'out', targetHandle: 'right' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toContain('transform.core.join');
    expect(result.code).toContain('_inputs_');
    expect(result.code).toContain('merge_by_key');
  });

  it('compiles route/conditional pipeline: Route data by condition', () => {
    const result = compileExecutionGraph({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: 'data.csv' } },
        r1: { id: 'r1', type: 'transform.core.route', config: { condition: 'age > 18', mode: 'split' } },
      },
      edges: [
        { source: 'd1', target: 'r1' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toContain('transform.core.route');
    expect(result.code).toContain('age > 18');
  });

  it('compiles classification pipeline: JSON dataset -> model classification', () => {
    const result = compileExecutionGraph({
      nodes: {
        d1: { id: 'd1', type: 'dataset.json', config: { path: 'data.json' } },
        s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 80, val_pct: 10, test_pct: 10 } },
        m1: { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'mlp', num_outputs: 3 } },
        o1: { id: 'o1', type: 'lifecycle.core.objective', config: { loss_type: 'cross_entropy', metrics: ['accuracy', 'f1'] } },
        tr1: { id: 'tr1', type: 'lifecycle.core.trainer', config: { epochs: 50, learning_rate: 0.0005 } },
        ev1: { id: 'ev1', type: 'lifecycle.core.evaluator', config: { metrics: ['accuracy', 'precision', 'recall'] } },
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

    expect(result.ok).toBe(true);
    expect(result.metadata.nodeCount).toBe(6);
    expect(result.code).toContain('mlp');
    expect(result.code).toContain('cross_entropy');
  });

  it('compiles prediction pipeline with predictor node', () => {
    const result = compileExecutionGraph({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: 'test_data.csv' } },
        m1: { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'linear_regression' } },
        tr1: { id: 'tr1', type: 'lifecycle.core.trainer', config: { epochs: 10 } },
        p1: { id: 'p1', type: 'lifecycle.core.predictor', config: { batch_size: 32, return_probabilities: true } },
      },
      edges: [
        { source: 'd1', target: 'm1', sourceHandle: 'out', targetHandle: 'train_data' },
        { source: 'm1', target: 'tr1', sourceHandle: 'model', targetHandle: 'model' },
        { source: 'd1', target: 'tr1', sourceHandle: 'out', targetHandle: 'train_data' },
        { source: 'tr1', target: 'p1', sourceHandle: 'trained_model', targetHandle: 'model' },
        { source: 'd1', target: 'p1', sourceHandle: 'out', targetHandle: 'test_data' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toContain('lifecycle.core.predictor');
    expect(result.code).toContain('return_probabilities');
  });
});
