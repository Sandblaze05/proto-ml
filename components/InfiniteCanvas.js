'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, useReactFlow, ReactFlowProvider, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { View, Minus, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

import { useUIStore } from '../store/useUIStore';
import { useExecutionStore } from '../store/useExecutionStore';
import DatasetNode from './nodes/DatasetNode';

function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const containerStyle = {
    position: 'absolute',
    right: 16,
    bottom: 16,
    display: 'flex',
    flexDirection: 'column',
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
  };

  return (
    <div style={containerStyle}>
      <button aria-label="Zoom in" title="Zoom in" style={buttonStyle} onClick={() => zoomIn()}>
        <Plus size={20} />
      </button>
      <button aria-label="Zoom out" title="Zoom out" style={buttonStyle} onClick={() => zoomOut()}>
        <Minus size={20} />
      </button>
      <button aria-label="Fit view" title="Fit view" style={buttonStyle} onClick={() => fitView()}>
        <View size={20} />
      </button>
    </div>
  );
}

// Generic CustomNode for non-dataset nodes (Process / Model / Optimize)
function CustomNode({ data, id }) {
  const { type, inputs, outputs, params } = data.nodeModel;

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

const nodeTypes = { custom: CustomNode, datasetNode: DatasetNode };
const edgeTypes = {};

// Hardcoded initial data from previous setup
const initialCustomNodes = [
];

const initialCustomEdges = [

];

function InteractiveCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges, addNode, addEdge, removeNode } = useUIStore();
  const { addExecutionNode, addExecutionEdge, canConnect, removeExecutionNode } = useExecutionStore();
  const { setNodeRef } = useDroppable({ id: 'canvas-droppable' });
  const { project } = useReactFlow();

  const initialized = useRef(false);
  const [menu, setMenu] = useState(null);

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
    if (canConnect(connection.source, connection.target)) {
      // 2. Add to UI
      addEdge(connection);
      // 3. Add to Execution Graph
      addExecutionEdge(connection);
    } else {
      console.warn("Invalid connection discarded.");
      // Could trigger a toast notification here
    }
  }, [addEdge, addExecutionEdge, canConnect]);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      setMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
      });
    },
    [setMenu]
  );

  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

  const handleDeleteNode = () => {
    if (menu?.id) {
      removeNode(menu.id);
      removeExecutionNode(menu.id);
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
        panOnDrag={true}
        panOnScrollSpeed={0.5}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.1}
        maxZoom={2}
        style={{ background: 'transparent' }}
      >
        <Background gap={16} size={1} color="#faebd7" opacity={0.1} />
        <ZoomControls />
      </ReactFlow>

      {menu && (
        <div
          style={{ top: menu.top, left: menu.left }}
          className="fixed z-[100] bg-[#1a1a1a] border border-[#faebd7]/30 rounded-lg shadow-2xl flex flex-col py-2 w-36"
        >
          <button
            onClick={handleDeleteNode}
            className="px-4 py-2 text-red-400 hover:bg-[#faebd7]/10 text-sm font-mono text-left transition-colors"
          >
            Delete Node
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
