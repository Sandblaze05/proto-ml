'use client';

import React, { useState } from 'react';
import { NodeResizer } from 'reactflow';
import { useUIStore } from '../../store/useUIStore';

export default function GroupNode({ id, data, selected }) {
  const { setNodes, nodes } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || 'New Group');

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n));
  };

  return (
    <div
      className={`w-full h-full rounded-2xl border-2 transition-all duration-200 ${
        selected ? 'border-cyan-400 bg-cyan-400/5 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'border-foreground/10 bg-foreground/[0.02]'
      }`}
      onDoubleClick={handleDoubleClick}
      style={{ minWidth: 100, minHeight: 100 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={100}
        lineClassName="border-cyan-400"
        handleClassName="w-2 h-2 bg-background border-2 border-cyan-400 rounded-sm"
      />
      
      <div className="absolute -top-6 left-0 flex items-center gap-2">
        {isEditing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            className="bg-background border border-cyan-400 rounded px-1 text-[10px] font-bold uppercase tracking-wider outline-none text-cyan-400"
          />
        ) : (
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 px-1">
            {label}
          </span>
        )}
      </div>

      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-foreground/20 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-foreground/20 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-foreground/20 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-foreground/20 rounded-br-lg" />
    </div>
  );
}
