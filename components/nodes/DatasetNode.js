'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { FolderOpen, Eye, Code2, ChevronDown, ChevronUp, ImageIcon, Database, FileText, Braces, Globe, Table2 } from 'lucide-react';
import { useExecutionStore } from '../../store/useExecutionStore';
import { previewNode } from '../../lib/executionClient';
import { validatePath as apiValidatePath, deleteUpload as apiDeleteUpload } from '../../lib/datasetClient';
import { generateDatasetPythonCode } from '../../lib/pythonTemplates/datasetNodeTemplate';
import MonacoCodeEditor from './MonacoCodeEditor';

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

function NodeInput({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 outline-none focus:border-[#faebd7]/30 placeholder:text-[#faebd7]/20"
    />
  );
}

function NodeSelect({ value, onChange, options }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 outline-none focus:border-[#faebd7]/30"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-[#faebd7]/70 font-mono">{label}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onChange(!value); }}
        className={`relative w-8 h-4 rounded-full border-none cursor-pointer transition-colors duration-200 shrink-0 ${value ? 'bg-purple-500' : 'bg-[#2a2a2a]'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-[#faebd7] transition-all duration-200 ${value ? 'left-4.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function SourceTab({ nodeType, config, onChange, onValidate, onList, onDelete, validation, filesList, busy, onUpload }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const triggerUpload = useCallback(() => {
    if (fileRef.current) fileRef.current.click();
  }, []);

  useEffect(() => {
    const el = fileRef.current;
    if (!el) return;
    try {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    } catch {
      // ignore
    }
  }, []);

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

  const renderPathStatus = (expectDirectory) => {
    if (!validation) return null;
    if (validation.error) return <div className="text-[10px] text-red-400 mt-1">{validation.error}</div>;
    if (validation.deleted) return <div className="text-[10px] text-emerald-400 mt-1">Uploaded folder deleted.</div>;
    if (validation.exists === false) return <div className="text-[10px] text-red-400 mt-1">Path does not exist</div>;
    if (expectDirectory && validation.exists && validation.isDirectory === false) return <div className="text-[10px] text-red-400 mt-1">Path is not a directory</div>;
    if (!expectDirectory && validation.exists && validation.isDirectory === true) return <div className="text-[10px] text-red-400 mt-1">Path is a directory, expected a file</div>;
    return <div className="text-[10px] text-emerald-400 mt-1">Path looks valid.</div>;
  };

  if (nodeType === 'dataset.image') {
    return (
      <>
        <Field label="Folder Path">
          <NodeInput value={config.path} onChange={(v) => onChange('path', v)} placeholder="./data/uploads/... or /data/images" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); triggerUpload(); }} disabled={uploading || busy} className="px-2 py-1 text-[10px] bg-emerald-600/20 hover:bg-emerald-600/30 rounded border border-emerald-600/20 disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload Folder'}</button>
            <button onClick={(e) => { e.stopPropagation(); onValidate && onValidate(); }} disabled={busy || uploading} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded disabled:opacity-50">Validate</button>
            <button onClick={(e) => { e.stopPropagation(); onList && onList(); }} disabled={busy || uploading} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded disabled:opacity-50">List</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }} disabled={busy || uploading} className="px-2 py-1 text-[10px] bg-red-700/30 hover:bg-red-700/40 rounded disabled:opacity-50">Delete</button>
            <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
          </div>
          {renderPathStatus(true)}
          {busy && <div className="text-[10px] text-[#faebd7]/50 mt-1">Working...</div>}
          {filesList && filesList.length > 0 && (
            <div className="mt-2 bg-black/40 px-2 py-1 rounded text-[9px] font-mono max-h-40 overflow-auto">
              {filesList.slice(0, 50).map((f, i) => <div key={i}>{f}</div>)}
            </div>
          )}
        </Field>
        <Field label="Format">
          <NodeSelect value={config.format} onChange={(v) => onChange('format', v)} options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }, { value: 'tiff', label: 'TIFF' }]} />
        </Field>
        <Field label="Label Strategy">
          <NodeSelect value={config.label_strategy} onChange={(v) => onChange('label_strategy', v)} options={[{ value: 'folder_name', label: 'Folder Name' }, { value: 'csv_mapping', label: 'CSV Mapping' }, { value: 'json_mapping', label: 'JSON Mapping' }, { value: 'none', label: 'Unlabeled' }]} />
        </Field>
        <Toggle label="Recursive" value={config.recursive} onChange={(v) => onChange('recursive', v)} />
      </>
    );
  }

  if (nodeType === 'dataset.csv') {
    return (
      <>
        <Field label="File Path">
          <NodeInput value={config.path} onChange={(v) => onChange('path', v)} placeholder="/data/data.csv" />
          <div className="mt-2 flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onValidate && onValidate(); }} disabled={busy} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded disabled:opacity-50">Validate</button>
            {busy && <span className="text-[10px] text-[#faebd7]/50">Working...</span>}
          </div>
          {renderPathStatus(false)}
        </Field>
        <Field label="Target Column"><NodeInput value={config.target_column} onChange={(v) => onChange('target_column', v)} placeholder="label" /></Field>
        <Field label="Delimiter"><NodeSelect value={config.delimiter} onChange={(v) => onChange('delimiter', v)} options={[{ value: ',', label: 'Comma' }, { value: '\t', label: 'Tab' }, { value: ';', label: 'Semicolon' }]} /></Field>
        <Toggle label="Has Header" value={config.header} onChange={(v) => onChange('header', v)} />
      </>
    );
  }

  if (nodeType === 'dataset.text') {
    return (
      <>
        <Field label="File Path">
          <NodeInput value={config.path} onChange={(v) => onChange('path', v)} placeholder="/data/corpus.txt" />
          <div className="mt-2 flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onValidate && onValidate(); }} disabled={busy} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded disabled:opacity-50">Validate</button>
            {busy && <span className="text-[10px] text-[#faebd7]/50">Working...</span>}
          </div>
          {renderPathStatus(false)}
        </Field>
        <Field label="Format"><NodeSelect value={config.file_format} onChange={(v) => onChange('file_format', v)} options={[{ value: 'txt', label: 'TXT' }, { value: 'csv', label: 'CSV' }, { value: 'jsonl', label: 'JSONL' }]} /></Field>
        <Field label="Text Column"><NodeInput value={config.text_column} onChange={(v) => onChange('text_column', v)} placeholder="text" /></Field>
        <Field label="Tokenizer"><NodeSelect value={config.tokenizer} onChange={(v) => onChange('tokenizer', v)} options={[{ value: 'whitespace', label: 'Whitespace' }, { value: 'bpe', label: 'BPE' }, { value: 'wordpiece', label: 'WordPiece' }, { value: 'custom', label: 'Custom' }]} /></Field>
        <Field label="Max Length"><NodeInput type="number" value={config.max_length} onChange={(v) => onChange('max_length', Number(v))} /></Field>
      </>
    );
  }

  if (nodeType === 'dataset.json') {
    return (
      <>
        <Field label="File Path">
          <NodeInput value={config.path} onChange={(v) => onChange('path', v)} placeholder="/data/data.json" />
          <div className="mt-2 flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onValidate && onValidate(); }} disabled={busy} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded disabled:opacity-50">Validate</button>
            {busy && <span className="text-[10px] text-[#faebd7]/50">Working...</span>}
          </div>
          {renderPathStatus(false)}
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
    if (Array.isArray(previewResult)) return `Items: ${previewResult.length}`;
    if (typeof previewResult === 'object') return 'Preview ready';
    return String(previewResult);
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

      {previewResult && Array.isArray(previewResult) && (
        <div className="mt-2 grid grid-cols-1 gap-1">
          {previewResult.slice(0, 5).map((it, i) => (
            <div key={i} className="text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70">
              {it.path ? it.path : JSON.stringify(it)} {it.label ? ` - ${it.label}` : ''}
            </div>
          ))}
        </div>
      )}

      {previewResult && !Array.isArray(previewResult) && !previewResult.error && (
        <div className="mt-2 text-[9px] bg-black/40 px-2 py-1 rounded font-mono text-[#faebd7]/70 whitespace-pre-wrap break-all">
          {JSON.stringify(previewResult, null, 2)}
        </div>
      )}
    </div>
  );
}

function CodeTab({ pythonCode, onCodeChange, onResetCode }) {
  return (
    <MonacoCodeEditor
      title="Generated Python Template"
      language="python"
      value={pythonCode}
      onChange={onCodeChange}
      onReset={onResetCode}
      height={180}
    />
  );
}

export default function DatasetNode({ data, id, selected }) {
  const { nodeModel } = data;
  const { type, inputs = [], outputs = [], config = {}, label } = nodeModel;

  const [activeTab, setActiveTab] = useState('Source');
  const [collapsed, setCollapsed] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);
  const [pythonCode, setPythonCode] = useState(() => nodeModel.pythonCode || generateDatasetPythonCode(type, config));
  const [manualCodeOverride, setManualCodeOverride] = useState(false);

  const updateNodeConfig = useExecutionStore((s) => s.updateNodeConfig);
  const updateExecutionNode = useExecutionStore((s) => s.updateExecutionNode);
  const execNodes = useExecutionStore((s) => s.nodes);
  const execEdges = useExecutionStore((s) => s.edges);

  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [filesList, setFilesList] = useState(null);
  const [busyAction, setBusyAction] = useState(false);

  const accent = TYPE_HEX[type] ?? '#faebd7';
  const Icon = TYPE_ICONS[type] ?? Database;

  const handleChange = useCallback((key, value) => {
    const nextConfig = { ...localConfig, [key]: value };
    const nextPythonCode = generateDatasetPythonCode(type, nextConfig);

    setLocalConfig(nextConfig);
    if (!manualCodeOverride) setPythonCode(nextPythonCode);

    updateNodeConfig(id, { [key]: value });
    updateExecutionNode(id, { pythonCode: manualCodeOverride ? pythonCode : nextPythonCode });

    if (data?.nodeModel?.config) data.nodeModel.config[key] = value;
    if (data?.nodeModel) data.nodeModel.pythonCode = manualCodeOverride ? pythonCode : nextPythonCode;
  }, [localConfig, type, manualCodeOverride, pythonCode, updateNodeConfig, updateExecutionNode, id, data]);

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
      const graph = { nodes: execNodes, edges: execEdges };
      const res = await previewNode(graph, id, count);
      setPreviewResult(res?.sample ?? res);
    } catch (err) {
      setPreviewResult({ error: String(err) });
    } finally {
      setPreviewing(false);
    }
  }, [execNodes, execEdges, id]);

  const validateCurrentPath = useCallback(async () => {
    const p = localConfig.path;
    if (!p) {
      setValidation({ error: 'No path configured' });
      return;
    }
    setBusyAction(true);
    try {
      const res = await apiValidatePath(p);
      setValidation(res);
      if (res && res.files) setFilesList(res.files);
    } catch (err) {
      setValidation({ error: String(err) });
    } finally {
      setBusyAction(false);
    }
  }, [localConfig.path]);

  const listCurrentPath = useCallback(async () => {
    await validateCurrentPath();
  }, [validateCurrentPath]);

  const deleteCurrentUpload = useCallback(async () => {
    const p = localConfig.path;
    if (!p) {
      setValidation({ error: 'No path configured' });
      return;
    }
    if (!confirm('Delete uploaded directory? This cannot be undone.')) return;
    setBusyAction(true);
    try {
      const res = await apiDeleteUpload(p);
      if (res.ok) {
        handleChange('path', '');
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
  }, [localConfig.path, handleChange]);

  const handleUpload = useCallback(async (files) => {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const fd = new FormData();
      for (const f of files) {
        const rel = f.webkitRelativePath || f.name;
        fd.append(rel, f, rel);
      }
      const resp = await fetch('/api/datasets/upload', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok) {
        setPreviewResult({ error: json.error || 'Upload failed' });
        return;
      }
      const uploadPath = json.uploadPath;
      handleChange('path', `./${uploadPath}`);
      setPreviewResult({ uploaded: uploadPath });
    } catch (err) {
      setPreviewResult({ error: String(err) });
    } finally {
      setPreviewing(false);
    }
  }, [handleChange]);

  return (
    <div
      className={`w-67 rounded-xl overflow-hidden font-mono transition-shadow duration-200 ${selected ? 'shadow-[0_0_0_2px_var(--accent-faint),0_8px_32px_rgba(0,0,0,0.7)]' : 'shadow-[0_4px_20px_rgba(0,0,0,0.55)]'}`}
      style={{
        background: '#141414',
        border: `1px solid ${selected ? accent : '#faebd720'}`,
        '--accent-faint': `${accent}55`,
      }}
    >
      {inputs.map((inp, idx) => (
        <Handle
          key={`in-${inp.name}`}
          type="target"
          position={Position.Left}
          id={inp.name}
          style={{ top: 22 + idx * 16, background: portHex(inp.datatype), border: 'none', width: 8, height: 8 }}
          title={`${inp.name}: ${inp.datatype}${inp.optional ? ' (optional)' : ''}`}
        />
      ))}

      <div className="flex items-center justify-between px-2.5 py-2 cursor-grab active:cursor-grabbing" style={{ background: `${accent}18`, borderBottom: `1px solid ${accent}30` }} onClick={() => setCollapsed((c) => !c)}>
        <div className="flex items-center gap-2">
          <div className="w-5.5 h-5.5 rounded-[5px] flex items-center justify-center shrink-0" style={{ background: `${accent}28` }}>
            <Icon size={12} color={accent} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#faebd7] leading-tight">{label ?? type}</div>
            <div className="text-[8px] uppercase tracking-widest" style={{ color: `${accent}cc` }}>Dataset Node</div>
          </div>
        </div>
        {collapsed ? <ChevronDown size={14} color="#faebd760" /> : <ChevronUp size={14} color="#faebd760" />}
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
              />
            )}
            {activeTab === 'Code' && <CodeTab pythonCode={pythonCode} onCodeChange={handleCodeChange} onResetCode={resetCodeFromTemplate} />}
            {activeTab === 'Preview' && <PreviewTab nodeType={type} config={localConfig} previewing={previewing} onRunPreview={() => runPreview(5)} previewResult={previewResult} />}
          </div>

          <div className="flex flex-col items-end gap-1 px-2.5 pt-1.5 pb-2.5 border-t border-[#faebd7]/5">
            {outputs.map((out) => {
              const tw = portTw(out.datatype);
              return (
                <div key={out.name} className="flex items-center gap-1.5">
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
          {outputs.map((out) => {
            const tw = portTw(out.datatype);
            return (
              <div key={out.name} className="flex items-center gap-1">
                <span className={`text-[7px] font-mono px-1 py-px rounded border ${tw.badge}`}>{out.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tw.dot}`} />
              </div>
            );
          })}
        </div>
      )}

      {outputs.map((out, idx) => (
        <Handle
          key={`out-${out.name}`}
          type="source"
          position={Position.Right}
          id={out.name}
          style={{
            top: collapsed ? 57 + idx * 18 : 313 + idx * 22,
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
