'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  SidebarClose, Code2, PlayCircle, AlertCircle, Terminal,
  Settings2, Play, Zap, CheckCircle2, XCircle, SkipForward,
  RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react'
import gsap from 'gsap'
import { useUIStore } from '@/store/useUIStore'
import { compileExecutionGraph } from '@/lib/executor/pipelineCompiler'
import { compilePipelineCells, compileBootstrapCell } from '@/lib/executor/nodeCellCompiler'
import MonacoCodeEditor from './nodes/MonacoCodeEditor'

// ─── Node status badge icon helper ─────────────────────────────────────────────

function NodeStatusIcon({ status, size = 10 }) {
  if (status === 'running') return (
    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ width: size, height: size }} />
  )
  if (status === 'success') return <CheckCircle2 size={size} className="text-emerald-400" />
  if (status === 'error') return <XCircle size={size} className="text-red-400" />
  if (status === 'skipped') return <SkipForward size={size} className="text-foreground/30" />
  return null
}

// ─── Cell-mode execution log entry ─────────────────────────────────────────────

function CellLogGroup({ nodeId, nodeLabel, nodeType, status, logs = [], error = null }) {
  const [expanded, setExpanded] = useState(status === 'error')

  useEffect(() => {
    if (status === 'error') setExpanded(true)
  }, [status])

  const borderColor = status === 'success' ? 'border-emerald-500/30'
    : status === 'error' ? 'border-red-500/40'
    : status === 'running' ? 'border-amber-400/40'
    : status === 'skipped' ? 'border-foreground/10'
    : 'border-foreground/15'

  const bgColor = status === 'error' ? 'bg-red-950/20' : status === 'running' ? 'bg-amber-950/10' : 'bg-black/20'

  return (
    <div className={`mb-1.5 rounded border ${borderColor} ${bgColor} overflow-hidden`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-foreground/5 transition-colors"
      >
        <NodeStatusIcon status={status} size={10} />
        <span className="flex-1 text-[10px] font-mono font-bold text-foreground/80 truncate">{nodeLabel || nodeId}</span>
        <span className="text-[9px] font-mono text-foreground/30 shrink-0">{nodeType}</span>
        {expanded ? <ChevronDown size={10} className="text-foreground/30 shrink-0" /> : <ChevronRight size={10} className="text-foreground/30 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-2 pb-2 font-mono text-[10px] space-y-px">
          {error && (
            <div className="text-red-300 whitespace-pre-wrap break-all leading-relaxed">{error}</div>
          )}
          {logs.map((log, i) => (
            <div
              key={i}
              className={`leading-relaxed whitespace-pre-wrap break-all ${log.type === 'stderr' ? 'text-red-300' : log.type === 'system' ? 'text-cyan-400/80' : 'text-foreground/70'}`}
            >
              {log.text}
            </div>
          ))}
          {logs.length === 0 && !error && status !== 'running' && (
            <div className="text-foreground/25 italic">No output.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ────────────────────────────────────────────────────────────────

const PipelineCompilerPanel = () => {
  const panelRef = useRef(null)
  const logsEndRef = useRef(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelHover, setPanelHover] = useState(false)

  // ── Compile-mode state ────────────────────────────────────────────────────
  const [compiledCode, setCompiledCode] = useState('')
  const [compileErrors, setCompileErrors] = useState([])
  const [compileWarnings, setCompileWarnings] = useState([])
  const [compileMeta, setCompileMeta] = useState(null)
  const [validationMode, setValidationMode] = useState('strict')

  // ── Shared execution state ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('code') // 'code' | 'cell' | 'logs' | 'result'
  const [showSettings, setShowSettings] = useState(false)

  // ── Jupyter session (persisted in store so nodes can read it) ────────────
  const jupyterSession = useUIStore(s => s.jupyterSession)
  const setJupyterSession = useUIStore(s => s.setJupyterSession)
  const setNodeExecutionState = useUIStore(s => s.setNodeExecutionState)
  const clearNodeExecutionStates = useUIStore(s => s.clearNodeExecutionStates)

  const jupyterUrl = jupyterSession.url
  const jupyterToken = jupyterSession.token
  const setJupyterUrl = (url) => setJupyterSession({ url })
  const setJupyterToken = (token) => setJupyterSession({ token })

  // ── Monolith run state (existing mode) ───────────────────────────────────
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionLogs, setExecutionLogs] = useState([])
  const [executionResult, setExecutionResult] = useState(null)

  // ── Cell-mode state ───────────────────────────────────────────────────────
  const [isCellRunning, setIsCellRunning] = useState(false)
  const [cellRunLog, setCellRunLog] = useState([]) // { nodeId, nodeLabel, nodeType, status, logs, error }
  const [cellRunStatus, setCellRunStatus] = useState(null) // null | 'running' | 'success' | 'error'
  const [cellNodeOrder, setCellNodeOrder] = useState([]) // compiled order reference

  const uiNodes = useUIStore(s => s.nodes)
  const uiEdges = useUIStore(s => s.edges)

  // ── Panel animation ───────────────────────────────────────────────────────

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
    if (!panelRef.current || panelOpen) return
    const tween = gsap.to(panelRef.current, {
      xPercent: panelHover ? -2 : 0,
      duration: 0.2,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    return () => tween.kill()
  }, [panelHover, panelOpen])

  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [executionLogs, activeTab])

  // ── Graph extraction ──────────────────────────────────────────────────────

  const buildCompilerGraphFromUI = useCallback(() => {
    const nodesById = (uiNodes || []).reduce((acc, node) => {
      const model = node?.data?.nodeModel || {}
      acc[node.id] = {
        id: node.id,
        type: model.type || node.type || 'unknown',
        config: model.config || model.params || {},
        pythonCode: model.pythonCode || model.execution_code || '',
        label: model.label || model.type || node.type || node.id,
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
  }, [uiNodes, uiEdges])

  // ── Compile (monolith mode) ───────────────────────────────────────────────

  const handleCompile = useCallback(() => {
    const uiGraph = buildCompilerGraphFromUI()
    const result = compileExecutionGraph(uiGraph, { validationMode })
    setCompiledCode(result.code || '')
    setCompileErrors(result.errors || [])
    setCompileWarnings(result.warnings || [])
    setCompileMeta(result.metadata || null)
    setActiveTab('code')
  }, [buildCompilerGraphFromUI, validationMode])

  // ── Monolith execute (existing mode, unchanged) ───────────────────────────

  const handleExecute = useCallback(async () => {
    if (!compiledCode) return
    setIsExecuting(true)
    setActiveTab('logs')
    setExecutionLogs([])
    setExecutionResult(null)

    try {
      const response = await fetch('/api/jupyter/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jupyterUrl, jupyterToken, code: compiledCode }),
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Execution failed (${response.status})`)

      setExecutionLogs(prev => [...prev, ...(Array.isArray(data.logs) ? data.logs : [])])
      setExecutionResult(data?.structuredResult ?? null)
      if (data?.structuredResult) setActiveTab('result')
    } catch (err) {
      setExecutionLogs(prev => [...prev, { type: 'stderr', text: `\n[Fatal Error]: ${String(err?.message || err)}` }])
    } finally {
      setIsExecuting(false)
    }
  }, [compiledCode, jupyterUrl, jupyterToken])

  // ── Cell-mode: run pipeline node-by-node ─────────────────────────────────

  const handleCellRun = useCallback(async () => {
    if (isCellRunning) return
    setIsCellRunning(true)
    setActiveTab('cell')
    setCellRunStatus('running')
    clearNodeExecutionStates()

    // Build graph and compile cell order
    const graph = buildCompilerGraphFromUI()
    const { order, errors: cellErrors } = compilePipelineCells(graph)

    if (cellErrors.length > 0) {
      setCellRunLog([{
        nodeId: '__compile_error',
        nodeLabel: 'Compile Error',
        nodeType: '',
        status: 'error',
        logs: [],
        error: cellErrors.join('\n'),
      }])
      setCellRunStatus('error')
      setIsCellRunning(false)
      return
    }

    // Initialise per-node status panels in order
    const initialLog = order.map(({ nodeId, node }) => ({
      nodeId,
      nodeLabel: node?.label || node?.type || nodeId,
      nodeType: node?.type || '',
      status: 'idle',
      logs: [],
      error: null,
    }))
    setCellRunLog(initialLog)
    setCellNodeOrder(order.map(o => o.nodeId))

    // Update store so nodes on canvas see idle status
    order.forEach(({ nodeId }) => setNodeExecutionState(nodeId, { status: 'idle', logs: [], error: null }))

    // Step 1: acquire (or create) a kernel — always use a fresh kernel per pipeline run
    let kernelId = null
    try {
      const kRes = await fetch(
        `/api/jupyter/kernel?jupyterUrl=${encodeURIComponent(jupyterUrl)}&jupyterToken=${encodeURIComponent(jupyterToken)}&fresh=true`
      )
      const kData = await kRes.json()
      if (!kData.ok) throw new Error(kData.error || 'Kernel creation failed')
      kernelId = kData.kernelId
      setJupyterSession({ kernelId })
    } catch (err) {
      setCellRunLog([{
        nodeId: '__kernel_error',
        nodeLabel: 'Kernel Error',
        nodeType: '',
        status: 'error',
        logs: [],
        error: `Failed to connect to Jupyter at ${jupyterUrl}:\n${String(err?.message || err)}`,
      }])
      setCellRunStatus('error')
      setIsCellRunning(false)
      return
    }

    // Step 2: send bootstrap cell (installs runtime helpers)
    try {
      const bootstrapCode = compileBootstrapCell()
      const bRes = await fetch('/api/jupyter/cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jupyterUrl, jupyterToken, kernelId, code: bootstrapCode, nodeId: '__bootstrap' }),
      })
      const bData = await bRes.json()
      if (!bData.ok) throw new Error(bData.stderr || bData.error || 'Bootstrap failed')
    } catch (err) {
      setCellRunLog(prev => [{
        nodeId: '__bootstrap_error',
        nodeLabel: 'Bootstrap Error',
        nodeType: 'runtime helpers',
        status: 'error',
        logs: [],
        error: `Runtime helpers failed to install:\n${String(err?.message || err)}`,
      }, ...prev])
      setCellRunStatus('error')
      setIsCellRunning(false)
      return
    }

    // Step 3: execute each node cell in topological order
    let overallOk = true

    for (let i = 0; i < order.length; i++) {
      const { nodeId, node, code } = order[i]
      const nodeLabel = node?.label || node?.type || nodeId
      const nodeType = node?.type || ''

      // Mark running
      setCellRunLog(prev => prev.map(e => e.nodeId === nodeId ? { ...e, status: 'running' } : e))
      setNodeExecutionState(nodeId, { status: 'running', startedAt: Date.now(), logs: [], error: null })

      try {
        const res = await fetch('/api/jupyter/cell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jupyterUrl, jupyterToken, kernelId, code, nodeId }),
        })
        const data = await res.json()

        const nodeLogs = Array.isArray(data.logs) ? data.logs : []
        const nodeError = (!data.ok || data.status !== 'ok')
          ? (data.stderr || data.error || `Cell execution failed with status: ${data.status}`)
          : null
        const nodeStatus = nodeError ? 'error' : 'success'

        setCellRunLog(prev => prev.map(e =>
          e.nodeId === nodeId
            ? { ...e, status: nodeStatus, logs: nodeLogs, error: nodeError }
            : e
        ))
        setNodeExecutionState(nodeId, {
          status: nodeStatus,
          completedAt: Date.now(),
          logs: nodeLogs,
          error: nodeError,
        })

        if (nodeError) {
          overallOk = false
          // Mark all remaining nodes as skipped
          for (let j = i + 1; j < order.length; j++) {
            const skippedId = order[j].nodeId
            setCellRunLog(prev => prev.map(e => e.nodeId === skippedId ? { ...e, status: 'skipped' } : e))
            setNodeExecutionState(skippedId, { status: 'skipped' })
          }
          break
        }
      } catch (fetchErr) {
        const errorMsg = String(fetchErr?.message || fetchErr)
        setCellRunLog(prev => prev.map(e =>
          e.nodeId === nodeId ? { ...e, status: 'error', error: errorMsg } : e
        ))
        setNodeExecutionState(nodeId, { status: 'error', error: errorMsg, completedAt: Date.now() })
        overallOk = false
        for (let j = i + 1; j < order.length; j++) {
          const skippedId = order[j].nodeId
          setCellRunLog(prev => prev.map(e => e.nodeId === skippedId ? { ...e, status: 'skipped' } : e))
          setNodeExecutionState(skippedId, { status: 'skipped' })
        }
        break
      }
    }

    setCellRunStatus(overallOk ? 'success' : 'error')
    setIsCellRunning(false)
  }, [
    isCellRunning, buildCompilerGraphFromUI, clearNodeExecutionStates,
    setNodeExecutionState, jupyterUrl, jupyterToken, setJupyterSession,
  ])

  // ── Result helpers (monolith mode) ────────────────────────────────────────

  const getResultRows = () => {
    const candidate = executionResult
    if (!candidate) return null
    if (Array.isArray(candidate)) return candidate
    if (Array.isArray(candidate.final_output)) return candidate.final_output
    if (Array.isArray(candidate.rows)) return candidate.rows
    if (Array.isArray(candidate.data)) return candidate.data
    return null
  }

  const triggerDownload = (filename, mimeType, content) => {
    if (typeof window === 'undefined') return
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const downloadResultJson = () => {
    if (!executionResult) return
    triggerDownload('pipeline-result.json', 'application/json;charset=utf-8', `${JSON.stringify(executionResult, null, 2)}\n`)
  }

  const toCsv = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return ''
    const objectRows = rows.map((row) => (row && typeof row === 'object' ? row : { value: row }))
    const headers = Array.from(new Set(objectRows.flatMap((row) => Object.keys(row))))
    const escapeCell = (value) => {
      const normalized = value == null ? '' : String(value)
      const escaped = normalized.replace(/"/g, '""')
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
    }
    return [`${headers.join(',')}`, ...objectRows.map(row => headers.map(h => escapeCell(row[h])).join(','))].join('\n') + '\n'
  }

  const downloadResultCsv = () => {
    const rows = getResultRows()
    if (!rows?.length) return
    const csv = toCsv(rows)
    if (csv) triggerDownload('pipeline-result.csv', 'text/csv;charset=utf-8', csv)
  }

  const resultRows = getResultRows()
  const hasCsvRows = Array.isArray(resultRows) && resultRows.length > 0
  const tableRows = hasCsvRows ? resultRows.map((row) => (row && typeof row === 'object' ? row : { value: row })) : []
  const tableHeaders = hasCsvRows ? Array.from(new Set(tableRows.flatMap((row) => Object.keys(row)))) : []

  // ── Cell-mode summary counts ──────────────────────────────────────────────
  const cellSuccessCount = cellRunLog.filter(e => e.status === 'success').length
  const cellErrorCount = cellRunLog.filter(e => e.status === 'error').length
  const cellSkippedCount = cellRunLog.filter(e => e.status === 'skipped').length

  // ─────────────────────────────────────────────────────────────────────────

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
            <span className="ml-3 font-mono font-bold text-sm text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
        {/* Header */}
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
              Compiler &amp; Execution
            </h1>
            <div className='mr-5 w-full bg-foreground h-px' />
          </span>
        </span>

        <div className={`nowheel w-full flex flex-col flex-1 transition-opacity duration-200 ${panelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

          {/* ── Cell-mode run bar ─────────────────────────────────────────── */}
          <div className='flex items-center justify-between shrink-0 p-2 border border-violet-400/30 rounded bg-violet-900/10 mb-2'>
            <div className='flex items-center gap-1.5 text-[11px] font-bold font-mono text-violet-300'>
              <Zap size={13} />
              <span>Cell Mode</span>
              {cellRunStatus === 'success' && <span className='text-emerald-400 text-[10px] font-normal ml-1'>✓ {cellSuccessCount} nodes</span>}
              {cellRunStatus === 'error' && <span className='text-red-400 text-[10px] font-normal ml-1'>✗ {cellErrorCount} failed, {cellSkippedCount} skipped</span>}
              {isCellRunning && <span className='inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse ml-1' />}
            </div>
            <button
              onClick={handleCellRun}
              disabled={isCellRunning}
              className='px-3 py-1.5 rounded text-[11px] font-mono bg-violet-700/35 hover:bg-violet-700/55 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-300/30 flex items-center gap-1.5 shadow-md transition-all cursor-pointer'
            >
              {isCellRunning
                ? <><RefreshCw size={11} className="animate-spin" /> Running...</>
                : <><Zap size={11} fill="currentColor" /> Run Pipeline</>}
            </button>
          </div>

          {/* ── Compile + monolith run bar ────────────────────────────────── */}
          <div className='flex items-center justify-between shrink-0 mb-1'>
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

          {/* ── Jupyter settings + monolith run ──────────────────────────── */}
          <div className='flex items-center justify-between shrink-0 p-2 border border-foreground/20 rounded bg-black/20 mb-1'>
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
                <Play size={12} fill="currentColor" /> {isExecuting ? 'Running...' : 'Run Script'}
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mb-2 p-3 bg-black/30 border border-foreground/20 rounded flex flex-col gap-2 shrink-0">
              <label className="flex flex-col text-[10px] font-mono text-foreground/70">
                Jupyter Base URL
                <input
                  type="text"
                  value={jupyterUrl}
                  onChange={e => setJupyterUrl(e.target.value)}
                  className="mt-1 px-2 py-1 bg-black/50 border border-foreground/30 rounded text-foreground outline-none focus:border-violet-500"
                  placeholder="http://localhost:8888"
                />
              </label>
              <label className="flex flex-col text-[10px] font-mono text-foreground/70">
                Access Token (Optional)
                <input
                  type="text"
                  value={jupyterToken}
                  onChange={e => setJupyterToken(e.target.value)}
                  className="mt-1 px-2 py-1 bg-black/50 border border-foreground/30 rounded text-foreground outline-none focus:border-violet-500"
                  placeholder="Enter token..."
                />
              </label>
              {jupyterSession.kernelId && (
                <div className="text-[9px] font-mono text-foreground/40">
                  Active kernel: <span className="text-violet-400">{jupyterSession.kernelId}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Compile errors / warnings ─────────────────────────────────── */}
          {compileErrors.length > 0 && (
            <div className='p-3 rounded bg-red-900/20 border border-red-500/30 text-[11px] font-mono text-red-300 shadow-inner shrink-0 overflow-y-auto max-h-[100px] mb-1'>
              <div className='flex items-center gap-1.5 mb-2 font-bold text-[12px]'><AlertCircle size={14} /> Compile Errors</div>
              {compileErrors.map((err, i) => <div key={i} className="mb-1 leading-relaxed">- {err}</div>)}
            </div>
          )}
          {compileWarnings.length > 0 && (
            <div className='p-2 rounded bg-amber-900/20 border border-amber-500/30 text-[11px] font-mono text-amber-200 shadow-inner shrink-0 overflow-y-auto max-h-[80px] mb-1'>
              {compileWarnings.map((warn, i) => <div key={i} className="mb-1 leading-relaxed text-[10px]">- {warn}</div>)}
            </div>
          )}

          {/* ── Tab bar ───────────────────────────────────────────────────── */}
          <div className="flex bg-black/40 border border-foreground/20 rounded-t-lg overflow-hidden shrink-0">
            {[
              { id: 'cell', label: 'Cell Run', color: 'violet' },
              { id: 'code', label: 'Python Code', color: 'cyan' },
              { id: 'logs', label: 'Script Logs', color: 'emerald' },
              { id: 'result', label: 'Result', color: 'violet' },
            ].map(({ id, label, color }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-1.5 text-[10px] font-mono border-b-2 transition-colors ${activeTab === id ? `border-${color}-400 text-foreground bg-foreground/10` : 'border-transparent text-foreground/50 hover:bg-foreground/5'}`}
              >
                {label}
                {id === 'logs' && isExecuting && <span className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {id === 'cell' && isCellRunning && <span className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />}
              </button>
            ))}
          </div>

          {/* ── Tab content ───────────────────────────────────────────────── */}
          <div className="flex-1 border border-t-0 border-foreground/20 rounded-b-lg overflow-hidden bg-black/60 flex flex-col min-h-0 relative">

            {/* Cell Run tab */}
            {activeTab === 'cell' && (
              <div className="flex-1 w-full h-full overflow-y-auto p-2.5 font-mono text-[10px] flex flex-col">
                {cellRunLog.length === 0 && !isCellRunning ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-foreground/30">
                    <Zap size={28} className="opacity-20" />
                    <span className="italic text-[11px]">Click "Run Pipeline" to execute each node as a Jupyter cell.</span>
                  </div>
                ) : (
                  <>
                    {cellRunLog.map((entry) => (
                      <CellLogGroup
                        key={entry.nodeId}
                        nodeId={entry.nodeId}
                        nodeLabel={entry.nodeLabel}
                        nodeType={entry.nodeType}
                        status={entry.status}
                        logs={entry.logs}
                        error={entry.error}
                      />
                    ))}
                    {cellRunStatus && !isCellRunning && (
                      <div className={`mt-2 p-2 rounded text-[11px] font-bold font-mono text-center ${cellRunStatus === 'success' ? 'text-emerald-400 bg-emerald-900/20 border border-emerald-500/30' : 'text-red-400 bg-red-900/20 border border-red-500/30'}`}>
                        {cellRunStatus === 'success' ? `✓ Pipeline complete — ${cellSuccessCount} nodes executed` : `✗ Pipeline failed — ${cellErrorCount} error(s), ${cellSkippedCount} skipped`}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Python Code tab */}
            {activeTab === 'code' && (
              <MonacoCodeEditor
                title='Compiled Pipeline Python'
                language='python'
                value={compiledCode || "# Pipeline not compiled yet.\n# Click 'Compile' to generate code."}
                readOnly
                height="100%"
              />
            )}

            {/* Script Logs tab */}
            {activeTab === 'logs' && (
              <div className="flex-1 w-full h-full overflow-y-auto p-3 font-mono text-[11px] whitespace-pre-wrap flex flex-col break-all">
                {executionLogs.length === 0
                  ? <span className="text-foreground/30 italic">No execution logs yet. Run the pipeline to see output.</span>
                  : executionLogs.map((log, i) => (
                    <span key={i} className={`${log.type === 'stderr' ? 'text-red-400' : log.type === 'system' ? 'text-cyan-400' : 'text-foreground/90'}`}>{log.text}</span>
                  ))
                }
                <div ref={logsEndRef} />
              </div>
            )}

            {/* Result tab */}
            {activeTab === 'result' && (
              <div className="flex-1 w-full h-full overflow-y-auto p-3 font-mono text-[11px] whitespace-pre-wrap break-all">
                {executionResult ? (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <button onClick={downloadResultJson} className="px-2 py-1 rounded text-[10px] font-mono bg-cyan-700/35 hover:bg-cyan-700/50 border border-cyan-300/30 text-foreground/90">Download JSON</button>
                      <button onClick={downloadResultCsv} disabled={!hasCsvRows} className="px-2 py-1 rounded text-[10px] font-mono bg-emerald-700/35 hover:bg-emerald-700/50 border border-emerald-300/30 text-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed">Download CSV</button>
                    </div>
                    {hasCsvRows ? (
                      <div className="overflow-auto border border-foreground/20 rounded">
                        <table className="w-full text-[10px] border-collapse">
                          <thead className="bg-foreground/10 sticky top-0">
                            <tr>{tableHeaders.map(h => <th key={h} className="text-left px-2 py-1 border-b border-foreground/20 whitespace-nowrap text-foreground/90">{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {tableRows.map((row, ri) => (
                              <tr key={ri} className="odd:bg-foreground/5">
                                {tableHeaders.map(h => <td key={`${ri}-${h}`} className="px-2 py-1 border-b border-foreground/10 align-top text-foreground/90">{row[h] == null ? '' : String(row[h])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <pre className="text-foreground/90">{JSON.stringify(executionResult, null, 2)}</pre>
                    )}
                  </>
                ) : (
                  <span className="text-foreground/30 italic">No structured result yet. Run the script mode pipeline to populate this view.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default PipelineCompilerPanel