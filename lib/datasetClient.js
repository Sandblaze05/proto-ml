export async function validatePath(pathStr) {
  const res = await fetch('/api/datasets/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: pathStr })
  });
  return res.json();
}

export async function listUploads() {
  const res = await fetch('/api/datasets/list', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  return res.json();
}

export async function inspectCsv(payload) {
  const res = await fetch('/api/datasets/inspect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  return res.json();
}

export async function validateCsvJoins(payload) {
  const res = await fetch('/api/datasets/joins', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  return res.json();
}

export async function deleteUpload(pathStr) {
  const res = await fetch('/api/datasets/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: pathStr })
  });
  return res.json();
}
