'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  useReactFlow, 
  ReactFlowProvider, 
  Handle, 
  Position, 
  useStore, 
  useOnSelectionChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { View, Minus, Plus, Maximize, Minimize2, Trash2, 
  AlignCenterHorizontal, AlignCenterVertical,
  CheckCircle2, AlertCircle, Info, X, Wand2,
  MousePointer2, Pencil, Eraser, Type, Undo2, Redo2, ChevronLeft, ChevronRight, Lock, Unlock
} from 'lucide-react';
import gsap from 'gsap';
import { useDroppable } from '@dnd-kit/core';

import { useUIStore } from '../store/useUIStore';
import { useExecutionStore } from '../store/useExecutionStore';
import DatasetNode from './nodes/DatasetNode';
import TransformNode from './nodes/TransformNode';
import AnnotationNode from './nodes/AnnotationNode';
import ShapeNode from './nodes/ShapeNode';
import { getPaletteCategories } from './NodePalette';
import { ANNOTATION_SHAPES, RectIcon } from './AnnotationsPanel';
import { v4 as uuidv4 } from 'uuid';
import { generateDatasetPythonCode } from '@/lib/pythonTemplates/datasetNodeTemplate';
import { generateTransformPythonCode } from '@/lib/pythonTemplates/transformNodeTemplate';
import { generateLifecyclePythonCode } from '@/lib/pythonTemplates/lifecycleNodeTemplate';
import { CursorMark } from '@/components/ui/cursor';

