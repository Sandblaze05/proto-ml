'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SidebarClose, Code2, PlayCircle, AlertCircle, CheckCircle2, Terminal, Settings2, Play } from 'lucide-react'
import gsap from 'gsap'
import { useUIStore } from '@/store/useUIStore'
import { compileExecutionGraph } from '@/lib/executor/pipelineCompiler'
import MonacoCodeEditor from './nodes/MonacoCodeEditor'
import JupyterClient from '@/lib/executor/jupyterClient'

const PipelineCompilerPanel = () => {
  const panelRef = useRef(null)
  const logsEndRef = useRef(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelHover, setPanelHover] = useState(false)
  const [compiledCode, setCompiledCode] = useState('')
  const [compileErrors, setCompileErrors] = useState([])
  const [compileWarnings, setCompileWarnings] = useState([])
  const [compileMeta, setCompileMeta] = useState(null)
  const [validationMode, setValidationMode] = useState('strict')

  // Execution State
  const [activeTab, setActiveTab] = useState('code') // 'code' | 'logs'
  const [jupyterUrl, setJupyterUrl] = useState('http://localhost:8888')
  const [jupyterToken, setJupyterToken] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionLogs, setExecutionLogs] = useState([])
  const [showSettings, setShowSettings] = useState(false)

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

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionLogs, activeTab]);

  const handleCompile = () => {
    const uiGraph = buildCompilerGraphFromUI()
    const result = compileExecutionGraph(uiGraph, { validationMode })
    setCompiledCode(result.code || '')
    setCompileErrors(result.errors || [])
    setCompileWarnings(result.warnings || [])
    setCompileMeta(result.metadata || null)
    setActiveTab('code')
  }

  const handleExecute = async () => {
    if (!compiledCode) return;
    setIsExecuting(true);
    setActiveTab('logs');
    setExecutionLogs([{ type: 'system', text: `Connecting to Jupyter at ${jupyterUrl}...` }]);

    try {
      const appProtocol = typeof window !== 'undefined' ? window.location.protocol : '';
      const appHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const runtimeUrl = new URL(jupyterUrl);
      const isLocalKernel = ['localhost', '127.0.0.1'].includes(runtimeUrl.hostname);
      const isMixedContent = appProtocol === 'https:' && runtimeUrl.protocol === 'http:';

      if (isMixedContent) {
        throw new Error('Blocked by browser mixed-content policy: this app is loaded over HTTPS but Jupyter URL is HTTP. Use an HTTPS Jupyter endpoint (or tunnel), or run the app locally over HTTP.');
      }

      if (isLocalKernel && appHost && !['localhost', '127.0.0.1'].includes(appHost)) {
        setExecutionLogs(prev => [
          ...prev,
          {
            type: 'system',
            text: 'Localhost kernel detected while app is remote. Browser can only reach your local kernel from a local app session or via a public tunnel endpoint.',
          },
        ]);
      }

      const client = new JupyterClient(jupyterUrl, jupyterToken);
      
      // Step 1: List / create kernel
      let kernelId;
      setExecutionLogs(prev => [...prev, { type: 'system', text: 'Fetching kernels...' }]);
      const kernels = await client.listKernels();
      
      if (kernels && kernels.length > 0) {
        kernelId = kernels[0].id; // reuse existing kernel
        setExecutionLogs(prev => [...prev, { type: 'system', text: `Reusing existing kernel ${kernelId}...` }]);
      } else {
        setExecutionLogs(prev => [...prev, { type: 'system', text: 'Starting new kernel...' }]);
        const newKernel = await client.startKernel();
        kernelId = newKernel.id;
      }

      // Step 2: Execute code
      setExecutionLogs(prev => [...prev, { type: 'system', text: 'Executing compiled pipeline...\n' + '-'.repeat(40) }]);
      
      const result = await client.executeCode(kernelId, compiledCode, {
        onStream: (name, text) => {
          setExecutionLogs(prev => [...prev, { type: name, text }]);
        },
        onDisplayData: (data) => {
          if (data['text/plain']) {
            setExecutionLogs(prev => [...prev, { type: 'stdout', text: data['text/plain'] }]);
          }
        },
        onError: (err) => {
          setExecutionLogs(prev => [...prev, { type: 'stderr', text: `${err.ename}: ${err.evalue}\n${(err.traceback || []).join('\n')}` }]);
        },
        onConnected: () => {
          // Socket connected
        },
        onComplete: (status) => {
          setExecutionLogs(prev => [...prev, { type: 'system', text: `\n${'-'.repeat(40)}\nExecution finished with status: ${status}` }]);
        }
      });
      
      if (result.status !== 'ok') {
         setExecutionLogs(prev => [...prev, { type: 'stderr', text: `Pipeline execution failed or aborted.` }]);
      }
    } catch (err) {
      const message = String(err?.message || err || 'Unknown error');
      const isNetworkFailure = /NetworkError|Failed to fetch|fetch resource/i.test(message);
      const hint = isNetworkFailure
        ? '\nHint: If this app is not running on localhost, a local Jupyter URL (http://localhost:8888) is unreachable from the browser context. Use a publicly reachable HTTPS Jupyter endpoint or run the app locally.'
        : '';
      setExecutionLogs(prev => [...prev, { type: 'stderr', text: `\n[Fatal Error]: ${message}${hint}` }]);
    } finally {
      setIsExecuting(false);
    }
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
        className={`z-[150] flex flex-col fixed py-4 px-4 gap-2 items-center right-4 top-[80px] bottom-[24px] rounded-2xl border-3 border-foreground w-120 bg-background/90 backdrop-blur-md overflow-hidden shadow-2xl ${panelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
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
              Compiler & Execution
            </h1>
            <div className='mr-5 w-full bg-foreground h-px' />
          </span>
        </span>
        <div className={`nowheel w-full flex flex-col flex-1 transition-opacity duration-200 ${panelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          
          <div className='mt-2 flex items-center justify-between shrink-0'>
            <div className='text-[12px] font-bold font-mono text-foreground/80 flex items-center gap-1.5'>
              <Code2 size={16} /> Compile to Python
            </div>
            <div className='flex items-center gap-2'>
              <select
                value={validationMode}
                onChange={(e) => setValidationMode(e.target.value === 'relax' ? 'relax' : 'strict')}
                className='px-2 py-1 rounded text-[11px] font-mono bg-black/40 border border-foreground/30 text-foreground/85'
                title='Validation Mode'
              >
                <option value='strict'>Strict</option>
                <option value='relax'>Relax</option>
              </select>
              <button
                onClick={handleCompile}
                className='px-3 py-1.5 rounded text-[11px] font-mono bg-cyan-700/35 hover:bg-cyan-700/50 border border-cyan-300/30 flex items-center gap-1.5 shadow-md transition-all cursor-pointer'
              >
                <PlayCircle size={14} /> Compile
              </button>
            </div>
          </div>

          <div className='mt-3 flex items-center justify-between shrink-0 p-2 border border-foreground/20 rounded bg-black/20'>
             <div className='text-[11px] font-bold font-mono flex items-center gap-1.5'>
               <Terminal size={14} /> Jupyter Engine
             </div>
             <div className='flex items-center gap-2'>
               <button
                 onClick={() => setShowSettings(!showSettings)}
                 className='p-1 rounded hover:bg-foreground/10 text-foreground/70'
                 title="Runtime Settings"
               >
                 <Settings2 size={14} />
               </button>
               <button
                 onClick={handleExecute}
                 disabled={isExecuting || !compiledCode || compileErrors.length > 0}
                 className='px-3 py-1.5 rounded text-[11px] font-mono bg-emerald-700/35 hover:bg-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-300/30 flex items-center gap-1.5 shadow-md transition-all cursor-pointer'
               >
                 <Play size={12} fill="currentColor" /> {isExecuting ? 'Running...' : 'Run Pipeline'}
               </button>
             </div>
          </div>

          {showSettings && (
             <div className="mt-2 p-3 bg-black/30 border border-foreground/20 rounded flex flex-col gap-2 shrink-0">
               <label className="flex flex-col text-[10px] font-mono text-foreground/70">
                 Jupyter Base URL (Colab/Kaggle/Local)
                 <input 
                   type="text" 
                   value={jupyterUrl} 
                   onChange={e => setJupyterUrl(e.target.value)}
                   className="mt-1 px-2 py-1 bg-black/50 border border-foreground/30 rounded text-foreground outline-none focus:border-cyan-500"
                   placeholder="http://localhost:8888"
                 />
               </label>
               <label className="flex flex-col text-[10px] font-mono text-foreground/70">
                 Access Token (Optional)
                 <input 
                   type="text" 
                   value={jupyterToken} 
                   onChange={e => setJupyterToken(e.target.value)}
                   className="mt-1 px-2 py-1 bg-black/50 border border-foreground/30 rounded text-foreground outline-none focus:border-cyan-500"
                   placeholder="Enter token..."
                 />
               </label>
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

          {compileWarnings.length > 0 && (
            <div className='mt-2 p-3 rounded bg-amber-900/20 border border-amber-500/30 text-[11px] font-mono text-amber-200 shadow-inner shrink-0 overflow-y-auto max-h-[120px]'>
              <div className='flex items-center gap-1.5 mb-2 font-bold text-[12px]'><AlertCircle size={14} /> Compile Warnings</div>
              {compileWarnings.map((warn, i) => (
                <div key={i} className="mb-1 leading-relaxed">- {warn}</div>
              ))}
            </div>
          )}

          <div className="flex bg-black/40 border border-foreground/20 rounded-t-lg mt-3 overflow-hidden shrink-0">
             <button 
               onClick={() => setActiveTab('code')}
               className={`flex-1 py-1.5 text-[11px] font-mono border-b-2 transition-colors ${activeTab === 'code' ? 'border-cyan-400 text-foreground bg-foreground/10' : 'border-transparent text-foreground/50 hover:bg-foreground/5'}`}
             >
               Python Code
             </button>
             <button 
               onClick={() => setActiveTab('logs')}
               className={`flex-1 py-1.5 text-[11px] font-mono border-b-2 transition-colors ${activeTab === 'logs' ? 'border-emerald-400 text-foreground bg-foreground/10' : 'border-transparent text-foreground/50 hover:bg-foreground/5'}`}
             >
               Execution Logs 
               {isExecuting && <span className="inline-block ml-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
             </button>
          </div>

          <div className="flex-1 border border-t-0 border-foreground/20 rounded-b-lg overflow-hidden bg-black/60 flex flex-col min-h-0 relative">
            {activeTab === 'code' ? (
              <MonacoCodeEditor
                title='Compiled Pipeline Python'
                language='python'
                value={compiledCode || "# Pipeline not compiled yet.\n# Click 'Compile' to generate code."}
                readOnly
                height="100%"
              />
            ) : (
              <div className="flex-1 w-full h-full overflow-y-auto p-3 font-mono text-[11px] whitespace-pre-wrap flex flex-col break-all">
                {executionLogs.length === 0 ? (
                  <span className="text-foreground/30 italic">No execution logs yet. Run the pipeline to see output.</span>
                ) : (
                  executionLogs.map((log, i) => (
                    <span 
                      key={i} 
                      className={`${log.type === 'stderr' ? 'text-red-400' : log.type === 'system' ? 'text-cyan-400' : 'text-foreground/90'}`}
                    >
                      {log.text}
                    </span>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}

export default PipelineCompilerPanel