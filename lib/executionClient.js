export async function previewNode(graph, targetNodeId, n = 5) {
  const res = await fetch('/api/graph/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph, targetNodeId, n }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Preview request failed: ${res.status} ${txt}`);
  }
  return res.json();
}
