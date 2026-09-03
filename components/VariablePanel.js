'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Hash, Type, Settings2 } from 'lucide-react';
import { useVariableStore } from '@/store/useVariableStore';
import { useUIStore } from '@/store/useUIStore';

export default function VariablePanel() {
  const { variables, panelOpen, setPanelOpen, addVariable, updateVariable, removeVariable } = useVariableStore();
  const { addToast, activeSidePanel, setActiveSidePanel } = useUIStore();
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (activeSidePanel !== 'variables' && panelOpen) setPanelOpen(false);
  }, [activeSidePanel, panelOpen, setPanelOpen]);

  const handleTogglePanel = () => {
    if (panelOpen) {
      setActiveSidePanel(null);
      setPanelOpen(false);
    } else {
      setActiveSidePanel('variables');
      setPanelOpen(true);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (variables.some(v => v.name === newName.trim().toUpperCase())) {
      addToast('Variable already exists', 'error');
      return;
    }
    addVariable({ name: newName.trim().toUpperCase(), value: '0', type: 'number' });
    setNewName('');
  };

  return (
    <>
      {!panelOpen && !activeSidePanel && (
        <button
          onClick={handleTogglePanel}
          className="group z-[150] fixed top-[176px] right-0 flex items-center h-10 bg-background/90 backdrop-blur-md border border-r-0 border-foreground rounded-l-lg shadow-lg cursor-pointer hover:bg-foreground/10 transition-all duration-300 overflow-hidden w-10 hover:w-32"
        >
          <div className="flex items-center pl-3 w-32 whitespace-nowrap">
            <Settings2 size={18} className="shrink-0 text-foreground" />
            <span className="ml-2 font-semibold text-sm text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Variables
            </span>
          </div>
        </button>
      )}

      {panelOpen && (
        <div className="z-[200] flex flex-col fixed right-3 top-16 bottom-6 w-[380px] rounded-2xl bg-background border border-foreground/20 overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-foreground/5 border-b border-foreground/10">
            <div className="flex items-center gap-2">
              <Settings2 size={18} className="text-amber-400" />
              <h1 className="text-base font-bold text-foreground">Global Variables</h1>
            </div>
            <button
              onClick={handleTogglePanel}
              className="p-1.5 hover:bg-foreground/10 rounded-md transition-colors"
            >
              <X size={18} className="text-foreground/60" />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="VARIABLE_NAME"
                className="flex-1 bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-amber-400/50 transition-colors"
              />
              <button
                onClick={handleAdd}
                className="p-2 bg-amber-400 text-background rounded-lg hover:bg-amber-500 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {variables.map((v) => (
                <div key={v.id} className="group flex items-center gap-2 bg-foreground/[0.02] border border-foreground/5 p-3 rounded-xl hover:border-foreground/10 transition-colors">
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 font-mono">
                        {v.name}
                      </span>
                      <button 
                        onClick={() => removeVariable(v.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-400/10 rounded transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => updateVariable(v.id, { value: e.target.value })}
                        className="flex-1 bg-transparent border-none text-sm font-mono text-foreground outline-none focus:text-amber-400 transition-colors"
                      />
                      {v.type === 'number' ? <Hash size={14} className="text-foreground/20" /> : <Type size={14} className="text-foreground/20" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-amber-400/5 border-t border-amber-400/10">
            <p className="text-[10px] text-amber-400/60 leading-relaxed italic">
              * Variables can be referenced in Python code using their names directly. They are injected as global constants during execution.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
