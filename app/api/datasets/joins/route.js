import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function splitCsvLine(line, delimiter) {
  return String(line).split(delimiter).map((v) => v.trim());
}

async function readCsvColumns(filePath, delimiter, header) {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  if (!header) {
    const cols = splitCsvLine(lines[0], delimiter);
    return cols.map((_, idx) => `col_${idx}`);
  }
  return splitCsvLine(lines[0], delimiter).map((h, idx) => h || `col_${idx}`);
}

function resolveSafe(projectRoot, p) {
  const resolved = path.resolve(projectRoot, p);
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

async function loadCsvColumns(projectRoot, body) {
  const delimiter = body?.delimiter || ',';
  const header = body?.header !== false;
  const rootPath = body?.path ? resolveSafe(projectRoot, body.path) : null;
  const files = Array.isArray(body?.files) ? body.files : [];

  const targets = [];
  if (files.length > 0) {
    for (const file of files) {
      const full = rootPath ? path.resolve(rootPath, file) : resolveSafe(projectRoot, file);
      const rel = rootPath ? path.relative(rootPath, full) : path.relative(projectRoot, full);
      if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
      if (path.extname(full).toLowerCase() !== '.csv') continue;
      targets.push(full);
    }
  } else if (rootPath) {
    const st = await fs.stat(rootPath);
    if (st.isDirectory()) {
      const nested = await collectCsvFilesRecursive(rootPath);
      targets.push(...nested);
    } else if (st.isFile() && path.extname(rootPath).toLowerCase() === '.csv') {
      targets.push(rootPath);
    }
  }

  if (targets.length === 0) throw new Error('No CSV files found');

  const columnsByTable = {};
  for (const full of targets) {
    const name = path.parse(full).name;
    const columns = await readCsvColumns(full, delimiter, header);
    columnsByTable[name] = columns;
  }

  return columnsByTable;
}

function buildSuggestions(columnsByTable) {
  const names = Object.keys(columnsByTable || {});
  const suggestions = [];

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const left = names[i];
      const right = names[j];
      const leftSet = new Set(columnsByTable[left] || []);
      const rightSet = new Set(columnsByTable[right] || []);
      for (const col of leftSet) {
        if (!rightSet.has(col)) continue;
        suggestions.push({ left, right, on: col, type: 'left' });
      }
    }
  }

  return suggestions;
}

function validateRelations(relations, columnsByTable, primary) {
  const checks = [];
  for (let i = 0; i < relations.length; i++) {
    const rel = relations[i] || {};
    const left = rel.left || primary;
    const right = rel.right;
    const on = rel.on;

    if (!right || !on) {
      checks.push({ index: i, ok: false, error: 'Relation needs right and on' });
      continue;
    }
    if (!columnsByTable[left]) {
      checks.push({ index: i, ok: false, error: `Unknown left table: ${left}` });
      continue;
    }
    if (!columnsByTable[right]) {
      checks.push({ index: i, ok: false, error: `Unknown right table: ${right}` });
      continue;
    }
    if (!columnsByTable[left].includes(on)) {
      checks.push({ index: i, ok: false, error: `Column ${on} missing in ${left}` });
      continue;
    }
    if (!columnsByTable[right].includes(on)) {
      checks.push({ index: i, ok: false, error: `Column ${on} missing in ${right}` });
      continue;
    }

    checks.push({ index: i, ok: true });
  }

  return checks;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const projectRoot = process.cwd();
    const columnsByTable = await loadCsvColumns(projectRoot, body || {});

    const tableNames = Object.keys(columnsByTable);
    const primary = body?.primary && columnsByTable[body.primary] ? body.primary : tableNames[0];
    const relations = Array.isArray(body?.relations) ? body.relations : [];

    const suggestions = buildSuggestions(columnsByTable);
    const validation = validateRelations(relations, columnsByTable, primary);
    const valid = validation.every((it) => it.ok);

    return NextResponse.json({
      ok: true,
      valid,
      primary,
      columnsByTable,
      suggestions,
      validation,
    });
  } catch (err) {
    const message = String(err?.message || err);
    if (message.includes('No CSV files found')) {
      return NextResponse.json({ ok: false, error: message, valid: false, suggestions: [], validation: [] }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
