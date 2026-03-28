import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useUIStore } from '../../store/useUIStore';

export default function AnnotationNode({ id, data, selected }) {
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
    <div className={`p-2 transition-all duration-200 ${selected ? 'ring-2 ring-primary/50' : ''}`}>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Type here..."
        className="bg-transparent border-none outline-none resize-none overflow-hidden font-mono text-sm leading-relaxed min-w-[120px]"
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
