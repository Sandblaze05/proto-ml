'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SidebarClose, Menu, PlayCircle, AlertCircle, CheckCircle2, Code2 } from 'lucide-react'
import gsap from 'gsap'
import NodePalette from './NodePalette'
import { useExecutionStore } from '@/store/useExecutionStore'
import { compileExecutionGraph } from '@/lib/executor/pipelineCompiler'
import MonacoCodeEditor from './nodes/MonacoCodeEditor'

const DashboardNav = () => {

  const navRef = useRef(null)
  const [navOpen, setNavOpen] = useState(true)
  const [navHover, setNavHover] = useState(false);
  const [compiledCode, setCompiledCode] = useState('')
  const [compileErrors, setCompileErrors] = useState([])
  const [compileMeta, setCompileMeta] = useState(null)

  const execNodes = useExecutionStore(s => s.nodes)
  const execEdges = useExecutionStore(s => s.edges)

  useEffect(() => {
    if (!navRef.current) return

    const tween = gsap.to(navRef.current, {
      xPercent: navOpen ? 0 : -85,
      duration: 0.4,
      ease: 'power3.out',
      overwrite: 'auto',
    })

    return () => tween.kill()
  }, [navOpen])

  useEffect(() => {
    if (!navRef.current || navOpen) return;

    const tween = gsap.to(navRef.current, {
      xPercent: navHover ? -80 : -85,
      duration: 0.2,
      ease: 'power3.out',
      overwrite: 'auto'
    })

    return () => tween.kill();
  }, [navHover, navOpen]);

  const handleCompile = () => {
    const result = compileExecutionGraph({ nodes: execNodes, edges: execEdges })
    setCompiledCode(result.code || '')
    setCompileErrors(result.errors || [])
    setCompileMeta(result.metadata || null)
  }

  return (
    <div
      ref={navRef}
      onMouseEnter={() => setNavHover(true)}
      onMouseLeave={() => setNavHover(false)}
      className={`z-100 fixed py-4 px-4 flex flex-col gap-2 items-center left-4 top-1/2 -translate-y-[50%] rounded-2xl border-3 border-foreground h-170 bg-background w-100 overflow-hidden`}
    >
      <span className='w-full flex items-center justify-between'>
        <span className='flex flex-col gap-3 items-center'>
          <h1 className={`text-3xl font-bold font-mono ${navOpen && 'pointer-events-none'}`}>
            Control Panel
          </h1>
          <div className='mx-5 w-full bg-foreground h-px' />
        </span>
        <button
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setNavOpen((s) => !s)}
          className='p-1 text-foreground pb-3'
        >
          {navOpen ? <SidebarClose size={24} /> : <Menu size={24} />}
        </button>
      </span>
      <div className={`nowheel w-full px-4 overflow-y-auto transition-opacity duration-200 ${navOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <NodePalette />

        <div className='mt-4 border border-foreground/20 rounded-lg p-2 bg-black/20'>
          <div className='flex items-center justify-between mb-2'>
            <div className='text-[11px] font-bold font-mono flex items-center gap-1'>
              <Code2 size={14} /> Pipeline Compiler
            </div>
            <button
              onClick={handleCompile}
              className='px-2 py-1 rounded text-[10px] font-mono bg-cyan-700/35 hover:bg-cyan-700/50 border border-cyan-300/30 flex items-center gap-1'
            >
              <PlayCircle size={12} /> Compile
            </button>
          </div>

          {compileMeta && (
            <div className='text-[9px] font-mono text-foreground/60 mb-2'>
              nodes: {compileMeta.nodeCount} | edges: {compileMeta.edgeCount} | datasets: {compileMeta.datasetCount}
            </div>
          )}

          {compileErrors.length > 0 && (
            <div className='mb-2 p-2 rounded bg-red-900/20 border border-red-500/30 text-[10px] font-mono text-red-300'>
              <div className='flex items-center gap-1 mb-1'><AlertCircle size={12} /> Compile Errors</div>
              {compileErrors.map((err, i) => (
                <div key={i}>- {err}</div>
              ))}
            </div>
          )}

          {compiledCode && compileErrors.length === 0 && (
            <div className='mb-2 p-1 rounded bg-emerald-900/20 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center gap-1'>
              <CheckCircle2 size={12} /> Compile successful
            </div>
          )}

          <MonacoCodeEditor
            title='Compiled Pipeline Python'
            language='python'
            value={compiledCode}
            readOnly
            height={260}
          />
        </div>
      </div>
    </div>
  )
}

export default DashboardNav