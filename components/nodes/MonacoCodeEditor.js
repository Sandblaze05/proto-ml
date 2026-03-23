'use client';

import React, { useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';

export default function MonacoCodeEditor({
  title = 'Code',
  language = 'python',
  value = '',
  onChange,
  onReset,
  readOnly = false,
  height = 190,
}) {
  const [wordWrap, setWordWrap] = useState('on');

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value || '');
    } catch {
      // ignore clipboard errors
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[9px] text-[#faebd7]/45 uppercase tracking-wider">{title}</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setWordWrap((v) => (v === 'on' ? 'off' : 'on')); }}
            className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded"
          >
            Wrap: {wordWrap === 'on' ? 'On' : 'Off'}
          </button>
          {onReset && (
            <button
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="px-2 py-1 text-[10px] bg-amber-700/30 hover:bg-amber-700/45 rounded"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-700/50 rounded"
          >
            Copy
          </button>
        </div>
      </div>

      <div
        className="border border-[#faebd7]/10 rounded overflow-hidden bg-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <Editor
          height={height}
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
  );
}
