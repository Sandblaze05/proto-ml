'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  SidebarClose, Code2, PlayCircle, AlertCircle, Terminal,
  Settings2, Play, Zap, CheckCircle2, XCircle, SkipForward,
  RefreshCw, ChevronDown, ChevronRight, FlaskConical, X, Workflow, Download,
} from 'lucide-react'
import gsap from 'gsap'
import { useUIStore } from '@/store/useUIStore'
import { useVariableStore } from '@/store/useVariableStore'
import { compileExecutionGraph } from '@/lib/executor/pipelineCompiler'
import { compilePipelineCells, compileBootstrapCell } from '@/lib/executor/nodeCellCompiler'
import { BrowserJupyterClient, extractStructuredResult } from '@/lib/executor/browserJupyterClient'
import { airflowExporter } from '@/lib/exporters/AirflowExporter'
import { buildCompilerGraphFromUI } from '@/lib/exporters/buildCompilerGraphFromUI'
import { sanitizeDagName } from '@/lib/executor/graphUtils'
import { previewClientUpload } from '@/lib/clientUploadStore'
import { RUN } from '@/lib/executor/executionContract'
import MonacoCodeEditor from './nodes/MonacoCodeEditor'

const WEIGHTS_SESSION_PREFIX = 'protoMlSessionWeights'

function getWeightsSessionKey(pathname) {
  return `${WEIGHTS_SESSION_PREFIX}:${pathname || 'canvas'}`
}

function extractWeightsArtifact(executionResult) {
  if (!executionResult || typeof executionResult !== 'object') return null

  const candidates = []
  const pushCandidate = (value, source) => {
    if (value && typeof value === 'object') candidates.push({ value, source })
  }

  pushCandidate(executionResult, 'run')
  pushCandidate(executionResult.final_output, 'final_output')
  pushCandidate(executionResult.trained_model, 'trained_model')
  pushCandidate(executionResult.final_output?.trained_model, 'final_output.trained_model')
  pushCandidate(executionResult.model, 'model')
  pushCandidate(executionResult.final_output?.model, 'final_output.model')
  pushCandidate(executionResult.artifacts, 'artifacts')
  pushCandidate(executionResult.final_output?.artifacts, 'final_output.artifacts')

  if (executionResult.leaf_outputs && typeof executionResult.leaf_outputs === 'object') {
    Object.entries(executionResult.leaf_outputs).forEach(([nodeId, nodeVal]) => {
      if (nodeVal && typeof nodeVal === 'object') {
        pushCandidate(nodeVal, `leaf:${nodeId}`)
      }
    })
  }

  for (const candidate of candidates) {
    const value = candidate.value || {}
    const modelPath = String(value.model_path || value.modelPath || '').trim()
    if (!modelPath) continue
    return {
      id: modelPath,
      label: 'Weights file',
      fileName: 'model.joblib',
      modelPath,
      source: candidate.source,
      createdAt: new Date().toISOString(),
    }
  }

  return null
}

function extractTrainedModel(executionResult) {
  if (!executionResult || typeof executionResult !== 'object') return null
  if (executionResult.trained_model) return executionResult.trained_model
  if (executionResult.final_output?.trained_model) return executionResult.final_output.trained_model
  if (executionResult.model) return executionResult.model
  if (executionResult.final_output?.model) return executionResult.final_output.model
  if (executionResult.leaf_outputs) {
    for (const nodeVal of Object.values(executionResult.leaf_outputs)) {
      if (nodeVal?.trained_model) return nodeVal.trained_model
      if (nodeVal?.model) return nodeVal.model
    }
  }
  return null
}

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

async function buildClientDatasetVariables(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : Object.values(graph?.nodes || {})
  const clientDatasets = {}

  for (const node of nodes) {
    if (node?.type !== 'dataset.csv') continue
    const config = node.config || {}
    const path = String(config.path || '')
    const uploadId = config.client_upload_id || (path.startsWith('client://') ? path.replace('client://', '') : '')
    if (!uploadId) continue

    const preview = await previewClientUpload(uploadId, {
      ...config,
      n: Number(config.max_train_rows || config.sample_rows || 100000),
    })
    const rows = Array.isArray(preview?.rows) ? preview.rows : []
    const metadata = preview?.metadata || {}
    const payload = {
      rows,
      data: rows,
      columns: Array.isArray(metadata.columnsList) ? metadata.columnsList : Object.keys(rows[0] || {}),
      feature_columns: Array.isArray(metadata.features) ? metadata.features : [],
      target_column: config.target_column || metadata.target || '',
      source: 'client_upload',
    }
    clientDatasets[uploadId] = payload
    clientDatasets[`client://${uploadId}`] = payload
  }

  return clientDatasets
}

