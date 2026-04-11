import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { listNodeDefs } from '../../nodes/nodeRegistry.js';

const require = createRequire(import.meta.url);
const runtimeFactories = require('../../lib/runtimeFactories');

function evaluateStandalone(def) {
  const requiredInputs = (def.inputs || []).filter((input) => input && input.optional === false);
  const hasRuntimeFactory = Boolean(runtimeFactories.get(def.type));
  const requiresUpstreamInput = requiredInputs.length > 0;

  const reasons = [];
  if (requiresUpstreamInput) reasons.push('requires_upstream_input');
  if (!hasRuntimeFactory) reasons.push('missing_runtime_factory');

  return {
    type: def.type,
    kind: def.kind,
    requiredInputCount: requiredInputs.length,
    hasRuntimeFactory,
    standaloneCapable: !requiresUpstreamInput && hasRuntimeFactory,
    reasons,
  };
}

describe('Node standalone cell capability audit', () => {
  it('classifies nodes by standalone capability', () => {
    const defs = listNodeDefs();
    const report = defs.map(evaluateStandalone);

    expect(report.length).toBeGreaterThan(0);

    const byType = Object.fromEntries(report.map((item) => [item.type, item]));

    expect(byType['dataset.csv'].standaloneCapable).toBe(true);
    expect(byType['transform.core.map'].standaloneCapable).toBe(false);
    expect(byType['lifecycle.core.trainer'].standaloneCapable).toBe(false);

    expect(byType['dataset.database'].standaloneCapable).toBe(true);
    expect(byType['dataset.api'].standaloneCapable).toBe(true);

    const standalone = report.filter((item) => item.standaloneCapable);
    const blocked = report.filter((item) => !item.standaloneCapable);

    expect(standalone.length).toBeGreaterThan(0);
    expect(blocked.length).toBeGreaterThan(0);
  });
});
