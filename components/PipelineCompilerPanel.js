'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  SidebarClose, Code2, PlayCircle, AlertCircle, Terminal,
  Settings2, Play, Zap, CheckCircle2, XCircle, SkipForward,
  RefreshCw, ChevronDown, ChevronRight, FlaskConical, X,
} from 'lucide-react'
import gsap from 'gsap'
import { useUIStore } from '@/store/useUIStore'
import { compileExecutionGraph } from '@/lib/executor/pipelineCompiler'
import { compilePipelineCells, compileBootstrapCell } from '@/lib/executor/nodeCellCompiler'
import MonacoCodeEditor from './nodes/MonacoCodeEditor'

function NodeStatusIcon({ status, size = 10 }) {
  if (status === 'running') return (
    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ width: size, height: size }} />
  )
  if (status === 'success') return <CheckCircle2 size={size} className="text-emerald-400" />
  if (status === 'error') return <XCircle size={size} className="text-red-400" />
  if (status === 'skipped') return <SkipForward size={size} className="text-foreground/30" />
  if (status === 'idle') return <span className="w-2 h-2 rounded-full bg-foreground/20" style={{ width: size, height: size }} />
  return null
}

function CellLogGroup({ nodeId, nodeLabel, nodeType, status, logs = [], error = null }) {
  const [expanded, setExpanded] = useState(status === 'error')

  useEffect(() => {
    if (status === 'error') setExpanded(true)
  }, [status])

  const bgColor = status === 'error' ? 'bg-red-950/15' : status === 'running' ? 'bg-amber-950/10' : 'bg-foreground/5'

  return (
    <div className={`mb-1 rounded-md ${bgColor}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors rounded-md"
      >
        <NodeStatusIcon status={status} size={12} />
        <span className="flex-1 text-xs font-mono font-medium text-foreground/90 truncate">{nodeLabel || nodeId}</span>
        <span className="text-[10px] font-mono text-foreground/40 shrink-0 bg-foreground/5 px-1.5 py-0.5 rounded">{nodeType}</span>
        {expanded ? <ChevronDown size={12} className="text-foreground/40 shrink-0" /> : <ChevronRight size={12} className="text-foreground/40 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 font-mono text-[10px] space-y-1">
          {error && (
            <div className="text-red-400 whitespace-pre-wrap break-all leading-relaxed bg-red-950/20 p-2 rounded border border-red-500/20">{error}</div>
          )}
          {logs.map((log, i) => (
            <div
              key={i}
              className={`leading-relaxed whitespace-pre-wrap break-all pl-2 border-l-2 ${log.type === 'stderr' ? 'border-red-500/50 text-red-300' : log.type === 'system' ? 'border-cyan-500/50 text-cyan-400/80' : 'border-foreground/10 text-foreground/70'}`}
            >
              {log.text}
            </div>
          ))}
          {logs.length === 0 && !error && status !== 'running' && (
            <div className="text-foreground/30 italic ml-2">No output</div>
          )}
        </div>
      )}
    </div>
  )
}

const CellRunPanel = ({ 
  isCellRunning, cellRunLog, cellRunStatus, handleCellRun, 
  setNodeExecutionState, clearNodeExecutionStates, buildCompilerGraphFromUI,
  jupyterUrl, jupyterToken, setJupyterSession, clearNodeExecutionStates: _clear
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 bg-violet-950/10 border-b border-violet-500/10">
        <button
          onClick={handleCellRun}
          disabled={isCellRunning}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {isCellRunning ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Zap size={14} fill="currentColor" />
              <span>Run Pipeline</span>
            </>
          )}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">
        {cellRunLog.length === 0 && !isCellRunning ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-foreground/30">
            <Zap size={32} className="opacity-20" />
            <span className="text-sm text-center px-8">Click "Run Pipeline" to execute nodes sequentially</span>
          </div>
        ) : (
          <div className="space-y-1">
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
          </div>
        )}
        {cellRunStatus && !isCellRunning && (
          <div className={`mt-3 p-2.5 rounded-lg text-center font-semibold text-sm ${
            cellRunStatus === 'success' 
              ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-500/20' 
              : 'bg-red-950/20 text-red-400 border border-red-500/20'
          }`}>
            {cellRunStatus === 'success' 
              ? `✓ ${cellRunLog.filter(e => e.status === 'success').length} nodes executed successfully` 
              : `✗ Failed — ${cellRunLog.filter(e => e.status === 'error').length} error(s), ${cellRunLog.filter(e => e.status === 'skipped').length} skipped`
            }
          </div>
        )}
      </div>
    </div>
  )
}

const PythonCodePanel = ({ compiledCode, handleCompile, compileErrors, compileWarnings, validationMode, setValidationMode }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 bg-cyan-950/10 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <select
            value={validationMode}
            onChange={(e) => setValidationMode(e.target.value === 'relax' ? 'relax' : 'strict')}
            className="px-2 py-1 rounded text-xs bg-background border border-foreground/20 text-foreground"
          >
            <option value='strict'>Strict</option>
            <option value='relax'>Relax</option>
          </select>
        </div>
        <button
          onClick={handleCompile}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors"
        >
          <PlayCircle size={14} />
          <span>Compile</span>
        </button>
      </div>

      {compileErrors.length > 0 && (
        <div className="p-2.5 m-2 rounded-lg bg-red-950/20 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-1.5 font-semibold text-xs text-red-400">
            <AlertCircle size={12} />
            <span>{compileErrors.length} Error{compileErrors.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-0.5">
            {compileErrors.slice(0, 3).map((err, i) => (
              <div key={i} className="text-[10px] text-red-300/80 leading-tight">• {err}</div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <MonacoCodeEditor
          title='Compiled Python'
          language='python'
          value={compiledCode || "# Click 'Compile' to generate code"}
          readOnly
          height="100%"
        />
      </div>
    </div>
  )
}

const LogsPanel = ({ isExecuting, executionLogs, handleExecute, compiledCode, compileErrors }) => {
  const logsEndRef = useRef(null)

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [executionLogs])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 bg-emerald-950/10 border-b border-emerald-500/10">
        <button
          onClick={handleExecute}
          disabled={isExecuting || !compiledCode || compileErrors.length > 0}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {isExecuting ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              <span>Run Script</span>
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs whitespace-pre-wrap break-all">
        {executionLogs.length === 0
          ? <span className="text-foreground/30 italic">Run script to see output</span>
          : executionLogs.map((log, i) => (
            <span key={i} className={`${log.type === 'stderr' ? 'text-red-400' : log.type === 'system' ? 'text-cyan-400' : 'text-foreground/80'}`}>{log.text}</span>
          ))
        }
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

const ResultPanel = ({ executionResult, downloadResultJson, downloadResultCsv, hasCsvRows, resultRows, tableHeaders, tableRows }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3">
        {executionResult ? (
          <>
            <div className="flex gap-2 mb-3">
              <button onClick={downloadResultJson} className="px-2.5 py-1.5 rounded-md bg-cyan-700/40 hover:bg-cyan-700/60 text-xs font-medium border border-cyan-500/30">JSON</button>
              <button onClick={downloadResultCsv} disabled={!hasCsvRows} className="px-2.5 py-1.5 rounded-md bg-emerald-700/40 hover:bg-emerald-700/60 text-xs font-medium border border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed">CSV</button>
            </div>
            {hasCsvRows ? (
              <div className="overflow-auto rounded-lg border border-foreground/10">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-foreground/5 sticky top-0">
                    <tr>{tableHeaders.map(h => <th key={h} className="text-left px-2 py-1.5 border-b border-foreground/10 font-medium text-foreground/70">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, ri) => (
                      <tr key={ri} className="odd:bg-foreground/5/30">
                        {tableHeaders.map(h => <td key={`${ri}-${h}`} className="px-2 py-1.5 border-b border-foreground/5 text-foreground/80">{row[h] == null ? '—' : String(row[h])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{JSON.stringify(executionResult, null, 2)}</pre>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-foreground/30">
            <FlaskConical size={32} className="opacity-20" />
            <span className="text-sm text-center px-8">Run script to see results</span>
          </div>
        )}
      </div>
    </div>
  )
}

const PipelineCompilerPanel = () => {
  const panelRef = useRef(null)
  const logsEndRef = useRef(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelHover, setPanelHover] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [compiledCode, setCompiledCode] = useState('')
  const [compileErrors, setCompileErrors] = useState([])
  const [compileWarnings, setCompileWarnings] = useState([])
  const [compileMeta, setCompileMeta] = useState(null)
  const [validationMode, setValidationMode] = useState('strict')

  const [activePanel, setActivePanel] = useState('cell')

  const jupyterSession = useUIStore(s => s.jupyterSession)
  const setJupyterSession = useUIStore(s => s.setJupyterSession)
  const setNodeExecutionState = useUIStore(s => s.setNodeExecutionState)
  const clearNodeExecutionStates = useUIStore(s => s.clearNodeExecutionStates)

  const jupyterUrl = jupyterSession.url
  const jupyterToken = jupyterSession.token
  const setJupyterUrl = (url) => setJupyterSession({ url })
  const setJupyterToken = (token) => setJupyterSession({ token })

  const [isExecuting, setIsExecuting] = useState(false)
  const [executionLogs, setExecutionLogs] = useState([])
  const [executionResult, setExecutionResult] = useState(null)

  const [isCellRunning, setIsCellRunning] = useState(false)
  const [cellRunLog, setCellRunLog] = useState([])
  const [cellRunStatus, setCellRunStatus] = useState(null)
  const [cellNodeOrder, setCellNodeOrder] = useState([])

  const uiNodes = useUIStore(s => s.nodes)
  const uiEdges = useUIStore(s => s.edges)

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

  const NON_COMPILABLE_TYPES = ['annotationNode', 'shapeNode']

  const buildCompilerGraphFromUI = useCallback(() => {
    const filteredNodes = (uiNodes || []).filter(n => !NON_COMPILABLE_TYPES.includes(n.type))
    
    const nodesById = filteredNodes.reduce((acc, node) => {
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
    })).filter(e => nodesById[e.source] && nodesById[e.target])

    return { nodes: nodesById, edges: normalizedEdges }
  }, [uiNodes, uiEdges])

  const handleCompile = useCallback(() => {
    const uiGraph = buildCompilerGraphFromUI()
    const result = compileExecutionGraph(uiGraph, { validationMode })
    setCompiledCode(result.code || '')
    setCompileErrors(result.errors || [])
    setCompileWarnings(result.warnings || [])
    setCompileMeta(result.metadata || null)
    setActivePanel('code')
  }, [buildCompilerGraphFromUI, validationMode])

  const handleExecute = useCallback(async () => {
    if (!compiledCode) return
    setIsExecuting(true)
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
    } catch (err) {
      setExecutionLogs(prev => [...prev, { type: 'stderr', text: `\n[Fatal Error]: ${String(err?.message || err)}` }])
    } finally {
      setIsExecuting(false)
    }
  }, [compiledCode, jupyterUrl, jupyterToken])

  const handleCellRun = useCallback(async () => {
    if (isCellRunning) return
    setIsCellRunning(true)
    setCellRunStatus('running')
    clearNodeExecutionStates()

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

    order.forEach(({ nodeId }) => setNodeExecutionState(nodeId, { status: 'idle', logs: [], error: null }))

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

    let overallOk = true

    for (let i = 0; i < order.length; i++) {
      const { nodeId, node, code } = order[i]
      const nodeLabel = node?.label || node?.type || nodeId

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

  const getResultRows = () => {
    const candidate = executionResult
    if (!candidate) return null
    if (Array.isArray(candidate)) return candidate
    if (Array.isArray(candidate.final_output)) return candidate.final_output
    if (Array.isArray(candidate.rows)) return candidate.rows
    if (Array.isArray(candidate.data)) return candidate.data
    return null
  }

  const resultRows = getResultRows()
  const hasCsvRows = Array.isArray(resultRows) && resultRows.length > 0
  const tableRows = hasCsvRows ? resultRows.map((row) => (row && typeof row === 'object' ? row : { value: row })) : []
  const tableHeaders = hasCsvRows ? Array.from(new Set(tableRows.flatMap((row) => Object.keys(row)))) : []

  const panels = [
    { id: 'cell', label: 'Cell Run', icon: Zap, color: 'violet' },
    { id: 'code', label: 'Python', icon: Code2, color: 'cyan' },
    { id: 'logs', label: 'Logs', icon: Terminal, color: 'emerald' },
    { id: 'result', label: 'Result', icon: FlaskConical, color: 'amber' },
  ]

  return (
    <>
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="group z-[150] fixed top-[80px] right-0 flex items-center h-10 bg-background/90 backdrop-blur-md border border-r-0 border-foreground rounded-l-lg shadow-lg cursor-pointer hover:bg-foreground/10 transition-all duration-300 overflow-hidden w-10 hover:w-28"
          aria-label="Open Compiler"
        >
          <div className="flex items-center pl-3 w-28 whitespace-nowrap">
            <Code2 size={18} className="shrink-0 text-foreground" />
            <span className="ml-2 font-semibold text-sm text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Compiler
            </span>
          </div>
        </button>
      )}

      <div
        ref={panelRef}
        onMouseEnter={() => setPanelHover(true)}
        onMouseLeave={() => setPanelHover(false)}
        className={`z-[150] flex flex-col fixed right-3 top-16 bottom-6 w-[380px] rounded-2xl bg-background border border-foreground/20 overflow-hidden shadow-2xl ${panelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-foreground/5 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-cyan-400" />
            <h1 className="text-base font-bold text-foreground">Compiler</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-foreground/20 text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-foreground/10'}`}
            >
              <Settings2 size={16} />
            </button>
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1.5 hover:bg-foreground/10 rounded-md transition-colors"
            >
              <SidebarClose size={18} className="text-foreground/60" />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="p-3 bg-foreground/[0.02] border-b border-foreground/5 flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-foreground/50 uppercase tracking-wide">Jupyter URL</span>
              <input
                type="text"
                value={jupyterUrl}
                onChange={e => setJupyterUrl(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-foreground/20 rounded-md text-sm text-foreground outline-none focus:border-cyan-500"
                placeholder="http://localhost:8888"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-foreground/50 uppercase tracking-wide">Access Token</span>
              <input
                type="text"
                value={jupyterToken}
                onChange={e => setJupyterToken(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-foreground/20 rounded-md text-sm text-foreground outline-none focus:border-cyan-500"
                placeholder="Optional"
              />
            </label>
            {jupyterSession.kernelId && (
              <div className="text-[10px] text-foreground/40">
                Active kernel: <span className="text-violet-400">{jupyterSession.kernelId}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex bg-foreground/5 border-b border-foreground/10">
          {panels.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 text-[10px] font-medium border-b-2 transition-all ${
                activePanel === id 
                  ? `border-${color}-400 text-foreground bg-background/50` 
                  : 'border-transparent text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5'
              }`}
            >
              <Icon size={14} className="mb-1" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activePanel === 'cell' && (
            <CellRunPanel
              isCellRunning={isCellRunning}
              cellRunLog={cellRunLog}
              cellRunStatus={cellRunStatus}
              handleCellRun={handleCellRun}
              setNodeExecutionState={setNodeExecutionState}
              clearNodeExecutionStates={clearNodeExecutionStates}
              buildCompilerGraphFromUI={buildCompilerGraphFromUI}
              jupyterUrl={jupyterUrl}
              jupyterToken={jupyterToken}
              setJupyterSession={setJupyterSession}
            />
          )}
          {activePanel === 'code' && (
            <PythonCodePanel
              compiledCode={compiledCode}
              handleCompile={handleCompile}
              compileErrors={compileErrors}
              compileWarnings={compileWarnings}
              validationMode={validationMode}
              setValidationMode={setValidationMode}
            />
          )}
          {activePanel === 'logs' && (
            <LogsPanel
              isExecuting={isExecuting}
              executionLogs={executionLogs}
              handleExecute={handleExecute}
              compiledCode={compiledCode}
              compileErrors={compileErrors}
            />
          )}
          {activePanel === 'result' && (
            <ResultPanel
              executionResult={executionResult}
              downloadResultJson={downloadResultJson}
              downloadResultCsv={downloadResultCsv}
              hasCsvRows={hasCsvRows}
              resultRows={resultRows}
              tableHeaders={tableHeaders}
              tableRows={tableRows}
            />
          )}
        </div>
      </div>
    </>
  )
}

export default PipelineCompilerPanel