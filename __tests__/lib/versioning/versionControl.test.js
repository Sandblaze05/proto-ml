import { describe, it, expect } from 'vitest';
import { computeGraphHash, graphsEqual } from '../../../lib/versioning/graphHash.js';
import { computeGraphDiff } from '../../../lib/versioning/graphDiff.js';

describe('Graph Versioning — Hashing & Diffing', () => {
  describe('Graph Hashing', () => {
    const nodes = [
      {
        id: 'node-1',
        type: 'datasetNode',
        position: { x: 100, y: 150 },
        data: {
          nodeModel: {
            type: 'csv',
            label: 'Load CSV',
            config: { path: 'data.csv', delimiter: ',' },
            pythonCode: 'df = pd.read_csv("data.csv", sep=",")',
            inputs: [],
            outputs: ['out']
          }
        }
      },
      {
        id: 'node-2',
        type: 'transformNode',
        position: { x: 300, y: 150 },
        data: {
          nodeModel: {
            type: 'drop_columns',
            label: 'Drop Cols',
            config: { columns: ['id'] },
            pythonCode: 'df = df.drop(columns=["id"])',
            inputs: ['in'],
            outputs: ['out']
          }
        }
      }
    ];

    const edges = [
      { source: 'node-1', target: 'node-2', sourceHandle: 'out', targetHandle: 'in' }
    ];

    it('generates a stable SHA-256 hash', () => {
      const hash1 = computeGraphHash(nodes, edges);
      const hash2 = computeGraphHash(nodes, edges);
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('ignores visual properties like positions and selection states', () => {
      const hashOriginal = computeGraphHash(nodes, edges);

      const modifiedNodes = nodes.map(n => ({
        ...n,
        position: { x: n.position.x + 50, y: n.position.y - 30 },
        selected: true,
        dragging: true
      }));

      const hashModified = computeGraphHash(modifiedNodes, edges);
      expect(hashOriginal).toBe(hashModified);
      expect(graphsEqual(nodes, edges, modifiedNodes, edges)).toBe(true);
    });

    it('changes hash when semantic parameters change', () => {
      const hashOriginal = computeGraphHash(nodes, edges);

      // Modify config
      const modifiedNodes = JSON.parse(JSON.stringify(nodes));
      modifiedNodes[0].data.nodeModel.config.delimiter = ';';

      const hashModified = computeGraphHash(modifiedNodes, edges);
      expect(hashOriginal).not.toBe(hashModified);
      expect(graphsEqual(nodes, edges, modifiedNodes, edges)).toBe(false);
    });
  });

  describe('Graph Diffing', () => {
    const graphA = {
      nodes: [
        {
          id: 'node-1',
          type: 'datasetNode',
          position: { x: 100, y: 100 },
          data: {
            nodeModel: {
              type: 'csv',
              label: 'Load CSV',
              config: { path: 'data.csv' },
              pythonCode: 'df = pd.read_csv("data.csv")',
              inputs: [],
              outputs: ['out']
            }
          }
        },
        {
          id: 'node-2',
          type: 'transformNode',
          position: { x: 300, y: 100 },
          data: {
            nodeModel: {
              type: 'clean',
              label: 'Clean Data',
              config: { fill_na: true },
              pythonCode: 'df = df.fillna(0)',
              inputs: ['in'],
              outputs: ['out']
            }
          }
        }
      ],
      edges: [
        { source: 'node-1', target: 'node-2', sourceHandle: 'out', targetHandle: 'in' }
      ]
    };

    it('correctly reports no changes on identical graphs', () => {
      const diff = computeGraphDiff(graphA, graphA);
      expect(diff.summary.totalChanges).toBe(0);
      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
      expect(diff.movedNodes).toHaveLength(0);
    });

    it('detects node addition', () => {
      const graphB = JSON.parse(JSON.stringify(graphA));
      const newNode = {
        id: 'node-3',
        type: 'transformNode',
        position: { x: 500, y: 100 },
        data: {
          nodeModel: {
            type: 'scale',
            label: 'Scale Features',
            config: { scaler: 'minmax' },
            pythonCode: 'scale()',
            inputs: ['in'],
            outputs: ['out']
          }
        }
      };
      graphB.nodes.push(newNode);
      graphB.edges.push({ source: 'node-2', target: 'node-3', sourceHandle: 'out', targetHandle: 'in' });

      const diff = computeGraphDiff(graphA, graphB);
      expect(diff.summary.totalChanges).toBe(2); // 1 node added + 1 edge added
      expect(diff.addedNodes).toHaveLength(1);
      expect(diff.addedNodes[0].nodeId).toBe('node-3');
      expect(diff.addedEdges).toHaveLength(1);
      expect(diff.addedEdges[0].source).toBe('node-2');
    });

    it('detects node removal', () => {
      const graphB = {
        nodes: [graphA.nodes[0]],
        edges: []
      };

      const diff = computeGraphDiff(graphA, graphB);
      expect(diff.summary.totalChanges).toBe(2); // 1 node removed + 1 edge removed
      expect(diff.removedNodes).toHaveLength(1);
      expect(diff.removedNodes[0].nodeId).toBe('node-2');
      expect(diff.removedEdges).toHaveLength(1);
    });

    it('detects config changes and renames', () => {
      const graphB = JSON.parse(JSON.stringify(graphA));
      graphB.nodes[1].data.nodeModel.config.fill_na = false;
      graphB.nodes[1].data.nodeModel.label = 'Custom Rename';

      const diff = computeGraphDiff(graphA, graphB);
      expect(diff.summary.totalChanges).toBe(1); // 1 modified node
      expect(diff.modifiedNodes).toHaveLength(1);
      expect(diff.modifiedNodes[0].nodeId).toBe('node-2');
      expect(diff.modifiedNodes[0].changes.config).toBeDefined();
      expect(diff.modifiedNodes[0].changes.config.before.fill_na).toBe(true);
      expect(diff.modifiedNodes[0].changes.config.after.fill_na).toBe(false);
      expect(diff.modifiedNodes[0].changes.label.before).toBe('Clean Data');
      expect(diff.modifiedNodes[0].changes.label.after).toBe('Custom Rename');
    });

    it('detects code changes', () => {
      const graphB = JSON.parse(JSON.stringify(graphA));
      graphB.nodes[0].data.nodeModel.pythonCode = 'df = pd.read_csv("different_name.csv")';

      const diff = computeGraphDiff(graphA, graphB);
      expect(diff.summary.totalChanges).toBe(1);
      expect(diff.modifiedNodes).toHaveLength(1);
      expect(diff.modifiedNodes[0].changes.code).toBeDefined();
      expect(diff.modifiedNodes[0].changes.code.before).toContain('data.csv');
      expect(diff.modifiedNodes[0].changes.code.after).toContain('different_name.csv');
    });
  });
});
