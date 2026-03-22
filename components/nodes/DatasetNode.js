'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import {
  FolderOpen, Settings2, Cpu, Scissors, Eye,
  ChevronDown, ChevronUp,
  ImageIcon, Database, FileText, Braces, Globe, Table2,
} from 'lucide-react';
import { useExecutionStore } from '../../store/useExecutionStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const PORT_TW = {
  tensor: { dot: 'bg-purple-400', badge: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  dataloader: { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  sequence: { dot: 'bg-blue-400', badge: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  list: { dot: 'bg-amber-400', badge: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  dict: { dot: 'bg-red-400', badge: 'text-red-400 bg-red-400/10 border-red-400/30' },
  transform: { dot: 'bg-slate-400', badge: 'text-slate-400 bg-slate-400/10 border-slate-400/30' },
  tokenizer: { dot: 'bg-indigo-400', badge: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30' },
};
const PORT_TW_DEFAULT = { dot: 'bg-[#faebd7]', badge: 'text-[#faebd7] bg-[#faebd7]/10 border-[#faebd7]/30' };

// Hex colour still needed for Handle (ReactFlow inline style) and accent gradients
const PORT_HEX = {
  tensor: '#c084fc', dataloader: '#34d399', sequence: '#60a5fa',
  list: '#fbbf24', dict: '#f87171', transform: '#94a3b8',
  tokenizer: '#818cf8', default: '#faebd7',
};
function portHex(dt) { return PORT_HEX[dt] ?? PORT_HEX.default; }
function portTw(dt) { return PORT_TW[dt] ?? PORT_TW_DEFAULT; }

const TYPE_ICONS = {
  'dataset.image': ImageIcon, 'dataset.csv': Table2,
  'dataset.text': FileText, 'dataset.json': Braces,
  'dataset.database': Database, 'dataset.api': Globe,
};
const TYPE_HEX = {
  'dataset.image': '#c084fc', 'dataset.csv': '#34d399',
  'dataset.text': '#60a5fa', 'dataset.json': '#fbbf24',
  'dataset.database': '#f87171', 'dataset.api': '#a78bfa',
};

const ALL_TABS = ['Source', 'Loading', 'Processing', 'Split', 'Preview'];
const TAB_ICONS = { Source: FolderOpen, Loading: Settings2, Processing: Cpu, Split: Scissors, Preview: Eye };

// ── Utility: stop mouse/pointer bubbling to ReactFlow canvas ──────────────────
// Not needed anymore; we use React Flow's "nodrag" class instead.

// ── Primitive form components ────────────────────────────

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
      onChange={e => onChange(e.target.value)}
      className="w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 outline-none focus:border-[#faebd7]/30 placeholder:text-[#faebd7]/20"
    />
  );
}

function NodeSelect({ value, onChange, options }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 outline-none focus:border-[#faebd7]/30"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-[#faebd7]/70 font-mono">{label}</span>
      <button
        onClick={e => { e.stopPropagation(); onChange(!value); }}
        className={`relative w-8 h-4 rounded-full border-none cursor-pointer transition-colors duration-200 flex-shrink-0 ${value ? 'bg-purple-500' : 'bg-[#2a2a2a]'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-[#faebd7] transition-all duration-200 ${value ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

// ── Tab content components ────────────────────────────────────────────────────

function SourceTab({ nodeType, config, onChange }) {
  if (nodeType === 'dataset.image') return (
    <>
      <Field label="Folder Path"><NodeInput value={config.path} onChange={v => onChange('path', v)} placeholder="/data/images" /></Field>
      <Field label="Format">
        <NodeSelect value={config.format} onChange={v => onChange('format', v)}
          options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }, { value: 'tiff', label: 'TIFF' }]} />
      </Field>
      <Field label="Label Strategy">
        <NodeSelect value={config.label_strategy} onChange={v => onChange('label_strategy', v)}
          options={[{ value: 'folder_name', label: 'Folder Name' }, { value: 'csv_mapping', label: 'CSV Mapping' }, { value: 'json_mapping', label: 'JSON Mapping' }, { value: 'none', label: 'Unlabeled' }]} />
      </Field>
      <Toggle label="Recursive" value={config.recursive} onChange={v => onChange('recursive', v)} />
    </>
  );

  if (nodeType === 'dataset.csv') return (
    <>
      <Field label="File Path"><NodeInput value={config.path} onChange={v => onChange('path', v)} placeholder="/data/data.csv" /></Field>
      <Field label="Target Column"><NodeInput value={config.target_column} onChange={v => onChange('target_column', v)} placeholder="label" /></Field>
      <Field label="Delimiter">
        <NodeSelect value={config.delimiter} onChange={v => onChange('delimiter', v)}
          options={[{ value: ',', label: 'Comma' }, { value: '\t', label: 'Tab' }, { value: ';', label: 'Semicolon' }]} />
      </Field>
      <Toggle label="Has Header" value={config.header} onChange={v => onChange('header', v)} />
    </>
  );

  if (nodeType === 'dataset.text') return (
    <>
      <Field label="File Path"><NodeInput value={config.path} onChange={v => onChange('path', v)} placeholder="/data/corpus.txt" /></Field>
      <Field label="Format">
        <NodeSelect value={config.file_format} onChange={v => onChange('file_format', v)}
          options={[{ value: 'txt', label: 'TXT' }, { value: 'csv', label: 'CSV' }, { value: 'jsonl', label: 'JSONL' }]} />
      </Field>
      <Field label="Text Column"><NodeInput value={config.text_column} onChange={v => onChange('text_column', v)} placeholder="text" /></Field>
      <Field label="Tokenizer">
        <NodeSelect value={config.tokenizer} onChange={v => onChange('tokenizer', v)}
          options={[{ value: 'whitespace', label: 'Whitespace' }, { value: 'bpe', label: 'BPE' }, { value: 'wordpiece', label: 'WordPiece' }, { value: 'custom', label: 'Custom' }]} />
      </Field>
      <Field label="Max Length"><NodeInput type="number" value={config.max_length} onChange={v => onChange('max_length', Number(v))} /></Field>
    </>
  );

  if (nodeType === 'dataset.json') return (
    <>
      <Field label="File Path"><NodeInput value={config.path} onChange={v => onChange('path', v)} placeholder="/data/data.json" /></Field>
      <Field label="Format">
        <NodeSelect value={config.file_format} onChange={v => onChange('file_format', v)}
          options={[{ value: 'json', label: 'JSON' }, { value: 'jsonl', label: 'JSONL' }]} />
      </Field>
      <Field label="Data Key"><NodeInput value={config.data_key} onChange={v => onChange('data_key', v)} placeholder="data.records" /></Field>
      <Field label="Label Key"><NodeInput value={config.label_key} onChange={v => onChange('label_key', v)} placeholder="label" /></Field>
    </>
  );

  if (nodeType === 'dataset.database') return (
    <>
      <Field label="DB Type">
        <NodeSelect value={config.db_type} onChange={v => onChange('db_type', v)}
          options={[{ value: 'postgresql', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL' }, { value: 'sqlite', label: 'SQLite' }, { value: 'mongodb', label: 'MongoDB' }]} />
      </Field>
      <Field label="Host"><NodeInput value={config.host} onChange={v => onChange('host', v)} placeholder="localhost" /></Field>
      <Field label="Database"><NodeInput value={config.database} onChange={v => onChange('database', v)} placeholder="mydb" /></Field>
      <Field label="Table"><NodeInput value={config.table} onChange={v => onChange('table', v)} placeholder="records" /></Field>
      <Field label="Query"><NodeInput value={config.query} onChange={v => onChange('query', v)} placeholder="SELECT * FROM ..." /></Field>
    </>
  );

  if (nodeType === 'dataset.api') return (
    <>
      <Field label="Endpoint URL"><NodeInput value={config.url} onChange={v => onChange('url', v)} placeholder="https://api.example.com/data" /></Field>
      <Field label="Method">
        <NodeSelect value={config.method} onChange={v => onChange('method', v)}
          options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }]} />
      </Field>
      <Field label="Auth Type">
        <NodeSelect value={config.auth_type} onChange={v => onChange('auth_type', v)}
          options={[{ value: 'none', label: 'None' }, { value: 'bearer', label: 'Bearer Token' }, { value: 'api_key', label: 'API Key' }, { value: 'basic', label: 'Basic Auth' }]} />
      </Field>
      {config.auth_type !== 'none' && (
        <Field label="Auth Token"><NodeInput value={config.auth_token} onChange={v => onChange('auth_token', v)} placeholder="..." /></Field>
      )}
      <Field label="Data Path"><NodeInput value={config.data_path} onChange={v => onChange('data_path', v)} placeholder="data" /></Field>
    </>
  );

  return null;
}

function LoadingTab({ config, onChange }) {
  return (
    <>
      <Field label="Batch Size"><NodeInput type="number" value={config.batch_size} onChange={v => onChange('batch_size', Number(v))} /></Field>
      <Field label="Workers"><NodeInput type="number" value={config.workers} onChange={v => onChange('workers', Number(v))} /></Field>
      <Toggle label="Shuffle" value={config.shuffle} onChange={v => onChange('shuffle', v)} />
      {'pin_memory' in config && <Toggle label="Pin Memory" value={config.pin_memory} onChange={v => onChange('pin_memory', v)} />}
      {'prefetch' in config && <Toggle label="Prefetch" value={config.prefetch} onChange={v => onChange('prefetch', v)} />}
      <Field label="Cache">
        <NodeSelect value={config.cache} onChange={v => onChange('cache', v)}
          options={[{ value: 'none', label: 'None' }, { value: 'ram', label: 'RAM' }, { value: 'disk', label: 'Disk' }]} />
      </Field>
      {'streaming' in config && <Toggle label="Streaming" value={config.streaming} onChange={v => onChange('streaming', v)} />}
    </>
  );
}

function ProcessingTab({ nodeType, config, onChange }) {
  if (nodeType === 'dataset.image') return (
    <>
      <Field label="Resize (H × W)">
        <div className="flex gap-1.5">
          <NodeInput type="number" value={config.resize?.[0]} onChange={v => onChange('resize', [Number(v), config.resize?.[1] ?? 224])} />
          <NodeInput type="number" value={config.resize?.[1]} onChange={v => onChange('resize', [config.resize?.[0] ?? 224, Number(v)])} />
        </div>
      </Field>
      <Field label="Normalize">
        <NodeSelect value={config.normalize} onChange={v => onChange('normalize', v)}
          options={[{ value: 'imagenet', label: 'ImageNet' }, { value: 'zero_one', label: '[0,1]' }, { value: 'custom', label: 'Custom' }, { value: 'none', label: 'None' }]} />
      </Field>
      <Field label="Color Mode">
        <NodeSelect value={config.color_mode} onChange={v => onChange('color_mode', v)}
          options={[{ value: 'RGB', label: 'RGB' }, { value: 'Grayscale', label: 'Grayscale' }]} />
      </Field>
      <Toggle label="Augmentation" value={config.augmentation} onChange={v => onChange('augmentation', v)} />
      <Toggle label="Lazy Loading" value={config.lazy_loading} onChange={v => onChange('lazy_loading', v)} />
      <Toggle label="Memory Map" value={config.memory_map} onChange={v => onChange('memory_map', v)} />
    </>
  );

  if (nodeType === 'dataset.csv' || nodeType === 'dataset.json') return (
    <>
      <Field label="Normalize">
        <NodeSelect value={config.normalize} onChange={v => onChange('normalize', v)}
          options={[{ value: 'standard', label: 'Standard (z-score)' }, { value: 'minmax', label: 'Min-Max' }, { value: 'none', label: 'None' }]} />
      </Field>
      <Field label="Handle Missing">
        <NodeSelect value={config.handle_missing} onChange={v => onChange('handle_missing', v)}
          options={[{ value: 'drop', label: 'Drop Row' }, { value: 'mean', label: 'Fill Mean' }, { value: 'median', label: 'Fill Median' }, { value: 'zero', label: 'Fill Zero' }]} />
      </Field>
      {nodeType === 'dataset.csv' && (
        <Field label="Categorical Encoding">
          <NodeSelect value={config.categorical_encoding} onChange={v => onChange('categorical_encoding', v)}
            options={[{ value: 'onehot', label: 'One-Hot' }, { value: 'label', label: 'Label' }, { value: 'none', label: 'None' }]} />
        </Field>
      )}
    </>
  );

  return <div className="text-[10px] text-[#faebd7]/30 font-mono pt-2">No processing options for this type.</div>;
}

function SplitTab({ config, onChange }) {
  const train = config.train_split ?? 0.7;
  const val = config.val_split ?? 0.15;
  const test = config.test_split ?? 0.15;
  const total = train + val + test;
  const warn = Math.abs(total - 1.0) > 0.01;
  const pct = v => `${Math.round(v * 100)}%`;

  return (
    <>
      <Field label={`Train — ${pct(train)}`}>
        <input type="range" min={0} max={100} value={Math.round(train * 100)}
          onChange={e => {
            const t = Number(e.target.value) / 100;
            const rem = 1 - t;
            onChange('train_split', t);
            onChange('val_split', parseFloat((rem * (val / (val + test || 1))).toFixed(2)));
            onChange('test_split', parseFloat((rem * (test / (val + test || 1))).toFixed(2)));
          }}
          className="w-full accent-purple-400" />
      </Field>
      <Field label={`Val — ${pct(val)}`}>
        <input type="range" min={0} max={100} value={Math.round(val * 100)}
          onChange={e => onChange('val_split', Number(e.target.value) / 100)}
          className="w-full accent-blue-400" />
      </Field>
      <Field label={`Test — ${pct(test)}`}>
        <input type="range" min={0} max={100} value={Math.round(test * 100)}
          onChange={e => onChange('test_split', Number(e.target.value) / 100)}
          className="w-full accent-emerald-400" />
      </Field>

      {/* Split bar */}
      <div className="flex rounded overflow-hidden h-2 mt-1 gap-px">
        <div className="bg-purple-400 transition-all" style={{ flex: train }} />
        <div className="bg-blue-400 transition-all" style={{ flex: val }} />
        <div className="bg-emerald-400 transition-all" style={{ flex: test }} />
      </div>

      {warn && <div className="text-[9px] text-red-400 mt-1.5 font-mono">⚠ Splits total {(total * 100).toFixed(0)}%, should be 100%</div>}
    </>
  );
}

function PreviewTab({ config, nodeType }) {
  const items = [
    { k: 'Type', v: nodeType },
    { k: 'Batch', v: config.batch_size },
    { k: 'Workers', v: config.workers },
    { k: 'Shuffle', v: config.shuffle ? 'Yes' : 'No' },
    { k: 'Cache', v: config.cache ?? '—' },
    { k: 'Streaming', v: config.streaming ? 'Yes' : 'No' },
  ];
  if (nodeType === 'dataset.image') {
    items.push({ k: 'Resize', v: config.resize?.join('×') }, { k: 'Normalize', v: config.normalize });
  }

  const schemaLines = {
    'dataset.image': `images: tensor[B,C,${config.resize?.[0]},${config.resize?.[1]}]\nlabels: tensor[B]\nclasses: list[N]`,
    'dataset.csv': `features: tensor[B, num_features]\ntargets: tensor[B]`,
    'dataset.text': `input_ids: seq[B, ${config.max_length}]\nattention_mask: seq[B, ${config.max_length}]`,
    'dataset.json': `data: tensor[B, feature_dim]\nlabels: tensor[B]`,
    'dataset.database': `features: tensor[B, num_features]\ntargets: tensor[B]`,
    'dataset.api': `data: tensor[B, feature_dim]\nlabels: tensor[B]`,
  };

  return (
    <div className="flex flex-col gap-1">
      {items.map(({ k, v }) => (
        <div key={k} className="flex justify-between bg-black/50 px-1.5 py-0.5 rounded">
          <span className="text-[9px] text-[#faebd7]/30 font-mono uppercase">{k}</span>
          <span className="text-[9px] text-[#faebd7]/70 font-mono">{String(v ?? '—')}</span>
        </div>
      ))}
      <div className="mt-1 bg-black/50 px-1.5 py-1 rounded">
        <div className="text-[8px] text-purple-400/60 font-mono mb-0.5">OUTPUT SCHEMA</div>
        <pre className="text-[8px] text-purple-300/80 font-mono whitespace-pre-wrap leading-relaxed">
          {schemaLines[nodeType] ?? ''}
        </pre>
      </div>
    </div>
  );
}

// ── Main DatasetNode ──────────────────────────────────────────────────────────

export default function DatasetNode({ data, id, selected }) {
  const { nodeModel } = data;
  const { type, inputs = [], outputs = [], config = {}, label } = nodeModel;

  const [activeTab, setActiveTab] = useState('Source');
  const [collapsed, setCollapsed] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);

  const updateNodeConfig = useExecutionStore(s => s.updateNodeConfig);

  const accent = TYPE_HEX[type] ?? '#faebd7';
  const Icon = TYPE_ICONS[type] ?? Database;

  const handleChange = useCallback((key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    updateNodeConfig(id, { [key]: value });
    if (data?.nodeModel?.config) data.nodeModel.config[key] = value;
  }, [id, updateNodeConfig, data, setLocalConfig]);

  const visibleTabs = ALL_TABS.filter(t =>
    t !== 'Processing' || ['dataset.image', 'dataset.csv', 'dataset.json'].includes(type)
  );

  // ── Handle vertical positioning ─────────────────────────────────────────
  // Collapsed: header is ~44px tall. Space handles evenly within that.
  // Expanded:  the port label row is always at a fixed offset from top.
  //   Header: 44px + Tabs: 34px + Content: 220px + PortRow: ~30px each port at 22px apart
  //   We anchor input handles to header and output handles to port-label row.
  const HEADER_H = 44;
  const TABBAR_H = 34;
  const CONTENT_H = 220;
  const PORT_ROW_START = HEADER_H + TABBAR_H + CONTENT_H + 8; // ~306px from top

  return (

    <div
      className={`
        w-[268px] rounded-xl overflow-hidden font-mono
        transition-shadow duration-200
        ${selected ? 'shadow-[0_0_0_2px_var(--accent-faint),0_8px_32px_rgba(0,0,0,0.7)]' : 'shadow-[0_4px_20px_rgba(0,0,0,0.55)]'}
      `}
      style={{
        background: '#141414',
        border: `1px solid ${selected ? accent : '#faebd720'}`,
        // CSS custom prop used in shadow class above
        '--accent-faint': accent + '55',
      }}
    >
      {/* ── Input handles (left side, anchored to header) ── */}
      {inputs.map((inp, idx) => (
        <Handle
          key={`in-${inp.name}`}
          type="target"
          position={Position.Left}
          id={inp.name}
          style={{ top: HEADER_H / 2 + idx * 16, background: portHex(inp.datatype), border: 'none', width: 8, height: 8 }}
          title={`${inp.name}: ${inp.datatype}${inp.optional ? ' (optional)' : ''}`}
        />
      ))}

      {/* ── HEADER (the ONLY draggable region = no stopProp here) ── */}
      <div
        className="flex items-center justify-between px-2.5 py-2 cursor-grab active:cursor-grabbing"
        style={{ background: accent + '18', borderBottom: `1px solid ${accent}30` }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center flex-shrink-0"
            style={{ background: accent + '28' }}>
            <Icon size={12} color={accent} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#faebd7] leading-tight">{label ?? type}</div>
            <div className="text-[8px] uppercase tracking-widest" style={{ color: accent + 'cc' }}>Dataset Node</div>
          </div>
        </div>
        {collapsed
          ? <ChevronDown size={14} color="#faebd760" />
          : <ChevronUp size={14} color="#faebd760" />}
      </div>

      {/* ── BODY — use React Flow's 'nodrag' class to prevent canvas drag ── */}
      {!collapsed && (
        <div className="nodrag">

          {/* Tab bar */}
          <div className="flex border-b border-[#faebd7]/[0.06] bg-black/40">
            {visibleTabs.map(tab => {
              const TI = TAB_ICONS[tab];
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={e => { e.stopPropagation(); setActiveTab(tab); }}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 border-b-2 transition-colors duration-150 cursor-pointer ${active ? '' : 'border-transparent'}`}
                  style={{ borderColor: active ? accent : undefined }}
                  title={tab}
                >
                  <TI size={10} color={active ? accent : '#faebd740'} />
                  <span className="text-[7px]" style={{ color: active ? accent : '#faebd740' }}>{tab}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="nowheel h-[220px] overflow-y-auto px-2.5 pt-2 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#faebd7]/10"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#faebd710 transparent' }}
          >
            {activeTab === 'Source' && <SourceTab nodeType={type} config={localConfig} onChange={handleChange} />}
            {activeTab === 'Loading' && <LoadingTab config={localConfig} onChange={handleChange} />}
            {activeTab === 'Processing' && <ProcessingTab nodeType={type} config={localConfig} onChange={handleChange} />}
            {activeTab === 'Split' && <SplitTab config={localConfig} onChange={handleChange} />}
            {activeTab === 'Preview' && <PreviewTab nodeType={type} config={localConfig} />}
          </div>

          {/* Port label row (right-aligned) — output handles are anchored to these */}
          <div className="flex flex-col items-end gap-1 px-2.5 pt-1.5 pb-2.5 border-t border-[#faebd7]/[0.05]">
            {outputs.map((out, idx) => {
              const tw = portTw(out.datatype);
              return (
                <div key={out.name} className="flex items-center gap-1.5">
                  {out.shape?.length > 0 && (
                    <span className="text-[8px] text-[#faebd7]/25 font-mono">{out.shape.join('×')}</span>
                  )}
                  <span className={`text-[8px] font-mono px-1.5 py-px rounded border ${tw.badge}`}>
                    {out.name}
                  </span>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tw.dot}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsed port row */}
      {collapsed && (
        <div
          className="flex flex-col items-end gap-1 px-2.5 py-1.5 border-t border-[#faebd7]/[0.05]"
        >
          {outputs.map(out => {
            const tw = portTw(out.datatype);
            return (
              <div key={out.name} className="flex items-center gap-1">
                <span className={`text-[7px] font-mono px-1 py-px rounded border ${tw.badge}`}>{out.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tw.dot}`} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Output Handles ── */}
      {/* Position handles relative to their port-label rows.
          We measure from top of node:
            Expanded:  header(44) + tabbar(34) + content(220) + top-padding(6) + (idx * row-height ~22px) + half-row
            Collapsed: header(44) + top-padding(6) + (idx * row-height ~18px) + half-row */}
      {outputs.map((out, idx) => (
        <Handle
          key={`out-${out.name}`}
          type="source"
          position={Position.Right}
          id={out.name}
          style={{
            top: collapsed
              ? 44 + 6 + idx * 18 + 7        // header + padding + row * idx + center
              : 44 + 34 + 220 + 6 + idx * 22 + 9, // header + tabs + content + padding + center
            background: portHex(out.datatype),
            border: '2px solid #141414',
            width: 10, height: 10,
            borderRadius: '50%',
            zIndex: 10,
          }}
          title={`${out.name}: ${out.datatype}[${out.shape?.join(', ')}]`}
        />
      ))}
    </div>
  );
}
