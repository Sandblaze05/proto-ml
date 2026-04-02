const uploadStore = new Map();

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff']);

const DB_NAME = 'proto_ml_client_uploads';
const DB_VERSION = 1;
const STORE_UPLOADS = 'uploads';
const IDB_PERSIST_THRESHOLD_BYTES = 250 * 1024 * 1024;
const CSV_SAMPLE_BYTES = 8 * 1024 * 1024;

function isMissingValue(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeBoolean(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
}

function getUniqueValues(values = []) {
  return Array.from(new Set(values));
}

function quantile(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sortedValues[base + 1];
  if (next === undefined) return sortedValues[base];
  return sortedValues[base] + rest * (next - sortedValues[base]);
}

function buildHistogram(values = [], binCount = 10) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) {
    return [{ min, max, count: sorted.length }];
  }

  const bins = Math.max(1, Math.min(binCount, sorted.length));
  const width = (max - min) / bins;
  const histogram = Array.from({ length: bins }, (_, index) => ({
    min: min + (index * width),
    max: index === bins - 1 ? max : min + ((index + 1) * width),
    count: 0,
  }));

  for (const value of sorted) {
    const index = value === max ? bins - 1 : Math.floor((value - min) / width);
    histogram[Math.min(Math.max(index, 0), bins - 1)].count += 1;
  }

  return histogram;
}

function summarizeNumeric(values = []) {
  const numericValues = values.map((value) => safeNumber(value)).filter((value) => value !== null);
  if (numericValues.length === 0) return null;

  const sorted = [...numericValues].sort((a, b) => a - b);
  const sum = numericValues.reduce((acc, value) => acc + value, 0);
  const mean = sum / numericValues.length;
  const variance = numericValues.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / numericValues.length;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: quantile(sorted, 0.5),
    std: Math.sqrt(variance),
    variance,
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    histogram: buildHistogram(numericValues),
  };
}

function summarizeCategorical(values = []) {
  const frequencies = new Map();
  let tokenCount = 0;
  let totalLength = 0;
  const vocabulary = new Set();

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    frequencies.set(normalized, (frequencies.get(normalized) || 0) + 1);
    tokenCount += normalized.split(/\s+/).filter(Boolean).length;
    totalLength += normalized.length;
    vocabulary.add(normalized.toLowerCase());
  }

  const entries = Array.from(frequencies.entries()).sort((a, b) => b[1] - a[1]);
  const total = values.filter((value) => !isMissingValue(value)).length || 1;
  const entropy = entries.reduce((acc, [, count]) => {
    const probability = count / total;
    return probability > 0 ? acc - (probability * Math.log2(probability)) : acc;
  }, 0);

  return {
    unique: frequencies.size,
    topValues: entries.slice(0, 5).map(([value, count]) => ({ value, count, ratio: count / total })),
    entropy,
    imbalance: entries.length > 0 ? 1 - (entries[0][1] / total) : 0,
    avgLength: total > 0 ? totalLength / total : 0,
    tokenCount,
    vocabSize: vocabulary.size,
  };
}

function summarizeBoolean(values = []) {
  let trueCount = 0;
  let falseCount = 0;
  let unknownCount = 0;

  for (const value of values) {
    const normalized = normalizeBoolean(value);
    if (normalized === true) trueCount += 1;
    else if (normalized === false) falseCount += 1;
    else unknownCount += 1;
  }

  const total = trueCount + falseCount + unknownCount;
  return {
    trueCount,
    falseCount,
    unknownCount,
    trueRatio: total > 0 ? trueCount / total : 0,
  };
}

function summarizeDatetime(values = []) {
  const timestamps = values
    .map((value) => Date.parse(normalizeText(value)))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;

  const sorted = [...timestamps].sort((a, b) => a - b);
  return {
    min: new Date(sorted[0]).toISOString(),
    max: new Date(sorted[sorted.length - 1]).toISOString(),
    sample: sorted.slice(0, 5).map((value) => new Date(value).toISOString()),
  };
}

