export async function previewNode(graph, targetNodeId, n = 5, options = {}) {
  const validationMode = options.validationMode === 'relax' ? 'relax' : 'strict';
  const res = await fetch('/api/graph/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph, targetNodeId, n, validationMode }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Preview request failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function createGraphRun({
  graph,
  targetNodeId,
  validationMode = 'strict',
  provider = 'colab',
  kernel = 'python3',
  metadata = {},
} = {}) {
  const res = await fetch('/api/graph/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph, targetNodeId, validationMode, provider, kernel, metadata }),
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
