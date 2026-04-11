import { describe, it, expect } from 'vitest';
import { buildNodeDiagnostics } from '../../../lib/executor/nodeDiagnostics.js';

describe('nodeDiagnostics', () => {
  it('reports cell-runnable status and blockers per node', () => {
    const graph = {
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: {} },
        db1: { id: 'db1', type: 'dataset.database', config: {} },
        t1: { id: 't1', type: 'transform.core.map', config: {} },
      },
      edges: [],
    };

    const diagnostics = buildNodeDiagnostics(graph);

    expect(diagnostics.summary.total).toBe(3);
    expect(diagnostics.nodes.d1.cellRunnable).toBe(true);
    expect(diagnostics.nodes.db1.cellRunnable).toBe(true);

    expect(diagnostics.nodes.t1.cellRunnable).toBe(false);
    expect(diagnostics.nodes.t1.blockers).toContain('requires_upstream_input');
  });
});
