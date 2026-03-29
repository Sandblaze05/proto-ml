const uploadStore = new Map();

const DB_NAME = 'proto_ml_client_uploads';
const DB_VERSION = 1;
const STORE_UPLOADS = 'uploads';

function makeUploadId() {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_UPLOADS)) {
        db.createObjectStore(STORE_UPLOADS, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

function idbRequestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

async function putUploadRecord(record) {
  const db = await openDb();
  const tx = db.transaction(STORE_UPLOADS, 'readwrite');
  const store = tx.objectStore(STORE_UPLOADS);
  await idbRequestToPromise(store.put(record));
  await txDone(tx);
  db.close();
}

async function getUploadRecord(uploadId) {
  const db = await openDb();
  const tx = db.transaction(STORE_UPLOADS, 'readonly');
  const store = tx.objectStore(STORE_UPLOADS);
  const result = await idbRequestToPromise(store.get(uploadId));
  db.close();
  return result || null;
}

async function getAllUploadRecords() {
  const db = await openDb();
  const tx = db.transaction(STORE_UPLOADS, 'readonly');
  const store = tx.objectStore(STORE_UPLOADS);
  const result = await idbRequestToPromise(store.getAll());
  db.close();
  return Array.isArray(result) ? result : [];
}

function splitCsvLine(line, delimiter) {
  return String(line).split(delimiter).map((v) => v.trim());
}

function parseCsvText(raw, delimiter = ',', header = true, limitRows = 200) {
  const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { columns: [], rows: [] };

  let headers = [];
  let start = 0;
  if (header) {
    headers = splitCsvLine(lines[0], delimiter).map((h, idx) => h || `col_${idx}`);
    start = 1;
  }

  const rows = [];
  for (let i = start; i < lines.length && rows.length < limitRows; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const row = {};
    if (headers.length > 0) {
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? '';
      });
    } else {
      cols.forEach((v, idx) => {
        row[`col_${idx}`] = v;
      });
    }
    rows.push(row);
  }

  const columns = headers.length > 0 ? headers : Object.keys(rows[0] || {});
  return { columns, rows };
}

function inferType(values = []) {
  let seenNumber = false;
  let seenDate = false;
  let seenString = false;

  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const str = String(value).trim();
    if (!str) continue;

    const asNum = Number(str);
    if (!Number.isNaN(asNum)) {
      seenNumber = true;
      continue;
    }

    const asDate = Date.parse(str);
    if (!Number.isNaN(asDate)) {
      seenDate = true;
      continue;
    }

    seenString = true;
  }

  if (seenString) return 'string';
  if (seenDate && !seenNumber) return 'datetime';
  if (seenNumber) return 'number';
  return 'unknown';
}

function profileColumns(rows, columns) {
  const profile = {};
  const numericColumns = [];

  for (const col of columns) {
    const values = rows.map((r) => r[col]);
    const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const dtype = inferType(nonEmpty);

    profile[col] = {
      name: col,
      dtype,
      nullCount: values.length - nonEmpty.length,
      sampleValues: nonEmpty.slice(0, 5),
    };

    if (dtype === 'number') numericColumns.push(col);
  }

  return { profile, numericColumns };
}

function suggestJoins(tables) {
  const names = Object.keys(tables || {});
  const suggestions = [];

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const left = names[i];
      const right = names[j];
      const leftSet = new Set(tables[left]?.columns || []);
      const rightSet = new Set(tables[right]?.columns || []);

      for (const col of leftSet) {
        if (!rightSet.has(col)) continue;
        suggestions.push({ left, right, on: col, type: 'left' });
      }
    }
  }

  return suggestions;
}

async function getUploadEntry(uploadId) {
  if (!uploadId) return null;
  if (uploadStore.has(uploadId)) return uploadStore.get(uploadId);

  const fromDb = await getUploadRecord(uploadId);
  if (fromDb) {
    uploadStore.set(uploadId, fromDb);
    return fromDb;
  }
  return null;
}