function ZoomControls({ readOnly }) {
  const { zoomIn, zoomOut, fitView, getNodes, getEdges } = useReactFlow();
  const setCanvasNodes = useUIStore(s => s.setNodes);
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

    if (nodes.length < 2) {
      addToast('Need at least 2 nodes to tidy layout', 'info');
      return;
    }

    // Keep free-form annotation notes where they are.
    const layoutNodes = nodes.filter((n) => n.type !== 'annotationNode');
    const stickyNodes = nodes.filter((n) => n.type === 'annotationNode');

    if (layoutNodes.length < 2) {
      addToast('No connected graph nodes to tidy', 'info');
      return;
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'LR',
      align: 'UL',
      nodesep: 120,
      ranksep: 220,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    const nodeSize = (node) => {
      const measuredW = node.measured?.width;
      const measuredH = node.measured?.height;
      const fallbackW = node.type === 'datasetNode' ? 320 : 260;
      const fallbackH = node.type === 'datasetNode' ? 260 : 180;
      return {
        width: measuredW || node.width || fallbackW,
        height: measuredH || node.height || fallbackH,
      };
    };

    const layoutNodeIds = new Set(layoutNodes.map((n) => n.id));

    layoutNodes.forEach((n) => {
      const { width, height } = nodeSize(n);
      g.setNode(n.id, { width, height });
    });

    edges.forEach((e) => {
      if (layoutNodeIds.has(e.source) && layoutNodeIds.has(e.target)) {
        g.setEdge(e.source, e.target);
      }
    });

    dagre.layout(g);

    const laidOut = layoutNodes.map((n) => {
      const pos = g.node(n.id);
      const { width, height } = nodeSize(n);
      if (!pos) return n;
      return {
        ...n,
        position: {
          x: pos.x - width / 2,
          y: pos.y - height / 2,
        },
      };
    });

    // Single store update keeps controlled ReactFlow state consistent.
    setCanvasNodes([...laidOut, ...stickyNodes]);

    // Refit viewport after node positions settle.
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 350 }));
    addToast('Layout tidied', 'success');
  };

  return (
    <div style={containerStyle}>
      {!readOnly && (
        <button 
          aria-label="Tidy Layout" 
          title="Tidy Layout" 
          style={{ ...buttonStyle, background: 'var(--color-foreground)', color: 'var(--color-background)' }} 
          onClick={onLayout}
          className="hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(250,235,215,0.3)] border-none"
        >
          <Wand2 size={20} />
        </button>
      )}
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




// Generic CustomNode for non-dataset nodes (Process / Model / Optimize)
function CustomNode({ id, data }) {
  const isLocked = useStore(s => s.nodeInternals.get(id)?.draggable === false);
  const { type, inputs, outputs, params, pythonCode } = data.nodeModel;

  let bgClass = "bg-[#1f1f1f]";
  if (["Resize", "Tokenize"].includes(type)) bgClass = "bg-[#212121]";
  else if (["CNN", "Transformer"].includes(type)) bgClass = "bg-[#282828]";
  else if (["Optimizer", "Accuracy"].includes(type)) bgClass = "bg-[#2f2f2f]";

  return (
    <div className={`p-3 rounded-lg border border-[#faebd7]/30 text-[#faebd7] font-mono shadow-xl ${bgClass}`} style={{ minWidth: 180, position: 'relative' }}>
      {isLocked && (
        <div className="absolute top-2 right-2 z-20 pointer-events-none opacity-60">
          <Lock size={12} color="#faebd7" />
        </div>
      )}
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

const nodeTypes = { 
  custom: CustomNode,  
  datasetNode: DatasetNode,
  transformNode: TransformNode,
  annotationNode: AnnotationNode,
  shapeNode: ShapeNode
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
    getPaletteCategories().forEach((category) => {
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

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(n => {
    const { width: w, height: h } = getNodeSize(n);
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

    // Keep minimap scale stable so a single node does not become oversized.
    const minExtentW = 1200;
    const minExtentH = 800;
    const curW = maxX - minX;
    const curH = maxY - minY;
    if (curW < minExtentW) {
      const d = (minExtentW - curW) / 2;
      minX -= d;
      maxX += d;
    }
    if (curH < minExtentH) {
      const d = (minExtentH - curH) / 2;
      minY -= d;
      maxY += d;
    }
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

    // Convert pixel click to SVG coordinates while accounting for letterboxing.
    const rectAspect = rect.width / rect.height;
    const mapAspect = mapW / mapH;
    let drawX = 0;
    let drawY = 0;
    let drawW = rect.width;
    let drawH = rect.height;

    if (rectAspect > mapAspect) {
      drawW = rect.height * mapAspect;
      drawX = (rect.width - drawW) / 2;
    } else if (rectAspect < mapAspect) {
      drawH = rect.width / mapAspect;
      drawY = (rect.height - drawH) / 2;
    }

    const nx = Math.max(0, Math.min(1, (x - drawX) / drawW));
    const ny = Math.max(0, Math.min(1, (y - drawY) / drawH));
    const clickX = minX + nx * mapW;
    const clickY = minY + ny * mapH;

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

          const { width: sW, height: sH } = getNodeSize(source);
          const { height: tH } = getNodeSize(target);

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
              width={getNodeSize(node).width}
              height={getNodeSize(node).height}
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
    return getPaletteCategories().flatMap(cat => cat.nodes);
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
        zIndex: 100,
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
        zIndex: 100,
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


function LiveCursors({ cursors, viewportTransform }) {
  if (!Array.isArray(cursors) || cursors.length === 0) return null;

  const [tx, ty, zoom] = Array.isArray(viewportTransform) && viewportTransform.length === 3
    ? viewportTransform
    : [0, 0, 1];

  const toScreenPosition = (cursor) => {
    if (cursor?.space === 'flow') {
      return {
        left: (cursor.x * zoom) + tx,
        top: (cursor.y * zoom) + ty,
      };
    }

    return {
      left: cursor.x,
      top: cursor.y,
    };
  };

  return (
    <>
      {cursors.map((cursor) => (
        <CursorMark
          key={cursor.userId}
          x={toScreenPosition(cursor).left}
          y={toScreenPosition(cursor).top}
          color={cursor.color || '#67e8f9'}
          label={cursor.label || 'Collaborator'}
          className="z-120"
        />
      ))}
    </>
  );
}

const initialCustomNodes = [];
const initialCustomEdges = [];

// ── Toolbar Icon Components ────────────────────────────────────────────────
const StrokeWidthIcon = ({ width, active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" className={active ? 'text-foreground' : 'text-foreground/40'}>
    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={width * 1.5} strokeLinecap="round" />
  </svg>
);

const StrokeStyleIcon = ({ style, active }) => {
  const dashArray = style === 'dashed' ? '6 3' : style === 'dotted' ? '1.5 3' : 'none';
  return (
    <svg width="32" height="24" viewBox="0 0 24 24" className={active ? 'text-foreground' : 'text-foreground/40'}>
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2.5" strokeDasharray={dashArray} strokeLinecap="round" />
    </svg>
  );
};

const ArrowStyleIcon = ({ type, active }) => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className={active ? 'text-foreground' : 'text-foreground/40'}>
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {(type === 'end' || type === 'both') && <path d="M 15 7 L 21 12 L 15 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {(type === 'start' || type === 'both') && <path d="M 9 7 L 3 12 L 9 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {type === 'none' && <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      {type === 'none' && <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
};

function FloatingToolbar() {
  const { 
    undo, redo, history, future, 
    activeTool, setActiveTool, 
    activeAnnotationShape, setActiveAnnotationShape,
    annotationColor, setAnnotationColor,
    addToast, setNodes, nodes
  } = useUIStore();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showShapes, setShowShapes] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 12 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  const selectedShapeNode = useMemo(() => nodes.find(n => n.selected && n.type === 'shapeNode'), [nodes]);

  useEffect(() => {
    // Default position below the top-right profile cluster to avoid overlap.
    setPos({ x: window.innerWidth - 140, y: 72 });
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

  const handleShapeClick = (shapeId) => {
    if (activeAnnotationShape === shapeId) {
      setActiveAnnotationShape(null);
    } else {
      setActiveAnnotationShape(shapeId);
      setActiveTool('select'); // Ensure we aren't in draw/erase mode
      addToast(`Selected ${shapeId} - click and drag on canvas`, 'info');
    }
    setShowShapes(false);
  };

  const updateSelectedNode = (patch) => {
    if (!selectedShapeNode) return;
    setNodes(nodes.map(n => n.id === selectedShapeNode.id ? { ...n, data: { ...n.data, ...patch } } : n));
  };

  if (isCollapsed) {
    return (
      <div
        onMouseDown={onStartDrag}
        style={{ left: pos.x, top: pos.y }}
        className={`fixed z-1100 p-4 bg-background/90 backdrop-blur-2xl border border-foreground/20 rounded-full shadow-2xl cursor-grab active:cursor-grabbing ${isDragging ? 'scale-105 shadow-3xl' : 'hover:scale-110 transition-transform duration-150'} text-foreground/50 hover:text-foreground`}
      >
        <Pencil size={20} />
      </div>
    );
  }

  const d = selectedShapeNode?.data || {};
  const strokeColor = d.strokeColor || '#67e8f9';
  const fillColor = d.fillColor ?? 'none';
  const strokeWidth = d.strokeWidth || 2;
  const strokeStyle = d.strokeStyle || 'solid';
  const opacity = d.opacity !== undefined ? d.opacity : 1;
  const arrowheads = d.arrowheads || 'none';
  const shapeType = d.shapeType;

  return (
    <div 
      ref={dragRef}
      className={`fixed z-1100 transition-shadow duration-300 ${isDragging ? 'shadow-2xl scale-[1.02]' : 'shadow-xl'}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex flex-col bg-background/90 backdrop-blur-2xl border border-foreground/20 rounded-2xl p-1 shadow-2xl">
        <div className="flex items-center">
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
              onClick={() => { setActiveTool('select'); setActiveAnnotationShape(null); setShowShapes(false); }}
              className={`p-2 rounded-lg transition-all ${activeTool === 'select' && !activeAnnotationShape ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
              title="Select Tool (V)"
            >
              <MousePointer2 size={18} />
            </button>
            <button 
              onClick={() => { setActiveTool('draw'); setActiveAnnotationShape(null); setShowShapes(false); }}
              className={`p-2 rounded-lg transition-all ${activeTool === 'draw' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
              title="Draw Mode (D)"
            >
              <Pencil size={18} />
            </button>
            <button 
              onClick={() => { setActiveTool('erase'); setActiveAnnotationShape(null); setShowShapes(false); }}
              className={`p-2 rounded-lg transition-all ${activeTool === 'erase' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
              title="Eraser (E)"
            >
              <Eraser size={18} />
            </button>
              
              <div className="relative">
                <button 
                  onClick={() => setShowShapes(!showShapes)}
                  className={`p-2 rounded-lg transition-all ${activeAnnotationShape ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
                  title="Shapes"
                >
                  <RectIcon color={activeAnnotationShape ? '#67e8f9' : 'currentColor'} />
                </button>
                
                {showShapes && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-2xl border border-foreground/20 rounded-xl shadow-2xl p-2 grid grid-cols-4 gap-1 z-1200 min-w-[180px]">
                    {ANNOTATION_SHAPES.map(shape => (
                      <button
                        key={shape.id}
                        onClick={() => handleShapeClick(shape.id)}
                        className={`p-2 rounded-lg transition-all flex flex-col items-center justify-center gap-1 ${activeAnnotationShape === shape.id ? 'bg-foreground/10 border border-foreground/20' : 'hover:bg-foreground/5 border border-transparent'}`}
                        title={shape.label}
                      >
                        <shape.Icon color={activeAnnotationShape === shape.id ? '#67e8f9' : 'currentColor'} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button 
                onClick={() => {
                  setActiveTool('text');
                  setActiveAnnotationShape(null);
                  setShowShapes(false);
                  addToast('Click anywhere on canvas to place sticky note', 'info');
                }}
                className={`p-2 rounded-lg transition-all ${activeTool === 'text' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
                title="Add Sticky Note (T)"
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
                  onClick={() => {
                    setAnnotationColor(c);
                    if (selectedShapeNode) updateSelectedNode({ strokeColor: c });
                  }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${ (selectedShapeNode ? strokeColor === c : annotationColor === c) ? 'border-foreground' : 'border-transparent'}`}
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

        {/* Expanded properties when a shape is selected */}
        {selectedShapeNode && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-foreground/10 mt-1 animate-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <div className="flex bg-foreground/5 rounded-lg p-1 gap-1">
                {[1, 2, 4].map(w => (
                  <button
                    key={w}
                    onClick={() => updateSelectedNode({ strokeWidth: w })}
                    className={`p-1 rounded transition-all ${strokeWidth === w ? 'bg-background shadow-sm' : 'hover:bg-foreground/5'}`}
                    title={w === 1 ? 'Thin' : w === 2 ? 'Mid' : 'Thick'}
                  >
                    <StrokeWidthIcon width={w === 4 ? 3 : w} active={strokeWidth === w} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-foreground/5 rounded-lg p-1 gap-1">
                {['solid', 'dashed', 'dotted'].map(s => (
                  <button
                    key={s}
                    onClick={() => updateSelectedNode({ strokeStyle: s })}
                    className={`p-1 rounded transition-all ${strokeStyle === s ? 'bg-background shadow-sm' : 'hover:bg-foreground/5'}`}
                    title={s.charAt(0).toUpperCase() + s.slice(1)}
                  >
                    <StrokeStyleIcon style={s} active={strokeStyle === s} />
                  </button>
                ))}
              </div>
            </div>

            {['line', 'dotted-line', 'elbow'].includes(shapeType) && (
              <div className="flex items-center gap-2">
                <div className="flex bg-foreground/5 rounded-lg p-1 gap-1">
                  {['none', 'end', 'start', 'both'].map(a => (
                    <button
                      key={a}
                      onClick={() => updateSelectedNode({ arrowheads: a })}
                      className={`p-1 rounded transition-all ${arrowheads === a ? 'bg-background shadow-sm' : 'hover:bg-foreground/5'}`}
                      title={a === 'none' ? 'No Arrows' : a === 'end' ? 'End Arrow' : a === 'start' ? 'Start Arrow' : 'Both Arrows'}
                    >
                      <ArrowStyleIcon type={a} active={arrowheads === a} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 ml-auto min-w-[60px] max-w-[80px]">
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={e => updateSelectedNode({ opacity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-foreground/10 rounded-full appearance-none cursor-pointer accent-foreground"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function parsePathPoints(path = '') {
  const nums = (String(path).match(/-?\d*\.?\d+/g) || []).map(Number);
  const points = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }
  return points;
}

function buildPathFromPoints(points = []) {
  if (!Array.isArray(points) || points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`;
}

function translatePath(path, dx, dy) {
  const points = parsePathPoints(path).map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return buildPathFromPoints(points);
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  const t = abLenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function pointHitsPath(path, x, y, tolerance) {
  const points = parsePathPoints(path);
  if (points.length < 2) return false;
  for (let i = 1; i < points.length; i += 1) {
    const p0 = points[i - 1];
    const p1 = points[i];
    if (distancePointToSegment(x, y, p0.x, p0.y, p1.x, p1.y) <= tolerance) {
      return true;
    }
  }
  return false;
}

function DrawingLayer() {
  const { drawings, addDrawing, setDrawings, activeTool, annotationColor, saveToHistory, setNodes } = useUIStore();
  const transform = useStore(s => s.transform);
  const [tx, ty, zoom] = transform;

  const [currentPath, setCurrentPath] = useState(null);
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(null);
  const [isErasing, setIsErasing] = useState(false);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const toCanvasPoint = useCallback((event) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (event.clientX - rect.left - tx) / zoom,
      y: (event.clientY - rect.top - ty) / zoom,
    };
  }, [tx, ty, zoom]);

  const eraseAtPoint = useCallback((x, y, shouldSaveHistory = false) => {
    const tolerance = 8 / zoom;
    const state = useUIStore.getState();
    const beforeDrawings = state.drawings;
    const beforeNodes = state.nodes;

    // 1. Erase drawings
    const nextDrawings = beforeDrawings.filter((draw) => !pointHitsPath(draw.path, x, y, tolerance));
    
    // 2. Erase shape nodes
    const nextNodes = beforeNodes.filter((node) => {
      if (node.type !== 'shapeNode') return true;
      const { x: nx, y: ny } = node.position;
      const nw = node.width || node.data.width || 180;
      const nh = node.height || node.data.height || 100;
      
      const hit = x >= nx - tolerance && x <= nx + nw + tolerance &&
                  y >= ny - tolerance && y <= ny + nh + tolerance;
      return !hit;
    });

    if (nextDrawings.length !== beforeDrawings.length || nextNodes.length !== beforeNodes.length) {
      if (shouldSaveHistory) saveToHistory();
      if (nextDrawings.length !== beforeDrawings.length) setDrawings(nextDrawings);
      if (nextNodes.length !== beforeNodes.length) setNodes(nextNodes);
      return true;
    }
    return false;
  }, [zoom, saveToHistory, setDrawings, setNodes]);

  const finishDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', finishDrag);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDragMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toCanvasPoint(event);
    if (!point) return;

    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const moved = Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25;
    if (!drag.historySaved && moved) {
      saveToHistory();
      drag.historySaved = true;
    }

    const currentDrawings = useUIStore.getState().drawings;
    if (!currentDrawings[drag.index]) return;
    const next = [...currentDrawings];
    next[drag.index] = {
      ...next[drag.index],
      path: translatePath(drag.originalPath, dx, dy),
    };
    setDrawings(next);
  }, [toCanvasPoint, saveToHistory, setDrawings]);

  useEffect(() => {
    if (activeTool !== 'select') {
      setSelectedDrawingIndex(null);
      finishDrag();
    }
    if (activeTool !== 'erase') {
      setIsErasing(false);
    }
  }, [activeTool, finishDrag]);

  const onDrawDown = (event) => {
    if (activeTool !== 'draw') return;
    event.stopPropagation();
    const point = toCanvasPoint(event);
    if (!point) return;
    saveToHistory();
    setCurrentPath(`M ${point.x} ${point.y}`);
  };

  const onDrawMove = (event) => {
    if (!currentPath || activeTool !== 'draw') return;
    const point = toCanvasPoint(event);
    if (!point) return;
    setCurrentPath((prev) => `${prev} L ${point.x} ${point.y}`);
  };

  const onDrawUp = () => {
    if (!currentPath) return;
    addDrawing({ path: currentPath, color: annotationColor });
    setCurrentPath(null);
  };

  const onEraseDown = (event) => {
    if (activeTool !== 'erase') return;
    event.stopPropagation();
    const point = toCanvasPoint(event);
    if (!point) return;
    setIsErasing(true);
    eraseAtPoint(point.x, point.y, true);
  };

  const onEraseMove = (event) => {
    if (!isErasing || activeTool !== 'erase') return;
    const point = toCanvasPoint(event);
    if (!point) return;
    eraseAtPoint(point.x, point.y, false);
  };

  const onEraseUp = () => {
    if (!isErasing) return;
    setIsErasing(false);
  };

  const onDrawingPointerDown = (index, event) => {
    if (activeTool !== 'select') return;
    event.stopPropagation();
    const point = toCanvasPoint(event);
    if (!point || !drawings[index]) return;
    setSelectedDrawingIndex(index);
    dragRef.current = {
      index,
      startX: point.x,
      startY: point.y,
      originalPath: drawings[index].path,
      historySaved: false,
    };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', finishDrag);
  };

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      onMouseMove={activeTool === 'draw' ? onDrawMove : undefined}
      onMouseUp={activeTool === 'draw' ? onDrawUp : undefined}
      onMouseLeave={activeTool === 'draw' ? onDrawUp : undefined}
    >
      {(activeTool === 'draw' || activeTool === 'erase') && (
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          className={`pointer-events-auto ${activeTool === 'erase' ? 'cursor-cell' : 'cursor-crosshair'}`}
          fill="transparent"
          onMouseDown={activeTool === 'draw' ? onDrawDown : onEraseDown}
          onMouseMove={activeTool === 'draw' ? onDrawMove : onEraseMove}
          onMouseUp={activeTool === 'draw' ? onDrawUp : onEraseUp}
          onMouseLeave={activeTool === 'draw' ? onDrawUp : onEraseUp}
        />
      )}

      <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
        {drawings.map((draw, i) => {
          const isSelected = i === selectedDrawingIndex;
          return (
            <path
              key={`${i}-${draw.path.length}`}
              d={draw.path}
              stroke={draw.color}
              strokeWidth={(isSelected ? 3 : 2) / zoom}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={activeTool === 'select' ? 'pointer-events-auto cursor-move' : 'pointer-events-none'}
              style={{ filter: isSelected ? 'drop-shadow(0 0 4px rgba(250,235,215,0.6))' : undefined }}
              onMouseDown={(e) => onDrawingPointerDown(i, e)}
            />
          );
        })}
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

function InteractiveCanvas({ onCanvasChange, onPointerMove, onEditingNodeChange, remoteCursors = [], remoteNodeEditors = [], readOnly = false }) {
  const { 
    nodes, edges, drawings,  
    setNodes, setEdges, addNode, addEdge, removeNode, addToast, showMinimap,
    activeTool, setActiveTool, undo, redo, saveToHistory, setCanvasViewport
  } = useUIStore();

  const wasDraggingRef = useRef(false);

  // Sync changes to remote peers
  useEffect(() => {
    if (!onCanvasChange) return;

    const hasDraggingNode = Array.isArray(nodes) && nodes.some((node) => node?.dragging);
    if (hasDraggingNode) {
      wasDraggingRef.current = true;
      return;
    }

    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      onCanvasChange(nodes, edges, drawings, { reason: 'drag-end' });
      return;
    }

    onCanvasChange(nodes, edges, drawings, { reason: 'graph-change' });
  }, [nodes, edges, drawings, onCanvasChange]);

  const { addExecutionNode, addExecutionEdge, validateConnection, removeExecutionNode } = useExecutionStore();
  const { setNodeRef } = useDroppable({ id: 'canvas-droppable' });
  const { project, screenToFlowPosition } = useReactFlow();
  const transform = useStore((s) => s.transform);
  const rfWidth = useStore((s) => s.width);
  const rfHeight = useStore((s) => s.height);

  const [selectedNodes, setSelectedNodes] = useState([]);
  const [menu, setMenu] = useState(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [droppingOver, setDroppingOver] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const [x, y, zoom] = transform || [0, 0, 1];
    setCanvasViewport({ x, y, zoom, width: rfWidth, height: rfHeight });
  }, [transform, rfWidth, rfHeight, setCanvasViewport]);
  
  useEffect(() => {
    const handleKeys = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

      // Spotlight
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      } else if (e.key === '/') {
        if (!isTyping) {
          e.preventDefault();
          setIsSpotlightOpen(true);
        }
      }

      if (!readOnly && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') setActiveTool('select');
        if (key === 'd') setActiveTool('draw');
        if (key === 'e') setActiveTool('erase');
        if (key === 't') setActiveTool('text');
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
  }, [readOnly, undo, redo, setActiveTool]);

  const onNodesChange = useCallback((changes) => {
    if (readOnly) return;

    // Save to history when dragging or significant changes happen
    const isDraggableChange = changes.some(c => c.type === 'position' && c.dragging === false);
    if (isDraggableChange) saveToHistory();
    
    useUIStore.getState().onNodesChange(changes);
  }, [readOnly, saveToHistory]);

  const onEdgesChange = useCallback((changes) => {
    if (readOnly) return;

    const isRemoval = changes.some(c => c.type === 'remove');
    if (isRemoval) saveToHistory();
    useUIStore.getState().onEdgesChange(changes);
  }, [readOnly, saveToHistory]);


  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Skip demo initialization when no starter graph is defined.
    // This prevents wiping server-fetched nodes/edges on first mount.
    if (initialCustomNodes.length === 0 && initialCustomEdges.length === 0) {
      return;
    }

    // Layout and Init
    const rfNodes = initialCustomNodes.map(n => ({
      id: n.id,
      type: 'custom',
      data: { nodeModel: n },
      position: { x: 0, y: 0 },
      zIndex: 100,
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

  const [isConnecting, setIsConnecting] = useState(false);

  const onConnect = useCallback((connection) => {
    if (readOnly) return;

    const diagnostic = validateConnection(
      connection.source,
      connection.target,
      connection.sourceHandle,
      connection.targetHandle,
    );

    // 1. Verify in Execution Store
    if (diagnostic.ok) {
      // 2. Add to UI
      addEdge(connection);
      // 3. Add to Execution Graph
      addExecutionEdge(connection);
      
      // Haptic-like feedback
      const targetEl = document.querySelector(`[data-id="${connection.target}"]`);
      if (targetEl) {
        gsap.fromTo(targetEl, 
          { scale: 1 }, 
          { scale: 1.05, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }
        );
      }
    } else {
      const fixHint = diagnostic?.details?.suggestedFix ? ` ${diagnostic.details.suggestedFix}` : '';
      addToast(`Incompatible connection: ${diagnostic?.message || 'validation failed.'}${fixHint}`, 'error');
    }
  }, [readOnly, addEdge, addExecutionEdge, validateConnection, addToast]);

  const onConnectStart = useCallback(() => setIsConnecting(true), []);
  const onConnectEnd = useCallback(() => setIsConnecting(false), []);

  const onNodesDelete = useCallback((deleted) => {
    deleted.forEach(n => {
      removeExecutionNode(n.id);
    });
  }, [removeExecutionNode]);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      setMenu({
        type: 'node',
        id: node.id,
        top: event.clientY,
        left: event.clientX,
        data: node
      });
    },
    [setMenu]
  );

  const onEdgeContextMenu = useCallback(
    (event, edge) => {
      event.preventDefault();
      setMenu({
        type: 'edge',
        id: edge.id,
        top: event.clientY,
        left: event.clientX,
        data: edge
      });
    },
    [setMenu]
  );

  const onPaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      setMenu({
        type: 'canvas',
        top: event.clientY,
        left: event.clientX
      });
    },
    [setMenu]
  );

  const onPaneClick = useCallback((event) => {
    if (readOnly) return;

    setMenu(null);
    if (activeTool === 'text') {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newId = `note-${uuidv4().slice(0, 6)}`;
      
      addNode({
        id: newId,
        type: 'annotationNode',
        position,
        zIndex: 50,
        data: { label: '', color: useUIStore.getState().annotationColor },
      });
      setActiveTool('select');
      addToast('Sticky note placed!', 'success');
    }
  }, [readOnly, activeTool, screenToFlowPosition, addNode, setActiveTool, addToast]);

  // ── Drag-to-canvas handlers ────────────────────────────────────────────────
  const onCanvasDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes('application/proto-ml-node')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDroppingOver(true);
    }
  }, []);

  const onCanvasDragLeave = useCallback((e) => {
    // Only set false if we actually left the container (not a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDroppingOver(false);
    }
  }, []);

  const onCanvasDrop = useCallback((e) => {
    if (readOnly) return;

    e.preventDefault();
    setDroppingOver(false);

    const raw = e.dataTransfer.getData('application/proto-ml-node');
    if (!raw) return;

    let node;
    try { node = JSON.parse(raw); } catch { return; }

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newId = `${node.id}-${uuidv4().slice(0, 6)}`;

    const isDataset = node.id.startsWith('dataset.');
    const isTransform = node.id.startsWith('transform.');
    const isLifecycle = node.id.startsWith('lifecycle.');

    if (isDataset && node.def) {
      const def = node.def;
      const initialConfig = { ...def.defaultConfig };
      const pythonCode = generateDatasetPythonCode(def.type, initialConfig);

      addNode({
        id: newId,
        type: 'datasetNode',
        position,
        zIndex: 100,
        data: {
          nodeModel: {
            type: def.type, label: def.label, inputs: def.inputs, outputs: def.outputs,
            config: initialConfig, schema: { ...def.schema }, metadata: { ...def.metadata }, pythonCode,
          },
        },
      });
      addExecutionNode(newId, {
        type: def.type, label: def.label, inputs: def.inputs.map(p => p.name),
        outputs: def.outputs.map(p => p.name),
        portMap: {
          inputs: Object.fromEntries(def.inputs.map(p => [p.name, p])),
          outputs: Object.fromEntries(def.outputs.map(p => [p.name, p])),
        },
        config: initialConfig, schema: { ...def.schema }, metadata: { ...def.metadata }, pythonCode,
      });
    } else if ((isTransform || isLifecycle) && node.def) {
      const def = node.def;
      const initialConfig = { ...(def.defaultConfig || {}) };
      const pythonCode = isLifecycle
        ? generateLifecyclePythonCode(def.type, initialConfig)
        : generateTransformPythonCode(def.type, initialConfig);
      const inputs = (def.inputs || []).map(p => p.name);
      const outputs = (def.outputs || []).map(p => p.name);

      addNode({
        id: newId,
        type: 'transformNode',
        position,
        zIndex: 100,
        data: {
          nodeModel: {
            type: def.type, label: def.label, inputs, outputs,
            params: initialConfig, config: initialConfig,
            uiSchema: { ...(def.uiSchema || {}) }, accepts: def.accepts || [],
            produces: def.produces || [], kind: isLifecycle ? 'lifecycle' : 'transform',
            category: def.category, pythonCode,
          },
        },
      });
      addExecutionNode(newId, {
        type: def.type, label: def.label, inputs, outputs,
        config: initialConfig, uiSchema: { ...(def.uiSchema || {}) },
        accepts: def.accepts || [], produces: def.produces || [],
        kind: isLifecycle ? 'lifecycle' : 'transform', category: def.category, pythonCode,
      });
    } else {
      let inputs = [], outputs = [];
      if (['cnn', 'transformer', 'optimizer'].includes(node.id)) {
        inputs = ['data']; outputs = ['data_out'];
      }
      if (node.id === 'accuracy') { inputs = ['data']; outputs = ['score']; }

      addNode({
        id: newId,
        type: 'custom',
        position,
        zIndex: 100,
        data: { nodeModel: { type: node.type, label: node.label, inputs, outputs, params: {}, execution_code: 'function() { return {} }' } },
      });
      addExecutionNode(newId, { type: node.type, inputs, outputs, config: {} });
    }

    addToast(`Added ${node.label} to canvas`, 'success');
  }, [readOnly, screenToFlowPosition, addNode, addExecutionNode, addToast]);

  const handleDeleteNode = () => {
    if (menu?.id) {
      if (menu.isGroup) {
        selectedNodes.forEach(n => {
          removeNode(n.id);
          removeExecutionNode(n.id);
        });
      } else {
        removeNode(menu.id);
        removeExecutionNode(menu.id);
      }
      setMenu(null);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onDragOver={onCanvasDragOver}
      onDragLeave={onCanvasDragLeave}
      onDrop={onCanvasDrop}
      onFocusCapture={(event) => {
        if (!onEditingNodeChange) return;
        const nodeEl = event.target?.closest?.('.react-flow__node');
        const focusedNodeId = nodeEl?.getAttribute?.('data-id') || null;
        onEditingNodeChange(focusedNodeId);
      }}
      onBlurCapture={() => {
        if (!onEditingNodeChange) return;
        requestAnimationFrame(() => {
          const activeNodeEl = document.activeElement?.closest?.('.react-flow__node');
          const focusedNodeId = activeNodeEl?.getAttribute?.('data-id') || null;
          onEditingNodeChange(focusedNodeId);
        });
      }}
      onMouseMove={(event) => {
        if (onPointerMove) {
          const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          onPointerMove(flowPos.x, flowPos.y);
        }
      }}
    >
      {/* Drop zone highlight overlay */}
      {droppingOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            pointerEvents: 'none',
            border: '2px solid #67e8f966',
            borderRadius: 12,
            boxShadow: 'inset 0 0 60px #67e8f912, 0 0 30px #67e8f910',
            background: 'radial-gradient(ellipse at center, #67e8f908 0%, transparent 70%)',
            transition: 'opacity 0.2s',
          }}
        />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onConnectStart={readOnly ? undefined : onConnectStart}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
        onEdgeContextMenu={readOnly ? undefined : onEdgeContextMenu}
        onPaneContextMenu={readOnly ? undefined : onPaneContextMenu}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        panOnScroll={true}
        zoomOnScroll={true}
        panOnDrag={readOnly ? true : activeTool === 'select'}
        selectionOnDrag={activeTool === 'select'}
        selectionKeyCode="Shift"
        selectionMode="box"
        panOnScrollSpeed={0.5}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        onNodesDelete={onNodesDelete}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        style={{ background: 'transparent' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="#faebd7" opacity={0.1} />
        <ZoomControls readOnly={readOnly} />
        <EdgeAwareMiniMap />
        <DrawingLayer />
      </ReactFlow>


      <Spotlight isOpen={isSpotlightOpen} onClose={() => setIsSpotlightOpen(false)} />
      {!readOnly && <FloatingToolbar />}
      <ShapeLayerComponents />
      <LiveCursors cursors={remoteCursors} viewportTransform={transform} />
      <LiveNodeEditors editors={remoteNodeEditors} nodes={nodes} viewportTransform={transform} />

      {!readOnly && nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="max-w-md text-center bg-black/40 backdrop-blur-sm p-6 rounded-3xl border border-foreground/20 shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
            <p className="font-mono text-foreground/70 text-sm leading-relaxed">
              Drag nodes from the left palette to construct your architecture
            </p>
          </div>
        </div>
      )}

      {menu && (
        <ContextMenu 
          menu={menu} 
          onClose={() => setMenu(null)} 
          screenToFlowPosition={screenToFlowPosition}
        />
      )}
    </div>
  );
}

function LiveNodeEditors({ editors, nodes, viewportTransform }) {
  if (!Array.isArray(editors) || editors.length === 0) return null;

  const [tx, ty, zoom] = Array.isArray(viewportTransform) && viewportTransform.length === 3
    ? viewportTransform
    : [0, 0, 1];

  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));

  return (
    <>
      {editors.map((editor) => {
        const node = nodeById.get(editor.nodeId);
        if (!node) return null;

        const left = (node.position.x * zoom) + tx;
        const top = (node.position.y * zoom) + ty;

        return (
          <div
            key={`${editor.userId}-${editor.nodeId}`}
            className="pointer-events-none absolute z-[121]"
            style={{ left, top, transform: 'translate(8px, -20px)' }}
          >
            <div
              className="rounded-full border border-foreground/20 bg-background/92 px-2 py-1 text-[10px] font-mono text-foreground/80 backdrop-blur"
              style={{ boxShadow: `0 0 0 1px ${editor.color || '#67e8f9'}33` }}
            >
              {editor.label || 'Collaborator'} editing
            </div>
          </div>
        );
      })}
    </>
  );
}

function ContextMenu({ menu, onClose, screenToFlowPosition }) {
  const { 
    nodes, edges, removeNode, addNode, addToast, 
    duplicateNode, clearCanvas, updateEdgeStyle, toggleNodeCollapse, toggleNodeLock
  } = useUIStore();
  const { removeExecutionNode } = useExecutionStore();
  
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAction = (action) => {
    switch (action) {
      case 'delete-node':
        removeNode(menu.id);
        removeExecutionNode(menu.id);
        break;
      case 'duplicate-node':
        duplicateNode(menu.id);
        break;
      case 'copy-id':
        navigator.clipboard.writeText(menu.id);
        addToast('ID copied to clipboard', 'success');
        break;
      case 'collapse-node':
        toggleNodeCollapse(menu.id);
        break;
      case 'lock-node':
        toggleNodeLock(menu.id);
        addToast(menu.data?.draggable === false ? 'Node unlocked' : 'Node locked', 'info');
        break;
      case 'delete-edge':
        useUIStore.getState().setEdges(edges.filter(e => e.id !== menu.id));
        addToast('Edge removed', 'error');
        break;
      case 'edge-style-straight':
        updateEdgeStyle(menu.id, 'straight');
        break;
      case 'edge-style-curved':
        updateEdgeStyle(menu.id, 'default');
        break;
      case 'add-note':
        const pos = screenToFlowPosition({ x: menu.left, y: menu.top });
        addNode({
          id: `note-${uuidv4().slice(0, 6)}`,
          type: 'annotationNode',
          position: pos,
          zIndex: 50,
          data: { label: 'New sticky note', color: '#faebd7' }
        });
        break;
      case 'clear-canvas':
        if (confirm('Are you sure you want to clear the entire canvas?')) {
          clearCanvas();
        }
        break;
    }
    onClose();
  };

  const renderContent = () => {
    if (menu.type === 'node') {
      const isShape = menu.data?.type === 'shapeNode';
      const isText = isShape && menu.data?.data?.shapeType === 'text';
      const isLocked = menu.data?.draggable === false;
      const typeLabel = isText ? 'Text' : isShape ? 'Shape' : 'Node';

      return (
        <>
          <MenuHeader label={`${typeLabel} Actions`} />
          <MenuButton icon={Maximize} label="Duplicate" onClick={() => handleAction('duplicate-node')} />
          {!isShape && <MenuButton icon={Minimize2} label="Collapse/Expand" onClick={() => handleAction('collapse-node')} />}
          <MenuButton icon={isLocked ? Unlock : Lock} label={isLocked ? 'Unlock' : 'Lock'} onClick={() => handleAction('lock-node')} />
          <MenuButton icon={Wand2} label="Copy ID" onClick={() => handleAction('copy-id')} />
          <div className="h-px bg-foreground/10 my-1" />
          <MenuButton icon={Trash2} label={`Delete ${typeLabel}`} color="text-red-500" onClick={() => handleAction('delete-node')} />
        </>
      );
    }
    if (menu.type === 'edge') {
      return (
        <>
          <MenuHeader label="Edge Actions" />
          <MenuButton icon={AlignCenterHorizontal} label="Straighten" onClick={() => handleAction('edge-style-straight')} />
          <MenuButton icon={AlignCenterVertical} label="Curved" onClick={() => handleAction('edge-style-curved')} />
          <div className="h-px bg-foreground/10 my-1" />
          <MenuButton icon={Trash2} label="Disconnect" color="text-red-500" onClick={() => handleAction('delete-edge')} />
        </>
      );
    }
    return (
      <>
        <MenuHeader label="Canvas Actions" />
        <MenuButton icon={Pencil} label="Add Note" onClick={() => handleAction('add-note')} />
        <MenuButton icon={Wand2} label="Tidy Layout" onClick={() => { useUIStore.getState().onLayout?.(); onClose(); }} disabled />
        <div className="h-px bg-foreground/10 my-1" />
        <MenuButton icon={Trash2} label="Clear Canvas" color="text-red-500" onClick={() => handleAction('clear-canvas')} />
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{ top: menu.top, left: menu.left }}
      className="fixed z-5000 bg-background/90 backdrop-blur-3xl border border-foreground/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col py-2 w-56 overflow-hidden animate-in fade-in zoom-in duration-200"
    >
      {renderContent()}
    </div>
  );
}

function ShapeLayerComponents() {
  const { activeAnnotationShape, setActiveAnnotationShape, addNode, addToast, nodes } = useUIStore();
  const { screenToFlowPosition } = useReactFlow();
  const [startPt, setStartPt] = useState(null);
  const [currPt, setCurrPt] = useState(null);

  const selectedShapeNodes = nodes.filter(n => n.selected && n.type === 'shapeNode');
  const selectedShapeNode = selectedShapeNodes.length === 1 ? selectedShapeNodes[0] : null;

  const isText = activeAnnotationShape === 'text';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeAnnotationShape) {
        setActiveAnnotationShape(null);
        setStartPt(null);
        setCurrPt(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAnnotationShape, setActiveAnnotationShape]);

  const onPointerDown = (e) => {
    if (!activeAnnotationShape) return;
    
    e.preventDefault();
    e.stopPropagation();

    const pos = { x: e.clientX, y: e.clientY };
    if (isText) {
      const flowPos = screenToFlowPosition(pos);
      addNode({
        id: `shape-${uuidv4().slice(0, 6)}`,
        type: 'shapeNode',
        position: flowPos,
        width: 160,
        height: 40,
        zIndex: 10,
        data: { shapeType: 'text', label: '', strokeColor: '#67e8f9', width: 160, height: 40 },
      });
      setActiveAnnotationShape(null);
      addToast('Text added', 'success');
      return;
    }
    setStartPt(pos);
    setCurrPt(pos);
  };

  const onPointerMove = (e) => {
    if (!startPt) return;
    setCurrPt({ x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e) => {
    if (!startPt) return;
    const endPt = { x: e.clientX, y: e.clientY };
    
    const dragDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    if (dragDist < 5) {
      const flowPos = screenToFlowPosition(endPt);
      addNode({
        id: `shape-${uuidv4().slice(0, 6)}`,
        type: 'shapeNode',
        position: flowPos,
        width: 200,
        height: 120,
        zIndex: 10,
        data: { 
          shapeType: activeAnnotationShape, 
          strokeColor: '#67e8f9', 
          fillColor: 'none',
          strokeWidth: 2,
          strokeStyle: activeAnnotationShape.startsWith('dotted') ? 'dotted' : 'solid',
          width: 200, height: 120 
        },
      });
      setStartPt(null); setCurrPt(null); setActiveAnnotationShape(null);
      return;
    }

    const flowStart = screenToFlowPosition(startPt);
    const flowEnd = screenToFlowPosition(endPt);

    const w = Math.max(Math.abs(flowEnd.x - flowStart.x), 40);
    const h = Math.max(Math.abs(flowEnd.y - flowStart.y), 30);
    const px = Math.min(flowStart.x, flowEnd.x);
    const py = Math.min(flowStart.y, flowEnd.y);

    addNode({
      id: `shape-${uuidv4().slice(0, 6)}`,
      type: 'shapeNode',
      position: { x: px, y: py },
      width: w,
      height: h,
      zIndex: 10,
      data: {
        shapeType: activeAnnotationShape,
        width: w, height: h,
        strokeColor: '#67e8f9',
        fillColor: 'none',
        strokeWidth: 2,
        strokeStyle: activeAnnotationShape.startsWith('dotted') ? 'dotted' : 'solid',
      },
    });

    setStartPt(null);
    setCurrPt(null);
    setActiveAnnotationShape(null);
  };

  return (
    <>
      {activeAnnotationShape && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1000,
            cursor: 'crosshair', pointerEvents: 'auto'
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onContextMenu={e => { e.preventDefault(); setActiveAnnotationShape(null); }}
        >
          {startPt && currPt && !isText && (
            <div style={{
              position: 'absolute',
              left: Math.min(startPt.x, currPt.x),
              top: Math.min(startPt.y, currPt.y),
              width: Math.abs(currPt.x - startPt.x),
              height: Math.abs(currPt.y - startPt.y),
              border: '1px dashed #67e8f9',
              backgroundColor: 'rgba(103,232,249,0.05)',
              pointerEvents: 'none'
            }} />
          )}
        </div>
      )}
    </>
  );
}

function MenuHeader({ label }) {
  return (
    <div className="px-4 py-1 pb-2 border-b border-foreground/10 mb-1">
      <span className="text-[10px] font-bold font-mono text-foreground/40 uppercase tracking-widest leading-none">
        {label}
      </span>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, color = "text-foreground/80", disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/5 text-sm font-mono text-left transition-colors ${color} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

export default function InfiniteCanvas({ onCanvasChange, onPointerMove, onEditingNodeChange, remoteCursors = [], remoteNodeEditors = [], readOnly = false }) {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <ReactFlowProvider>
        <InteractiveCanvas
          onCanvasChange={onCanvasChange}
          onPointerMove={onPointerMove}
          onEditingNodeChange={onEditingNodeChange}
          remoteCursors={remoteCursors}
          remoteNodeEditors={remoteNodeEditors}
          readOnly={readOnly}
        />
      </ReactFlowProvider>
    </div>
  );
}