function summarizeText(values = []) {
  const normalizedValues = values.map((value) => normalizeText(value)).filter(Boolean);
  if (normalizedValues.length === 0) return null;

  const lengths = normalizedValues.map((value) => value.length);
  const tokens = new Set();
  let tokenCount = 0;
  for (const value of normalizedValues) {
    const parts = value.split(/\s+/).filter(Boolean);
    tokenCount += parts.length;
    parts.forEach((part) => tokens.add(part.toLowerCase()));
  }

  return {
    avgLength: lengths.reduce((acc, value) => acc + value, 0) / lengths.length,
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
    tokenCount,
    vocabSize: tokens.size,
  };
}

function inferColumnKind(dtype, values = []) {
  if (dtype === 'number') return 'numeric';
  if (dtype === 'boolean') return 'boolean';
  if (dtype === 'datetime') return 'datetime';

  const normalized = values.map((value) => normalizeText(value)).filter(Boolean);
  if (normalized.length === 0) return 'unknown';

  const uniqueRatio = getUniqueValues(normalized.map((value) => value.toLowerCase())).length / normalized.length;
  if (uniqueRatio <= 0.2 || normalized.length <= 20) return 'categorical';
  return 'text';
}

export function inferType(values = []) {
  const normalized = values.filter((value) => !isMissingValue(value));
  if (normalized.length === 0) return 'unknown';

  let boolCount = 0;
  let numberCount = 0;
  let dateCount = 0;

  for (const value of normalized) {
    if (normalizeBoolean(value) !== null) {
      boolCount += 1;
    }
    if (safeNumber(value) !== null) {
      numberCount += 1;
      continue;
    }
    if (!Number.isNaN(Date.parse(normalizeText(value)))) {
      dateCount += 1;
    }
  }

  if (boolCount / normalized.length >= 0.95) return 'boolean';
  if (numberCount / normalized.length >= 0.95) return 'number';
  if (dateCount / normalized.length >= 0.95) return 'datetime';
  return 'string';
}

export function profileColumns(rows = [], columns = []) {
  const profile = {};
  const numericColumns = [];
  const categoricalColumns = [];
  const booleanColumns = [];
  const datetimeColumns = [];
  const textColumns = [];

  let missingCells = 0;
  const seenRows = new Set();
  for (const row of rows) {
    const rowKey = JSON.stringify(columns.map((col) => row?.[col] ?? null));
    seenRows.add(rowKey);
  }

  for (const column of columns) {
    const values = rows.map((row) => row?.[column]);
    const nonEmpty = values.filter((value) => !isMissingValue(value));
    missingCells += values.length - nonEmpty.length;

    const dtype = inferType(nonEmpty);
    const kind = inferColumnKind(dtype, nonEmpty);
    const uniqueValues = getUniqueValues(nonEmpty.map((value) => normalizeText(value)));
    const item = {
      name: column,
      dtype,
      kind,
      nullCount: values.length - nonEmpty.length,
      missingRatio: values.length > 0 ? (values.length - nonEmpty.length) / values.length : 0,
      unique: uniqueValues.length,
      sampleValues: nonEmpty.slice(0, 5),
    };

    if (dtype === 'number') {
      item.stats = summarizeNumeric(nonEmpty);
      numericColumns.push(column);
    } else if (dtype === 'boolean') {
      item.stats = summarizeBoolean(nonEmpty);
      booleanColumns.push(column);
    } else if (dtype === 'datetime') {
      item.stats = summarizeDatetime(nonEmpty);
      datetimeColumns.push(column);
    } else if (kind === 'categorical') {
      item.stats = summarizeCategorical(nonEmpty);
      categoricalColumns.push(column);
    } else {
      item.stats = summarizeText(nonEmpty);
      textColumns.push(column);
    }

    profile[column] = item;
  }

  return {
    profile,
    numericColumns,
    categoricalColumns,
    booleanColumns,
    datetimeColumns,
    textColumns,
    stats: {
      rows: rows.length,
      columns: columns.length,
      missingCells,
      duplicateRows: Math.max(rows.length - seenRows.size, 0),
      totalCells: rows.length * columns.length,
      memorySize: JSON.stringify(rows).length,
    },
  };
}

