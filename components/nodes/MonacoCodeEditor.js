'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import { AlignJustify, Copy, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

function IconHoverButton({ icon: Icon, label, onClick, className = '', onMouseDown }) {
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={`group relative inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/40 hover:bg-slate-700/55 transition-colors ${className}`}
      title={label}
    >
      <Icon size={12} />
      <span className="pointer-events-none absolute left-0 top-full mt-1 whitespace-nowrap rounded-md border border-[#faebd7]/15 bg-[#101014] px-2 py-1 text-[10px] text-[#faebd7] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

export default function MonacoCodeEditor({
  title = 'Code',
  language = 'python',
  value = '',
  onChange,
  onReset,
  readOnly = false,
  height = 190,
  dockItems = [],
  activeDockId = '',
  onDockSelect,
  onExpandedChange,
}) {
  const [wordWrap, setWordWrap] = useState('on');
  const [expanded, setExpanded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [panelRect, setPanelRect] = useState({ x: 80, y: 60, width: 900, height: 640 });
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  useEffect(() => {
    if (!expanded || typeof window === 'undefined') return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetWidth = Math.max(680, Math.min(1200, Math.round(vw * 0.52)));
    const targetHeight = Math.max(420, Math.min(900, Math.round(vh * 0.74)));

    setPanelRect((prev) => {
      const width = Math.min(prev.width || targetWidth, vw - 24);
      const height = Math.min(prev.height || targetHeight, vh - 24);
      const x = Math.max(12, Math.min(prev.x ?? Math.round((vw - width) / 2), vw - width - 12));
      const y = Math.max(12, Math.min(prev.y ?? 56, vh - height - 12));
      return {
        x,
        y,
        width: prev.width ? width : targetWidth,
        height: prev.height ? height : targetHeight,
      };
    });
  }, [expanded]);

  const stopInteractions = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', stopInteractions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerMove = useCallback((e) => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (dragRef.current) {
      const d = dragRef.current;
      const nextX = e.clientX - d.offsetX;
      const nextY = e.clientY - d.offsetY;
      setPanelRect((prev) => ({
        ...prev,
        x: Math.max(8, Math.min(nextX, vw - prev.width - 8)),
        y: Math.max(8, Math.min(nextY, vh - prev.height - 8)),
      }));
      return;
    }

    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      setPanelRect((prev) => {
        let width = r.startWidth;
        let height = r.startHeight;
        if (r.mode === 'right' || r.mode === 'corner') width = r.startWidth + dx;
        if (r.mode === 'bottom' || r.mode === 'corner') height = r.startHeight + dy;

        const maxWidth = vw - prev.x - 8;
        const maxHeight = vh - prev.y - 8;
        width = Math.max(620, Math.min(width, maxWidth));
        height = Math.max(360, Math.min(height, maxHeight));
        return { ...prev, width, height };
      });
    }
  }, []);

  const startDragging = useCallback((e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = {
      offsetX: e.clientX - panelRect.x,
      offsetY: e.clientY - panelRect.y,
    };
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', stopInteractions);
  }, [panelRect.x, panelRect.y, onPointerMove, stopInteractions]);

  const startResizing = useCallback((mode, e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    resizeRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: panelRect.width,
      startHeight: panelRect.height,
    };
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', stopInteractions);
  }, [panelRect.width, panelRect.height, onPointerMove, stopInteractions]);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value || '');
    } catch {
      // ignore clipboard errors
    }
  }, [value]);

  const isFill = height === '100%';
  const editorHeight = expanded ? '100%' : height;
  const headerClass = expanded
    ? 'flex items-center justify-between gap-2'
    : `flex flex-col gap-1.5 ${isFill ? 'h-full min-h-0' : ''}`;
  const controlsClass = expanded
    ? 'flex items-center gap-1.5'
    : 'flex flex-wrap items-center gap-1.5';

  const editorBody = (
    <div
      className={expanded
        ? 'fixed z-1200 flex flex-col rounded-xl border border-[#faebd7]/25 bg-[#111] shadow-2xl overflow-hidden'
        : `flex flex-col gap-2 ${isFill ? 'h-full' : ''}`}
      style={expanded ? { left: panelRect.x, top: panelRect.y, width: panelRect.width, height: panelRect.height } : undefined}
    >
      {expanded && (
        <div className="border-b border-[#faebd7]/15 bg-[#171717]">
          <div className="flex items-end justify-between gap-2 px-2 pt-2 pb-1 cursor-move" onMouseDown={startDragging}>
            <div className="flex items-end gap-1 overflow-x-auto">
              {Array.isArray(dockItems) && dockItems.length > 0 ? dockItems.map((item, idx) => {
                const isActive = String(activeDockId || '') === String(item.id || '');
                return (
                  <button
                    key={item.id || idx}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDockSelect?.(item.id);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-t-xl text-[10px] font-mono border border-b-0 transition-colors ${isActive ? 'bg-[#1f1f1f] border-[#faebd7]/35 text-[#faebd7]' : 'bg-[#0f0f0f] border-[#faebd7]/20 text-[#faebd7]/65 hover:bg-[#171717]'}`}
                    title={item.subtitle ? `${item.label} (${item.subtitle})` : item.label}
                  >
                    {item.label}
                  </button>
                );
              }) : (
                <div className="px-2 py-1 text-[10px] text-[#faebd7]/50 font-mono">{title}</div>
              )}
            </div>

            <IconHoverButton
              icon={Minimize2}
              label="Collapse"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            />
          </div>
        </div>
      )}

      <div className={expanded ? 'flex flex-col gap-2 h-full p-3' : headerClass}>
        <div className={expanded ? 'flex items-center justify-between gap-2' : ''}>
          <div className="text-[9px] text-[#faebd7]/45 uppercase tracking-wider leading-tight">{title}</div>
          <div className={controlsClass}>
            {!expanded && (
              <IconHoverButton icon={Maximize2} label="Expand" onClick={(e) => { e.stopPropagation(); setExpanded(true); }} />
            )}
          <IconHoverButton
            icon={AlignJustify}
            label={`Wrap ${wordWrap === 'on' ? 'On' : 'Off'}`}
            onClick={(e) => { e.stopPropagation(); setWordWrap((v) => (v === 'on' ? 'off' : 'on')); }}
          />
          {onReset && (
            <IconHoverButton
              icon={RotateCcw}
              label="Reset"
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="bg-amber-700/30 hover:bg-amber-700/45"
            />
          )}
          <IconHoverButton icon={Copy} label="Copy" onClick={handleCopy} />
          </div>
        </div>

        <div
          className={`border border-[#faebd7]/10 rounded overflow-hidden bg-black/60 ${isFill || expanded ? 'flex-1 min-h-0' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Editor
            height={editorHeight}
            language={language}
            value={value || ''}
            onChange={(next) => onChange?.(next ?? '')}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 11,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap,
              wrappingIndent: 'indent',
              tabSize: 2,
            }}
            theme="vs-dark"
          />
        </div>
      </div>

      {expanded && (
        <>
          <div className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize" onMouseDown={(e) => startResizing('right', e)} />
          <div className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize" onMouseDown={(e) => startResizing('bottom', e)} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-[#faebd7]/20" onMouseDown={(e) => startResizing('corner', e)} />
        </>
      )}
    </div>
  );

  const expandedLayer = expanded ? editorBody : null;

  return (
    <>
      {!expanded && editorBody}
      {expanded && portalReady ? createPortal(expandedLayer, document.body) : null}
    </>
  );
}
