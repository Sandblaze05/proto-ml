import { describe, it, expect } from 'vitest';
import {
  nodeIdToVar,
  compileBootstrapCell,
  compileNodeCell,
  compilePipelineCells
} from '../../../lib/executor/nodeCellCompiler.js';

describe('nodeCellCompiler', () => {
  describe('nodeIdToVar', () => {
    it('converts basic ids to valid python variable names', () => {
      expect(nodeIdToVar('node1')).toBe('_pml_node1');
      expect(nodeIdToVar('my-dataset')).toBe('_pml_my_dataset');
      expect(nodeIdToVar('transform 123')).toBe('_pml_transform_123');
      expect(nodeIdToVar('!@#$')).toBe('_pml_____');
    });
  });

  describe('compileBootstrapCell', () => {
    it('returns valid bootstrap python code', () => {
      const code = compileBootstrapCell();
      expect(typeof code).toBe('string');
      // Should include runtime helpers import and json output
      expect(code).toContain('import json');
      expect(code).toContain('"__pml_event": "bootstrap_ok"');
      expect(code).toContain('def apply_transform(');
      expect(code).toContain('def apply_lifecycle(');
    });
  });

  describe('compileNodeCell', () => {
    it('compiles a simple dataset node (no incoming edges)', () => {
      const node = {
        id: 'ds-1',
        type: 'dataset.csv',
        config: { path: '/data.csv' }
      };
      const { code, outputVar } = compileNodeCell(node, []);
      
      expect(outputVar).toBe('_pml_ds_1');
      expect(code).toContain('_pml_node_cfg = {\'path\': \'/data.csv\'}');
      expect(code).toContain('_pml_ds_1 = {\'dataset_type\': \'dataset.csv\'');
      expect(code).toContain('__pml_event\': \'node_ok\'');
      expect(code).toContain('\'nodeId\': \'ds-1\'');
    });

    it('compiles a transform node with a single incoming edge', () => {
      const node = {
        id: 't-1',
        type: 'transform.image.resize',
        config: { size: [128, 128] }
      };
      const edges = [{ source: 'ds-1', sourceHandle: 'out' }];
      const { code, outputVar } = compileNodeCell(node, edges);
      
      expect(outputVar).toBe('_pml_t_1');
      expect(code).toContain('_pml_input = select_output_handle(_pml_ds_1, \'out\')');
      expect(code).toContain('_pml_t_1 = apply_transform(\'transform.image.resize\', _pml_input, _pml_node_cfg)');
    });

    it('compiles a transform node with multiple incoming edges', () => {
      const node = {
        id: 'join-1',
        type: 'transform.core.join',
        config: { on: 'id' }
      };
      const edges = [
        { source: 'ds-1', targetHandle: 'left' },
        { source: 'ds-2', targetHandle: 'right' }
      ];
      const { code, outputVar } = compileNodeCell(node, edges);
      
      expect(outputVar).toBe('_pml_join_1');
      expect(code).toContain('_pml_inputs = {}');
      expect(code).toContain('_pml_inputs[\'left\'] = select_output_handle(_pml_ds_1, None)');
      expect(code).toContain('_pml_inputs[\'right\'] = select_output_handle(_pml_ds_2, None)');
      expect(code).toContain('_pml_join_1 = apply_transform(\'transform.core.join\', _pml_inputs, _pml_node_cfg)');
    });

    it('compiles a lifecycle node', () => {
      const node = {
        id: 'lc-1',
        type: 'lifecycle.split',
        config: { ratio: 0.8 }
      };
      const edges = [{ source: 'ds-1', targetHandle: 'dataset' }];
      const { code, outputVar } = compileNodeCell(node, edges);
      
      expect(outputVar).toBe('_pml_lc_1');
      expect(code).toContain('_pml_inputs[\'dataset\'] = select_output_handle(_pml_ds_1, None)');
      expect(code).toContain('_pml_lc_1 = apply_lifecycle(\'split\', _pml_inputs, _pml_node_cfg)');
    });
  });

  describe('compilePipelineCells', () => {
    it('returns empty array for an empty graph', () => {
      const { order, errors } = compilePipelineCells({ nodes: [], edges: [] });
      expect(order).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Graph is empty');
    });

    it('sorts nodes topologically and returns order and cell code', () => {
      const graph = {
        nodes: [
          { id: 't2', type: 'transform.b' },
          { id: 'ds1', type: 'dataset.csv' },
          { id: 't1', type: 'transform.a' }
        ],
        edges: [
          { source: 'ds1', target: 't1' },
          { source: 't1', target: 't2' }
        ]
      };
      
      const { order, errors } = compilePipelineCells(graph);
      expect(errors).toHaveLength(0);
      expect(order).toHaveLength(3);
      
      // Topologial order check
      expect(order[0].nodeId).toBe('ds1');
      expect(order[1].nodeId).toBe('t1');
      expect(order[2].nodeId).toBe('t2');

      // Check the output structure
      expect(order[0].outputVar).toBe('_pml_ds1');
      expect(order[1].inEdges).toHaveLength(1);
      expect(order[2].code).toContain('_pml_t1'); // Should read output from t1
    });

    it('detects cycles and returns an error', () => {
      const graph = {
        nodes: [
          { id: 'a', type: 'transform' },
          { id: 'b', type: 'transform' }
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a' } // Cycle!
        ]
      };
      
      const { order, errors } = compilePipelineCells(graph);
      expect(order).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('contains a cycle');
    });
  });
});