function buildRecommendations(profile = {}, stats = {}, targetColumn = '') {
  const columnProfiles = Object.values(profile || {});
  const recommendations = [];

  if (columnProfiles.some((column) => column.kind === 'numeric')) {
    recommendations.push('Normalize numeric columns before training.');
  }
  if (columnProfiles.some((column) => column.kind === 'categorical')) {
    recommendations.push('Encode categorical columns for downstream models.');
  }
  if (columnProfiles.some((column) => column.nullCount > 0)) {
    recommendations.push('Handle missing values before feeding the graph.');
  }
  if (columnProfiles.some((column) => column.unique === 1)) {
    recommendations.push('Drop constant columns.');
  }
  if (targetColumn && profile[targetColumn]) {
    recommendations.push(profile[targetColumn].dtype === 'number'
      ? 'Regression target detected; verify numeric scale and outliers.'
      : 'Classification target detected; verify class balance.');
  }
  if ((stats?.duplicateRows || 0) > 0) {
    recommendations.push('Deduplicate rows if the source is not intentionally repeated.');
  }

  return Array.from(new Set(recommendations));
}

export function buildDatasetMetadata({
  uploadId,
  sourceType,
  primary,
  tables,
  columns,
  profile,
  stats,
  preview,
  targetColumn,
  features,
  missingStrategy,
  totalBytes,
  sampled,
  sampledBytes,
  taskSuggestion,
  joinSuggestions,
}) {
  const schemaColumns = Array.isArray(columns)
    ? columns.map((name) => profile?.[name] || { name, dtype: 'unknown', kind: 'unknown' })
    : Object.values(profile || {});

  return {
    datasetId: uploadId,
    sourceType,
    primary: primary || null,
    tables: Array.isArray(tables) ? tables : [],
    schema: {
      primary: primary || null,
      columns: schemaColumns,
      columnTypes: Object.fromEntries(schemaColumns.map((column) => [column.name, column.dtype])),
    },
    stats: {
      ...(stats || {}),
      sampled: !!sampled,
      sampledBytes: sampledBytes ?? null,
      totalBytes: totalBytes ?? null,
      target: targetColumn || null,
    },
    sampleRows: Array.isArray(preview) ? preview.slice(0, 50) : [],
    features: Array.isArray(features) ? features : [],
    target: targetColumn || null,
    missing: missingStrategy || 'drop',
    taskSuggestion: taskSuggestion || null,
    joinSuggestions: Array.isArray(joinSuggestions) ? joinSuggestions : [],
    recommendations: buildRecommendations(profile, stats, targetColumn),
  };
}

async function buildImageMetadata(entry, options = {}) {
  const imageFiles = entry.files
    .filter((item) => isImageFileName(item.name))
    .map((item) => {
      const meta = getImageFileMetadata(item.name);
      return {
        path: meta.path,
        name: meta.name,
        label: options.label_strategy === 'none' ? null : (options.label_strategy === 'json_mapping' ? null : meta.label),
        ext: meta.ext,
        size: item.file?.size ?? null,
      };
    });

  const classDistribution = {};
  const formatDistribution = {};
  let totalSize = 0;

  for (const item of imageFiles) {
    if (item.label) {
      classDistribution[item.label] = (classDistribution[item.label] || 0) + 1;
    }
    if (item.ext) {
      formatDistribution[item.ext] = (formatDistribution[item.ext] || 0) + 1;
    }
    totalSize += Number(item.size || 0);
  }

  return {
    ok: true,
    datasetId: entry.id,
    sourceType: 'image',
    schema: {
      primary: null,
      columns: [
        { name: 'path', dtype: 'string', kind: 'text' },
        { name: 'label', dtype: 'string', kind: 'categorical' },
        { name: 'ext', dtype: 'string', kind: 'categorical' },
        { name: 'size', dtype: 'number', kind: 'numeric' },
      ],
      columnTypes: {
        path: 'string',
        label: 'string',
        ext: 'string',
        size: 'number',
      },
    },
    stats: {
      rows: imageFiles.length,
      columns: 4,
      fileCount: imageFiles.length,
      totalBytes: totalSize,
      classDistribution,
      formatDistribution,
    },
    sampleRows: imageFiles.slice(0, 50),
    preview: imageFiles.slice(0, 50),
    metadata: {
      rows: imageFiles.length,
      columns: 4,
      datasetType: 'image',
      classDistribution,
      formatDistribution,
      totalBytes: totalSize,
      taskSuggestion: imageFiles.length > 0 ? 'classification' : null,
      sampled: true,
      sampledBytes: totalSize,
      recommendations: imageFiles.length > 0 ? ['Use class balancing if classes are imbalanced.'] : [],
    },
    joinSuggestions: [],
    correlations: [],
    outliers: [],
    clientOnly: true,
  };
}

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

