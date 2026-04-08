'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import { Wrench, Settings2, Code2, Eye, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useExecutionStore } from '../../store/useExecutionStore';
import { useUIStore } from '../../store/useUIStore';
import { generateTransformPythonCode } from '../../lib/pythonTemplates/transformNodeTemplate';
import { previewNode } from '../../lib/executionClient';
import MonacoCodeEditor from './MonacoCodeEditor';

const TABS = ['Config', 'Code', 'Preview'];
const TAB_ICONS = { Config: Settings2, Code: Code2, Preview: Eye };

function ConfigField({ label, value, onChange, schema = {}, disabled = false }) {
  const isArray = Array.isArray(value);
  const valueType = isArray ? 'array' : typeof value;
  const schemaType = schema?.type;

  const effectiveType = schemaType || valueType;
  const effectiveLabel = schema?.label || label;

  const parseList = (txt) => txt
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const parseNumberList = (txt) => parseList(txt).map((v) => Number(v)).filter((v) => Number.isFinite(v));

  return (
    <div className="mb-2">
      <div className="text-[9px] text-[#faebd7]/40 uppercase tracking-wider mb-1">{effectiveLabel}</div>

      {effectiveType === 'enum' && (
        <select
          value={String(value ?? '')}
          onChange={(e) => !disabled && onChange(e.target.value)}
          disabled={disabled}
          className={`w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {(schema.options || []).map((opt) => (
            <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
          ))}
        </select>
      )}

      {(effectiveType === 'boolean' || valueType === 'boolean') && (
        <button
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); !disabled && onChange(!value); }}
          className={`px-2 py-1 text-[10px] rounded transition-colors ${value ? 'bg-cyan-700/40' : 'bg-slate-700/35'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {value ? 'True' : 'False'}
        </button>
      )}

      {(effectiveType === 'number' || valueType === 'number') && (
        <input
          type="number"
          value={value}
          min={schema.min}
          max={schema.max}
          step={schema.step}
          onChange={(e) => !disabled && onChange(Number(e.target.value))}
          disabled={disabled}
          className={`w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
        />
      )}

      {effectiveType === 'array:number' && (
        <input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) => onChange(parseNumberList(e.target.value))}
          placeholder="e.g. 224, 224"
          className="w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1"
        />
      )}

      {effectiveType === 'array:string' && (
        <input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) => onChange(parseList(e.target.value))}
          placeholder="comma-separated values"
          className="w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1"
        />
      )}

      {effectiveType === 'code' && (
        <MonacoCodeEditor
          title={effectiveLabel}
          language={schema.language || 'python'}
          value={String(value ?? '')}
          onChange={(next) => onChange(next)}
          height={140}
        />
      )}

      {effectiveType === 'string' && (
        <input
          type="text"
          value={value}
          onChange={(e) => !disabled && onChange(e.target.value)}
          disabled={disabled}
          className={`w-full bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
        />
      )}

      {(effectiveType === 'array' || effectiveType === 'object' || (!schemaType && (valueType === 'array' || valueType === 'object'))) && (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            if (disabled) return;
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Ignore temporary invalid JSON while typing.
            }
          }}
          disabled={disabled}
          className={`w-full min-h-14 bg-black/60 border border-[#faebd7]/10 rounded text-[#faebd7] text-[10px] font-mono px-1.5 py-1 ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
        />
      )}
    </div>
  );
}

function PreviewTab({ previewing, onRunPreview, previewResult, disabled = false }) {
  const analysis = useMemo(() => {
    if (!previewResult || previewResult.error) return null;

    const rows = Array.isArray(previewResult)
      ? previewResult
      : (Array.isArray(previewResult?.rows) ? previewResult.rows : []);

    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        rows: 0,
        columns: 0,
        missingCells: 0,
        hints: ['No tabular rows available in preview output.'],
      };
    }

    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
    let missingCells = 0;
    rows.forEach((row) => {
      columns.forEach((column) => {
        if (row?.[column] === null || row?.[column] === undefined || row?.[column] === '') {
          missingCells += 1;
        }
      });
    });

    const hints = [];
    if (missingCells > 0) hints.push('Missing values detected; consider fill or filter operations.');
    if (columns.length === 0) hints.push('No columns inferred; validate upstream structure.');
    if (hints.length === 0) hints.push('Shape looks consistent for downstream processing.');

    return {
      rows: rows.length,
      columns: columns.length,
      missingCells,
      hints,
      columnsPreview: columns.slice(0, 8),
      rowsPreview: rows.slice(0, 4),
    };
  }, [previewResult]);

  return (
    <div className="space-y-2">
      <button
        onClick={(e) => { e.stopPropagation(); !disabled && onRunPreview(); }}
        disabled={previewing || disabled}
        className={`w-full px-2 py-1 rounded text-[10px] font-mono bg-cyan-700/30 border border-cyan-300/25 transition-all ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-cyan-700/45'} `}
      >
        {previewing ? 'Previewing...' : 'Run Preview'}
      </button>

      {previewResult?.error && (
        <div className="rounded border border-red-400/30 bg-red-500/10 px-2 py-1 text-[9px] font-mono text-red-300">
          {previewResult.error}
        </div>
      )}

      {analysis && (
        <div className="rounded border border-[#faebd7]/12 bg-black/35 px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-wider text-[#faebd7]/45 font-mono mb-1">Node Analysis</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-[#faebd7]/70 mb-1">
            <div>Rows: {analysis.rows}</div>
            <div>Columns: {analysis.columns}</div>
            <div>Missing: {analysis.missingCells}</div>
            <div>Hints: {analysis.hints.length}</div>
          </div>
          {analysis.columnsPreview?.length > 0 && (
            <div className="text-[9px] text-[#faebd7]/60 font-mono mb-1">Schema: {analysis.columnsPreview.join(', ')}</div>
          )}
          {analysis.hints.map((hint, index) => (
            <div key={index} className="text-[9px] text-[#faebd7]/55 font-mono">- {hint}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TransformNode({ data, id, selected }) {
  const isLocked = useStore(s => s.nodeInternals.get(id)?.draggable === false);
  const readOnly = useUIStore(s => s.readOnly);
  const { nodeModel, collapsed: storeCollapsed } = data;
  const {
    type,
    label,
    inputs = ['in'],
    outputs = ['out'],
    config = {},
    uiSchema = {},
    kind = 'transform',
    pythonCode: initialPythonCode,
  } = nodeModel;

  const [activeTab, setActiveTab] = useState('Config');
  const toggleNodeCollapse = useUIStore((s) => s.toggleNodeCollapse);
  const collapsed = !!storeCollapsed;
  const [localConfig, setLocalConfig] = useState(config);
  const [pythonCode, setPythonCode] = useState(() => initialPythonCode || generateTransformPythonCode(type, config));
  const [manualCodeOverride, setManualCodeOverride] = useState(false);
  const [codeViewNodeId, setCodeViewNodeId] = useState(id);

  const updateExecutionNode = useExecutionStore(s => s.updateExecutionNode);
  const execNodes = useExecutionStore(s => s.nodes);
  const execEdges = useExecutionStore(s => s.edges);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

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

  const applyNodeUpdates = useCallback((patch) => {
    updateExecutionNode(id, patch);
    if (data?.nodeModel) Object.assign(data.nodeModel, patch);
  }, [id, updateExecutionNode, data]);

  const updateConfig = useCallback((key, value) => {
    const nextConfig = { ...localConfig, [key]: value };
    setLocalConfig(nextConfig);

    const patch = { config: nextConfig, params: nextConfig };
    if (!manualCodeOverride) {
      const generated = generateTransformPythonCode(type, nextConfig);
      setPythonCode(generated);
      patch.pythonCode = generated;
    }

    applyNodeUpdates(patch);
  }, [localConfig, manualCodeOverride, type, applyNodeUpdates]);

  const handleCodeChange = useCallback((nextCode) => {
    setPythonCode(nextCode);
    setManualCodeOverride(true);
    applyNodeUpdates({ pythonCode: nextCode });
  }, [applyNodeUpdates]);

  const resetCodeFromTemplate = useCallback(() => {
    const generated = generateTransformPythonCode(type, localConfig);
    setPythonCode(generated);
    setManualCodeOverride(false);
    applyNodeUpdates({ pythonCode: generated });
  }, [type, localConfig, applyNodeUpdates]);

  const runPreview = useCallback(async (count = 5) => {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const graph = { nodes: execNodes, edges: execEdges };
      const res = await previewNode(graph, id, count);
      setPreviewResult(res?.sample ?? res);
    } catch (error) {
      setPreviewResult({ error: String(error) });
    } finally {
      setPreviewing(false);
    }
  }, [execNodes, execEdges, id]);

  useEffect(() => {
    if (!initialPythonCode) {
      const generated = generateTransformPythonCode(type, localConfig);
      applyNodeUpdates({ pythonCode: generated, config: localConfig, params: localConfig });
    }
  }, [type, initialPythonCode, localConfig, applyNodeUpdates]);

  const configKeys = useMemo(() => {
    const keys = new Set([...(Object.keys(uiSchema || {})), ...(Object.keys(localConfig || {}))]);
    return Array.from(keys);
  }, [uiSchema, localConfig]);

  const selectedColor = kind === 'lifecycle' ? '#ffe066' : '#67e8f9';

  return (
    <div
      className={`w-67 rounded-xl overflow-hidden font-mono transition-shadow duration-200`}
      style={{
        background: '#141414',
        border: `1px solid ${selected ? selectedColor : '#faebd720'}`,
        boxShadow: selected
          ? `0 0 0 2px ${selectedColor}55, 0 8px 32px rgba(0,0,0,0.7)`
          : '0 4px 20px rgba(0,0,0,0.55)',
      }}
    >
      {inputs.map((inp, idx) => (
        <Handle
          key={`in-${inp || idx}`}
          type="target"
          position={Position.Left}
          id={inp}
          style={{ top: 22 + idx * 16, background: '#fbbf24', border: 'none', width: 8, height: 8 }}
          title={`Input port: ${inp || `in_${idx + 1}`}`}
        />
      ))}

      <div
        className="flex items-center justify-between px-2.5 py-2 cursor-grab active:cursor-grabbing"
        style={{ background: kind === 'lifecycle' ? '#ffe06622' : '#67e8f922', borderBottom: kind === 'lifecycle' ? '1px solid #ffe06644' : '1px solid #67e8f944' }}
        onClick={() => toggleNodeCollapse(id)}
      >
        <div className="flex items-center gap-2">
          <div className="w-5.5 h-5.5 rounded-[5px] flex items-center justify-center shrink-0" style={{ background: kind === 'lifecycle' ? '#ffe06633' : 'rgba(34,211,238,0.2)' }}>
            <Wrench size={12} color={kind === 'lifecycle' ? '#ffe066' : '#67e8f9'} />
          </div>
          <div>
            <div className="text-[11px] font-bold" style={{ color: kind === 'lifecycle' ? '#ffe066' : '#faebd7' }}>{label || type}</div>
            <div className="text-[8px] uppercase tracking-widest" style={{ color: kind === 'lifecycle' ? '#ffe066cc' : 'rgba(103,232,249,0.8)' }}>{kind === 'lifecycle' ? 'Lifecycle Node' : 'Transform Node'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && <Lock size={12} color={kind === 'lifecycle' ? '#ffe066' : '#67e8f9'} className="opacity-60" />}
          {collapsed ? <ChevronDown size={14} color="#faebd760" /> : <ChevronUp size={14} color="#faebd760" />}
        </div>
      </div>

      {!collapsed && (
        <div className="nodrag">
          <div className="flex border-b border-[#faebd7]/6 bg-black/40">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 border-b-2 transition-colors duration-150 ${active ? '' : 'border-transparent'}`}
                  style={{ borderColor: active ? '#67e8f9' : undefined }}
                >
                  <Icon size={10} color={active ? '#67e8f9' : '#faebd740'} />
                  <span className="text-[7px]" style={{ color: active ? '#67e8f9' : '#faebd740' }}>{tab}</span>
                </button>
              );
            })}
          </div>

          <div className="nowheel h-55 overflow-y-auto px-2.5 pt-2 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#faebd7]/10">
            <div className={activeTab === 'Config' ? '' : 'hidden'}>
              {configKeys.length === 0 && (
                <div className="text-[10px] text-[#faebd7]/40">No editable parameters for this transform.</div>
              )}
              {configKeys.map((k) => (
                <ConfigField
                  key={k}
                  label={k}
                  value={localConfig?.[k]}
                  schema={uiSchema?.[k]}
                  onChange={(next) => updateConfig(k, next)}
                  disabled={readOnly}
                />
              ))}
            </div>

            <div className={activeTab === 'Code' ? '' : 'hidden'}>
              <MonacoCodeEditor
                title="Generated Python Transform"
                language="python"
                value={displayedCode}
                onChange={isDockReadOnly || readOnly ? undefined : handleCodeChange}
                onReset={readOnly ? undefined : resetCodeFromTemplate}
                readOnly={isDockReadOnly || readOnly}
                height={180}
                dockItems={dockItems}
                activeDockId={codeViewNodeId}
                onDockSelect={(nodeId) => setCodeViewNodeId(String(nodeId))}
              />
            </div>

            <div className={activeTab === 'Preview' ? '' : 'hidden'}>
              <PreviewTab
                previewing={previewing}
                onRunPreview={() => runPreview(5)}
                previewResult={previewResult}
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-end gap-1 px-2.5 pt-1.5 pb-2.5 border-t border-[#faebd7]/5">
        {outputs.map((out, idx) => (
          <div key={out || idx} className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono px-1.5 py-px rounded border text-cyan-300 bg-cyan-400/10 border-cyan-400/30">{out}</span>
            <div className="w-2 h-2 rounded-full shrink-0 bg-cyan-300" />
          </div>
        ))}
      </div>

      {outputs.map((out, idx) => (
        <Handle
          key={`out-${out || idx}`}
          type="source"
          position={Position.Right}
          id={out}
          title={`Output port: ${out || `out_${idx + 1}`}`}
          style={{
            top: collapsed ? 44 + 6 + idx * 22 + 9 : 44 + 34 + 220 + 6 + idx * 22 + 9,
            background: '#67e8f9',
            border: '2px solid #141414',
            width: 10,
            height: 10,
            borderRadius: '50%',
            zIndex: 10,
          }}
        />
      ))}
    </div>
  );
}