export async function createClientUpload(files = []) {
  const id = makeUploadId();
  const normalized = files
    .filter(Boolean)
    .map((file) => ({
      file,
      name: file.webkitRelativePath || file.name,
      csv: (file.webkitRelativePath || file.name || '').toLowerCase().endsWith('.csv'),
    }));

  const record = {
    id,
    createdAt: new Date().toISOString(),
    files: normalized,
  };

  uploadStore.set(id, record);
  await putUploadRecord(record);

  return {
    uploadId: id,
    files: normalized.map((f) => f.name),
    csvFiles: normalized.filter((f) => f.csv).map((f) => f.name),
  };
}

export async function listClientUploads() {
  const records = await getAllUploadRecords();
  records.forEach((r) => uploadStore.set(r.id, r));

  return records
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((entry) => ({
      id: entry.id,
      path: `client://${entry.id}`,
      createdAt: entry.createdAt,
      fileCount: entry.files.length,
      clientOnly: true,
    }));
}

export async function validateClientUpload(uploadId) {
  const entry = await getUploadEntry(uploadId);
  if (!entry) {
    return { ok: false, exists: false, error: 'Client upload not found' };
  }

  const files = entry.files.map((f) => f.name);
  return {
    ok: true,
    exists: true,
    isDirectory: true,
    isFile: false,
    count: files.length,
    files,
    clientOnly: true,
  };
}

async function getCsvTables(uploadId, delimiter, header) {
  const entry = await getUploadEntry(uploadId);
  if (!entry) throw new Error('Client upload not found');

  const csvFiles = entry.files.filter((f) => f.csv);
  if (csvFiles.length === 0) throw new Error('No CSV files found in uploaded client files');

  const tables = {};
  for (const item of csvFiles) {
    const raw = await item.file.text();
    const parsed = parseCsvText(raw, delimiter, header);
    const parts = item.name.split('/').pop().split('\\').pop();
    const stem = parts.replace(/\.csv$/i, '');
    tables[stem] = {
      file: item.name,
      columns: parsed.columns,
      rows: parsed.rows,
    };
  }

  return tables;
}

export async function inspectClientUpload(uploadId, options = {}) {
  const delimiter = options.delimiter || ',';
  const header = options.header !== false;
  const targetColumn = options.target_column || '';

  const tables = await getCsvTables(uploadId, delimiter, header);
  const tableNames = Object.keys(tables);
  const primary = options.primary && tables[options.primary] ? options.primary : tableNames[0];
  const primaryTable = tables[primary];
  const { profile } = profileColumns(primaryTable.rows, primaryTable.columns);

  const metadata = {
    rows: primaryTable.rows.length,
    columns: primaryTable.columns.length,
    target: targetColumn || null,
    taskSuggestion: targetColumn && profile[targetColumn]
      ? (profile[targetColumn].dtype === 'number' ? 'regression' : 'classification')
      : null,
  };

  return {
    ok: true,
    primary,
    tables,
    columns: primaryTable.columns,
    profile,
    preview: primaryTable.rows.slice(0, 50),
    metadata,
    joinSuggestions: suggestJoins(tables),
    correlations: [],
    outliers: [],
    clientOnly: true,
  };
}

export async function validateClientUploadJoins(uploadId, options = {}) {
  const delimiter = options.delimiter || ',';
  const header = options.header !== false;
  const relations = Array.isArray(options.relations) ? options.relations : [];

  const tables = await getCsvTables(uploadId, delimiter, header);
  const columnsByTable = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.columns]));
  const tableNames = Object.keys(columnsByTable);
  const primary = options.primary && columnsByTable[options.primary] ? options.primary : tableNames[0];

  const validation = [];
  for (let i = 0; i < relations.length; i++) {
    const rel = relations[i] || {};
    const left = rel.left || primary;
    const right = rel.right;
    const on = rel.on;

    if (!right || !on) {
      validation.push({ index: i, ok: false, error: 'Relation needs right and on' });
      continue;
    }
    if (!columnsByTable[left]) {
      validation.push({ index: i, ok: false, error: `Unknown left table: ${left}` });
      continue;
    }
    if (!columnsByTable[right]) {
      validation.push({ index: i, ok: false, error: `Unknown right table: ${right}` });
      continue;
    }
    if (!columnsByTable[left].includes(on)) {
      validation.push({ index: i, ok: false, error: `Column ${on} missing in ${left}` });
      continue;
    }
    if (!columnsByTable[right].includes(on)) {
      validation.push({ index: i, ok: false, error: `Column ${on} missing in ${right}` });
      continue;
    }

    validation.push({ index: i, ok: true });
  }

  return {
    ok: true,
    valid: validation.every((it) => it.ok),
    primary,
    columnsByTable,
    suggestions: suggestJoins(tables),
    validation,
    clientOnly: true,
  };
}

