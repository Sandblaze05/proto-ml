'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, { Background, useReactFlow, ReactFlowProvider, Handle, Position, useStore, useOnSelectionChange } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { View, Minus, Plus, Maximize, Minimize2, Trash2, 
  AlignCenterHorizontal, AlignCenterVertical,
  CheckCircle2, AlertCircle, Info, X, Wand2,
  MousePointer2, Pencil, Type, Undo2, Redo2, ChevronLeft, ChevronRight
} from 'lucide-react';
import gsap from 'gsap';
import { useDroppable } from '@dnd-kit/core';

import { useUIStore } from '../store/useUIStore';
import { useExecutionStore } from '../store/useExecutionStore';
import DatasetNode from './nodes/DatasetNode';
import TransformNode from './nodes/TransformNode';
import AnnotationNode from './nodes/AnnotationNode';
import { CATEGORIES } from './NodePalette';
import { v4 as uuidv4 } from 'uuid';
import { generateDatasetPythonCode } from '@/lib/pythonTemplates/datasetNodeTemplate';
import { generateTransformPythonCode } from '@/lib/pythonTemplates/transformNodeTemplate';
import { generateLifecyclePythonCode } from '@/lib/pythonTemplates/lifecycleNodeTemplate';

function ZoomControls() {
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, setNodes } = useReactFlow();
  const addToast = useUIStore(s => s.addToast);

  const containerStyle = {
    position: 'absolute',
    right: 16,
    bottom: 16,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  };

  const buttonStyle = {
    width: 44,
    height: 44,
    borderRadius: 8,
    border: '1px solid var(--color-foreground)',
    background: 'var(--color-background)',
    color: 'var(--color-foreground)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
  };

  const onLayout = () => {
    const nodes = getNodes();
    const edges = getEdges();
    
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 200 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((n) => {
      g.setNode(n.id, { width: n.width || 200, height: n.height || 100 });
    });

    edges.forEach((e) => {
      g.setEdge(e.source, e.target);
    });

    dagre.layout(g);

    const laidOutNodes = nodes.map((n) => {
      const nodeWithPos = g.node(n.id);
      return {
        ...n,
        targetPosition: {
          x: nodeWithPos.x - (n.width || 200) / 2,
          y: nodeWithPos.y - (n.height || 100) / 2,
        },
      };
    });

    // Animate with GSAP
    laidOutNodes.forEach((n) => {
      const el = document.querySelector(`[data-id="${n.id}"]`);
      if (el) {
        gsap.to(n.position, {
          x: n.targetPosition.x,
          y: n.targetPosition.y,
          duration: 0.8,
          ease: 'power3.inOut',
          onUpdate: () => {
            // Update the actual node state to force React Flow to re-render edges
            setNodes((nds) => nds.map((node) => node.id === n.id ? { ...node, position: { ...n.position } } : node));
          }
        });
      }
    });
    
    addToast('Layout tidied up successfully!', 'success');
  };

  return (
    <div style={containerStyle}>
      <button 
        aria-label="Tidy Layout" 
        title="Tidy Layout" 
        style={{ ...buttonStyle, background: 'var(--color-foreground)', color: 'var(--color-background)' }} 
        onClick={onLayout}
        className="hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(250,235,215,0.3)] border-none"
      >
        <Wand2 size={20} />
      </button>
      <button aria-label="Zoom in" title="Zoom in" style={buttonStyle} onClick={() => zoomIn()} className="hover:bg-foreground/10">
        <Plus size={20} />
      </button>
      <button aria-label="Zoom out" title="Zoom out" style={buttonStyle} onClick={() => zoomOut()} className="hover:bg-foreground/10">
        <Minus size={20} />
      </button>
      <button aria-label="Fit view" title="Fit view" style={buttonStyle} onClick={() => fitView()} className="hover:bg-foreground/10">
        <View size={20} />
      </button>
    </div>
  );
}


