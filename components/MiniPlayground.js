'use client'

import React, { useState, useEffect } from 'react'
import { motion, useMotionValue } from 'motion/react'
import { Database, Zap, FileCode } from 'lucide-react'

const INPUT_DATASET_LINES = [
  '1. Aster Labs, west, $1200, churn=no',
  '2. Nova Retail, east, $640, churn=yes',
  '3. Pixel Foods, north, $820, churn=no',
  '4. Helio Health, west, $1480, churn=no',
  '5. Orbit Motors, south, $530, churn=yes',
  '6. Quill Media, east, $910, churn=no'
]

const TRANSFORM_PREVIEW_LINES = [
  '{region:"WEST", spend_band:"high", churn_label:0}',
  '{region:"EAST", spend_band:"low", churn_label:1}',
  '{region:"NORTH", spend_band:"mid", churn_label:0}',
  '{region:"WEST", spend_band:"high", churn_label:0}',
  '{region:"SOUTH", spend_band:"low", churn_label:1}',
  '{region:"EAST", spend_band:"mid", churn_label:0}'
]

const OUTPUT_SUMMARY_LINES = [
  'rows_processed: 6',
  'churn_rate: 33%',
  'high_spend_share: 33%',
  'artifact: rea'
]

const Node = ({ id, label, icon: Icon, color, initialX, initialY, onMove, expanded, onToggle, previewTitle, previewLines }) => {
  const x = useMotionValue(initialX)
  const y = useMotionValue(initialY)

  useEffect(() => {
    const unsubscribeX = x.on('change', (latestX) => onMove(id, { x: latestX, y: y.get() }))
    const unsubscribeY = y.on('change', (latestY) => onMove(id, { x: x.get(), y: latestY }))
    return () => {
      unsubscribeX()
      unsubscribeY()
    }
  }, [id, onMove, x, y])

  return (
    <motion.div
      drag
      dragMomentum={false}
      style={{ x, y }}
      className={`absolute cursor-grab active:cursor-grabbing ${expanded ? 'z-20' : 'z-10'}`}
    >
      <div
        className={`bg-background border-2 rounded-2xl shadow-xl min-w-56 transition-all duration-200 ${expanded ? 'ring-1 ring-foreground/15' : ''}`}
        style={{ borderColor: `${color}40` }}
      >
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggle(id)
          }}
          className="w-full flex items-center justify-between gap-3 p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">{id}</p>
              <p className="text-sm font-bold text-foreground">{label}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
            {expanded ? 'Collapse' : 'Expand'}
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            <div className="h-px bg-foreground/10 mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2">{previewTitle}</p>
            <div className="space-y-1 font-mono text-[11px] leading-relaxed text-foreground/85 max-w-85">
              {previewLines.map((line, index) => (
                <div key={`${id}-${index}`}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

const MiniPlayground = () => {
  const [nodes, setNodes] = useState({
    dataset: { x: 100, y: 100 },
    transform: { x: 400, y: 150 },
    output: { x: 700, y: 100 }
  })
  const [expandedNode, setExpandedNode] = useState('dataset')

  const handleMove = (id, pos) => {
    setNodes(prev => ({ ...prev, [id]: pos }))
  }

  const handleToggleNode = (id) => {
    setExpandedNode((prev) => (prev === id ? null : id))
  }

  // Calculate paths for connections
  const getPath = (start, end) => {
    const startX = start.x + 180 // Approximate width
    const startY = start.y + 40  // Approximate center Y
    const endX = end.x
    const endY = end.y + 40

    const cp1X = startX + (endX - startX) / 2
    const cp2X = endX - (endX - startX) / 2

    return `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`
  }

  return (
    <div className="w-full max-w-5xl mx-auto mb-16">
      <div className="h-100 relative bg-foreground/2 border border-foreground/5 rounded-3xl overflow-hidden group">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      
      {/* SVG for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path d={getPath(nodes.dataset, nodes.transform)} stroke="url(#grad1)" strokeWidth="3" fill="none" strokeDasharray="8 4" className="animate-[dash_20s_linear_infinite]" />
        <path d={getPath(nodes.transform, nodes.output)} stroke="url(#grad2)" strokeWidth="3" fill="none" strokeDasharray="8 4" className="animate-[dash_20s_linear_infinite]" />
      </svg>

      <Node
        id="dataset"
        label="customers.csv (6 rows)"
        icon={Database}
        color="#3b82f6"
        initialX={nodes.dataset.x}
        initialY={nodes.dataset.y}
        onMove={handleMove}
        expanded={expandedNode === 'dataset'}
        onToggle={handleToggleNode}
        previewTitle="Input Dataset"
        previewLines={INPUT_DATASET_LINES}
      />
      <Node
        id="transform"
        label="Encode + Banding"
        icon={Zap}
        color="#8b5cf6"
        initialX={nodes.transform.x}
        initialY={nodes.transform.y}
        onMove={handleMove}
        expanded={expandedNode === 'transform'}
        onToggle={handleToggleNode}
        previewTitle="Transform Preview"
        previewLines={TRANSFORM_PREVIEW_LINES}
      />
      <Node
        id="output"
        label="ready_features.parquet"
        icon={FileCode}
        color="#10b981"
        initialX={nodes.output.x}
        initialY={nodes.output.y}
        onMove={handleMove}
        expanded={expandedNode === 'output'}
        onToggle={handleToggleNode}
        previewTitle="Output Summary"
        previewLines={OUTPUT_SUMMARY_LINES}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/80 backdrop-blur-md border border-foreground/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
        Interactive Demo: Click a node to expand details
      </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -1000;
          }
        }
      ` }} />
    </div>
  )
}

export default MiniPlayground
