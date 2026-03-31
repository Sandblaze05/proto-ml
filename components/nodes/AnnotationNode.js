import React, { useState, useEffect } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import { Lock } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

export default function AnnotationNode({ id, data, selected }) {
  const isLocked = useStore(s => s.nodeInternals.get(id)?.draggable === false);
  const { setNodes, nodes } = useUIStore();
  const [text, setText] = useState(data.label || '');
  const color = data.color || '#faebd7';

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    // Update the node's label in the store
    setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n));
  };

  return (
    <div className={`p-2 transition-all duration-200 rounded-md bg-black/15 ${selected ? 'ring-2 ring-primary/50' : ''}`}>
      <div className="flex items-center justify-between mb-1 px-1 py-0.5 text-[10px] font-mono text-[#faebd7]/55 cursor-move select-none">
        <div className="flex items-center gap-1.5">
          {isLocked && <Lock size={10} className="opacity-60" />}
          <span>Text Note</span>
        </div>
        <span className="tracking-[2px]">:::</span>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Type here..."
        className="nodrag bg-transparent border-none outline-none resize-none overflow-hidden font-mono text-sm leading-relaxed min-w-[120px]"
        style={{ 
          color: color,
          width: 'auto',
          height: 'auto',
          minHeight: '2em'
        }}
        autoFocus
        spellCheck={false}
      />
      
      {/* Hidden Handles for connectivity if needed, though usually annotations are free-floating */}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