function ToastContainer() {
  const { toasts, removeToast } = useUIStore();
  
  return (
    <div className="fixed top-6 left-0 right-0 z-5000 flex flex-col items-center gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const itemRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(itemRef.current,
      { y: -20, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }
    );
  }, []);

  return (
    <div 
      ref={itemRef}
      className="flex items-center gap-4 px-6 py-3 bg-background/90 backdrop-blur-3xl border border-foreground/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[340px] pointer-events-auto"
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
        toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 
        toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 
        'bg-blue-500/20 text-blue-400'
      }`}>
        {toast.type === 'success' ? <CheckCircle2 size={20} /> : 
         toast.type === 'error' ? <AlertCircle size={20} /> : 
         <Info size={20} />}
      </div>
      <div className="flex-1">
        <div className="text-xs font-bold font-mono text-foreground uppercase tracking-tight">
          {toast.type}
        </div>
        <div className="text-[13px] text-foreground/70 font-medium leading-tight">
          {toast.message}
        </div>
      </div>
      <button 
        onClick={onRemove}
        className="p-1 hover:bg-foreground/10 rounded-lg transition-colors text-foreground/30 hover:text-foreground"
      >
        <X size={18} />
      </button>
    </div>
  );
}

// Generic CustomNode for non-dataset nodes (Process / Model / Optimize)
function CustomNode({ data }) {
  const { type, inputs, outputs, params, pythonCode } = data.nodeModel;

  let bgClass = "bg-[#1f1f1f]";
  if (["Resize", "Tokenize"].includes(type)) bgClass = "bg-[#212121]";
  else if (["CNN", "Transformer"].includes(type)) bgClass = "bg-[#282828]";
  else if (["Optimizer", "Accuracy"].includes(type)) bgClass = "bg-[#2f2f2f]";

  return (
    <div className={`p-3 rounded-lg border border-[#faebd7]/30 text-[#faebd7] font-mono shadow-xl ${bgClass}`} style={{ minWidth: 180 }}>
      {/* Input Handles */}
      {inputs.map((inp, idx) => (
        <Handle
          key={`in-${inp}`}
          type="target"
          position={Position.Left}
          id={inp}
          style={{ top: 20 + idx * 15, background: '#faebd7', border: 'none', width: 6, height: 6 }}
        />
      ))}

      <div className="font-bold border-b border-[#faebd7]/20 pb-1 mb-2 text-sm">{type}</div>

      <div className="text-xs text-[#faebd7]/70 space-y-1">
        {inputs.length > 0 && <div><span className="opacity-50">in:</span> {inputs.join(', ')}</div>}
        {outputs.length > 0 && <div><span className="opacity-50">out:</span> {outputs.join(', ')}</div>}
      </div>

      {params && Object.keys(params).length > 0 && (
        <div className="mt-2 text-[10px] bg-black/40 p-1 rounded text-[#faebd7]/50 overflow-hidden text-ellipsis">
          {JSON.stringify(params)}
        </div>
      )}

      {pythonCode && (
        <div className="mt-2 text-[9px] bg-black/40 p-1 rounded text-[#faebd7]/65 font-mono whitespace-pre-wrap max-h-20 overflow-auto">
          {pythonCode.split('\n').slice(0, 4).join('\n')}
        </div>
      )}

      {/* Output Handles */}
      {outputs.map((out, idx) => (
        <Handle
          key={`out-${out}`}
          type="source"
          position={Position.Right}
          id={out}
          style={{ top: 20 + idx * 15, background: '#faebd7', border: 'none', width: 6, height: 6 }}
        />
      ))}
    </div>
  );
}

const nodeTypes = { custom: CustomNode,  datasetNode: DatasetNode,
  transformNode: TransformNode,
  annotationNode: AnnotationNode,
};
const edgeTypes = {};

