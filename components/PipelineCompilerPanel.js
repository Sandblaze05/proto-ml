'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SidebarClose, Code2, PlayCircle, AlertCircle, CheckCircle2 } from 'lucide-react'
import gsap from 'gsap'
import { useExecutionStore } from '@/store/useExecutionStore'
import { useUIStore } from '@/store/useUIStore'
import { compileExecutionGraph } from '@/lib/executor/pipelineCompiler'
import MonacoCodeEditor from './nodes/MonacoCodeEditor'

const PipelineCompilerPanel = () => {
  const panelRef = useRef(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelHover, setPanelHover] = useState(false)
  const [compiledCode, setCompiledCode] = useState('')
  const [compileErrors, setCompileErrors] = useState([])
  const [compileMeta, setCompileMeta] = useState(null)

  const execNodes = useExecutionStore(s => s.nodes)
  const execEdges = useExecutionStore(s => s.edges)
  const uiNodes = useUIStore(s => s.nodes)
  const uiEdges = useUIStore(s => s.edges)

  const buildCompilerGraphFromUI = () => {
    const nodesById = (uiNodes || []).reduce((acc, node) => {
      const model = node?.data?.nodeModel || {}
      acc[node.id] = {
        id: node.id,
        type: model.type || node.type || 'unknown',
        config: model.config || model.params || {},
        pythonCode: model.pythonCode || model.execution_code || '',
      }
      return acc
    }, {})

    const normalizedEdges = (uiEdges || []).map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }))

    return { nodes: nodesById, edges: normalizedEdges }
  }

  useEffect(() => {
    if (!panelRef.current) return

    const tween = gsap.to(panelRef.current, {
      xPercent: panelOpen ? 0 : 120,
      opacity: panelOpen ? 1 : 0,
      duration: 0.4,
      ease: 'power3.out',
      overwrite: 'auto',
    })

    return () => tween.kill()
  }, [panelOpen])

  useEffect(() => {
    if (!panelRef.current || panelOpen) return;

    const tween = gsap.to(panelRef.current, {
      xPercent: panelHover ? -2 : 0,
      duration: 0.2,
      ease: 'power3.out',
      overwrite: 'auto'
    })

    return () => tween.kill();
  }, [panelHover, panelOpen]);

  const handleCompile = () => {
    const uiGraph = buildCompilerGraphFromUI()
    const hasUiNodes = Object.keys(uiGraph.nodes || {}).length > 0
    const sourceGraph = hasUiNodes
      ? uiGraph
      : { nodes: execNodes, edges: execEdges }

    const result = compileExecutionGraph(sourceGraph)
    setCompiledCode(result.code || '')
    setCompileErrors(result.errors || [])
    setCompileMeta(result.metadata || null)
  }

  return (
    <>
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="group z-[150] fixed top-[80px] right-0 flex items-center h-[44px] bg-background/90 backdrop-blur-md border border-r-0 border-foreground rounded-l-md shadow-[0_6px_18px_rgba(0,0,0,0.35)] cursor-pointer hover:bg-foreground/10 transition-all duration-300 overflow-hidden w-[44px] hover:w-[130px]"
          aria-label="Open Compiler"
          title="Open Compiler"
        >
          <div className="flex items-center pl-[11px] w-[130px] whitespace-nowrap">
            <Code2 size={20} className="shrink-0 text-foreground" />
            <span className="ml-3 font-mono font-bold text-sm text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300 delayed-fade">
              Compiler
            </span>
          </div>
        </button>
      )}

      <div
        ref={panelRef}
        onMouseEnter={() => setPanelHover(true)}
        onMouseLeave={() => setPanelHover(false)}
        className={`z-[150] flex flex-col fixed py-4 px-4 gap-2 items-center right-4 top-[80px] bottom-[24px] rounded-2xl border-3 border-foreground w-100 bg-background/90 backdrop-blur-md overflow-hidden shadow-2xl ${panelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <span className={`w-full flex items-center justify-between`}>
          <button
            aria-label='Close compiler'
            onClick={() => setPanelOpen(false)}
            className={`p-1 text-foreground pb-3 hover:opacity-80 transition-opacity cursor-pointer`}
          >
            <SidebarClose size={24} className="scale-x-[-1]" />
          </button>
          <span className='flex flex-col gap-3 items-center ml-auto mr-0 w-3/4'>
            <h1 className={`text-2xl pt-1 font-bold font-mono tracking-tighter ${panelOpen && 'pointer-events-none'}`}>
              Compiler
            </h1>
            <div className='mr-5 w-full bg-foreground h-px' />
          </span>
        </span>
        <div className={`nowheel w-full flex flex-col flex-1 transition-opacity duration-200 ${panelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          
          <div className='mt-2 flex items-center justify-between shrink-0'>
            <div className='text-[12px] font-bold font-mono text-foreground/80 flex items-center gap-1.5'>
              <Code2 size={16} /> Compile to Python
            </div>
            <button
              onClick={handleCompile}
              className='px-3 py-1.5 rounded text-[11px] font-mono bg-cyan-700/35 hover:bg-cyan-700/50 border border-cyan-300/30 flex items-center gap-1.5 shadow-md transition-all cursor-pointer'
            >
              <PlayCircle size={14} /> Compile
            </button>
          </div>

          {compileMeta && (
            <div className='text-[10px] font-mono text-foreground/50 mt-3 mb-1 shrink-0'>
              nodes: {compileMeta.nodeCount} | edges: {compileMeta.edgeCount} | datasets: {compileMeta.datasetCount}
            </div>
          )}

          {compileErrors.length > 0 && (
            <div className='mt-3 p-3 rounded bg-red-900/20 border border-red-500/30 text-[11px] font-mono text-red-300 shadow-inner shrink-0 overflow-y-auto max-h-[120px]'>
              <div className='flex items-center gap-1.5 mb-2 font-bold text-[12px]'><AlertCircle size={14} /> Compile Errors</div>
              {compileErrors.map((err, i) => (
                <div key={i} className="mb-1 leading-relaxed">- {err}</div>
              ))}
            </div>
          )}

          {compiledCode && compileErrors.length === 0 && (
            <div className='mt-3 p-2 rounded bg-emerald-900/20 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 flex items-center gap-1.5 shadow-inner shrink-0'>
              <CheckCircle2 size={14} /> Compile successful
            </div>
          )}

          <div className="flex-1 mt-4 border border-foreground/20 rounded-lg overflow-hidden bg-black/40 mb-2 flex flex-col min-h-0">
            <MonacoCodeEditor
              title='Compiled Pipeline Python'
              language='python'
              value={compiledCode}
              readOnly
              height="100%"
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default PipelineCompilerPanel