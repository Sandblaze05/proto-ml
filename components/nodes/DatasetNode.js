'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import { FolderOpen, Eye, Code2, ChevronDown, ChevronUp, ImageIcon, Database, FileText, Braces, Globe, Table2, Upload, ShieldCheck, List, Search, Link2, Trash2, Lock } from 'lucide-react';
import { useExecutionStore } from '../../store/useExecutionStore';
import { useUIStore } from '../../store/useUIStore';
import { previewGraphClient } from '../../lib/executor/clientPreviewExecutor';
import {
  createClientUpload,
  deleteClientUpload,
  inspectClientUpload,
  listClientUploads,
  previewClientUpload,
  previewClientImageUpload,
  validateClientUpload,
  validateClientUploadJoins,
} from '../../lib/clientUploadStore';
import { generateDatasetPythonCode } from '../../lib/pythonTemplates/datasetNodeTemplate';
import MonacoCodeEditor from './MonacoCodeEditor';
import { getUploadInputMode } from './datasetUploadMode';

const STRICT_CLIENT_ONLY_DATASETS = true;

const PORT_TW = {
  tensor: { dot: 'bg-purple-400', badge: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  dataloader: { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  sequence: { dot: 'bg-blue-400', badge: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  list: { dot: 'bg-amber-400', badge: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  dict: { dot: 'bg-red-400', badge: 'text-red-400 bg-red-400/10 border-red-400/30' },
};
const PORT_TW_DEFAULT = { dot: 'bg-[#faebd7]', badge: 'text-[#faebd7] bg-[#faebd7]/10 border-[#faebd7]/30' };

const PORT_HEX = {
  tensor: '#c084fc',
  dataloader: '#34d399',
  sequence: '#60a5fa',
  list: '#fbbf24',
  dict: '#f87171',
  default: '#faebd7',
};

function portHex(dt) { return PORT_HEX[dt] ?? PORT_HEX.default; }
function portTw(dt) { return PORT_TW[dt] ?? PORT_TW_DEFAULT; }

function inferPortDatatype(name = '', fallback = 'default') {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return fallback;

  if (n === 'images' || n.includes('image') || n.includes('tensor') || n.includes('pixel')) return 'tensor';
  if (n === 'labels' || n.includes('label') || n.includes('sequence') || n.includes('token')) return 'sequence';
  if (n === 'classes' || n.includes('class') || n.includes('map') || n.includes('dict') || n.includes('meta')) return 'dict';
  if (n.includes('loader') || n.includes('batch')) return 'dataloader';
  if (n.includes('list') || n.includes('ids') || n.includes('index')) return 'list';

  return fallback;
}

function normalizePort(port, idx, fallbackPrefix) {
  if (typeof port === 'string') {
    const trimmed = port.trim();
    const name = trimmed || `${fallbackPrefix}_${idx + 1}`;
    return {
      name,
      datatype: inferPortDatatype(name, 'default'),
      shape: [],
    };
  }

  if (port && typeof port === 'object') {
    const name = typeof port.name === 'string' && port.name.trim().length > 0
      ? port.name.trim()
      : `${fallbackPrefix}_${idx + 1}`;

    return {
      ...port,
      name,
      datatype: inferPortDatatype(name, port.datatype || 'default'),
      shape: Array.isArray(port.shape) ? port.shape : [],
    };
  }

  return {
    name: `${fallbackPrefix}_${idx + 1}`,
    datatype: 'default',
    shape: [],
  };
}

const TYPE_ICONS = {
  'dataset.image': ImageIcon,
  'dataset.csv': Table2,
  'dataset.text': FileText,
  'dataset.json': Braces,
  'dataset.database': Database,
  'dataset.api': Globe,
};

const TYPE_HEX = {
  'dataset.image': '#c084fc',
  'dataset.csv': '#34d399',
  'dataset.text': '#60a5fa',
  'dataset.json': '#fbbf24',
  'dataset.database': '#f87171',
  'dataset.api': '#a78bfa',
};

const TABS = ['Source', 'Code', 'Preview'];
const TAB_ICONS = { Source: FolderOpen, Code: Code2, Preview: Eye };

function Field({ label, children }) {
  return (
    <div className="mb-2">
      <div className="text-[9px] text-[#faebd7]/40 uppercase tracking-wider mb-1">{label}</div>
      {children}
    </div>
  );
}

function NodeInput({ value, onChange, type = 'text', placeholder = '', disabled = false }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => !disabled && onChange(e.target.value)}
      disabled={disabled}
      className={`w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 outline-none focus:border-[#faebd7]/30 placeholder:text-[#faebd7]/20 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    />
  );
}

function NodeSelect({ value, onChange, options, disabled = false }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => !disabled && onChange(e.target.value)}
      disabled={disabled}
      className={`w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 outline-none focus:border-[#faebd7]/30 disabled:opacity-50 ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function MultiCheckboxDropdown({ options, value = [], onChange, disabled = false, placeholder = 'Select columns...' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const selected = Array.isArray(value) ? value : [];

  const toggleOne = (item) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const summary = selected.length === 0
    ? placeholder
    : `${selected.length} selected`;

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-2 py-1.5 outline-none focus:border-[#faebd7]/30 disabled:opacity-50 flex items-center justify-between"
      >
        <span className="truncate text-left">{summary}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#0f0f12] border border-[#faebd7]/15 rounded max-h-36 overflow-auto p-1">
          {options.length === 0 && <div className="text-[10px] text-[#faebd7]/45 px-1.5 py-1">No columns detected</div>}
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[#faebd7]/7 cursor-pointer text-[10px] text-[#faebd7] font-mono">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOne(opt)}
                  className="accent-[#faebd7]"
                />
                <span className="truncate">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange, disabled = false }) {
  return (
    <div className={`flex items-center justify-between mb-2 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <span className="text-[10px] text-[#faebd7]/70 font-mono">{label}</span>
      <button
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); !disabled && onChange(!value); }}
        className={`relative w-8 h-4 rounded-full border-none transition-colors duration-200 shrink-0 ${value ? 'bg-purple-500' : 'bg-[#2a2a2a]'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-[#faebd7] transition-all duration-200 ${value ? 'left-4.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function IconHoverAction({ icon: Icon, label, onClick, disabled = false, tone = 'neutral' }) {
  const toneClass = tone === 'danger'
    ? 'bg-red-700/30 hover:bg-red-700/45'
    : tone === 'accent'
      ? 'bg-indigo-700/30 hover:bg-indigo-700/45'
      : tone === 'success'
        ? 'bg-emerald-600/20 border border-emerald-600/20 hover:bg-emerald-600/30'
        : 'bg-slate-700/40 hover:bg-slate-700/50';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); !disabled && onClick?.(); }}
      disabled={disabled}
      className={`group relative inline-flex items-center px-2 py-1 text-[10px] rounded transition-colors disabled:opacity-40 ${toneClass} ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      <Icon size={12} />
      {!disabled && (
        <span className="pointer-events-none absolute left-0 top-full mt-1 whitespace-nowrap rounded-md border border-[#faebd7]/15 bg-[#101014] px-2 py-1 text-[10px] text-[#faebd7] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          {label}
        </span>
      )}
    </button>
  );
}

function SourceTab({
  nodeType,
  config,
  onChange,
  onValidate,
  onList,
  onDelete,
  validation,
  filesList,
  busy,
  onUpload,
  onInspect,
  inspectResult,
  onValidateJoins,
  uploadsList,
  disabled = false,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { useDirectoryPicker, acceptCsvFiles } = getUploadInputMode(nodeType, config.source_mode);

  const triggerUpload = useCallback(() => {
    if (fileRef.current) fileRef.current.click();
  }, []);

  useEffect(() => {
    const el = fileRef.current;
    if (!el) return;

    try {
      if (useDirectoryPicker) {
        el.setAttribute('webkitdirectory', '');
        el.setAttribute('directory', '');
      } else {
        el.removeAttribute('webkitdirectory');
        el.removeAttribute('directory');
      }

      if (acceptCsvFiles) {
        el.setAttribute('accept', '.csv,text/csv');
      } else {
        el.removeAttribute('accept');
      }
    } catch {
      // ignore
    }
  }, [useDirectoryPicker, acceptCsvFiles]);

  const handleFiles = useCallback(async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await onUpload?.(Array.from(files));
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  }, [onUpload]);

  const renderPathStatus = (mode = 'either') => {
    if (!validation) return null;
    if (validation.error) return <div className="text-[10px] text-red-400 mt-1">{validation.error}</div>;
    if (validation.uploaded) return <div className="text-[10px] text-emerald-400 mt-1">Upload complete.</div>;
    if (validation.deleted) return <div className="text-[10px] text-emerald-400 mt-1">Uploaded folder deleted.</div>;
    if (validation.exists === false) return <div className="text-[10px] text-red-400 mt-1">Path does not exist</div>;
    if (mode === 'directory' && validation.exists && validation.isDirectory === false) return <div className="text-[10px] text-red-400 mt-1">Path is not a directory</div>;
    if (mode === 'file' && validation.exists && validation.isDirectory === true) return <div className="text-[10px] text-red-400 mt-1">Path is a directory, expected a file</div>;
    return <div className="text-[10px] text-emerald-400 mt-1">Path looks valid.</div>;
  };

  if (nodeType === 'dataset.image') {
    return (
      <>
        <Field label="Folder Path">
          <NodeInput value={config.path} onChange={(v) => onChange('path', v)} placeholder="./data/uploads/... or /data/images" disabled={disabled} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IconHoverAction icon={Upload} label="Upload Folder" onClick={triggerUpload} disabled={uploading || busy} tone="success" />
            <IconHoverAction icon={ShieldCheck} label="Validate" onClick={onValidate} disabled={busy} tone="accent" />
            <IconHoverAction icon={Search} label="Inspect" onClick={onInspect} disabled={busy} tone="accent" />
            <IconHoverAction icon={List} label="List" onClick={() => onList && onList()} disabled={busy} />
            <IconHoverAction icon={Trash2} label="Delete" onClick={onDelete} disabled={busy} tone="danger" />
            {uploading && <span className="text-[10px] text-[#faebd7]/50">Uploading...</span>}
            {busy && !uploading && <span className="text-[10px] text-[#faebd7]/50">Working...</span>}
          </div>
          <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
          {renderPathStatus('directory')}
          {filesList && filesList.length > 0 && (
            <div className="mt-2 bg-black/40 px-2 py-1 rounded text-[9px] font-mono max-h-40 overflow-auto">
              {filesList.map((f, i) => <div key={i}>{f}</div>)}
            </div>
          )}
        </Field>
        <Field label="Format">
          <NodeSelect value={config.format} onChange={(v) => onChange('format', v)} options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }, { value: 'tiff', label: 'TIFF' }]} disabled={disabled} />
        </Field>
        <Field label="Label Strategy">
          <NodeSelect value={config.label_strategy} onChange={(v) => onChange('label_strategy', v)} options={[{ value: 'folder_name', label: 'Folder Name' }, { value: 'csv_mapping', label: 'CSV Mapping' }, { value: 'json_mapping', label: 'JSON Mapping' }, { value: 'none', label: 'Unlabeled' }]} disabled={disabled} />
        </Field>
        <Toggle label="Recursive" value={config.recursive} onChange={(v) => onChange('recursive', v)} disabled={disabled} />
      </>
    );
  }

  if (nodeType === 'dataset.csv') {
    const mode = config.source_mode || 'folder';
    const files = Array.isArray(config.files) ? config.files : [];
    const features = Array.isArray(config.features) && config.features.length > 0
      ? config.features
      : (Array.isArray(config.feature_columns) ? config.feature_columns : []);
    const relations = Array.isArray(config.relations) ? config.relations : [];

    const tableNameFromEntry = (entry) => {
      const base = String(entry || '').split(/[\\/]/).pop() || '';
      return base.replace(/\.csv$/i, '').trim();
    };

    const discoveredFromInspect = inspectResult?.tables ? Object.keys(inspectResult.tables) : [];
    const discoveredFromValidation = Array.isArray(filesList) ? filesList.map((f) => tableNameFromEntry(f)) : [];
    const discoveredFromConfig = files.map((f) => tableNameFromEntry(f));
    const tableNames = Array.from(new Set([
      ...discoveredFromInspect,
      ...discoveredFromValidation,
      ...discoveredFromConfig,
    ].filter(Boolean)));
    if (config.primary && !tableNames.includes(config.primary)) tableNames.unshift(config.primary);

    const primaryOptions = [
      { value: '', label: tableNames.length > 0 ? 'Select table...' : 'No files detected' },
      ...tableNames.map((name) => ({ value: name, label: name })),
    ];

    const inspectColumns = Array.isArray(inspectResult?.columns) ? inspectResult.columns : [];
    const previewColumns = Array.isArray(inspectResult?.preview) && inspectResult.preview.length > 0
      ? Object.keys(inspectResult.preview[0] || {})
      : [];
    const profileColumns = inspectResult?.profile ? Object.keys(inspectResult.profile) : [];
    const targetColumns = Array.from(new Set([
      ...inspectColumns,
      ...previewColumns,
      ...profileColumns,
    ].filter(Boolean)));
    if (config.target_column && !targetColumns.includes(config.target_column)) targetColumns.unshift(config.target_column);

    const targetOptions = [
      { value: '', label: targetColumns.length > 0 ? 'None' : 'No columns detected' },
      ...targetColumns.map((name) => ({ value: name, label: name })),
    ];

    const effectiveDatasetPath = config.client_upload_id
      ? `client://${config.client_upload_id}`
      : (config.path || '');

    const tableColumnsByName = inspectResult?.tables
      ? Object.fromEntries(Object.entries(inspectResult.tables).map(([name, tbl]) => [name, Array.isArray(tbl?.columns) ? tbl.columns : []]))
      : {};

    const allTableColumns = inspectResult?.tables
      ? Object.values(inspectResult.tables).flatMap((t) => (Array.isArray(t?.columns) ? t.columns : []))
      : [];
    const featureOptions = Array.from(new Set([
      ...allTableColumns,
      ...targetColumns,
      ...features,
    ].filter(Boolean)));

    const updateRelation = (idx, key, value) => {
      const next = relations.map((rel, i) => {
        if (i !== idx) return rel;
        const nextRel = { ...rel, [key]: value };
        if (key === 'left' || key === 'right') nextRel.on = '';
        return nextRel;
      });
      onChange('relations', next);
    };

    const removeRelation = (idx) => {
      const next = relations.filter((_, i) => i !== idx);
      onChange('relations', next);
    };

    const addRelation = () => {
      const next = [...relations, { left: config.primary || '', right: '', on: '', type: 'left' }];
      onChange('relations', next);
    };

    const applySuggestedRelations = () => {
      const suggestions = Array.isArray(inspectResult?.joinSuggestions) ? inspectResult.joinSuggestions : [];
      if (suggestions.length === 0) return;

      const chosenPrimary = config.primary || inspectResult?.primary || suggestions[0]?.left || suggestions[0]?.right || '';
      if (!config.primary && chosenPrimary) onChange('primary', chosenPrimary);

      const normalized = suggestions.map((s) => {
        const left = String(s?.left || '').trim();
        const right = String(s?.right || '').trim();
        const on = String(s?.on || '').trim();
        const type = String(s?.type || 'left').trim() || 'left';
        if (!on) return null;

        if (chosenPrimary) {
          if (left === chosenPrimary) return { left: chosenPrimary, right, on, type };
          if (right === chosenPrimary) return { left: chosenPrimary, right: left, on, type: 'left' };
        }

        return left && right ? { left, right, on, type } : null;
      }).filter(Boolean);

      const unique = [];
      const seen = new Set();
      for (const rel of normalized) {
        const key = `${rel.left}|${rel.right}|${rel.on}|${rel.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(rel);
      }

      if (unique.length > 0) onChange('relations', unique);
    };

    const quickResult = (() => {
      if (validation?.error) return { tone: 'text-red-300', text: validation.error };
      if (validation?.joinValid === true) return { tone: 'text-emerald-300', text: 'Join validation passed.' };
      if (validation?.joinValid === false) return { tone: 'text-amber-300', text: 'Join validation has issues.' };
      if (inspectResult?.columns?.length > 0) return { tone: 'text-emerald-300', text: `Inspected ${inspectResult.columns.length} columns.` };
      if (filesList?.length > 0) return { tone: 'text-emerald-300', text: `Detected ${filesList.length} files.` };
      if (validation?.exists && validation?.isDirectory) return { tone: 'text-emerald-300', text: 'Path exists and is readable.' };
      return { tone: 'text-[#faebd7]/60', text: 'Run an action to see results here.' };
    })();

    return (
      <>
        <Field label="Source Mode">
          <NodeSelect
            value={mode}
            onChange={(v) => onChange('source_mode', v)}
            options={[{ value: 'folder', label: 'Folder' }, { value: 'files', label: 'Explicit Files' }]}
          />
        </Field>

        <Field label="Dataset Path">
          <NodeInput
            value={effectiveDatasetPath}
            onChange={(v) => {
              if (config.client_upload_id) onChange('client_upload_id', '');
              onChange('path', v);
            }}
            placeholder="./data/uploads/... or ./data/chocolate-sales"
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IconHoverAction icon={Upload} label={uploading ? 'Uploading...' : 'Upload'} onClick={triggerUpload} disabled={uploading || busy} tone="success" />
            <IconHoverAction icon={ShieldCheck} label="Validate" onClick={onValidate} disabled={busy} tone="accent" />
            <IconHoverAction icon={List} label="List" onClick={() => onList && onList()} disabled={busy} />
            <IconHoverAction icon={Search} label="Inspect" onClick={onInspect} disabled={busy} tone="accent" />
            <IconHoverAction icon={Link2} label="Joins" onClick={onValidateJoins} disabled={busy} tone="accent" />
            <IconHoverAction icon={Trash2} label="Delete" onClick={onDelete} disabled={busy} tone="danger" />
            {busy && <span className="text-[10px] text-[#faebd7]/50">Working...</span>}
          </div>
          <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
          {renderPathStatus('either')}
        </Field>

        <Field label="Latest Result">
          <div className={`text-[10px] font-mono bg-black/40 px-2 py-1 rounded ${quickResult.tone}`}>{quickResult.text}</div>
        </Field>

        {mode === 'files' && (
          <Field label="Files (one per line)">
            <textarea
              value={files.join('\n')}
              onChange={(e) => onChange('files', e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))}
              className="w-full h-16 bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 outline-none focus:border-[#faebd7]/30 placeholder:text-[#faebd7]/20"
              placeholder="sales.csv&#10;products.csv&#10;customers.csv"
            />
          </Field>
        )}

        {(inspectResult?.columns?.length > 0 || inspectResult?.joinSuggestions?.length > 0 || inspectResult?.correlations?.length > 0 || inspectResult?.outliers?.length > 0 || (filesList && filesList.length > 0)) && (
          <Field label="Analysis Results">
            <div className="space-y-1.5">
              {(inspectResult?.metadata || inspectResult?.schema || inspectResult?.stats) && (
                <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70 max-h-28 overflow-auto space-y-0.5">
                  <div>Dataset ID: {inspectResult.datasetId || inspectResult.metadata?.datasetId || localConfig.dataset_id || localConfig.client_upload_id || '—'}</div>
                  <div>Source: {inspectResult.metadata?.sourceType || inspectResult.schema?.sourceType || inspectResult.sourceType || type.split('.').pop()}</div>
                  <div>Rows: {inspectResult.metadata?.rows ?? inspectResult.stats?.rows ?? '—'} | Columns: {inspectResult.metadata?.columns ?? inspectResult.stats?.columns ?? '—'}</div>
                  <div>Missing cells: {inspectResult.stats?.missingCells ?? '—'} | Duplicate rows: {inspectResult.stats?.duplicateRows ?? '—'}</div>
                  <div>Task Suggestion: {inspectResult.metadata?.taskSuggestion || inspectResult.taskSuggestion || '—'}</div>
                  {Array.isArray(inspectResult.metadata?.recommendations) && inspectResult.metadata.recommendations.length > 0 && (
                    <div>
                      <div className="text-[#faebd7]/45">Recommendations:</div>
                      <div className="whitespace-pre-wrap">{inspectResult.metadata.recommendations.slice(0, 3).join(' · ')}</div>
                    </div>
                  )}
                </div>
              )}

              {inspectResult?.columns?.length > 0 && (
                <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70 max-h-24 overflow-auto">
                  <div>Primary: {inspectResult.primary || '—'}</div>
                  <div>Rows(sample): {inspectResult.metadata?.rows ?? '—'} | Columns: {inspectResult.metadata?.columns ?? '—'}</div>
                  <div>Task Suggestion: {inspectResult.metadata?.taskSuggestion || '—'}</div>
                </div>
              )}

              {inspectResult?.joinSuggestions?.length > 0 && (
                <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70 max-h-20 overflow-auto">
                  {inspectResult.joinSuggestions.slice(0, 12).map((j, idx) => (
                    <div key={`${j.left}-${j.right}-${j.on}-${idx}`}>{j.left}.{j.on} {'->'} {j.right}.{j.on}</div>
                  ))}
                </div>
              )}

              {inspectResult?.correlations?.length > 0 && (
                <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70 max-h-20 overflow-auto">
                  {inspectResult.correlations.slice(0, 8).map((c, idx) => (
                    <div key={`${c.left}-${c.right}-${idx}`}>{c.left} vs {c.right}: {Number(c.value).toFixed(3)}</div>
                  ))}
                </div>
              )}

              {inspectResult?.outliers?.length > 0 && (
                <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70 max-h-20 overflow-auto">
                  {inspectResult.outliers.slice(0, 8).map((o, idx) => (
                    <div key={`${o.column}-${idx}`}>{o.column}: {o.count} ({(o.ratio * 100).toFixed(1)}%)</div>
                  ))}
                </div>
              )}

              {filesList && filesList.length > 0 && (
                <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70 max-h-20 overflow-auto">
                  {filesList.map((f, i) => <div key={i}>{f}</div>)}
                </div>
              )}
            </div>
          </Field>
        )}

        <Field label="Primary Table">
          <NodeSelect
            value={config.primary || ''}
            onChange={(v) => {
              onChange('primary', v);
              onChange('target_column', '');
            }}
            options={primaryOptions}
            disabled={tableNames.length === 0}
          />
        </Field>
        <Field label="Target Column">
          <NodeSelect
            value={config.target_column || ''}
            onChange={(v) => onChange('target_column', v)}
            options={targetOptions}
            disabled={targetColumns.length === 0}
          />
        </Field>
        <Field label="Features">
          <MultiCheckboxDropdown
            options={featureOptions}
            value={features}
            onChange={(selected) => onChange('features', selected)}
            disabled={featureOptions.length === 0}
            placeholder="Select features..."
          />
        </Field>
        <Field label="Delimiter"><NodeSelect value={config.delimiter} onChange={(v) => onChange('delimiter', v)} options={[{ value: ',', label: 'Comma' }, { value: '\t', label: 'Tab' }, { value: ';', label: 'Semicolon' }]} /></Field>
        <Field label="Missing Strategy"><NodeSelect value={(config.missing && config.missing.strategy) || config.handle_missing || 'drop'} onChange={(v) => { onChange('handle_missing', v); onChange('missing', { ...(config.missing || {}), strategy: v }); }} options={[{ value: 'drop', label: 'Drop Rows' }, { value: 'mean', label: 'Fill Numeric Mean' }]} /></Field>
        <Toggle label="Has Header" value={config.header} onChange={(v) => onChange('header', v)} />

        <Field label="Relations (joins)">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); applySuggestedRelations(); }}
                disabled={!Array.isArray(inspectResult?.joinSuggestions) || inspectResult.joinSuggestions.length === 0}
                className="px-2 py-1 text-[10px] bg-indigo-700/30 hover:bg-indigo-700/45 rounded disabled:opacity-45"
              >
                Use Suggested Joins
              </button>
            </div>

            {relations.map((rel, idx) => (
              <div key={`${idx}-${rel.right || ''}-${rel.on || ''}`} className="rounded border border-[#faebd7]/10 bg-black/35 p-1.5">
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <NodeSelect
                    value={rel.left || config.primary || ''}
                    onChange={(v) => updateRelation(idx, 'left', v)}
                    options={[
                      { value: '', label: tableNames.length > 0 ? 'Left table...' : 'No tables' },
                      ...tableNames.map((name) => ({ value: name, label: name })),
                    ]}
                    disabled={tableNames.length === 0}
                  />
                  <NodeSelect
                    value={rel.right || ''}
                    onChange={(v) => updateRelation(idx, 'right', v)}
                    options={[
                      { value: '', label: tableNames.length > 0 ? 'Right table...' : 'No tables' },
                      ...tableNames.filter((name) => name !== (rel.left || config.primary || '')).map((name) => ({ value: name, label: name })),
                    ]}
                    disabled={tableNames.length === 0}
                  />
                </div>

                <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 items-center">
                  <NodeSelect
                    value={rel.on || ''}
                    onChange={(v) => updateRelation(idx, 'on', v)}
                    options={(() => {
                      const leftCols = tableColumnsByName[rel.left || config.primary || ''] || [];
                      const rightCols = tableColumnsByName[rel.right || ''] || [];
                      const shared = leftCols.length > 0 && rightCols.length > 0
                        ? leftCols.filter((c) => rightCols.includes(c))
                        : Array.from(new Set([...(leftCols || []), ...(rightCols || [])]));
                      const items = shared.length > 0 ? shared : targetColumns;
                      return [
                        { value: '', label: items.length > 0 ? 'Join column...' : 'No columns' },
                        ...items.map((name) => ({ value: name, label: name })),
                      ];
                    })()}
                    disabled={targetColumns.length === 0}
                  />
                  <NodeSelect value={rel.type || 'left'} onChange={(v) => updateRelation(idx, 'type', v)} options={[{ value: 'left', label: 'left' }, { value: 'inner', label: 'inner' }, { value: 'outer', label: 'outer' }]} />
                  <button onClick={(e) => { e.stopPropagation(); removeRelation(idx); }} className="px-2 py-1 text-[9px] bg-red-700/30 hover:bg-red-700/40 rounded text-[#faebd7]">x</button>
                </div>
              </div>
            ))}
            <button onClick={(e) => { e.stopPropagation(); addRelation(); }} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded self-start">+ Add Join</button>
          </div>
        </Field>
      </>
    );
  }

  if (nodeType === 'dataset.text') {
    return (
      <>
        <Field label="File Path">
          <NodeInput value={config.path} onChange={(v) => onChange('path', v)} placeholder="/data/corpus.txt or client://upload_..." />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IconHoverAction icon={Upload} label="Upload" onClick={triggerUpload} disabled={uploading || busy} tone="success" />
            <IconHoverAction icon={ShieldCheck} label="Validate" onClick={onValidate} disabled={busy} tone="accent" />
            <IconHoverAction icon={Search} label="Inspect" onClick={onInspect} disabled={busy} tone="accent" />
            <IconHoverAction icon={List} label="List Files" onClick={() => onList && onList()} disabled={busy} />
            <IconHoverAction icon={Trash2} label="Delete" onClick={onDelete} disabled={busy} tone="danger" />
            {uploading && <span className="text-[10px] text-[#faebd7]/50">Uploading...</span>}
            {busy && !uploading && <span className="text-[10px] text-[#faebd7]/50">Working...</span>}
          </div>
          <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
          {renderPathStatus('file')}
          {filesList && filesList.length > 0 && (
            <div className="mt-2 bg-black/40 px-2 py-1 rounded text-[9px] font-mono max-h-40 overflow-auto">
              {filesList.map((f, i) => <div key={i}>{f}</div>)}
            </div>
          )}
        </Field>
        <Field label="Format"><NodeSelect value={config.file_format} onChange={(v) => onChange('file_format', v)} options={[{ value: 'txt', label: 'TXT' }, { value: 'csv', label: 'CSV' }, { value: 'jsonl', label: 'JSONL' }]} /></Field>
        <Field label="Text Column"><NodeInput value={config.text_column} onChange={(v) => onChange('text_column', v)} placeholder="text" /></Field>
        <Field label="Label Column"><NodeInput value={config.label_column} onChange={(v) => onChange('label_column', v)} placeholder="label" /></Field>
        <Field label="Tokenizer"><NodeSelect value={config.tokenizer} onChange={(v) => onChange('tokenizer', v)} options={[{ value: 'whitespace', label: 'Whitespace' }, { value: 'bpe', label: 'BPE' }, { value: 'wordpiece', label: 'WordPiece' }, { value: 'custom', label: 'Custom' }]} /></Field>
        <Field label="Max Length"><NodeInput type="number" value={config.max_length} onChange={(v) => onChange('max_length', Number(v))} /></Field>
      </>
    );
  }

  if (nodeType === 'dataset.json') {
    return (
      <>
        <Field label="File Path">
          <NodeInput value={config.path} onChange={(v) => onChange('path', v)} placeholder="/data/data.json or client://upload_..." />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IconHoverAction icon={Upload} label="Upload" onClick={triggerUpload} disabled={uploading || busy} tone="success" />
            <IconHoverAction icon={ShieldCheck} label="Validate" onClick={onValidate} disabled={busy} tone="accent" />
            <IconHoverAction icon={Search} label="Inspect" onClick={onInspect} disabled={busy} tone="accent" />
            <IconHoverAction icon={List} label="List Files" onClick={() => onList && onList()} disabled={busy} />
            <IconHoverAction icon={Trash2} label="Delete" onClick={onDelete} disabled={busy} tone="danger" />
            {uploading && <span className="text-[10px] text-[#faebd7]/50">Uploading...</span>}
            {busy && !uploading && <span className="text-[10px] text-[#faebd7]/50">Working...</span>}
          </div>
          <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
          {renderPathStatus('file')}
          {filesList && filesList.length > 0 && (
            <div className="mt-2 bg-black/40 px-2 py-1 rounded text-[9px] font-mono max-h-40 overflow-auto">
              {filesList.map((f, i) => <div key={i}>{f}</div>)}
            </div>
          )}
        </Field>
        <Field label="Format"><NodeSelect value={config.file_format} onChange={(v) => onChange('file_format', v)} options={[{ value: 'json', label: 'JSON' }, { value: 'jsonl', label: 'JSONL' }]} /></Field>
        <Field label="Data Key"><NodeInput value={config.data_key} onChange={(v) => onChange('data_key', v)} placeholder="data.records" /></Field>
        <Field label="Label Key"><NodeInput value={config.label_key} onChange={(v) => onChange('label_key', v)} placeholder="label" /></Field>
      </>
    );
  }

  if (nodeType === 'dataset.database') {
    return (
      <>
        <Field label="DB Type"><NodeSelect value={config.db_type} onChange={(v) => onChange('db_type', v)} options={[{ value: 'postgresql', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL' }, { value: 'sqlite', label: 'SQLite' }, { value: 'mongodb', label: 'MongoDB' }]} /></Field>
        <Field label="Host"><NodeInput value={config.host} onChange={(v) => onChange('host', v)} placeholder="localhost" /></Field>
        <Field label="Database"><NodeInput value={config.database} onChange={(v) => onChange('database', v)} placeholder="mydb" /></Field>
        <Field label="Table"><NodeInput value={config.table} onChange={(v) => onChange('table', v)} placeholder="records" /></Field>
        <Field label="Query"><NodeInput value={config.query} onChange={(v) => onChange('query', v)} placeholder="SELECT * FROM ..." /></Field>
      </>
    );
  }

  if (nodeType === 'dataset.api') {
    return (
      <>
        <Field label="Endpoint URL"><NodeInput value={config.url} onChange={(v) => onChange('url', v)} placeholder="https://api.example.com/data" /></Field>
        <Field label="Method"><NodeSelect value={config.method} onChange={(v) => onChange('method', v)} options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }]} /></Field>
        <Field label="Auth Type"><NodeSelect value={config.auth_type} onChange={(v) => onChange('auth_type', v)} options={[{ value: 'none', label: 'None' }, { value: 'bearer', label: 'Bearer Token' }, { value: 'api_key', label: 'API Key' }, { value: 'basic', label: 'Basic Auth' }]} /></Field>
        {config.auth_type !== 'none' && <Field label="Auth Token"><NodeInput value={config.auth_token} onChange={(v) => onChange('auth_token', v)} placeholder="..." /></Field>}
        <Field label="Data Path"><NodeInput value={config.data_path} onChange={(v) => onChange('data_path', v)} placeholder="data" /></Field>
      </>
    );
  }

  return null;
}

function PreviewTab({ config, nodeType, previewing, onRunPreview, previewResult }) {
  const items = [
    { k: 'Type', v: nodeType },
    { k: 'Path', v: config.path || config.url || '—' },
    { k: 'Format', v: config.format || config.file_format || config.db_type || config.method || '—' },
  ];

  if (nodeType === 'dataset.image') {
    items.push({ k: 'Resize', v: config.resize?.join('x') || '—' });
    items.push({ k: 'Normalize', v: config.normalize || '—' });
  }

  const previewSummary = (() => {
    if (!previewResult) return '';
    if (previewResult.error) return `Error: ${previewResult.error}`;
    if (previewResult.uploaded) return `Uploaded: ${previewResult.uploaded}`;
    if (previewResult.type === 'image') return `📷 ${previewResult.count} images`;
    if (previewResult.type === 'text') return `📄 ${previewResult.count} text records`;
    if (previewResult.type === 'json') return `📋 ${previewResult.count} records ${previewResult.is_tabular ? `• ${previewResult.columns?.length || 0} cols` : ''}`;
    if (Array.isArray(previewResult)) return `Items: ${previewResult.length}`;
    if (Array.isArray(previewResult.rows)) return `Rows: ${previewResult.rows.length}`;
    if (typeof previewResult === 'object') return 'Preview ready';
    return String(previewResult);
  })();

  const csvRunSummary = (() => {
    if (nodeType !== 'dataset.csv' || !previewResult || previewResult.error) return null;

    const rows = Array.isArray(previewResult.rows) ? previewResult.rows : [];
    const metadata = previewResult.metadata || {};
    const target = metadata.target || config.target_column || null;
    const columns = Array.isArray(metadata.columnsList)
      ? metadata.columnsList
      : Object.keys(rows[0] || {}).filter((c) => c !== '_target');

    let features = Array.isArray(metadata.features) ? metadata.features : [];
    if (features.length === 0) {
      const configured = Array.isArray(config.features) ? config.features : (Array.isArray(config.feature_columns) ? config.feature_columns : []);
      features = configured.length > 0 ? configured.filter((c) => columns.includes(c) && c !== target) : columns.filter((c) => c !== target);
    }

    return { columns, features, target };
  })();

  return (
    <div className="flex flex-col gap-1">
      {items.map(({ k, v }) => (
        <div key={k} className="flex justify-between bg-black/50 px-1.5 py-0.5 rounded">
          <span className="text-[9px] text-[#faebd7]/30 font-mono uppercase">{k}</span>
          <span className="text-[9px] text-[#faebd7]/70 font-mono">{String(v ?? '—')}</span>
        </div>
      ))}

      <div className="mt-2 flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); onRunPreview && onRunPreview(); }} className="px-2 py-1 text-[10px] bg-purple-600/25 hover:bg-purple-600/35 rounded border border-purple-600/30">
          {previewing ? 'Previewing...' : 'Run Preview'}
        </button>
        <div className="text-[10px] text-[#faebd7]/50">{previewSummary}</div>
      </div>

      {csvRunSummary && (
        <div className="mt-2 space-y-1">
          <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/75">
            <span className="text-[#faebd7]/45">Target:</span> {csvRunSummary.target || 'None'}
          </div>
          <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/75 max-h-16 overflow-auto">
            <div className="text-[#faebd7]/45 mb-0.5">Features in run:</div>
            {csvRunSummary.features.length > 0 ? csvRunSummary.features.join(', ') : 'None'}
          </div>
          <div className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/75 max-h-16 overflow-auto">
            <div className="text-[#faebd7]/45 mb-0.5">Result columns:</div>
            {csvRunSummary.columns.length > 0 ? csvRunSummary.columns.join(', ') : 'None'}
          </div>
        </div>
      )}

      {previewResult && Array.isArray(previewResult) && (
        <div className="mt-2">
          <div className="text-[9px] text-[#faebd7]/50 mb-1 font-mono uppercase">Items ({previewResult.length} total)</div>
          <div className="space-y-0.5">
            {previewResult.slice(0, 5).map((it, i) => (
              <div key={i} className="text-[8px] bg-black/40 border border-[#faebd7]/10 px-2 py-1 rounded font-mono text-[#faebd7]/70">
                {it.path && <span className="text-[#faebd7]/90">{it.path}</span>}
                {it.label && <span className="text-[#faebd7]/50"> ({it.label})</span>}
                {!it.path && !it.label && <span>{JSON.stringify(it).substring(0, 60)}…</span>}
              </div>
            ))}
          </div>
          {previewResult.length > 5 && (
            <div className="text-[8px] text-[#faebd7]/40 mt-1 font-mono">
              … and {previewResult.length - 5} more items
            </div>
          )}
        </div>
      )}

      {previewResult && Array.isArray(previewResult.rows) && previewResult.rows.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] text-[#faebd7]/50 mb-1 font-mono uppercase">Data Preview (first 5 rows)</div>
          <div className="border border-[#faebd7]/20 rounded overflow-hidden bg-black/60">
            {/* Table Header */}
            <div className="grid gap-px bg-[#faebd7]/10 border-b border-[#faebd7]/20" style={{ gridTemplateColumns: `repeat(${Math.min(Object.keys(previewResult.rows[0] || {}).length, 8)}, minmax(60px, 1fr))` }}>
              {Object.keys(previewResult.rows[0] || {}).slice(0, 8).map((col) => (
                <div key={col} className="px-2 py-1 text-[8px] font-mono font-semibold text-[#faebd7]/80 bg-black/40 whitespace-nowrap overflow-hidden text-ellipsis">
                  {col}
                </div>
              ))}
            </div>
            {/* Table Rows */}
            {previewResult.rows.slice(0, 5).map((row, idx) => (
              <div key={idx} className="grid gap-px border-t border-[#faebd7]/10" style={{ gridTemplateColumns: `repeat(${Math.min(Object.keys(row || {}).length, 8)}, minmax(60px, 1fr))` }}>
                {Object.keys(row || {}).slice(0, 8).map((col) => {
                  const val = row[col];
                  const displayVal = val === null ? '∅' : val === undefined ? '—' : String(val).length > 20 ? String(val).substring(0, 17) + '…' : String(val);
                  return (
                    <div key={col} className="px-2 py-1 text-[8px] font-mono text-[#faebd7]/70 bg-black/20 whitespace-nowrap overflow-hidden text-ellipsis" title={String(val)}>
                      {displayVal}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {Object.keys(previewResult.rows[0] || {}).length > 8 && (
            <div className="text-[8px] text-[#faebd7]/40 mt-1 font-mono">
              ... and {Object.keys(previewResult.rows[0] || {}).length - 8} more columns
            </div>
          )}
        </div>
      )}

      {previewResult && !Array.isArray(previewResult) && !previewResult.error && (
        <div className="mt-2">
          <div className="text-[9px] text-[#faebd7]/50 mb-1 font-mono uppercase">Result</div>
          {previewResult.type === 'image' && previewResult.files && (
            <div className="bg-black/40 border border-[#faebd7]/10 rounded overflow-hidden">
              <div className="grid grid-cols-1 gap-px">
                <div className="px-2 py-1 text-[8px] font-mono text-[#faebd7]/70 bg-[#faebd7]/5">
                  📷 {previewResult.count} images found
                </div>
                {previewResult.files.slice(0, 8).map((img, idx) => (
                  <div key={idx} className="px-2 py-1 text-[8px] font-mono text-[#faebd7]/70 bg-black/20 border-t border-[#faebd7]/10 whitespace-nowrap overflow-hidden text-ellipsis" title={img.path}>
                    {img.path.split('/').pop()} <span className="text-[#faebd7]/40">({(img.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ))}
                {previewResult.count > 8 && (
                  <div className="px-2 py-1 text-[8px] text-[#faebd7]/40 bg-black/20 border-t border-[#faebd7]/10">
                    … and {previewResult.count - 8} more
                  </div>
                )}
              </div>
            </div>
          )}
          {previewResult.type === 'text' && previewResult.records && (
            <div className="bg-black/40 border border-[#faebd7]/10 rounded overflow-hidden">
              <div className="grid grid-cols-1 gap-px">
                <div className="px-2 py-1 text-[8px] font-mono text-[#faebd7]/70 bg-[#faebd7]/5">
                  📄 {previewResult.count} text records from {previewResult.file_count} file(s)
                </div>
                {previewResult.records.slice(0, 5).map((record, idx) => (
                  <div key={idx} className="px-2 py-1 text-[8px] font-mono text-[#faebd7]/70 bg-black/20 border-t border-[#faebd7]/10">
                    <div className="truncate text-[#faebd7]/80">
                      {String(record.text || record.label || '—').substring(0, 80)}
                      {String(record.text || record.label || '—').length > 80 ? '…' : ''}
                    </div>
                    {record.source && <div className="text-[#faebd7]/40 text-[7px]">{record.source}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {previewResult.type === 'json' && previewResult.records && (
            <div className="bg-black/40 border border-[#faebd7]/10 rounded overflow-hidden">
              <div className="grid grid-cols-1 gap-px">
                <div className="px-2 py-1 text-[8px] font-mono text-[#faebd7]/70 bg-[#faebd7]/5">
                  {previewResult.is_tabular ? '📊' : '📋'} {previewResult.count} records {previewResult.is_tabular && `• ${previewResult.columns.length} columns`}
                </div>
                {previewResult.is_tabular && previewResult.columns.length > 0 && (
                  <div className="px-2 py-0.5 text-[7px] font-mono text-[#faebd7]/50 bg-black/20 border-t border-[#faebd7]/10 max-h-10 overflow-auto">
                    Columns: {previewResult.columns.join(', ')}
                  </div>
                )}
                {previewResult.records.slice(0, 4).map((record, idx) => (
                  <div key={idx} className="px-2 py-1 text-[8px] font-mono text-[#faebd7]/70 bg-black/20 border-t border-[#faebd7]/10 max-h-12 overflow-auto">
                    {typeof record === 'object' ? (
                      <div className="text-[7px] space-y-0.5">
                        {Object.entries(record)
                          .slice(0, 3)
                          .map(([k, v]) => (
                            <div key={k} className="flex gap-1">
                              <span className="text-[#faebd7]/50 flex-shrink-0">{k}:</span>
                              <span className="truncate text-[#faebd7]/80">{String(v).substring(0, 40)}</span>
                            </div>
                          ))}
                        {Object.keys(record).length > 3 && <div className="text-[#faebd7]/40">…</div>}
                      </div>
                    ) : (
                      String(record).substring(0, 60)
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!previewResult.type && (
            <div className="bg-black/40 border border-[#faebd7]/10 rounded px-2 py-1.5 text-[8px] font-mono text-[#faebd7]/70 max-h-32 overflow-auto whitespace-pre-wrap break-words">
              {typeof previewResult === 'object' ? JSON.stringify(previewResult, null, 2) : String(previewResult)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CodeTab({ pythonCode, onCodeChange, onResetCode, readOnly = false, dockItems = [], activeDockId = '', onDockSelect, onExpandedChange }) {
  return (
    <MonacoCodeEditor
      title="Generated Python Template"
      language="python"
      value={pythonCode}
      onChange={readOnly ? undefined : onCodeChange}
      onReset={onResetCode}
      readOnly={readOnly}
      height={180}
      dockItems={dockItems}
      activeDockId={activeDockId}
      onDockSelect={onDockSelect}
      onExpandedChange={onExpandedChange}
    />
  );
}

export default function DatasetNode({ data, id, selected }) {
  const isLocked = useStore(s => s.nodeInternals.get(id)?.draggable === false);
  const readOnly = useUIStore(s => s.readOnly);
  const { nodeModel, collapsed: storeCollapsed } = data;
  const { type, inputs = [], outputs = [], config = {}, label } = nodeModel;
  const normalizedInputs = useMemo(
    () => (Array.isArray(inputs) ? inputs.map((port, idx) => normalizePort(port, idx, 'in')) : []),
    [inputs],
  );
  const normalizedOutputs = useMemo(
    () => (Array.isArray(outputs) ? outputs.map((port, idx) => normalizePort(port, idx, 'out')) : []),
    [outputs],
  );

  const [activeTab, setActiveTab] = useState('Source');
  const toggleNodeCollapse = useUIStore((s) => s.toggleNodeCollapse);
  const collapsed = !!storeCollapsed;
  const [localConfig, setLocalConfig] = useState(config);
  const localConfigRef = useRef(config);
  const [pythonCode, setPythonCode] = useState(() => nodeModel.pythonCode || generateDatasetPythonCode(type, config));
  const [manualCodeOverride, setManualCodeOverride] = useState(false);
  const [codeViewNodeId, setCodeViewNodeId] = useState(id);

  const updateNodeConfig = useExecutionStore((s) => s.updateNodeConfig);
  const updateExecutionNode = useExecutionStore((s) => s.updateExecutionNode);
  const execNodes = useExecutionStore((s) => s.nodes);
  const execEdges = useExecutionStore((s) => s.edges);

  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [filesList, setFilesList] = useState(null);
  const [inspectResult, setInspectResult] = useState(null);
  const [uploadsList, setUploadsList] = useState([]);
  const [busyAction, setBusyAction] = useState(false);
  const [codeExpanded, setCodeExpanded] = useState(false);

  const incomingEdgeSignature = useMemo(() => {
    const incoming = (execEdges || [])
      .filter((edge) => edge.target === id)
      .map((edge) => `${edge.source}:${edge.sourceHandle || ''}->${edge.targetHandle || ''}`)
      .sort();
    return incoming.join('|');
  }, [execEdges, id]);

  const accent = TYPE_HEX[type] ?? '#faebd7';
  const Icon = TYPE_ICONS[type] ?? Database;

  const analysisCard = useMemo(() => {
    const stats = localConfig?.dataset_stats || inspectResult?.stats || {};
    const schema = localConfig?.dataset_schema || inspectResult?.schema || {};
    const metadata = localConfig?.dataset_metadata || inspectResult?.metadata || {};

    const rows = Number.isFinite(stats?.rows)
      ? stats.rows
      : (Array.isArray(previewResult?.rows) ? previewResult.rows.length : null);
    const columns = Number.isFinite(stats?.columns)
      ? stats.columns
      : (Array.isArray(schema?.columns) ? schema.columns.length : null);
    const missingCells = Number.isFinite(stats?.missingCells) ? stats.missingCells : null;
    const taskSuggestion = metadata?.taskSuggestion || null;

    if (rows === null && columns === null && missingCells === null && !taskSuggestion) {
      return null;
    }

    return {
      rows,
      columns,
      missingCells,
      taskSuggestion,
    };
  }, [localConfig, inspectResult, previewResult]);

  useEffect(() => {
    if (codeViewNodeId !== id && !execNodes[codeViewNodeId]) {
      setCodeViewNodeId(id);
    }
  }, [codeViewNodeId, execNodes, id]);

  const dockItems = useMemo(() => {
    const items = Object.entries(execNodes || {})
      .filter(([, node]) => typeof node?.pythonCode === 'string' && node.pythonCode.length > 0)
      .map(([nodeId, node]) => ({
        id: nodeId,
        label: node?.label || node?.type || nodeId,
        subtitle: node?.type || '',
      }));

    const uniq = [];
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      uniq.push(item);
    }
    return uniq;
  }, [execNodes]);

  const displayedCode = codeViewNodeId === id
    ? pythonCode
    : (execNodes?.[codeViewNodeId]?.pythonCode || '');
  const isDockReadOnly = codeViewNodeId !== id;

  useEffect(() => {
    localConfigRef.current = localConfig;
  }, [localConfig]);

  useEffect(() => {
    setPreviewResult(null);
  }, [incomingEdgeSignature]);

  const applyConfigPatch = useCallback((patch = {}) => {
    const nextConfig = { ...localConfigRef.current, ...patch };
    const nextPythonCode = generateDatasetPythonCode(type, nextConfig);
    const nextCode = manualCodeOverride ? pythonCode : nextPythonCode;

    localConfigRef.current = nextConfig;
    setLocalConfig(nextConfig);
    if (!manualCodeOverride) setPythonCode(nextPythonCode);

    updateNodeConfig(id, patch);
    updateExecutionNode(id, {
      config: nextConfig,
      pythonCode: nextCode,
    });

    if (data?.nodeModel?.config) {
      Object.assign(data.nodeModel.config, patch);
    }
    if (data?.nodeModel) {
      data.nodeModel.config = { ...(data.nodeModel.config || {}), ...patch };
      data.nodeModel.pythonCode = nextCode;
    }
  }, [type, manualCodeOverride, pythonCode, updateNodeConfig, updateExecutionNode, id, data]);

  const handleChange = useCallback((key, value) => {
    applyConfigPatch({ [key]: value });
  }, [applyConfigPatch]);

  const commitDatasetAnalysis = useCallback((analysis, extraPatch = {}) => {
    if (!analysis) return;

    const datasetId = analysis.datasetId || localConfigRef.current.dataset_id || localConfigRef.current.client_upload_id || '';
    const metadata = analysis.metadata || analysis;
    const schema = analysis.schema || metadata?.schema || null;
    const stats = analysis.stats || metadata?.stats || null;
    const sampleRows = analysis.sampleRows || analysis.preview || metadata?.sampleRows || [];
    const configPatch = {
      dataset_id: datasetId,
      dataset_metadata: metadata,
      dataset_schema: schema,
      dataset_stats: stats,
      dataset_sample: sampleRows,
      ...extraPatch,
    };

    applyConfigPatch(configPatch);

    const nextMetadata = {
      ...(data?.nodeModel?.metadata || {}),
      datasetId,
      datasetType: analysis.sourceType || analysis.type || type,
      datasetMetadata: metadata,
      taskSuggestion: metadata?.taskSuggestion || analysis.taskSuggestion || null,
      recommendations: metadata?.recommendations || analysis.recommendations || [],
    };

    updateExecutionNode(id, {
      metadata: nextMetadata,
      schema: schema || data?.nodeModel?.schema || null,
    });

    if (data?.nodeModel) {
      data.nodeModel.metadata = nextMetadata;
      if (schema) data.nodeModel.schema = schema;
    }
  }, [applyConfigPatch, data, id, type, updateExecutionNode]);

  const handleCodeChange = useCallback((nextCode) => {
    setPythonCode(nextCode);
    setManualCodeOverride(true);
    updateExecutionNode(id, { pythonCode: nextCode });
    if (data?.nodeModel) data.nodeModel.pythonCode = nextCode;
  }, [updateExecutionNode, id, data]);

  const resetCodeFromTemplate = useCallback(() => {
    const regenerated = generateDatasetPythonCode(type, localConfig);
    setPythonCode(regenerated);
    setManualCodeOverride(false);
    updateExecutionNode(id, { pythonCode: regenerated });
    if (data?.nodeModel) data.nodeModel.pythonCode = regenerated;
  }, [type, localConfig, updateExecutionNode, id, data]);

  useEffect(() => {
    const generated = nodeModel.pythonCode || generateDatasetPythonCode(type, localConfig);
    if (generated !== pythonCode) setPythonCode(generated);
    updateExecutionNode(id, { pythonCode: generated });
    if (data?.nodeModel && data.nodeModel.pythonCode !== generated) data.nodeModel.pythonCode = generated;
  }, [id, type, localConfig, nodeModel.pythonCode, pythonCode, updateExecutionNode, data]);

  const runPreview = useCallback(async (count = 5) => {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      if (type === 'dataset.csv' && localConfig.client_upload_id) {
        const sample = await previewClientUpload(localConfig.client_upload_id, {
          delimiter: localConfig.delimiter || ',',
          header: localConfig.header !== false,
          primary: localConfig.primary,
          relations: Array.isArray(localConfig.relations) ? localConfig.relations : [],
          target_column: localConfig.target_column,
          features: Array.isArray(localConfig.features)
            ? localConfig.features
            : (Array.isArray(localConfig.feature_columns) ? localConfig.feature_columns : []),
          missing: localConfig.missing || { strategy: localConfig.handle_missing || 'drop' },
          n: count,
        });
        setPreviewResult(sample);
        return;
      }

      if (type === 'dataset.image' && localConfig.client_upload_id) {
        const sample = await previewClientImageUpload(localConfig.client_upload_id, {
          label_strategy: localConfig.label_strategy || 'folder_name',
          recursive: localConfig.recursive !== false,
        });
        setPreviewResult(sample);
        return;
      }

      const graph = { nodes: execNodes, edges: execEdges };
      const res = await previewGraphClient(graph, id, count);
      setPreviewResult(res);
    } catch (err) {
      setPreviewResult({ error: String(err) });
    } finally {
      setPreviewing(false);
    }
  }, [execNodes, execEdges, id, type, localConfig]);

  const validateCurrentPath = useCallback(async () => {
    const p = localConfig.path;
    if (localConfig.client_upload_id) {
      const res = await validateClientUpload(localConfig.client_upload_id);
      setValidation(res);
      if (res && Array.isArray(res.files)) setFilesList(res.files);
      return;
    }

    if (STRICT_CLIENT_ONLY_DATASETS) {
      setValidation({ error: 'Client-only mode: upload files from this node. Server paths are disabled.' });
      return;
    }

    if (!p) {
      setValidation({ error: 'No path configured' });
      return;
    }
  }, [localConfig.path, localConfig.client_upload_id, type]);

  const listCurrentPath = useCallback(async (mode = 'files') => {
    if (mode === 'uploads') {
      setBusyAction(true);
      try {
        const clientUploads = await listClientUploads();
        setUploadsList(clientUploads);
      } finally {
        setBusyAction(false);
      }
      return;
    }
    await validateCurrentPath();
  }, [validateCurrentPath]);

  const deleteCurrentUpload = useCallback(async () => {
    const clientUploadId = localConfig.client_upload_id || (String(localConfig.path || '').startsWith('client://') ? String(localConfig.path).replace('client://', '') : '');
    if (!clientUploadId) {
      setValidation({ error: 'No path configured' });
      return;
    }
    if (!confirm('Delete uploaded directory? This cannot be undone.')) return;
    setBusyAction(true);
    try {
      const res = await deleteClientUpload(clientUploadId);
      if (res.ok) {
        handleChange('path', '');
        handleChange('client_upload_id', '');
        setFilesList(null);
        setValidation({ deleted: true });
      } else {
        setValidation({ error: res.error || 'Delete failed' });
      }
    } catch (err) {
      setValidation({ error: String(err) });
    } finally {
      setBusyAction(false);
    }
  }, [localConfig.path, localConfig.client_upload_id, handleChange]);

  const listUploads = useCallback(async () => {
    setBusyAction(true);
    try {
      const clientUploads = await listClientUploads();
      setUploadsList(clientUploads);
    } catch {
      setUploadsList(await listClientUploads());
    } finally {
      setBusyAction(false);
    }
  }, []);

  const inspectCsvConfig = useCallback(async () => {
    if (type !== 'dataset.csv') return;
    const files = Array.isArray(localConfig.files) ? localConfig.files : [];
    const hasPath = !!String(localConfig.path || '').trim();
    const hasClientUpload = !!localConfig.client_upload_id;
    if (STRICT_CLIENT_ONLY_DATASETS && !hasClientUpload) {
      setValidation({ error: 'Client-only mode: upload CSV files first, then inspect.' });
      return;
    }
    if (!hasPath && files.length === 0 && !hasClientUpload) {
      setValidation({ error: 'Set a CSV path or files before inspect.' });
      return;
    }
    setBusyAction(true);
    try {
      if (hasClientUpload) {
        const res = await inspectClientUpload(localConfig.client_upload_id, {
          delimiter: localConfig.delimiter || ',',
          header: localConfig.header !== false,
          primary: localConfig.primary,
          target_column: localConfig.target_column,
        });
        setInspectResult(res);
        commitDatasetAnalysis(res);
        if (!localConfig.primary && res.primary) handleChange('primary', res.primary);
        setValidation({ exists: true, isDirectory: true, clientOnly: true });
        if (Array.isArray(res?.tables?.[res.primary]?.rows)) {
          setFilesList(Object.values(res.tables).map((t) => t.file));
        }
        return;
      }

    } catch (err) {
      setValidation({ error: String(err) });
    } finally {
      setBusyAction(false);
    }
  }, [type, localConfig, handleChange, commitDatasetAnalysis]);

  const ensureCsvMetadata = useCallback(async () => {
    if (type !== 'dataset.csv') return;
    const files = Array.isArray(localConfig.files) ? localConfig.files : [];
    const hasPath = !!String(localConfig.path || '').trim();
    const hasClientUpload = !!localConfig.client_upload_id;
    if (STRICT_CLIENT_ONLY_DATASETS && !hasClientUpload) return;
    if (!hasPath && files.length === 0 && !hasClientUpload) return;

    try {
      if (hasClientUpload) {
        const res = await inspectClientUpload(localConfig.client_upload_id, {
          delimiter: localConfig.delimiter || ',',
          header: localConfig.header !== false,
          primary: localConfig.primary,
          target_column: localConfig.target_column,
        });
        if (res?.ok) {
          setInspectResult(res);
          commitDatasetAnalysis(res);
          if (!localConfig.primary && res.primary) handleChange('primary', res.primary);
          if (Array.isArray(res?.tables?.[res.primary]?.rows)) {
            setFilesList(Object.values(res.tables).map((t) => t.file));
          }
        }
        return;
      }

    } catch {
      // Best-effort metadata fetch for dropdowns; keep UI responsive on failure.
    }
  }, [type, localConfig, handleChange, commitDatasetAnalysis]);

  const validateJoins = useCallback(async () => {
    if (type !== 'dataset.csv') return;
    const files = Array.isArray(localConfig.files) ? localConfig.files : [];
    const hasPath = !!String(localConfig.path || '').trim();
    const hasClientUpload = !!localConfig.client_upload_id;
    if (STRICT_CLIENT_ONLY_DATASETS && !hasClientUpload) {
      setValidation({ error: 'Client-only mode: upload CSV files first, then validate joins.' });
      return;
    }
    if (!hasPath && files.length === 0 && !hasClientUpload) {
      setValidation({ error: 'Set a CSV path or files before join validation.' });
      return;
    }
    setBusyAction(true);
    try {
      if (hasClientUpload) {
        const res = await validateClientUploadJoins(localConfig.client_upload_id, {
          delimiter: localConfig.delimiter || ',',
          header: localConfig.header !== false,
          primary: localConfig.primary,
          relations: Array.isArray(localConfig.relations) ? localConfig.relations : [],
        });
        setValidation({
          exists: true,
          isDirectory: true,
          joinValidation: res.validation,
          joinValid: res.valid,
          clientOnly: true,
        });
        if (inspectResult) {
          setInspectResult({ ...inspectResult, joinSuggestions: res.suggestions || inspectResult.joinSuggestions || [] });
        }
        return;
      }

    } catch (err) {
      setValidation({ error: String(err) });
    } finally {
      setBusyAction(false);
    }
  }, [type, localConfig, inspectResult]);

  const handleUpload = useCallback(async (files) => {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      if (type === 'dataset.csv' || type === 'dataset.image') {
        const created = await createClientUpload(files);
        handleChange('client_upload_id', created.datasetId || created.uploadId);
        handleChange('dataset_id', created.datasetId || created.uploadId);
        handleChange('path', `client://${created.datasetId || created.uploadId}`);
        setFilesList(created.files || []);
        if (created.metadata) {
          commitDatasetAnalysis({
            datasetId: created.datasetId || created.uploadId,
            metadata: created.metadata,
            schema: created.schema,
            stats: created.stats,
            sampleRows: created.metadata?.sampleRows || created.metadata?.preview || [],
            sourceType: created.metadata?.sourceType || type,
          });
        }
        if (type === 'dataset.csv') {
          handleChange('files', created.csvFiles || []);
          try {
            const inspected = await inspectClientUpload(created.uploadId, {
              delimiter: localConfig.delimiter || ',',
              header: localConfig.header !== false,
              primary: localConfig.primary,
              target_column: localConfig.target_column,
            });
            if (inspected?.ok) {
              setInspectResult(inspected);
              commitDatasetAnalysis(inspected);
              if (!localConfig.primary && inspected.primary) handleChange('primary', inspected.primary);
            }
          } catch {
            // Non-blocking: upload succeeded even if inspect metadata fetch fails.
          }
        }
        setValidation({
          ok: true,
          exists: true,
          isDirectory: true,
          isFile: false,
          count: (created.files || []).length,
          files: created.files || [],
          uploaded: true,
          clientOnly: true,
          warning: created.warning || null,
        });
        listUploads();
        setPreviewResult({ uploaded: `client://${created.uploadId}`, clientOnly: true, warning: created.warning || null });
        return;
      }
      setPreviewResult({ error: 'Client-only mode supports dataset.csv and dataset.image uploads only.' });
    } catch (err) {
      setPreviewResult({ error: String(err) });
    } finally {
      setPreviewing(false);
    }
  }, [handleChange, listUploads, type, localConfig, commitDatasetAnalysis]);

  useEffect(() => {
    if (type !== 'dataset.csv') return;
    listUploads();
  }, [type, listUploads]);

  useEffect(() => {
    if (type !== 'dataset.csv') return;
    ensureCsvMetadata();
  }, [
    type,
    localConfig.path,
    localConfig.client_upload_id,
    localConfig.primary,
    localConfig.delimiter,
    localConfig.header,
    localConfig.target_column,
    JSON.stringify(localConfig.files || []),
    ensureCsvMetadata,
  ]);

  return (
    <div
      className={`w-67 rounded-xl overflow-hidden font-mono transition-shadow duration-200 ${selected ? 'shadow-[0_0_0_2px_var(--accent-faint),0_8px_32px_rgba(0,0,0,0.7)]' : 'shadow-[0_4px_20px_rgba(0,0,0,0.55)]'}`}
      style={{
        background: '#141414',
        border: `1px solid ${selected ? accent : '#faebd720'}`,
        '--accent-faint': `${accent}55`,
      }}
    >
      {normalizedInputs.map((inp, idx) => (
        <Handle
          key={`in-${inp.name || idx}`}
          type="target"
          position={Position.Left}
          id={inp.name}
          style={{ top: 22 + idx * 16, background: portHex(inp.datatype), border: 'none', width: 8, height: 8 }}
          title={`${inp.name}: ${inp.datatype}${inp.optional ? ' (optional)' : ''}`}
        />
      ))}

      <div className="flex items-center justify-between px-2.5 py-2 cursor-grab active:cursor-grabbing" style={{ background: `${accent}18`, borderBottom: `1px solid ${accent}30` }} onClick={() => toggleNodeCollapse(id)}>
        <div className="flex items-center gap-2">
          <div className="w-5.5 h-5.5 rounded-[5px] flex items-center justify-center shrink-0" style={{ background: `${accent}28` }}>
            <Icon size={12} color={accent} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#faebd7] leading-tight">{label ?? type}</div>
            <div className="text-[8px] uppercase tracking-widest" style={{ color: `${accent}cc` }}>Dataset Node</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && <Lock size={12} color={accent} className="opacity-60" />}
          {collapsed ? <ChevronDown size={14} color="#faebd760" /> : <ChevronUp size={14} color="#faebd760" />}
        </div>
      </div>

      {!collapsed && (
        <div className="nodrag">
          <div className="flex border-b border-[#faebd7]/6 bg-black/40">
            {TABS.map((tab) => {
              const TI = TAB_ICONS[tab];
              const active = activeTab === tab;
              return (
                <button key={tab} onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }} className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 border-b-2 transition-colors duration-150 cursor-pointer ${active ? '' : 'border-transparent'}`} style={{ borderColor: active ? accent : undefined }} title={tab}>
                  <TI size={10} color={active ? accent : '#faebd740'} />
                  <span className="text-[7px]" style={{ color: active ? accent : '#faebd740' }}>{tab}</span>
                </button>
              );
            })}
          </div>

          {analysisCard && (
            <div className="mx-2.5 mt-2 rounded border border-[#faebd7]/12 bg-black/35 px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-wider text-[#faebd7]/45 font-mono mb-1">Node Analysis</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-[#faebd7]/70">
                <div>Rows: {analysisCard.rows ?? '—'}</div>
                <div>Columns: {analysisCard.columns ?? '—'}</div>
                <div>Missing: {analysisCard.missingCells ?? '—'}</div>
                <div>Hint: {analysisCard.taskSuggestion || '—'}</div>
              </div>
            </div>
          )}

          <div className="nowheel h-55 overflow-y-auto px-2.5 pt-2 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#faebd7]/10" style={{ scrollbarWidth: 'thin', scrollbarColor: '#faebd710 transparent' }}>
            {activeTab === 'Source' && (
              <SourceTab
                nodeType={type}
                config={localConfig}
                onChange={handleChange}
                onValidate={validateCurrentPath}
                onList={listCurrentPath}
                onDelete={deleteCurrentUpload}
                validation={validation}
                filesList={filesList}
                busy={busyAction}
                onUpload={handleUpload}
                onInspect={inspectCsvConfig}
                inspectResult={inspectResult}
                onValidateJoins={validateJoins}
                uploadsList={uploadsList}
                disabled={readOnly}
              />
            )}
            <div className={activeTab === 'Code' ? '' : 'hidden'}>
              {codeExpanded && (
                <div className="mb-1 text-[9px] text-[#faebd7]/55 font-mono">Code is opened in floating fullscreen panel.</div>
              )}
              <CodeTab
                pythonCode={displayedCode}
                onCodeChange={handleCodeChange}
                onResetCode={resetCodeFromTemplate}
                readOnly={isDockReadOnly}
                dockItems={dockItems}
                activeDockId={codeViewNodeId}
                onDockSelect={(nodeId) => setCodeViewNodeId(String(nodeId))}
                onExpandedChange={setCodeExpanded}
              />
            </div>
            {activeTab === 'Preview' && <PreviewTab nodeType={type} config={localConfig} previewing={previewing} onRunPreview={() => runPreview(5)} previewResult={previewResult} />}
          </div>

          <div className="flex flex-col items-end gap-1 px-2.5 pt-1.5 pb-2.5 border-t border-[#faebd7]/5">
            {normalizedOutputs.map((out, idx) => {
              const tw = portTw(out.datatype);
              return (
                <div key={out.name || idx} className="flex items-center gap-1.5">
                  {out.shape?.length > 0 && <span className="text-[8px] text-[#faebd7]/25 font-mono">{out.shape.join('x')}</span>}
                  <span className={`text-[8px] font-mono px-1.5 py-px rounded border ${tw.badge}`}>{out.name}</span>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${tw.dot}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {collapsed && (
        <div className="flex flex-col items-end gap-1 px-2.5 py-1.5 border-t border-[#faebd7]/5">
          {normalizedOutputs.map((out, idx) => {
            const tw = portTw(out.datatype);
            return (
              <div key={out.name || idx} className="flex items-center gap-1">
                <span className={`text-[7px] font-mono px-1 py-px rounded border ${tw.badge}`}>{out.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tw.dot}`} />
              </div>
            );
          })}
        </div>
      )}

      {normalizedOutputs.map((out, idx) => (
        <Handle
          key={`out-${out.name || idx}`}
          type="source"
          position={Position.Right}
          id={out.name}
          style={{
            top: 'auto',
            bottom: 10 + ((normalizedOutputs.length - 1 - idx) * 18),
            background: portHex(out.datatype),
            border: '2px solid #141414',
            width: 10,
            height: 10,
            borderRadius: '50%',
            zIndex: 10,
          }}
          title={`${out.name}: ${out.datatype}`}
        />
      ))}
    </div>
  );
}