async function deleteUploadRecord(uploadId) {
  const db = await openDb();
  const tx = db.transaction(STORE_UPLOADS, 'readwrite');
  const store = tx.objectStore(STORE_UPLOADS);
  await idbRequestToPromise(store.delete(uploadId));
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

async function readCsvSampleText(file, maxBytes = CSV_SAMPLE_BYTES) {
  const size = Number(file?.size || 0);
  if (size <= 0) return { text: '', sampled: false, sampledBytes: 0, size: 0 };
  const blob = typeof file.slice === 'function' ? file.slice(0, Math.min(size, maxBytes)) : file;
  const text = await blob.text();
  return { text, sampled: size > maxBytes, sampledBytes: Math.min(size, maxBytes), size };
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
      size: Number(file.size || 0),
    }));

  const totalBytes = normalized.reduce((sum, item) => sum + (item.size || 0), 0);

  const record = {
    id,
    createdAt: new Date().toISOString(),
    files: normalized,
    totalBytes,
    sessionOnly: false,
  };

  uploadStore.set(id, record);

  let warning = '';
  if (totalBytes <= IDB_PERSIST_THRESHOLD_BYTES) {
    try {
      await putUploadRecord(record);
    } catch {
      record.sessionOnly = true;
      warning = 'Stored in session memory only (browser storage quota reached).';
    }
  } else {
    record.sessionOnly = true;
    warning = 'Large upload stored in session memory only to avoid browser storage quota issues.';
  }

  try {
    const analysis = await inspectClientUpload(id, { sampleRows: 100, previewRows: 100 });
    if (analysis?.metadata) {
      record.datasetId = id;
      record.metadata = analysis.metadata;
      record.schema = analysis.schema || null;
      record.stats = analysis.stats || analysis.metadata?.stats || null;
      record.sampleRows = analysis.sampleRows || analysis.preview || [];
      uploadStore.set(id, record);
      if (!record.sessionOnly) {
        await putUploadRecord(record);
      }
    }
  } catch {
    // Best-effort metadata analysis; upload creation still succeeds without it.
  }

  return {
    uploadId: id,
    datasetId: id,
    files: normalized.map((f) => f.name),
    csvFiles: normalized.filter((f) => f.csv).map((f) => f.name),
    totalBytes,
    sessionOnly: record.sessionOnly,
    warning,
    metadata: record.metadata || null,
    schema: record.schema || null,
    stats: record.stats || null,
  };
}

