import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inferType(values = []) {
  let seenNumeric = false;
  let seenDate = false;
  let seenString = false;

  for (const raw of values) {
    if (raw === null || raw === undefined || raw === '') continue;
    const str = String(raw).trim();
    if (!str) continue;

    if (!Number.isNaN(Number(str))) {
      seenNumeric = true;
      continue;
    }

    const dt = Date.parse(str);
    if (!Number.isNaN(dt)) {
      seenDate = true;
      continue;
    }

    seenString = true;
  }

  if (seenString) return 'string';
  if (seenNumeric && !seenDate) return 'number';
  if (seenDate && !seenNumeric) return 'datetime';
  if (seenDate && seenNumeric) return 'mixed';
  return 'unknown';
}

function splitCsvLine(line, delimiter) {
  return String(line).split(delimiter).map((v) => v.trim());
}

function parseCsvText(raw, delimiter = ',', header = true, sampleRows = 50) {
  const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  let headers = [];
  let start = 0;
  if (header) {
    headers = splitCsvLine(lines[0], delimiter).map((h, idx) => h || `col_${idx}`);
    start = 1;
  }

  const rows = [];
  for (let i = start; i < lines.length && rows.length < sampleRows; i++) {
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

function computeColumnProfile(rows, columns) {
  const profile = {};
  const numericColumns = [];

  for (const col of columns) {
    const values = rows.map((r) => r[col]);
    const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const dtype = inferType(nonEmpty);
    const nullCount = values.length - nonEmpty.length;

    const item = {
      name: col,
      dtype,
      nullCount,
      sampleValues: nonEmpty.slice(0, 5),
    };

    if (dtype === 'number') {
      const nums = nonEmpty.map((v) => safeNumber(v)).filter((v) => v !== null);
      if (nums.length > 0) {
        const sum = nums.reduce((a, b) => a + b, 0);
        item.stats = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          mean: sum / nums.length,
        };
        numericColumns.push(col);
      }
    }

    profile[col] = item;
  }

  return { profile, numericColumns };
}

function pearson(xs = [], ys = []) {
  if (xs.length === 0 || ys.length === 0 || xs.length !== ys.length) return null;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

function buildCorrelations(rows, numericColumns, maxColumns = 6) {
  const cols = numericColumns.slice(0, maxColumns);
  const matrix = [];

  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i];
      const b = cols[j];

      const pairs = rows
        .map((r) => [safeNumber(r[a]), safeNumber(r[b])])
        .filter(([x, y]) => x !== null && y !== null);

      if (pairs.length < 2) continue;
      const xs = pairs.map((p) => p[0]);
      const ys = pairs.map((p) => p[1]);
      const corr = pearson(xs, ys);
      if (corr === null) continue;

      matrix.push({ left: a, right: b, value: corr });
    }
  }

  return matrix.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function resolveSafePath(projectRoot, maybePath) {
  const resolved = path.resolve(projectRoot, maybePath);
  const rel = path.relative(projectRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path outside project root');
  }
  return resolved;
}

async function collectCsvFilesRecursive(basePath) {
  const out = [];
  const queue = [basePath];

  while (queue.length > 0) {
    const cur = queue.shift();
    let entries = [];
    try {
      entries = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.csv') {
        out.push(full);
      }
    }
  }

  return out;
}