export async function previewClientUpload(uploadId, options = {}) {
  const delimiter = options.delimiter || ',';
  const header = options.header !== false;
  const relations = Array.isArray(options.relations) ? options.relations : [];
  const targetColumn = options.target_column || '';
  const requestedFeatures = Array.isArray(options.features)
    ? options.features
    : (Array.isArray(options.feature_columns) ? options.feature_columns : []);
  const missingStrategy = (options.missing && options.missing.strategy) || options.handle_missing || 'drop';
  const n = Number.isFinite(Number(options.n)) ? Number(options.n) : 5;

  const tables = await getCsvTables(uploadId, delimiter, header);
  const tableNames = Object.keys(tables);
  const primary = options.primary && tables[options.primary] ? options.primary : tableNames[0];

  let mergedRows = [...tables[primary].rows];

  const mergeRows = (leftRows, rightRows, key, joinType = 'left') => {
    const rightMap = new Map();
    rightRows.forEach((r) => {
      const k = r[key];
      if (!rightMap.has(k)) rightMap.set(k, []);
      rightMap.get(k).push(r);
    });

    const out = [];
    const usedRight = new Set();

    for (const l of leftRows) {
      const matches = rightMap.get(l[key]) || [];
      if (matches.length === 0) {
        if (joinType === 'left' || joinType === 'outer') out.push({ ...l });
        continue;
      }
      for (const r of matches) {
        out.push({ ...l, ...r });
        usedRight.add(r);
      }
    }

    if (joinType === 'outer') {
      for (const r of rightRows) {
        if (!usedRight.has(r)) out.push({ ...r });
      }
    }
    return out;
  };

  for (const rel of relations) {
    const right = rel?.right;
    const on = rel?.on;
    const joinType = rel?.type || 'left';
    if (!right || !on || !tables[right]) continue;
    mergedRows = mergeRows(mergedRows, tables[right].rows, on, joinType);
  }

  if (missingStrategy === 'drop' || missingStrategy === 'drop_rows') {
    mergedRows = mergedRows.filter((row) => !Object.values(row).some((v) => v === null || v === undefined || String(v).trim() === ''));
  } else if (missingStrategy === 'mean') {
    const columns = Object.keys(mergedRows[0] || {});
    const means = {};
    for (const col of columns) {
      const nums = mergedRows
        .map((r) => Number(r[col]))
        .filter((x) => Number.isFinite(x));
      if (nums.length > 0) means[col] = nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    mergedRows = mergedRows.map((row) => {
      const out = { ...row };
      for (const [col, mean] of Object.entries(means)) {
        if (out[col] === null || out[col] === undefined || String(out[col]).trim() === '') out[col] = mean;
      }
      return out;
    });
  }

  const projected = mergedRows.map((row) => {
    if (requestedFeatures.length === 0) return { ...row };
    const out = {};
    for (const col of requestedFeatures) {
      if (col in row) out[col] = row[col];
    }
    if (targetColumn && targetColumn in row) out[targetColumn] = row[targetColumn];
    return out;
  });

  const previewRows = projected.slice(0, n).map((row) => {
    const out = { ...row };
    if (targetColumn && targetColumn in out) out._target = out[targetColumn];
    return out;
  });

  const sampleCols = Object.keys(projected[0] || {});
  const features = requestedFeatures.length > 0
    ? requestedFeatures.filter((c) => c !== targetColumn && sampleCols.includes(c))
    : sampleCols.filter((c) => c !== targetColumn);

  return {
    rows: previewRows,
    metadata: {
      rows: projected.length,
      columns: sampleCols.length,
      columnsList: sampleCols,
      features,
      primary,
      tables: tableNames,
      target: targetColumn || null,
      missing: missingStrategy,
      clientOnly: true,
    },
  };
}
