export async function validatePath(pathStr) {
  const res = await fetch('/api/datasets/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: pathStr })
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
