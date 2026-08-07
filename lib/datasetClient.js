import { listClientUploads, validateClientUpload, inspectClientUpload, deleteClientUpload } from './clientUploadStore';

export async function validatePath(pathStr) {
  if (typeof pathStr === 'string' && pathStr.startsWith('client://')) {
    const uploadId = pathStr.replace(/^client:\/\//, '');
    return validateClientUpload(uploadId);
  }
  try {
    const res = await fetch('/api/datasets/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr })
    });
    if (res.ok === false) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    if (typeof pathStr === 'string' && pathStr.startsWith('client://')) {
      const parts = pathStr.split('/');
      const possibleId = parts[parts.length - 1];
      return validateClientUpload(possibleId);
    }
    throw err;
  }
}

export async function listUploads() {
  const clientUploads = await listClientUploads();
  const res = await fetch('/api/datasets/list', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (res.ok === false) throw new Error(`HTTP ${res.status}`);
  const serverData = await res.json();
  if (clientUploads && clientUploads.length > 0) {
    const datasets = [...clientUploads, ...(serverData.datasets || [])];
    return { ...serverData, datasets };
  }
  return serverData;
}

export async function inspectCsv(payload) {
  const targetPath = payload?.path || '';
  if (typeof targetPath === 'string' && targetPath.startsWith('client://')) {
    const uploadId = targetPath.replace(/^client:\/\//, '');
    return inspectClientUpload(uploadId, payload);
  }
  try {
    const res = await fetch('/api/datasets/inspect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (res.ok === false) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    if (payload?.clientUploadId) {
      return inspectClientUpload(payload.clientUploadId, payload);
    }
    throw err;
  }
}

export async function validateCsvJoins(payload) {
  const res = await fetch('/api/datasets/joins', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  if (res.ok === false) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteUpload(pathStr) {
  if (typeof pathStr === 'string' && pathStr.startsWith('client://')) {
    const uploadId = pathStr.replace(/^client:\/\//, '');
    return deleteClientUpload(uploadId);
  }
  const res = await fetch('/api/datasets/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: pathStr })
  });
  if (res.ok === false) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

