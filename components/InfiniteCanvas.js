'use client'

import React, { useCallback, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow'
import { View, Minus, Plus } from 'lucide-react'


function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const containerStyle = {
    position: 'absolute',
    right: 16,
    bottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 10,
  }

  const buttonStyle = {
    width: 44,
    height: 44,
    borderRadius: 8,
    border: 'none',
    background: 'var(--color-foreground)',
    color: 'var(--color-background)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

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
  )
}

const edgeTypes = {};
const nodeTypes = {};

export default function InfiniteCanvas() {
  const initialNodes = useRef([
    {
      id: '1',
      position: { x: 0, y: 0 },
      data: { label: 'Start Node' },
      style: { padding: 10 },
    },
  ]);

  const initialEdges = useRef([])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes.current)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges.current)


  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges])

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
        <Background gap={16} size={1} />
        <ZoomControls />
      </ReactFlow>
    </div>
  )
}