async function collectCsvTargets(projectRoot, body) {
  const delimiter = body?.delimiter || ',';
  const header = body?.header !== false;
  const sampleRows = Number.isFinite(Number(body?.sampleRows)) ? Math.max(1, Number(body.sampleRows)) : 50;

  const rootPath = body?.path ? resolveSafePath(projectRoot, body.path) : null;
  const files = Array.isArray(body?.files) ? body.files : [];
  const selected = [];

  if (files.length > 0) {
    for (const f of files) {
      const full = rootPath ? path.resolve(rootPath, f) : resolveSafePath(projectRoot, f);
      const rel = rootPath ? path.relative(rootPath, full) : path.relative(projectRoot, full);
      if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
      if (path.extname(full).toLowerCase() !== '.csv') continue;
      selected.push(full);
    }
  } else if (rootPath) {
    const st = await fs.stat(rootPath);
    if (st.isDirectory()) {
      const nested = await collectCsvFilesRecursive(rootPath);
      selected.push(...nested);
    } else if (st.isFile() && path.extname(rootPath).toLowerCase() === '.csv') {
      selected.push(rootPath);
    }
  }

  if (selected.length === 0) {
    throw new Error('No CSV files found for inspection');
  }

  const tables = {};
  for (const targetFile of selected) {
    const raw = await fs.readFile(targetFile, 'utf8');
    const parsed = parseCsvText(raw, delimiter, header, sampleRows);
    const name = path.parse(targetFile).name;
    const { profile, numericColumns } = computeColumnProfile(parsed.rows, parsed.columns);

    tables[name] = {
      file: path.relative(projectRoot, targetFile).replace(/\\/g, '/'),
      columns: parsed.columns,
      rows: parsed.rows,
      profile,
      numericColumns,
      rowCountSampled: parsed.rows.length,
    };
  }

  return tables;
}

function joinCandidates(tables) {
  const names = Object.keys(tables || {});
  const out = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const left = names[i];
      const right = names[j];
      const leftCols = new Set(tables[left]?.columns || []);
      const rightCols = new Set(tables[right]?.columns || []);

      for (const col of leftCols) {
        if (!rightCols.has(col)) continue;
        out.push({ left, right, on: col, type: 'left' });
      }
    }
  }
  return out;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const projectRoot = process.cwd();
    const tables = await collectCsvTargets(projectRoot, body || {});

    const tableNames = Object.keys(tables);
    const primary = body?.primary && tables[body.primary] ? body.primary : tableNames[0];
    const primaryTable = tables[primary];
    const { profile, numericColumns } = computeColumnProfile(primaryTable.rows, primaryTable.columns);

    const targetColumn = body?.target_column || '';
    const taskSuggestion = (() => {
      if (!targetColumn || !profile[targetColumn]) return null;
      const dtype = profile[targetColumn].dtype;
      if (dtype === 'number') return 'regression';
      if (dtype === 'string') return 'classification';
      return 'unknown';
    })();

    const correlations = buildCorrelations(primaryTable.rows, numericColumns, 8);
    const outliers = [];
    for (const col of numericColumns.slice(0, 8)) {
      const values = primaryTable.rows.map((r) => safeNumber(r[col])).filter((v) => v !== null);
      if (values.length < 2) continue;
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const min = q1 - 1.5 * iqr;
      const max = q3 + 1.5 * iqr;
      const count = values.filter((v) => v < min || v > max).length;
      outliers.push({ column: col, count, ratio: values.length > 0 ? count / values.length : 0 });
    }

    const metadata = {
      rows: primaryTable.rows.length,
      columns: primaryTable.columns.length,
      target: targetColumn || null,
      numeric: Object.values(profile).filter((p) => p.dtype === 'number').map((p) => p.name),
      categorical: Object.values(profile).filter((p) => p.dtype === 'string').map((p) => p.name),
      datetime: Object.values(profile).filter((p) => p.dtype === 'datetime').map((p) => p.name),
      taskSuggestion,
    };

    return NextResponse.json({
      ok: true,
      primary,
      tables,
      columns: primaryTable.columns,
      profile,
      preview: primaryTable.rows.slice(0, 50),
      metadata,
      joinSuggestions: joinCandidates(tables),
      correlations,
      outliers,
    });
  } catch (err) {
    const message = String(err?.message || err);
    if (message.includes('No CSV files found')) {
      return NextResponse.json({ ok: false, error: message, columns: [], preview: [], joinSuggestions: [] }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
