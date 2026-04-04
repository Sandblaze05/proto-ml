'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { Database, Zap, FileCode } from 'lucide-react'

const Node = ({ id, label, icon: Icon, color, initialX, initialY, onMove }) => {
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
      className="absolute z-10 cursor-grab active:cursor-grabbing"
    >
      <div className={`flex items-center gap-3 p-4 bg-background border-2 rounded-2xl shadow-xl min-w-[180px] transition-colors`} style={{ borderColor: `${color}40` }}>
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">{id}</p>
          <p className="text-sm font-bold text-foreground">{label}</p>
        </div>
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

  const handleMove = (id, pos) => {
    setNodes(prev => ({ ...prev, [id]: pos }))
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
    <div className="w-full max-w-5xl mx-auto h-[400px] relative bg-foreground/[0.02] border border-foreground/5 rounded-3xl overflow-hidden mb-20 group">
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

      <Node id="dataset" label="Clean_Data.csv" icon={Database} color="#3b82f6" initialX={nodes.dataset.x} initialY={nodes.dataset.y} onMove={handleMove} />
      <Node id="transform" label="Standard_Scaler" icon={Zap} color="#8b5cf6" initialX={nodes.transform.x} initialY={nodes.transform.y} onMove={handleMove} />
      <Node id="output" label="Compiled_Model" icon={FileCode} color="#10b981" initialX={nodes.output.x} initialY={nodes.output.y} onMove={handleMove} />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/80 backdrop-blur-md border border-foreground/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
        Interactive Demo: Try dragging the nodes
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
