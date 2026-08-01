import { PREVIEW, RUN } from './executor/executionContract';

// Preview: the synthetic, in-process sampling path. This NEVER persists
// outputs as run results — it only returns an ephemeral sample to the UI.
export async function previewNode(graph, targetNodeId, n = 5, options = {}) {
  const validationMode = options.validationMode === 'relax' ? 'relax' : 'strict';
  const res = await fetch('/api/graph/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graph,
      targetNodeId,
      n,
      validationMode,
      mode: PREVIEW,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Preview request failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// Run pipeline: the SOLE implementation is one_off_compile / Jupyter execution
// (compile to Python + execute + persist the run through the Jupyter runner).
export async function createGraphRun({
  graph,
  targetNodeId,
  validationMode = 'strict',
  metadata = {},
  failurePolicy = 'fail-fast',
} = {}) {
  const normalizedMode = validationMode === 'relax' ? 'relax' : 'strict';
  const normalizedFailurePolicy = failurePolicy === 'fail-fast' ? 'fail-fast' : 'fail-fast';
  const res = await fetch('/api/graph/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graph,
      targetNodeId,
      validationMode: normalizedMode,
      metadata,
      mode: RUN,
      failurePolicy: normalizedFailurePolicy,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Create run request failed: ${res.status} ${txt}`);
  }

  return res.json();
}

export async function getGraphRunStatus(runId) {
  const res = await fetch(`/api/graph/runs/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Get run status failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function getGraphRunResult(runId) {
  const res = await fetch(`/api/graph/runs/${encodeURIComponent(runId)}/result`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Get run result failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function cancelGraphRun(runId) {
  const res = await fetch(`/api/graph/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Cancel run failed: ${res.status} ${txt}`);
  }
  return res.json();
}
