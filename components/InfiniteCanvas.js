'use client'

import React, { useCallback, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow'
import dagre from 'dagre'
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
  // Node visual size used for layout calculations
  const NODE_WIDTH = 200
  const NODE_HEIGHT = 80

  // --- Custom node model (user-specified schema) ---
  const customNodes = useRef([
    // Data nodes
    {
      id: 'dataset',
      type: 'Dataset',
      inputs: [],
      outputs: ['images', 'labels'],
      params: { path: '/data/images' },
      execution_code: "function(){ return {images: [], labels: []} }",
    },
    {
      id: 'csv',
      type: 'CSV',
      inputs: [],
      outputs: ['rows'],
      params: { path: '/data/table.csv' },
      execution_code: "function(){ return {rows: []} }",
    },

    // Processing nodes
    {
      id: 'resize',
      type: 'Resize',
      inputs: ['images'],
      outputs: ['images_resized'],
      params: { width: 224, height: 224 },
      execution_code: "function(images){ return images.map(...) }",
    },
    {
      id: 'tokenize',
      type: 'Tokenize',
      inputs: ['text'],
      outputs: ['tokens'],
      params: { vocab: 'default' },
      execution_code: "function(text){ return text.split(' ') }",
    },

    // Model nodes
    {
      id: 'cnn',
      type: 'CNN',
      inputs: ['images'],
      outputs: ['model'],
      params: { layers: [32,64,128] },
      execution_code: "function(images){ return {model: {}} }",
    },
    {
      id: 'transformer',
      type: 'Transformer',
      inputs: ['tokens'],
      outputs: ['model'],
      params: { heads: 8 },
      execution_code: "function(tokens){ return {model: {}} }",
    },

    // Training nodes
    {
      id: 'optimizer',
      type: 'Optimizer',
      inputs: ['model'],
      outputs: ['trained_model'],
      params: { type: 'adam', lr: 0.001 },
      execution_code: "function(model,data){ return {trained_model: model} }",
    },

    // Evaluation nodes
    {
      id: 'accuracy',
      type: 'Accuracy',
      inputs: ['trained_model', 'labels'],
      outputs: ['accuracy_score'],
      params: {},
      execution_code: "function(model,labels){ return {accuracy: 0} }",
    },
  ])

  // custom edges linking nodes by id (simple directional graph)
  const customEdges = useRef([
    { source: 'dataset', target: 'resize' },
    { source: 'resize', target: 'cnn' },
    { source: 'cnn', target: 'optimizer' },
    { source: 'optimizer', target: 'accuracy' },
    { source: 'csv', target: 'tokenize' },
    { source: 'tokenize', target: 'transformer' },
  ])

  // Convert custom node schema to React Flow nodes
  const convertToReactFlow = (cNodes) =>
    cNodes.map((n) => ({
      id: n.id,
      type: 'default',
      data: {
        label: (
          <div style={{ padding: 8 }}>
            <strong>{n.type}</strong>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <div>in: {n.inputs.join(', ') || '—'}</div>
              <div>out: {n.outputs.join(', ') || '—'}</div>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>{n.params && Object.keys(n.params).length ? JSON.stringify(n.params) : ''}</div>
          </div>
        ),
        // keep full node data so UI or execution engine can read the fields
        nodeModel: n,
      },
      position: { x: 0, y: 0 },
      style: { width: NODE_WIDTH, padding: 10 },
    }))

  const convertEdgesToRF = (cEdges) =>
    cEdges.map((e) => ({ id: `e-${e.source}-${e.target}`, source: e.source, target: e.target }))

  // layout using dagre
  const dagreLayout = (rfNodes, rfEdges) => {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR' })

    rfNodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
    rfEdges.forEach((e) => g.setEdge(e.source, e.target))

    dagre.layout(g)

    return rfNodes.map((n) => {
      const nodeWithPos = g.node(n.id)
      return {
        ...n,
        position: { x: nodeWithPos.x - NODE_WIDTH / 2, y: nodeWithPos.y - NODE_HEIGHT / 2 },
      }
    })
  }

  const rfInitial = useMemo(() => {
    const rfNodes = convertToReactFlow(customNodes.current)
    const rfEdges = convertEdgesToRF(customEdges.current)
    const laidOut = dagreLayout(rfNodes, rfEdges)
    return { nodes: laidOut, edges: rfEdges }
  }, [])

  const initialNodes = useRef(rfInitial.nodes)
  const initialEdges = useRef(rfInitial.edges)

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes.current)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges.current)


  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges])

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
