import {
  topologicalSort,
  buildIncomingMap,
  buildDependencyMap,
  sanitizeDagName,
} from '../executor/graphUtils.js';

export class BaseExporter {
  export(compilerGraph, opts = {}) {
    const nodesById = compilerGraph?.nodes ?? {};
    const edges = compilerGraph?.edges ?? [];
    const nodeIds = Object.keys(nodesById);

    if (nodeIds.length === 0) {
      return { ok: false, errors: ['Graph has no nodes'], code: '', warnings: [], filename: '' };
    }

    let order;
    try {
      order = topologicalSort(nodesById, edges);
    } catch {
      return { ok: false, errors: ['Graph contains a cycle'], code: '', warnings: [], filename: '' };
    }
    if (order.length !== nodeIds.length) {
      return { ok: false, errors: ['Graph contains a cycle'], code: '', warnings: [], filename: '' };
    }

    const incomingMap = buildIncomingMap(nodeIds, edges);
    const depMap = buildDependencyMap(order, incomingMap);
    const sortedNodes = order.map((id) => nodesById[id]);

    const code = this.generateCode(sortedNodes, edges, depMap, incomingMap, opts);
    const filename = `${sanitizeDagName(opts.dagName)}_airflow_dag.py`;
    return { ok: true, code, errors: [], warnings: [], filename };
  }

  generateCode(_sortedNodes, _edges, _depMap, _incomingMap, _opts) {
    throw new Error('generateCode() must be implemented by subclass');
  }
}