function EdgeAwareMiniMap() {
  const { nodes, edges, showMinimap, drawings } = useUIStore();
  const { setViewport } = useReactFlow();
  const transform = useStore(s => s.transform); 
  const rfWidth = useStore(s => s.width);
  const rfHeight = useStore(s => s.height);
  const nodeColorByType = useMemo(() => {
    const map = {};
    CATEGORIES.forEach((category) => {
      category.nodes.forEach((paletteNode) => {
        map[paletteNode.type] = paletteNode.color;
      });
    });
    return map;
  }, []);

  if (!showMinimap) return null;

  const getNodeSize = (node) => {
    const measuredWidth = node.measured?.width;
    const measuredHeight = node.measured?.height;
    const fallbackWidth = node.type === 'annotationNode' ? 140 : 260;
    const fallbackHeight = node.type === 'annotationNode' ? 60 : 180;

    return {
      width: measuredWidth || node.width || fallbackWidth,
      height: measuredHeight || node.height || fallbackHeight,
    };
  };

  const getNodeMiniSize = (node) => {
    const { width, height } = getNodeSize(node);
    const scale = node.type === 'annotationNode' ? 0.55 : 0.42;
    return {
      width: Math.max(38, width * scale),
      height: Math.max(24, height * scale),
    };
  };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(n => {
    const { width: w, height: h } = getNodeMiniSize(n);
    if (n.position.x < minX) minX = n.position.x;
    if (n.position.y < minY) minY = n.position.y;
    if (n.position.x + w > maxX) maxX = n.position.x + w;
    if (n.position.y + h > maxY) maxY = n.position.y + h;
  });

  const hasNodes = nodes.length > 0;
  if (hasNodes) {
    const rawW = Math.max(1, maxX - minX);
    const rawH = Math.max(1, maxY - minY);
    const padX = Math.max(40, Math.min(140, rawW * 0.1));
    const padY = Math.max(40, Math.min(140, rawH * 0.1));
    minX -= padX;
    minY -= padY;
    maxX += padX;
    maxY += padY;
  } else {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  const mapW = maxX - minX;
  const mapH = maxY - minY;

  const [tx, ty, zoom] = transform;
  const viewX = -tx / zoom;
  const viewY = -ty / zoom;
  const viewW = rfWidth / zoom;
  const viewH = rfHeight / zoom;

  const onMapClick = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixel click to SVG coordinates
    const clickX = minX + (x / rect.width) * mapW;
    const clickY = minY + (y / rect.height) * mapH;

    setViewport({
      x: -clickX * zoom + rfWidth / 2,
      y: -clickY * zoom + rfHeight / 2,
      zoom: zoom,
    }, { duration: 800 });
  };

  return (
    <div className="absolute bottom-[80px] right-[16px] w-[220px] h-[140px] bg-background border border-foreground/40 rounded-xl overflow-hidden z-50 shadow-2xl cursor-crosshair group active:scale-95 transition-transform duration-200 pointer-events-auto">
      <svg 
        viewBox={`${minX} ${minY} ${mapW} ${mapH}`} 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onClick={onMapClick}
      >
        <rect x={minX} y={minY} width={mapW} height={mapH} fill="var(--color-background)" opacity="1" />
        
        {/* Edges */}
        {edges.map(e => {
          const source = nodes.find(n => n.id === e.source);
          const target = nodes.find(n => n.id === e.target);
          if (!source || !target) return null;

          const { width: sW, height: sH } = getNodeMiniSize(source);
          const { height: tH } = getNodeMiniSize(target);

          const x1 = source.position.x + sW;
          const y1 = source.position.y + sH / 2;
          const x2 = target.position.x;
          const y2 = target.position.y + tH / 2;
          
          const cx1 = x1 + (x2 - x1) / 2;
          const cy1 = y1;
          const cx2 = x1 + (x2 - x1) / 2;
          const cy2 = y2;

          return (
            <path 
              key={e.id} 
              d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`} 
              fill="none" 
              stroke="var(--color-foreground)" 
              strokeWidth="2" 
              vectorEffect="non-scaling-stroke"
              opacity="0.34" 
            />
          );
        })}

        {/* Drawings */}
        {drawings.map((draw, i) => (
          <path 
            key={`draw-${i}`} 
            d={draw.path} 
            stroke={draw.color} 
            strokeWidth={1} 
            fill="none" 
            opacity={0.5}
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        ))}

        {/* Nodes */}
        {nodes.map((node) => {
          const isAnnotation = node.type === 'annotationNode';
          if (isAnnotation) {
            return (
              <text
                key={node.id}
                x={node.position.x + 10}
                y={node.position.y + 20}
                fill={node.data?.color || '#faebd7'}
                fontSize="8"
                fontFamily="monospace"
                className="opacity-60 pointer-events-none"
              >
                {node.data?.label?.slice(0, 15) || 'Text'}...
              </text>
            );
          }

          const modelType = node.data?.nodeModel?.type;
          const fillColor =
            nodeColorByType[modelType] ||
            (node.type === 'datasetNode' ? '#34d399' : node.type === 'transformNode' ? '#67e8f9' : '#666');

          return (
            <rect
              key={node.id}
              x={node.position.x}
              y={node.position.y}
              width={getNodeMiniSize(node).width}
              height={getNodeMiniSize(node).height}
              rx={6}
              fill={fillColor}
              opacity={0.8}
            />
          );
        })}

        {/* Viewport Mask and Box */}
        <mask id="minimap-mask">
          <rect x={minX} y={minY} width={mapW} height={mapH} fill="white" />
          <rect x={viewX} y={viewY} width={viewW} height={viewH} fill="black" />
        </mask>
        <rect x={minX} y={minY} width={mapW} height={mapH} fill="var(--color-background)" opacity="0.6" mask="url(#minimap-mask)" />
        <rect x={viewX} y={viewY} width={viewW} height={viewH} fill="none" stroke="var(--color-foreground)" strokeWidth="6" opacity="0.5" />
      </svg>
    </div>
  )
}


function Spotlight({ isOpen, onClose }) {
  const [search, setSearch] = useState('');
  const { addNode, addToast } = useUIStore();
  const { addExecutionNode } = useExecutionStore();
  const { getViewport } = useReactFlow();
  const rfWidth = useStore(s => s.width);
  const rfHeight = useStore(s => s.height);
  const containerRef = useRef(null);

  const flatNodes = useMemo(() => {
    return CATEGORIES.flatMap(cat => cat.nodes);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return flatNodes.slice(0, 5);
    return flatNodes.filter(n => 
      n.label.toLowerCase().includes(search.toLowerCase()) || 
      n.type.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, flatNodes]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      gsap.fromTo(containerRef.current, 
        { scale: 0.9, opacity: 0, y: -20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }
      );
    }
  }, [isOpen]);

  const onAddNode = (node) => {
    const newId = `${node.id}-${uuidv4().slice(0, 6)}`;
    const { x, y, zoom } = getViewport();
    const safeWidth = rfWidth || window.innerWidth;
    const safeHeight = rfHeight || window.innerHeight;
    const position = {
      x: (-x + safeWidth / 2) / zoom,
      y: (-y + safeHeight / 2) / zoom,
    };
    
    // Logic copied from NodePalette.js handleAdd
    const isDataset = node.id.startsWith('dataset.');
    const isLifecycle = node.id.startsWith('lifecycle.');

    if (isDataset && node.def) {
      const def = node.def;
      const initialConfig = { ...def.defaultConfig };
      const pythonCode = generateDatasetPythonCode(def.type, initialConfig);

      addNode({
        id: newId,
        type: 'datasetNode',
        position,
        data: {
          nodeModel: {
            type: def.type, label: def.label, inputs: def.inputs, outputs: def.outputs,
            config: initialConfig, schema: { ...def.schema }, metadata: { ...def.metadata }, pythonCode,
          },
        },
      });
      addExecutionNode(newId, {
        type: def.type, label: def.label, inputs: def.inputs.map(p => p.name),
        outputs: def.outputs.map(p => p.name), config: initialConfig,
        schema: { ...def.schema }, metadata: { ...def.metadata }, pythonCode,
      });
    } else if (node.def) {
      const def = node.def;
      const initialConfig = { ...(def.defaultConfig || {}) };
      const pythonCode = isLifecycle
        ? generateLifecyclePythonCode(def.type, initialConfig)
        : generateTransformPythonCode(def.type, initialConfig);

      addNode({
        id: newId,
        type: 'transformNode',
        position,
        data: {
          nodeModel: {
            type: def.type, label: def.label, inputs: (def.inputs || []).map(p => p.name),
            outputs: (def.outputs || []).map(p => p.name), params: initialConfig,
            config: initialConfig, kind: isLifecycle ? 'lifecycle' : 'transform', pythonCode,
          },
        },
      });
      addExecutionNode(newId, {
        type: def.type, label: def.label, inputs: (def.inputs || []).map(p => p.name),
        outputs: (def.outputs || []).map(p => p.name), config: initialConfig,
        kind: isLifecycle ? 'lifecycle' : 'transform', pythonCode,
      });
    }

    addToast(`Added ${node.label} from search`, 'success');
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      e.preventDefault();
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      onAddNode(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-1000 flex items-start justify-center pt-32 bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div 
        ref={containerRef}
        className="w-full max-w-xl bg-background/95 backdrop-blur-2xl border border-foreground/20 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-foreground/10">
          <Wand2 className="text-foreground/40" size={20} />
          <input 
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-lg font-mono placeholder:text-foreground/20"
            placeholder="Search nodes or type 'transform'..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onKey}
          />
          <div className="px-2 py-1 bg-foreground/10 rounded text-[10px] font-mono text-foreground/40">ESC to close</div>
        </div>
        <div className="max-h-[350px] overflow-y-auto p-2">
          {filtered.map((node, i) => (
            <div 
              key={node.id}
              onClick={() => onAddNode(node)}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                i === selectedIndex ? 'bg-foreground/10 shadow-inner' : 'hover:bg-foreground/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: node.color + '22' }}>
                  <node.icon size={16} color={node.color} />
                </div>
                <div>
                  <div className="text-sm font-mono font-bold">{node.label}</div>
                  <div className="text-[10px] font-mono text-foreground/40 uppercase tracking-tight">{node.type}</div>
                </div>
              </div>
              {i === selectedIndex && <div className="text-[10px] font-mono text-foreground/40 mr-2">ENTER</div>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-10 text-center text-foreground/20 font-mono italic">No matches found...</div>
          )}
        </div>
      </div>
    </div>
  );
}


const initialCustomNodes = [];
const initialCustomEdges = [];

function FloatingToolbar() {
  const { 
    undo, redo, history, future, 
    activeTool, setActiveTool, 
    annotationColor, setAnnotationColor,
    addToast
  } = useUIStore();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 12 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    // Default position beside settings icon (Top-Right, Collapsed)
    setPos({ x: window.innerWidth - 140, y: 12 });
  }, []);

  const onStartDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    let hasMoved = false;

    const onMove = (me) => {
      const dist = Math.sqrt(Math.pow(me.clientX - e.clientX, 2) + Math.pow(me.clientY - e.clientY, 2));
      if (dist > 3) hasMoved = true;
      
      setIsDragging(true);
      
      // Approximate dimensions for clamping
      const width = isCollapsed ? 60 : 340;
      const height = isCollapsed ? 60 : 70;
      
      const newX = Math.max(0, Math.min(me.clientX - startX, window.innerWidth - width));
      const newY = Math.max(0, Math.min(me.clientY - startY, window.innerHeight - height));
      
      setPos({ x: newX, y: newY });
    };
    const onUp = () => {
      if (!hasMoved && isCollapsed) {
        setIsCollapsed(false);
      }
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const colors = ['#faebd7', '#34d399', '#60a5fa', '#f87171', '#fbbf24', '#c084fc'];

  if (isCollapsed) {
    return (
      <div
        onMouseDown={onStartDrag}
        style={{ left: pos.x, top: pos.y }}
        className={`fixed z-1100 p-4 bg-background/90 backdrop-blur-2xl border border-foreground/20 rounded-full shadow-2xl transition-all cursor-grab active:cursor-grabbing hover:scale-110 ${isDragging ? 'scale-105 shadow-3xl' : ''} text-foreground/50 hover:text-foreground`}
      >
        <Pencil size={20} />
      </div>
    );
  }

  return (
    <div 
      ref={dragRef}
      className={`fixed z-1100 transition-shadow duration-300 ${isDragging ? 'shadow-2xl scale-[1.02]' : 'shadow-xl'}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex items-center bg-background/90 backdrop-blur-2xl border border-foreground/20 rounded-2xl overflow-hidden p-1 shadow-2xl">
        {/* Drag Handle */}
        <div 
          onMouseDown={onStartDrag}
          className="px-2 py-4 cursor-grab active:cursor-grabbing hover:bg-foreground/5 transition-colors rounded-l-xl"
        >
          <div className="w-1 h-6 flex flex-col gap-1">
            <div className="w-full h-1 bg-foreground/20 rounded-full" />
            <div className="w-full h-1 bg-foreground/20 rounded-full" />
            <div className="w-full h-1 bg-foreground/20 rounded-full" />
          </div>
        </div>

        <div className="flex items-center gap-1 px-1">
          <div className="flex bg-foreground/5 rounded-xl p-1 gap-1">
            <button 
              onClick={() => setActiveTool('select')}
              className={`p-2 rounded-lg transition-all ${activeTool === 'select' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
              title="Select Tool (V)"
            >
              <MousePointer2 size={18} />
            </button>
            <button 
              onClick={() => setActiveTool('draw')}
              className={`p-2 rounded-lg transition-all ${activeTool === 'draw' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
              title="Draw Mode (D)"
            >
              <Pencil size={18} />
            </button>
            <button 
              onClick={() => {
                setActiveTool('text');
                addToast('Click anywhere on canvas to place text', 'info');
              }}
              className={`p-2 rounded-lg transition-all ${activeTool === 'text' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
              title="Text Box (T)"
            >
              <Type size={18} />
            </button>
          </div>

          <div className="h-6 w-px bg-foreground/10 mx-1" />

          <div className="flex gap-1">
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-lg disabled:opacity-20 transition-all font-bold"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button 
              onClick={redo}
              disabled={future.length === 0}
              className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-lg disabled:opacity-20 transition-all font-bold"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={18} />
            </button>
          </div>

          <div className="h-6 w-px bg-foreground/10 mx-1" />

          <div className="flex gap-1 px-1">
            {colors.map(c => (
              <button 
                key={c}
                onClick={() => setAnnotationColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${annotationColor === c ? 'border-foreground' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-2 text-foreground/20 hover:text-foreground transition-colors ml-1"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
}

function DrawingLayer() {
  const { drawings, addDrawing, activeTool, annotationColor, saveToHistory } = useUIStore();
  const transform = useStore(s => s.transform);
  const [tx, ty, zoom] = transform;
  
  const [currentPath, setCurrentPath] = useState(null);
  const svgRef = useRef(null);

  const onMouseDown = (e) => {
    if (activeTool !== 'draw') return;
    
    // Stop event propagation to prevent React Flow from panning
    e.stopPropagation();
    
    saveToHistory();
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - tx) / zoom;
    const y = (e.clientY - rect.top - ty) / zoom;
    setCurrentPath(`M ${x} ${y}`);
  };

  const onMouseMove = (e) => {
    if (!currentPath || activeTool !== 'draw') return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - tx) / zoom;
    const y = (e.clientY - rect.top - ty) / zoom;
    setCurrentPath(prev => `${prev} L ${x} ${y}`);
  };

  const onMouseUp = () => {
    if (!currentPath) return;
    addDrawing({ path: currentPath, color: annotationColor });
    setCurrentPath(null);
  };

  return (
    <svg 
      ref={svgRef}
      className={`absolute inset-0 w-full h-full z-10 ${activeTool === 'draw' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
        {drawings.map((draw, i) => (
          <path 
            key={i} 
            d={draw.path} 
            stroke={draw.color} 
            strokeWidth={2 / zoom} 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        ))}
        {currentPath && (
          <path 
            d={currentPath} 
            stroke={annotationColor} 
            strokeWidth={2 / zoom} 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="opacity-60"
          />
        )}
      </g>
    </svg>
  );
}

function InteractiveCanvas() {
  const { 
    nodes, edges, drawings,  
    setNodes, setEdges, addNode, addEdge, removeNode, addToast, showMinimap,
    activeTool, setActiveTool, undo, redo, saveToHistory
  } = useUIStore();

  const { addExecutionNode, addExecutionEdge, canConnect, removeExecutionNode } = useExecutionStore();
  const { setNodeRef } = useDroppable({ id: 'canvas-droppable' });
  const { project, screenToFlowPosition } = useReactFlow();

  const [selectedNodes, setSelectedNodes] = useState([]);
  const [menu, setMenu] = useState(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const initialized = useRef(false);
  
  useEffect(() => {
    const handleKeys = (e) => {
      // Spotlight
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      } else if (e.key === '/') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsSpotlightOpen(true);
        }
      }
      
      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
        e.preventDefault();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [undo, redo]);

  const onNodesChange = useCallback((changes) => {
    // Save to history when dragging or significant changes happen
    const isDraggableChange = changes.some(c => c.type === 'position' && c.dragging === false);
    if (isDraggableChange) saveToHistory();
    
    useUIStore.getState().onNodesChange(changes);
  }, [saveToHistory]);

  const onEdgesChange = useCallback((changes) => {
    const isRemoval = changes.some(c => c.type === 'remove');
    if (isRemoval) saveToHistory();
    useUIStore.getState().onEdgesChange(changes);
  }, [saveToHistory]);


  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Layout and Init
    const rfNodes = initialCustomNodes.map(n => ({
      id: n.id,
      type: 'custom',
      data: { nodeModel: n },
      position: { x: 0, y: 0 },
    }));

    const rfEdges = initialCustomEdges.map(e => ({
      id: `e-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR' });
    rfNodes.forEach((n) => g.setNode(n.id, { width: 220, height: 100 }));
    rfEdges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    const laidOut = rfNodes.map((n) => {
      const nodeWithPos = g.node(n.id);
      return {
        ...n,
        position: { x: nodeWithPos.x - 110, y: nodeWithPos.y - 50 },
      };
    });

    setNodes(laidOut);
    setEdges(rfEdges);

    initialCustomNodes.forEach(n => {
      useExecutionStore.getState().addExecutionNode(n.id, { type: n.type, inputs: n.inputs, outputs: n.outputs, params: n.params, execution_code: n.execution_code });
    });

  }, [setNodes, setEdges]);

  const onConnect = useCallback((connection) => {
    // 1. Verify in Execution Store
    if (canConnect(connection.source, connection.target, connection.sourceHandle, connection.targetHandle)) {
      // 2. Add to UI
      addEdge(connection);
      // 3. Add to Execution Graph
      addExecutionEdge(connection);
    } else {
      console.warn("Invalid connection discarded.");
      // Could trigger a toast notification here
    }
  }, [addEdge, addExecutionEdge, canConnect]);

  const onNodesDelete = useCallback((deleted) => {
    deleted.forEach(n => {
      removeExecutionNode(n.id);
    });
    addToast(`Removed ${deleted.length} nodes`, 'error');
  }, [removeExecutionNode, addToast]);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      
      const isSelected = selectedNodes.some(n => n.id === node.id);
      
      setMenu({
        id: node.id,
        isGroup: isSelected && selectedNodes.length > 1,
        top: event.clientY,
        left: event.clientX,
      });
    },
    [setMenu, selectedNodes]
  );

  const onPaneClick = useCallback((event) => {
    setMenu(null);
    if (activeTool === 'text') {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newId = `text-${uuidv4().slice(0, 6)}`;
      
      addNode({
        id: newId,
        type: 'annotationNode',
        position,
        data: { label: '', color: useUIStore.getState().annotationColor },
      });
      setActiveTool('select');
      addToast('Annotation placed!', 'success');
    }
  }, [activeTool, screenToFlowPosition, addNode, setActiveTool, addToast]);

  const handleDeleteNode = () => {
    if (menu?.id) {
      if (menu.isGroup) {
        selectedNodes.forEach(n => {
          removeNode(n.id);
          removeExecutionNode(n.id);
        });
        addToast(`Deleted ${selectedNodes.length} nodes`, 'error');
      } else {
        removeNode(menu.id);
        removeExecutionNode(menu.id);
        addToast(`Deleted node`, 'error');
      }
      setMenu(null);
    }
  };

  return (
    <div ref={setNodeRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        panOnScroll={true}
        zoomOnScroll={true}
        panOnDrag={activeTool === 'select'}
        selectionOnDrag={activeTool === 'select'}
        selectionKeyCode="Shift"
        selectionMode="box"
        panOnScrollSpeed={0.5}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        onNodesDelete={onNodesDelete}
        style={{ background: 'transparent' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="#faebd7" opacity={0.1} />
        <ZoomControls />
        <EdgeAwareMiniMap />
        <DrawingLayer />
      </ReactFlow>

      <ToastContainer />
      <Spotlight isOpen={isSpotlightOpen} onClose={() => setIsSpotlightOpen(false)} />
      <FloatingToolbar />

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="max-w-md text-center bg-black/40 backdrop-blur-sm p-6 rounded-3xl border border-foreground/20 shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
            <p className="font-mono text-foreground/70 text-sm leading-relaxed">
              Drag nodes from the left palette to construct your architecture
            </p>
          </div>
        </div>
      )}

      {menu && (
        <div
          style={{ top: menu.top, left: menu.left }}
          className="fixed z-200 bg-background/90 backdrop-blur-2xl border border-foreground/30 rounded-2xl shadow-2xl flex flex-col py-2 w-48 overflow-hidden"
        >
          <div className="px-4 py-1 pb-2 border-b border-foreground/10 mb-1">
            <span className="text-[10px] font-bold font-mono text-foreground/40 uppercase tracking-widest leading-none">
              {menu.isGroup ? `Selection (${selectedNodes.length})` : 'Node Actions'}
            </span>
          </div>
          <button
            onClick={handleDeleteNode}
            className="flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-500/10 text-sm font-mono text-left transition-colors"
          >
            <Trash2 size={16} />
            {menu.isGroup ? `Delete ${selectedNodes.length} items` : 'Delete Node'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function InfiniteCanvas() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <ReactFlowProvider>
        <InteractiveCanvas />
      </ReactFlowProvider>
    </div>
  );
}