function CellLogGroup({ nodeId, nodeLabel, nodeType, status, logs = [], error = null }) {
  const [expanded, setExpanded] = useState(status === 'error')
  const isExpanded = expanded || status === 'error'

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
        {isExpanded ? <ChevronDown size={12} className="text-foreground/40 shrink-0" /> : <ChevronRight size={12} className="text-foreground/40 shrink-0" />}
      </button>
      {isExpanded && (
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
            <span className="text-sm text-center px-8">Click &quot;Run Pipeline&quot; to execute nodes sequentially</span>
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

const AirflowCodePanel = ({
  airflowCode,
  airflowErrors,
  airflowFilename,
  handleExportAirflow,
  handleDownloadAirflow,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 bg-orange-950/10 border-b border-orange-500/10">
        <button
          onClick={handleExportAirflow}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-colors"
        >
          <Workflow size={14} />
          <span>Generate DAG</span>
        </button>
        <button
          onClick={handleDownloadAirflow}
          disabled={!airflowCode}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-medium text-sm transition-colors border border-foreground/20"
          title="Download Airflow DAG"
        >
          <Download size={14} />
        </button>
      </div>

      {airflowErrors.length > 0 && (
        <div className="p-2.5 m-2 rounded-lg bg-red-950/20 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-1.5 font-semibold text-xs text-red-400">
            <AlertCircle size={12} />
            <span>{airflowErrors.length} Error{airflowErrors.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-0.5">
            {airflowErrors.map((err, i) => (
              <div key={i} className="text-[10px] text-red-300/80 leading-tight">• {err}</div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <MonacoCodeEditor
          title={airflowFilename || 'Airflow DAG'}
          language="python"
          value={airflowCode || "# Click 'Generate DAG' to export as Apache Airflow"}
          readOnly
          height="100%"
        />
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

const ResultPanel = ({
  executionResult,
  downloadResultJson,
  downloadResultCsv,
  hasCsvRows,
  resultRows,
  tableHeaders,
  tableRows,
  weightsArtifact,
  downloadWeights,
}) => {
  const getMetrics = () => {
    if (!executionResult) return null;
    if (executionResult.metrics) return executionResult.metrics;
    if (executionResult.final_output?.metrics) return executionResult.final_output.metrics;
    if (executionResult.leaf_outputs) {
      for (const nodeVal of Object.values(executionResult.leaf_outputs)) {
        if (nodeVal?.metrics) return nodeVal.metrics;
      }
    }
    return null;
  };

  const getTrainedModel = () => {
    if (!executionResult) return null;
    if (executionResult.trained_model) return executionResult.trained_model;
    if (executionResult.final_output?.trained_model) return executionResult.final_output.trained_model;
    if (executionResult.leaf_outputs) {
      for (const nodeVal of Object.values(executionResult.leaf_outputs)) {
        if (nodeVal?.trained_model) return nodeVal.trained_model;
      }
    }
    return null;
  };

  const getLogsAndArtifacts = () => {
    if (!executionResult) return { logs: null, artifacts: null };
    const finalOut = executionResult.final_output || {};
    const artifacts = executionResult.artifacts || finalOut.artifacts;
    const logs = executionResult.logs || finalOut.logs;
    return { logs, artifacts };
  };

  const metrics = getMetrics();
  const model = getTrainedModel();
  const { logs, artifacts } = getLogsAndArtifacts();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3">
        {executionResult ? (
          <>
          <div className="flex gap-2 mb-3">
            <button onClick={downloadResultJson} className="px-2.5 py-1.5 rounded-md bg-cyan-700/40 hover:bg-cyan-700/60 text-xs font-medium border border-cyan-500/30">JSON</button>
            <button onClick={downloadResultCsv} disabled={!hasCsvRows} className="px-2.5 py-1.5 rounded-md bg-emerald-700/40 hover:bg-emerald-700/60 text-xs font-medium border border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed">CSV</button>
            <button
              onClick={downloadWeights}
              disabled={!weightsArtifact}
              className="px-2.5 py-1.5 rounded-md bg-amber-700/40 hover:bg-amber-700/60 text-xs font-medium border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Weights
            </button>
          </div>
            
             {(!hasCsvRows && (metrics || model || logs || artifacts)) ? (
               <div className="space-y-4">
                 {metrics && (
                   <div className="p-3 bg-violet-950/10 border border-violet-500/20 rounded-lg">
                     <h3 className="text-xs font-bold text-violet-300 font-mono mb-2 uppercase tracking-wide">Key Metrics</h3>
                     {metrics.error ? (
                       <div className="p-2 bg-red-950/20 border border-red-500/30 rounded-md text-red-300 text-xs font-mono whitespace-pre-wrap">
                         <div>{metrics.error}</div>
                         {metrics.traceback && <div className="mt-1.5 text-[10px] text-red-400/80 leading-tight">{metrics.traceback}</div>}
                       </div>
                     ) : (
                       <div className="grid grid-cols-2 gap-2">
                         {Object.entries(metrics).map(([k, v]) => (
                           <div key={k} className="p-2 bg-background/50 border border-foreground/5 rounded-md">
                             <div className="text-[10px] text-foreground/40 font-mono capitalize truncate">{k.replace('_', ' ')}</div>
                             <div className="text-sm font-bold text-violet-400 font-mono mt-0.5">{typeof v === 'number' ? v.toFixed(4) : String(v)}</div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 )}

                 {model && (
                   <div className="p-3 bg-cyan-950/10 border border-cyan-500/20 rounded-lg">
                     <h3 className="text-xs font-bold text-cyan-300 font-mono mb-2 uppercase tracking-wide">Trained Model</h3>
                     <div className="space-y-1.5 font-mono text-[11px] text-foreground/80">
                       <div><span className="text-foreground/40">Status:</span> <span className={model.trained ? "text-emerald-400 font-bold uppercase" : "text-red-400 font-bold uppercase"}>{model.trained ? 'Trained' : (model.backend === 'failed' ? 'Training Failed' : 'Initialized')}</span></div>
                       {model.epochs_run !== undefined && <div><span className="text-foreground/40">Epochs:</span> {model.epochs_run}</div>}
                       {model.seen_train_samples !== undefined && <div><span className="text-foreground/40">Seen Samples:</span> {model.seen_train_samples}</div>}
                       {model.family && <div><span className="text-foreground/40">Algorithm:</span> <span className="text-cyan-400">{model.family}</span></div>}
                       {model.target_column && <div><span className="text-foreground/40">Target Column:</span> <span className="text-amber-400">{model.target_column}</span></div>}
                       {model.model_path && <div><span className="text-foreground/40">Model File:</span> <span className="text-emerald-300">{model.model_path}</span></div>}
                     </div>
                   </div>
                 )}

                 {weightsArtifact && (
                   <div className="p-3 bg-amber-950/10 border border-amber-500/20 rounded-lg">
                     <h3 className="text-xs font-bold text-amber-300 font-mono mb-2 uppercase tracking-wide">Weights File</h3>
                     <div className="space-y-1.5 font-mono text-[11px] text-foreground/80">
                       <div><span className="text-foreground/40">File:</span> <span className="text-amber-300">model.joblib</span></div>
                       {weightsArtifact.modelPath && <div><span className="text-foreground/40">Path:</span> <span className="text-emerald-300">{weightsArtifact.modelPath}</span></div>}
                       <div className="pt-1">
                         <button
                           onClick={downloadWeights}
                           disabled={!weightsArtifact}
                           className="px-2.5 py-1.5 rounded-md bg-amber-700/40 hover:bg-amber-700/60 text-xs font-medium border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                         >
                           Download Weights
                         </button>
                         <button
                           onClick={clearWeights}
                           disabled={!weightsArtifact}
                           className="ml-2 px-2.5 py-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-xs font-medium border border-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed"
                         >
                           Clear
                         </button>
                       </div>
                     </div>
                   </div>
                 )}

                 {(logs || artifacts) && (
                   <div className="p-3 bg-emerald-950/10 border border-emerald-500/20 rounded-lg">
                     <h3 className="text-xs font-bold text-emerald-300 font-mono mb-2 uppercase tracking-wide">Run Logs & Artifacts</h3>
                     <div className="space-y-1 font-mono text-[10px] text-foreground/80 break-all">
                       {logs?.run_dir && <div><span className="text-foreground/40">Run Directory:</span> <span className="text-emerald-400/80">{logs.run_dir}</span></div>}
                       {artifacts?.artifact_dir && <div><span className="text-foreground/40">Artifact Dir:</span> <span className="text-emerald-400/80">{artifacts.artifact_dir}</span></div>}
                       {logs?.learning_rate !== undefined && <div><span className="text-foreground/40">Learning Rate:</span> {logs.learning_rate}</div>}
                       {logs?.optimizer && <div><span className="text-foreground/40">Optimizer:</span> <span className="text-cyan-300">{logs.optimizer}</span></div>}
                     </div>
                   </div>
                 )}
                 
                 <details className="mt-2 bg-foreground/5 rounded-md p-2">
                   <summary className="text-[10px] text-foreground/40 cursor-pointer font-mono font-medium hover:text-foreground/60 select-none">View raw execution result (JSON)</summary>
                   <pre className="text-[10px] text-foreground/80 whitespace-pre-wrap font-mono mt-2 pt-2 border-t border-foreground/5">{JSON.stringify(executionResult, null, 2)}</pre>
                 </details>
               </div>
             ) : (
               <div className="space-y-4">
                 {hasCsvRows && metrics && (
                   <div className="p-3 bg-violet-950/10 border border-violet-500/20 rounded-lg">
                     <h3 className="text-xs font-bold text-violet-300 font-mono mb-2 uppercase tracking-wide">Key Metrics</h3>
                     {metrics.error ? (
                       <div className="p-2 bg-red-950/20 border border-red-500/30 rounded-md text-red-300 text-xs font-mono whitespace-pre-wrap">
                         <div>{metrics.error}</div>
                         {metrics.traceback && <div className="mt-1.5 text-[10px] text-red-400/80 leading-tight">{metrics.traceback}</div>}
                       </div>
                     ) : (
                       <div className="grid grid-cols-2 gap-2">
                         {Object.entries(metrics).map(([k, v]) => (
                           <div key={k} className="p-2 bg-background/50 border border-foreground/5 rounded-md">
                             <div className="text-[10px] text-foreground/40 font-mono capitalize truncate">{k.replace('_', ' ')}</div>
                             <div className="text-sm font-bold text-violet-400 font-mono mt-0.5">{typeof v === 'number' ? v.toFixed(4) : String(v)}</div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 )}

                 {hasCsvRows && (
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
                 )}

                 {!hasCsvRows && !metrics && !model && !logs && !artifacts && (
                   <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{JSON.stringify(executionResult, null, 2)}</pre>
                 )}

                 {!hasCsvRows && (model || logs || artifacts) && (
                   <>
                     {model && (
                       <div className="p-3 bg-cyan-950/10 border border-cyan-500/20 rounded-lg">
                         <h3 className="text-xs font-bold text-cyan-300 font-mono mb-2 uppercase tracking-wide">Trained Model</h3>
                         <div className="space-y-1.5 font-mono text-[11px] text-foreground/80">
                           <div><span className="text-foreground/40">Status:</span> <span className={model.trained ? "text-emerald-400 font-bold uppercase" : "text-red-400 font-bold uppercase"}>{model.trained ? 'Trained' : (model.backend === 'failed' ? 'Training Failed' : 'Initialized')}</span></div>
                           {model.epochs_run !== undefined && <div><span className="text-foreground/40">Epochs:</span> {model.epochs_run}</div>}
                           {model.seen_train_samples !== undefined && <div><span className="text-foreground/40">Seen Samples:</span> {model.seen_train_samples}</div>}
                           {model.family && <div><span className="text-foreground/40">Algorithm:</span> <span className="text-cyan-400">{model.family}</span></div>}
                           {model.target_column && <div><span className="text-foreground/40">Target Column:</span> <span className="text-amber-400">{model.target_column}</span></div>}
                           {model.model_path && <div><span className="text-foreground/40">Model File:</span> <span className="text-emerald-300">{model.model_path}</span></div>}
                     </div>
                   </div>
                 )}

                 {weightsArtifact && (
                   <div className="p-3 bg-amber-950/10 border border-amber-500/20 rounded-lg">
                     <h3 className="text-xs font-bold text-amber-300 font-mono mb-2 uppercase tracking-wide">Weights File</h3>
                     <div className="space-y-1.5 font-mono text-[11px] text-foreground/80">
                       <div><span className="text-foreground/40">File:</span> <span className="text-amber-300">model.joblib</span></div>
                       {weightsArtifact.modelPath && <div><span className="text-foreground/40">Path:</span> <span className="text-emerald-300">{weightsArtifact.modelPath}</span></div>}
                       <div className="pt-1">
                         <button
                           onClick={downloadWeights}
                           disabled={!weightsArtifact}
                           className="px-2.5 py-1.5 rounded-md bg-amber-700/40 hover:bg-amber-700/60 text-xs font-medium border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                         >
                           Download Weights
                         </button>
                         <button
                           onClick={clearWeights}
                           disabled={!weightsArtifact}
                           className="ml-2 px-2.5 py-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-xs font-medium border border-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed"
                         >
                           Clear
                         </button>
                       </div>
                     </div>
                   </div>
                 )}

                 {(logs || artifacts) && (
                   <div className="p-3 bg-emerald-950/10 border border-emerald-500/20 rounded-lg">
                         <h3 className="text-xs font-bold text-emerald-300 font-mono mb-2 uppercase tracking-wide">Run Logs & Artifacts</h3>
                         <div className="space-y-1 font-mono text-[10px] text-foreground/80 break-all">
                           {logs?.run_dir && <div><span className="text-foreground/40">Run Directory:</span> <span className="text-emerald-400/80">{logs.run_dir}</span></div>}
                           {artifacts?.artifact_dir && <div><span className="text-foreground/40">Artifact Dir:</span> <span className="text-emerald-400/80">{artifacts.artifact_dir}</span></div>}
                           {logs?.learning_rate !== undefined && <div><span className="text-foreground/40">Learning Rate:</span> {logs.learning_rate}</div>}
                           {logs?.optimizer && <div><span className="text-foreground/40">Optimizer:</span> <span className="text-cyan-300">{logs.optimizer}</span></div>}
                         </div>
                       </div>
                     )}
                   </>
                 )}

                 <details className="mt-2 bg-foreground/5 rounded-md p-2">
                   <summary className="text-[10px] text-foreground/40 cursor-pointer font-mono font-medium hover:text-foreground/60 select-none">View raw execution result (JSON)</summary>
                   <pre className="text-[10px] text-foreground/80 whitespace-pre-wrap font-mono mt-2 pt-2 border-t border-foreground/5">{JSON.stringify(executionResult, null, 2)}</pre>
                 </details>
               </div>
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

const ArtifactSidebar = ({
  panelOpen,
  setPanelOpen,
  artifacts = [],
  onDownloadArtifact,
  onDownloadAll,
  onClearArtifacts,
}) => {
  return (
    <>
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="group z-[160] fixed top-[126px] right-0 flex items-center h-10 bg-background/90 backdrop-blur-md border border-r-0 border-foreground/20 rounded-l-lg shadow-lg cursor-pointer hover:bg-foreground/10 transition-all duration-300 overflow-hidden w-10 hover:w-32"
          aria-label="Open Artifacts"
        >
          <div className="flex items-center pl-3 w-32 whitespace-nowrap">
            <Download size={18} className="shrink-0 text-foreground/80" />
            <span className="ml-2 font-semibold text-sm text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Artifacts
            </span>
          </div>
        </button>
      )}

      {panelOpen && (
        <div className="z-[160] flex flex-col fixed right-0 top-16 bottom-6 w-[320px] rounded-2xl bg-background border border-foreground/20 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 bg-foreground/5 border-b border-foreground/10">
            <div className="flex items-center gap-2">
              <Download size={18} className="text-amber-400" />
              <h1 className="text-base font-bold text-foreground">Artifacts</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onDownloadAll}
                disabled={artifacts.length === 0}
                className="px-2.5 py-1.5 rounded-md bg-amber-700/30 hover:bg-amber-700/50 text-xs font-medium border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Download artifact manifest"
              >
                Manifest
              </button>
              <button
                onClick={onClearArtifacts}
                disabled={artifacts.length === 0}
                className="px-2.5 py-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-xs font-medium border border-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Clear session artifacts"
              >
                Clear
              </button>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1.5 hover:bg-foreground/10 rounded-md transition-colors"
              >
                <SidebarClose size={18} className="text-foreground/60" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {artifacts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-foreground/30 text-center px-8">
                <Download size={32} className="opacity-20" />
                <div className="text-sm leading-relaxed">
                  Run a pipeline to collect session artifacts here.
                </div>
              </div>
            ) : (
              artifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{artifact.label}</div>
                      <div className="text-[10px] font-mono uppercase tracking-wide text-foreground/40 mt-1">
                        {artifact.kind}
                        {artifact.sourceNodeId ? ` · ${artifact.sourceNodeId}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[10px] font-mono text-foreground/50">
                      session
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onDownloadArtifact(artifact, 'json')}
                      className="px-2.5 py-1.5 rounded-md bg-cyan-700/30 hover:bg-cyan-700/50 text-xs font-medium border border-cyan-500/30"
                    >
                      JSON
                    </button>
                    {artifact.kind === 'rows' && (
                      <button
                        onClick={() => onDownloadArtifact(artifact, 'csv')}
                        className="px-2.5 py-1.5 rounded-md bg-emerald-700/30 hover:bg-emerald-700/50 text-xs font-medium border border-emerald-500/30"
                      >
                        CSV
                      </button>
                    )}
                    {artifact.kind === 'text' && (
                      <button
                        onClick={() => onDownloadArtifact(artifact, 'txt')}
                        className="px-2.5 py-1.5 rounded-md bg-violet-700/30 hover:bg-violet-700/50 text-xs font-medium border border-violet-500/30"
                      >
                        TXT
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}

const PipelineCompilerPanel = () => {
  const panelRef = useRef(null)
  const logsEndRef = useRef(null)
  const pathname = usePathname()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelHover, setPanelHover] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [compiledCode, setCompiledCode] = useState('')
  const [compileErrors, setCompileErrors] = useState([])
  const [compileWarnings, setCompileWarnings] = useState([])
  const [compileMeta, setCompileMeta] = useState(null)
  const [validationMode, setValidationMode] = useState('strict')

  const [airflowCode, setAirflowCode] = useState('')
  const [airflowErrors, setAirflowErrors] = useState([])
  const [airflowFilename, setAirflowFilename] = useState('')

  const [activePanel, setActivePanel] = useState('cell')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionLogs, setExecutionLogs] = useState([])
  const [executionResult, setExecutionResult] = useState(null)
  const [weightsArtifact, setWeightsArtifact] = useState(null)
  const weightsSessionKey = getWeightsSessionKey(pathname)

  const jupyterSession = useUIStore(s => s.jupyterSession)
  const setJupyterSession = useUIStore(s => s.setJupyterSession)
  const setNodeExecutionState = useUIStore(s => s.setNodeExecutionState)
  const clearNodeExecutionStates = useUIStore(s => s.clearNodeExecutionStates)
  const hydrateUI = useUIStore(s => s.hydrateUI)

  // Hydrate UI settings on mount
  useEffect(() => {
    hydrateUI()
  }, [hydrateUI])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(weightsSessionKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.weightsArtifact?.modelPath) {
        setWeightsArtifact(parsed.weightsArtifact)
      }
    } catch {
      // Ignore malformed session data.
    }
  }, [weightsSessionKey])

  useEffect(() => {
    if (executionResult === null || executionResult === undefined) return
    const model = extractTrainedModel(executionResult)
    const weights = model?.model_path ? extractWeightsArtifact({ ...executionResult, trained_model: model }) : null
    setWeightsArtifact(weights)
  }, [executionResult])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (weightsArtifact) {
        window.sessionStorage.setItem(weightsSessionKey, JSON.stringify({
          updatedAt: new Date().toISOString(),
          weightsArtifact,
        }))
      } else {
        window.sessionStorage.removeItem(weightsSessionKey)
      }
    } catch {
      // Session storage may be unavailable or full.
    }
  }, [weightsArtifact, weightsSessionKey])

  const jupyterUrl = jupyterSession.url
  const jupyterToken = jupyterSession.token
  const allowInsecure = jupyterSession.allowInsecure
  const setJupyterUrl = (url) => setJupyterSession({ url })
  const setJupyterToken = (token) => setJupyterSession({ token })
  const setAllowInsecure = (val) => setJupyterSession({ allowInsecure: val })

  const [isCellRunning, setIsCellRunning] = useState(false)
  const [cellRunLog, setCellRunLog] = useState([])
  const [cellRunStatus, setCellRunStatus] = useState(null)
  const [cellNodeOrder, setCellNodeOrder] = useState([])

  const uiNodes = useUIStore(s => s.nodes)
  const uiEdges = useUIStore(s => s.edges)
  const draftPipelineName = useUIStore(s => s.draftPipelineName)
  const addToast = useUIStore(s => s.addToast)

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

  const getCompilerGraph = useCallback(
    () => buildCompilerGraphFromUI(uiNodes, uiEdges),
    [uiNodes, uiEdges],
  )

  const handleCompile = useCallback(() => {
    const uiGraph = getCompilerGraph()
    const result = compileExecutionGraph(uiGraph, { validationMode })
    setCompiledCode(result.code || '')
    setCompileErrors(result.errors || [])
    setCompileWarnings(result.warnings || [])
    setCompileMeta(result.metadata || null)
    setActivePanel('code')
  }, [getCompilerGraph, validationMode])

  const handleExportAirflow = useCallback(() => {
    const uiGraph = getCompilerGraph()
    const dagName = sanitizeDagName(draftPipelineName || 'proto_ml_pipeline')
    const result = airflowExporter.export(uiGraph, { dagName })

    if (!result.ok) {
      setAirflowCode('')
      setAirflowFilename('')
      setAirflowErrors(result.errors || ['Failed to generate Airflow DAG'])
      setActivePanel('airflow')
      addToast(result.errors?.[0] || 'Failed to generate Airflow DAG', 'error')
      return
    }

    setAirflowCode(result.code)
    setAirflowErrors([])
    setAirflowFilename(result.filename)
    setActivePanel('airflow')
    addToast(`Airflow DAG generated (${result.filename})`, 'success')
  }, [getCompilerGraph, draftPipelineName, addToast])

  const handleExecute = useCallback(async () => {
    if (!compiledCode) return
    setIsExecuting(true)
    setExecutionLogs([])
    setExecutionResult(null)

    const uiGraph = getCompilerGraph()
    const targetNodeId = uiGraph.nodes?.[uiGraph.nodes.length - 1]?.id || 'target'

    if (jupyterUrl && jupyterUrl.trim()) {
      try {
        const client = new BrowserJupyterClient(jupyterUrl, jupyterToken, { allowInsecure })
        const logs = [
          { type: 'system', text: `Connecting to Jupyter at ${jupyterUrl}...\n` },
          { type: 'system', text: 'Starting kernel via API proxy...\n' },
        ]
        setExecutionLogs(logs)

        const kernelId = await client.startKernel({ fresh: false })
        setJupyterSession({ kernelId })
        
        const variables = useVariableStore.getState().getVariablesAsObject()
        const varCode = Object.entries(variables)
          .map(([name, value]) => `${name} = ${typeof value === 'number' || !isNaN(value) ? value : `'${value}'`}`)
          .join('\n')
        if (varCode) await client.executeCode(kernelId, varCode)

        logs.push({ type: 'system', text: `Executing compiled pipeline on kernel ${kernelId}...\n${'-'.repeat(40)}\n` })
        setExecutionLogs([...logs])

        const execution = await client.executeCode(kernelId, compiledCode)
        const allLogs = [
          ...logs,
          ...execution.logs,
          {
            type: execution.status === 'ok' ? 'system' : 'stderr',
            text: `\n${'-'.repeat(40)}\nExecution finished with status: ${execution.status}`,
          },
        ]
        setExecutionLogs(allLogs)
        setExecutionResult(extractStructuredResult(allLogs))

        if (execution.status !== 'ok') {
          throw new Error(`Execution failed with status: ${execution.status}`)
        }
        setIsExecuting(false)
        return
      } catch (err) {
        setExecutionLogs(prev => [...prev, { type: 'stderr', text: `[Jupyter connection failed]: ${String(err?.message || err)}. Executing via Local Python Process...\n` }])
      }
    }

    try {
      const logs = [
        { type: 'system', text: 'Executing compiled pipeline via Local Python Process...\n' },
      ]
      setExecutionLogs(logs)

      const res = await fetch('/api/graph/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: uiGraph,
          targetNodeId,
          mode: RUN,
          validationMode,
        }),
      })

      const data = await res.json()

      if (data.execution?.stdout) {
        logs.push({ type: 'stdout', text: data.execution.stdout })
      }
      if (data.execution?.stderr) {
        logs.push({ type: 'stderr', text: data.execution.stderr })
      }

      logs.push({
        type: data.ok ? 'system' : 'stderr',
        text: `\n${'-'.repeat(40)}\nLocal Python execution finished. Status: ${data.ok ? 'succeeded' : 'failed'}`,
      })

      setExecutionLogs([...logs])
      if (data.execution?.output) {
        setExecutionResult(data.execution.output)
      } else if (data.execution?.error) {
        setExecutionResult({ metrics: { error: data.execution.error } })
      }
    } catch (err) {
      setExecutionLogs(prev => [...prev, { type: 'stderr', text: `\n[Fatal Error]: ${String(err?.message || err)}` }])
    } finally {
      setIsExecuting(false)
    }
  }, [compiledCode, jupyterUrl, jupyterToken, allowInsecure, setJupyterSession, getCompilerGraph, validationMode])

  const handleCellRun = useCallback(async () => {
    if (isCellRunning) return
    setIsCellRunning(true)
    setCellRunStatus('running')
    clearNodeExecutionStates()

    const graph = getCompilerGraph()
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
      const client = new BrowserJupyterClient(jupyterUrl, jupyterToken, { allowInsecure })
      kernelId = await client.startKernel({ fresh: true })
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
      const client = new BrowserJupyterClient(jupyterUrl, jupyterToken, { allowInsecure })
      const variables = {
        ...useVariableStore.getState().getVariablesAsObject(),
        __pml_client_datasets: await buildClientDatasetVariables(graph),
      }
      const bootstrapCode = compileBootstrapCell(variables)
      const bootstrap = await client.executeCode(kernelId, bootstrapCode, { username: 'proto-ml-bootstrap' })
      if (bootstrap.status !== 'ok') {
        const stderr = bootstrap.logs.filter(log => log.type === 'stderr').map(log => log.text).join('\n')
        throw new Error(stderr || 'Bootstrap failed')
      }
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

    const client = new BrowserJupyterClient(jupyterUrl, jupyterToken, { allowInsecure })

    for (let i = 0; i < order.length; i++) {
      const { nodeId, node, code } = order[i]
      const nodeLabel = node?.label || node?.type || nodeId

      setCellRunLog(prev => prev.map(e => e.nodeId === nodeId ? { ...e, status: 'running' } : e))
      setNodeExecutionState(nodeId, { status: 'running', startedAt: Date.now(), logs: [], error: null })

      try {
        const data = await client.executeCode(kernelId, code, { username: `proto-ml-node-${nodeId}` })

        const nodeLogs = Array.isArray(data.logs) ? data.logs : []
        const nodeError = data.status !== 'ok'
          ? (nodeLogs.filter(log => log.type === 'stderr').map(log => log.text).join('\n') || `Cell execution failed with status: ${data.status}`)
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
    isCellRunning, getCompilerGraph, clearNodeExecutionStates,
    setNodeExecutionState, jupyterUrl, jupyterToken, allowInsecure, setJupyterSession,
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

  const handleDownloadAirflow = useCallback(() => {
    if (!airflowCode) return
    triggerDownload(airflowFilename || 'proto_ml_pipeline_airflow_dag.py', 'text/x-python;charset=utf-8', airflowCode)
    addToast(`Downloaded ${airflowFilename || 'Airflow DAG'}`, 'success')
  }, [airflowCode, airflowFilename, addToast])

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

  const downloadWeights = useCallback(async () => {
    if (!weightsArtifact?.modelPath) return
    try {
      const res = await fetch(`/api/artifacts/download?path=${encodeURIComponent(weightsArtifact.modelPath)}`)
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = weightsArtifact.fileName || 'model.joblib'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      addToast('Downloaded model weights', 'success')
    } catch (err) {
      addToast(`Failed to download weights: ${String(err?.message || err)}`, 'error')
    }
  }, [weightsArtifact, addToast])

  const clearWeights = useCallback(() => {
    setWeightsArtifact(null)
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(weightsSessionKey)
      } catch {
        // Ignore storage errors.
      }
    }
  }, [weightsSessionKey])

  const getResultRows = () => {
    const candidate = executionResult
    if (!candidate) return null
    if (Array.isArray(candidate)) return candidate
    const fo = candidate.final_output
    if (fo) {
      if (Array.isArray(fo)) return fo
      if (Array.isArray(fo.rows)) return fo.rows
      if (Array.isArray(fo.data)) return fo.data
      if (Array.isArray(fo.comparison_rows)) return fo.comparison_rows
    }
    if (Array.isArray(candidate.rows)) return candidate.rows
    if (Array.isArray(candidate.data)) return candidate.data
    const lo = candidate.leaf_outputs
    if (lo && typeof lo === 'object') {
      for (const v of Object.values(lo)) {
        if (Array.isArray(v)) return v
        if (v && typeof v === 'object' && Array.isArray(v.rows)) return v.rows
        if (v && typeof v === 'object' && Array.isArray(v.comparison_rows)) return v.comparison_rows
      }
    }
    return null
  }

  const resultRows = getResultRows()
  const hasCsvRows = Array.isArray(resultRows) && resultRows.length > 0
  const tableRows = hasCsvRows ? resultRows.map((row) => (row && typeof row === 'object' ? row : { value: row })) : []
  const tableHeaders = hasCsvRows ? Array.from(new Set(tableRows.flatMap((row) => Object.keys(row)))) : []

  const panels = [
    { id: 'cell', label: 'Cell Run', icon: Zap, color: 'violet' },
    { id: 'code', label: 'Python', icon: Code2, color: 'cyan' },
    { id: 'airflow', label: 'Airflow', icon: Workflow, color: 'orange' },
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
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={allowInsecure}
                onChange={e => setAllowInsecure(e.target.checked)}
                className="w-3 h-3 rounded border-foreground/20"
              />
              <span className="text-[10px] font-medium text-foreground/70 uppercase tracking-wide">Allow Insecure (Self-signed SSL)</span>
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
              buildCompilerGraphFromUI={getCompilerGraph}
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
          {activePanel === 'airflow' && (
            <AirflowCodePanel
              airflowCode={airflowCode}
              airflowErrors={airflowErrors}
              airflowFilename={airflowFilename}
              handleExportAirflow={handleExportAirflow}
              handleDownloadAirflow={handleDownloadAirflow}
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
              weightsArtifact={weightsArtifact}
              downloadWeights={downloadWeights}
            />
          )}
        </div>
      </div>
    </>
  )
}

export default PipelineCompilerPanel
