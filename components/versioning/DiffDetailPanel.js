'use client';

import React, { useState, useMemo } from 'react';
import { X, Settings, Code, FileText, ArrowRight } from 'lucide-react';
import { useVersionStore } from '@/store/useVersionStore';
import { diffCodeLines } from '@/lib/versioning/graphDiff';

export default function DiffDetailPanel({ selectedNodeId, onClose }) {
  const {
    compareMode,
    diffResult,
    diffStatusMap
  } = useVersionStore();

  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'code'

  const nodeDiff = useMemo(() => {
    if (!compareMode || !diffResult || !selectedNodeId) return null;

    // Find the node in added, removed, or modified lists
    const added = diffResult.addedNodes.find(n => n.nodeId === selectedNodeId);
    if (added) return added;

    const removed = diffResult.removedNodes.find(n => n.nodeId === selectedNodeId);
    if (removed) return removed;

    const modified = diffResult.modifiedNodes.find(n => n.nodeId === selectedNodeId);
    if (modified) return modified;

    const moved = diffResult.movedNodes.find(n => n.nodeId === selectedNodeId);
    if (moved) return moved;

    return null;
  }, [compareMode, diffResult, selectedNodeId]);

  // Config diff calculation
  const configDiff = useMemo(() => {
    if (!nodeDiff) return [];
    const status = nodeDiff.status;
    const modelBefore = nodeDiff.before?.data?.nodeModel || {};
    const modelAfter = nodeDiff.after?.data?.nodeModel || {};

    if (status === 'added') {
      return Object.entries(modelAfter.config || {}).map(([key, val]) => ({
        key,
        before: undefined,
        after: val
      }));
    }
    if (status === 'removed') {
      return Object.entries(modelBefore.config || {}).map(([key, val]) => ({
        key,
        before: val,
        after: undefined
      }));
    }
    if (status === 'modified' && nodeDiff.changes?.config) {
      const changes = nodeDiff.changes.config;
      return Object.entries({
        ...(changes.before || {}),
        ...(changes.after || {})
      }).map(([key]) => ({
        key,
        before: changes.before?.[key],
        after: changes.after?.[key]
      })).filter(c => JSON.stringify(c.before) !== JSON.stringify(c.after));
    }
    return [];
  }, [nodeDiff]);

  // Code lines diff calculation
  const codeLines = useMemo(() => {
    if (!nodeDiff) return [];
    const modelBefore = nodeDiff.before?.data?.nodeModel || {};
    const modelAfter = nodeDiff.after?.data?.nodeModel || {};
    const codeBefore = modelBefore.pythonCode || '';
    const codeAfter = modelAfter.pythonCode || '';
    if (codeBefore === codeAfter && codeBefore === '') return [];
    return diffCodeLines(codeBefore, codeAfter);
  }, [nodeDiff]);

  // Early return check (placed after all hook calls to satisfy React's Rules of Hooks)
  if (!compareMode || !nodeDiff) return null;

  const status = nodeDiff.status; // 'added' | 'removed' | 'modified' | 'moved'
  
  // Extract models
  const modelBefore = nodeDiff.before?.data?.nodeModel || {};
  const modelAfter = nodeDiff.after?.data?.nodeModel || {};
  const label = modelAfter.label || modelBefore.label || selectedNodeId;
  const nodeType = modelAfter.type || modelBefore.type || 'Node';

  const hasConfigChanges = configDiff.length > 0;
  const hasCodeChanges = codeLines.some(l => l.type !== 'same');

  // Status Badge styles
  const statusBadges = {
    added: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    removed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    modified: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    moved: 'bg-sky-500/10 text-sky-400 border-sky-500/20'
  };

  return (
    <div className="fixed bottom-4 left-80 z-[150] w-[480px] bg-background/95 border-2 border-foreground rounded-2xl shadow-2xl p-4 backdrop-blur-xl flex flex-col gap-3 max-h-[380px] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-foreground/10 pb-2">
        <div className="flex flex-col min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground truncate leading-tight">
              {label}
            </span>
            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0 ${statusBadges[status]}`}>
              {status}
            </span>
          </div>
          <span className="text-[10px] font-mono text-foreground/45 mt-0.5">
            type: {nodeType}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all cursor-pointer shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-foreground/5 p-0.5 rounded-xl self-start shrink-0">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'config' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground'
          }`}
        >
          <Settings size={12} />
          <span>Config Parameters</span>
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'code' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground'
          }`}
        >
          <Code size={12} />
          <span>Python Code</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {activeTab === 'config' && (
          <div className="space-y-2">
            {hasConfigChanges ? (
              <div className="border border-foreground/10 rounded-xl overflow-hidden text-[11px] font-medium font-mono">
                {/* Table Header */}
                <div className="grid grid-cols-3 bg-foreground/5 px-3 py-1.5 border-b border-foreground/10 text-[9px] font-black uppercase text-foreground/40">
                  <span>Parameter</span>
                  <span>Before</span>
                  <span>After</span>
                </div>
                {/* Table Rows */}
                <div className="divide-y divide-foreground/5 max-h-[180px] overflow-y-auto">
                  {configDiff.map((c) => (
                    <div key={c.key} className="grid grid-cols-3 px-3 py-2 items-center gap-2">
                      <span className="text-foreground/50 truncate" title={c.key}>{c.key}</span>
                      <span className="text-rose-400 bg-rose-500/5 px-1 py-0.5 rounded truncate" title={c.before !== undefined ? String(c.before) : 'None'}>
                        {c.before !== undefined ? String(c.before) : '—'}
                      </span>
                      <span className="text-emerald-400 bg-emerald-500/5 px-1 py-0.5 rounded truncate" title={c.after !== undefined ? String(c.after) : 'None'}>
                        {c.after !== undefined ? String(c.after) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-foreground/40">
                <FileText size={24} className="opacity-30 mb-2" />
                <span className="text-[10px] font-mono">No configuration parameter changes.</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'code' && (
          <div className="space-y-1">
            {hasCodeChanges ? (
              <div className="border border-foreground/10 bg-black/35 rounded-xl p-3 font-mono text-[10px] leading-relaxed max-h-[190px] overflow-y-auto whitespace-pre overflow-x-auto">
                {codeLines.map((line, idx) => {
                  let lineClass = 'text-foreground/60';
                  let prefix = '  ';
                  if (line.type === 'add') {
                    lineClass = 'text-emerald-400 bg-emerald-500/10 px-1 rounded';
                    prefix = '+ ';
                  } else if (line.type === 'remove') {
                    lineClass = 'text-rose-400 bg-rose-500/10 px-1 rounded line-through';
                    prefix = '- ';
                  }
                  return (
                    <div key={idx} className={lineClass}>
                      {prefix}{line.line}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-foreground/40">
                <Code size={24} className="opacity-30 mb-2" />
                <span className="text-[10px] font-mono">Python templates are identical.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