export async function listClientUploads() {
  const persisted = await getAllUploadRecords();
  const recordsById = new Map();

  persisted.forEach((r) => recordsById.set(r.id, r));
  uploadStore.forEach((r, id) => {
    if (!recordsById.has(id)) recordsById.set(id, r);
  });

  const records = Array.from(recordsById.values());
  records.forEach((r) => uploadStore.set(r.id, r));

  return records
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((entry) => ({
      id: entry.id,
      datasetId: entry.datasetId || entry.id,
      path: `client://${entry.id}`,
      createdAt: entry.createdAt,
      fileCount: entry.files.length,
      totalBytes: Number(entry.totalBytes || 0),
      sessionOnly: !!entry.sessionOnly,
      clientOnly: true,
      sourceType: entry.metadata?.sourceType || (entry.files.some((f) => f.csv) ? 'csv' : (entry.files.some((f) => isImageFileName(f.name)) ? 'image' : 'generic')),
      schema: entry.schema || null,
      stats: entry.stats || null,
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

export async function deleteClientUpload(uploadId) {
  const entry = await getUploadEntry(uploadId);
  if (!entry) {
    return { ok: false, exists: false, error: 'Client upload not found' };
  }

  uploadStore.delete(uploadId);
  try {
    await deleteUploadRecord(uploadId);
  } catch {
    // Session-only uploads are not persisted to IndexedDB.
  }

  return { ok: true, deleted: true, clientOnly: true };
}

function getFileExtension(name) {
  const normalized = String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const idx = normalized.lastIndexOf('.');
  return idx >= 0 ? normalized.slice(idx).toLowerCase() : '';
}

function getImageFileMetadata(name) {
  const normalized = String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  return {
    path: normalized,
    name: parts[parts.length - 1] || normalized,
    label: parts.length > 1 ? parts[0] : null,
    ext: getFileExtension(normalized),
  };
}

function isImageFileName(name) {
  return IMAGE_EXTENSIONS.has(getFileExtension(name));
}

async function getCsvTables(uploadId, delimiter, header) {
  const entry = await getUploadEntry(uploadId);
  if (!entry) throw new Error('Client upload not found');

  const csvFiles = entry.files.filter((f) => f.csv);
  if (csvFiles.length === 0) throw new Error('No CSV files found in uploaded client files');

  const tables = {};
  for (const item of csvFiles) {
    const sample = await readCsvSampleText(item.file, CSV_SAMPLE_BYTES);
    const parsed = parseCsvText(sample.text, delimiter, header);
    const parts = item.name.split('/').pop().split('\\').pop();
    const stem = parts.replace(/\.csv$/i, '');
    const analysis = profileColumns(parsed.rows, parsed.columns);
    tables[stem] = {
      file: item.name,
      columns: parsed.columns,
      rows: parsed.rows,
      sampled: !!sample.sampled,
      sampledBytes: sample.sampledBytes,
      totalBytes: sample.size,
      profile: analysis.profile,
      stats: analysis.stats,
      numericColumns: analysis.numericColumns,
      categoricalColumns: analysis.categoricalColumns,
      booleanColumns: analysis.booleanColumns,
      datetimeColumns: analysis.datetimeColumns,
      textColumns: analysis.textColumns,
    };
  }

  return tables;
}

export async function inspectClientUpload(uploadId, options = {}) {
  const delimiter = options.delimiter || ',';
  const header = options.header !== false;
  const targetColumn = options.target_column || '';
  const previewRows = Number.isFinite(Number(options.previewRows)) ? Math.max(1, Number(options.previewRows)) : 50;
  const sampleRows = Number.isFinite(Number(options.sampleRows)) ? Math.max(1, Number(options.sampleRows)) : 50;

  const entry = await getUploadEntry(uploadId);
  if (!entry) {
    return { ok: false, error: 'Client upload not found', clientOnly: true };
  }

  const csvFiles = entry.files.filter((f) => f.csv);
  const imageFiles = entry.files.filter((f) => isImageFileName(f.name));

  if (csvFiles.length > 0) {
    const tables = await getCsvTables(uploadId, delimiter, header);
    const tableNames = Object.keys(tables);
    const primary = options.primary && tables[options.primary] ? options.primary : tableNames[0];
    const primaryTable = tables[primary];
    const analysis = profileColumns(primaryTable.rows, primaryTable.columns);
    const profile = primaryTable.profile || analysis.profile;
    const stats = primaryTable.stats || analysis.stats;
    const metadata = buildDatasetMetadata({
      uploadId,
      sourceType: 'csv',
      primary,
      tables: tableNames,
      columns: primaryTable.columns,
      profile,
      stats,
      preview: primaryTable.rows.slice(0, previewRows),
      targetColumn,
      features: Array.isArray(options.features)
        ? options.features
        : (Array.isArray(options.feature_columns) ? options.feature_columns : []),
      missingStrategy: (options.missing && options.missing.strategy) || options.handle_missing || 'drop',
      totalBytes: entry.totalBytes,
      sampled: true,
      sampledBytes: primaryTable.sampledBytes,
      taskSuggestion: targetColumn && profile[targetColumn]
        ? (profile[targetColumn].dtype === 'number' ? 'regression' : 'classification')
        : null,
      joinSuggestions: suggestJoins(tables),
    });

    return {
      ok: true,
      datasetId: uploadId,
      primary,
      tables,
      schema: metadata.schema,
      stats,
      columns: primaryTable.columns,
      profile,
      preview: primaryTable.rows.slice(0, previewRows),
      sampleRows: primaryTable.rows.slice(0, sampleRows),
      metadata,
      joinSuggestions: suggestJoins(tables),
      correlations: [],
      outliers: [],
      clientOnly: true,
    };
  }

  if (imageFiles.length > 0) {
    return buildImageMetadata(entry, options);
  }

  const genericFiles = entry.files.map((file) => ({
    path: file.name,
    name: file.name.split(/[\\/]/).pop() || file.name,
    ext: getFileExtension(file.name),
    size: file.file?.size ?? null,
  }));
  const genericMetadata = {
    datasetId: uploadId,
    sourceType: 'generic',
    primary: null,
    tables: [],
    schema: {
      primary: null,
      columns: genericFiles.length > 0 ? [
        { name: 'path', dtype: 'string', kind: 'text' },
        { name: 'ext', dtype: 'string', kind: 'categorical' },
        { name: 'size', dtype: 'number', kind: 'numeric' },
      ] : [],
      columnTypes: genericFiles.length > 0 ? { path: 'string', ext: 'string', size: 'number' } : {},
    },
    stats: {
      rows: genericFiles.length,
      columns: genericFiles.length > 0 ? 3 : 0,
      fileCount: genericFiles.length,
      totalBytes: entry.totalBytes || 0,
    },
    sampleRows: genericFiles.slice(0, previewRows),
    recommendations: ['Upload CSV or image files for richer analysis.'],
    taskSuggestion: null,
  };

  const metadata = {
    rows: genericFiles.length,
    columns: genericMetadata.stats.columns,
    target: null,
    taskSuggestion: null,
  };

  return {
    ok: true,
    datasetId: uploadId,
    primary: null,
    tables: {},
    schema: genericMetadata.schema,
    stats: genericMetadata.stats,
    columns: [],
    profile: {},
    preview: genericFiles.slice(0, previewRows),
    sampleRows: genericFiles.slice(0, sampleRows),
    metadata: {
      ...genericMetadata,
      ...metadata,
    },
    joinSuggestions: [],
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

  const profile = primary && tables[primary] ? (tables[primary].profile || {}) : {};

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
      schema: {
        primary,
        columns: sampleCols.map((name) => profile[name] || { name, dtype: 'unknown', kind: 'unknown' }),
        columnTypes: Object.fromEntries(sampleCols.map((name) => [name, profile[name]?.dtype || 'unknown'])),
      },
    },
  };
}

export async function previewClientImageUpload(uploadId, options = {}) {
  const entry = await getUploadEntry(uploadId);
  if (!entry) throw new Error('Client upload not found');

  const analysis = await buildImageMetadata(entry, options);
  return {
    ...analysis,
    type: 'image',
    count: analysis.stats?.rows || 0,
    root: `client://${entry.id}`,
    files: analysis.sampleRows || [],
    classes: Object.keys(analysis.stats?.classDistribution || {}),
    class_distribution: analysis.stats?.classDistribution || {},
    clientOnly: true,
  };
}
