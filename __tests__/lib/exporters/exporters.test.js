import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { AirflowExporter } = require('../../../lib/exporters/AirflowExporter.js');

describe('AirflowExporter', () => {
  const exporter = new AirflowExporter();

  it('exports a 3-node linear pipeline with correct params and wiring', () => {
    const result = exporter.export({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: './data.csv' } },
        t1: { id: 't1', type: 'transform.core.map', config: { operation: 'drop_columns' } },
        s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 70 } },
      },
      edges: [
        { source: 'd1', target: 't1', sourceHandle: 'out', targetHandle: 'in' },
        { source: 't1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
      ],
    }, { dagName: 'test_pipeline' });

    expect(result.ok).toBe(true);
    expect(result.code).toContain('@dag');
    expect(result.code).toContain('@task');
    expect(result.code).toContain('import pandas as pd');
    expect(result.code).toContain('import joblib');
    expect(result.code).toContain('train_test_split');
    expect(result.code).toContain('def n_t1(in_data):');
    expect(result.code).toContain('n_d1_result = n_d1()');
    expect(result.code).toContain('n_t1_result = n_t1(in_data=n_d1_result)');
    expect(result.code).toContain('n_s1_result = n_s1(dataset=n_t1_result)');
    expect(result.filename).toBe('test_pipeline_airflow_dag.py');
  });

  it('exports a 2-input fan-in node with named params and wiring', () => {
    const result = exporter.export({
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
    expect(result.code).toContain('def n_j1(left, right):');
    expect(result.code).toContain('n_j1_result = n_j1(left=n_d1_result, right=n_d2_result)');
  });

    it('exports real label encoding logic', () => {
    const result = exporter.export({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: './data.csv' } },
        le1: { id: 'le1', type: 'transform.tabular.label_encoding', config: { columns: ['category'] } },
      },
      edges: [
        { source: 'd1', target: 'le1', sourceHandle: 'out', targetHandle: 'in' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toContain('LabelEncoder()');
    expect(result.code).toContain('fit_transform');
    expect(result.code).toContain('encoded_');
  });

  it('emits a warning for unknown node types without throwing', () => {
    const result = exporter.export({
      nodes: {
        u1: { id: 'u1', type: 'custom.foo', config: { key: 'value' } },
      },
      edges: [],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toContain('Generic transform logic');
  });

  it('returns ok:false for an empty graph', () => {
    const result = exporter.export({ nodes: {}, edges: [] });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['Graph has no nodes']);
  });

  it('defaults dag name to proto_ml_pipeline when opts.dagName is absent', () => {
    const result = exporter.export({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: {} },
      },
      edges: [],
    });

    expect(result.ok).toBe(true);
    expect(result.filename).toContain('pipeline_');
    expect(result.code).toContain("@dag(dag_id='pipeline_");
  });

  it('wires multi-output upstream slots via sourceHandle subscripts', () => {
    const result = exporter.export({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: './data.csv' } },
        s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 70, val_pct: 20, test_pct: 10 } },
        m1: { id: 'm1', type: 'lifecycle.core.model_builder', config: { family: 'mlp' } },
        tr1: { id: 'tr1', type: 'lifecycle.core.trainer', config: { epochs: 5 } },
      },
      edges: [
        { source: 'd1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
        { source: 's1', target: 'm1', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'm1', target: 'tr1', sourceHandle: 'model', targetHandle: 'model' },
        { source: 's1', target: 'tr1', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 's1', target: 'tr1', sourceHandle: 'val', targetHandle: 'val_data' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toContain("train_data=n_s1_result['train']");
    expect(result.code).toContain("val_data=n_s1_result['val']");
    expect(result.code).toContain("model=n_m1_result");
    expect(result.code).not.toContain("model=n_m1_result['model']");
  });

  it('indents @task bodies at 8 spaces inside the dag function', () => {
    const result = exporter.export({
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: './data.csv' } },
      },
      edges: [],
    });

    expect(result.ok).toBe(true);
    const defIdx = result.code.indexOf('def n_d1():');
    expect(defIdx).toBeGreaterThan(-1);
    const afterDef = result.code.slice(defIdx);
    const bodyLine = afterDef.split('\n').find((line) => line.includes('DATA_BASE_DIR ='));
    expect(bodyLine).toBeDefined();
    expect(bodyLine.startsWith('        ')).toBe(true);
    expect(bodyLine.startsWith('            ')).toBe(false);
  });

  it('strips bulky dataset preview fields from config literals', () => {
    const result = exporter.export({
      nodes: {
        d1: {
          id: 'd1',
          type: 'dataset.csv',
          config: {
            path: './data.csv',
            delimiter: ',',
            dataset_sample: [{ id: 1, value: 'huge' }],
            dataset_schema: { columns: [{ name: 'id' }] },
            dataset_stats: { id: { min: 1, max: 99 } },
            dataset_metadata: { row_count: 10000 },
          },
        },
      },
      edges: [],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toContain('path = \'./data.csv\'');
    expect(result.code).not.toContain('dataset_sample');
    expect(result.code).not.toContain('dataset_schema');
    expect(result.code).not.toContain('dataset_stats');
    expect(result.code).not.toContain('dataset_metadata');
  });

  it('returns ok:false when the graph contains a cycle', () => {
    const result = exporter.export({
      nodes: {
        t1: { id: 't1', type: 'transform.core.map', config: {} },
        t2: { id: 't2', type: 'transform.core.map', config: {} },
      },
      edges: [
        { source: 't1', target: 't2' },
        { source: 't2', target: 't1' },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['Graph contains a cycle']);
  });
});
