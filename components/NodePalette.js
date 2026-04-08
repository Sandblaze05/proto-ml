'use client';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Database, ImageIcon, FileText, Braces, Globe, Table,
  ToyBrick, Activity, GitBranchPlus, PackageOpen, BrainCircuit,
  Plus, ChevronDown, ChevronRight,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useUIStore } from '@/store/useUIStore';
import { useExecutionStore } from '@/store/useExecutionStore';
import { listNodeDefs } from '@/nodes/nodeRegistry';
import { generateDatasetPythonCode } from '@/lib/pythonTemplates/datasetNodeTemplate';
import { generateTransformPythonCode } from '@/lib/pythonTemplates/transformNodeTemplate';
import { generateLifecyclePythonCode } from '@/lib/pythonTemplates/lifecycleNodeTemplate';
import { BUILTIN_PIPELINE_TEMPLATES } from '@/lib/templates/builtinTemplates';
import { instantiatePipelineTemplate } from '@/lib/templates/pipelineTemplateService';
import { applyTemplateGraphToStores } from '@/lib/templates/applyTemplateToStores';
import { bootstrapClientPlugins } from '@/lib/plugins/clientPluginBootstrap';

// ── Icon map for dataset node types ──────────────────────────────────────────
const TYPE_ICON_MAP = {
  'dataset.image': ImageIcon,
  'dataset.csv': Table,
  'dataset.text': FileText,
  'dataset.json': Braces,
  'dataset.database': Database,
  'dataset.api': Globe,
};

const TYPE_COLOR_MAP = {
  'dataset.image': '#c084fc',
  'dataset.csv': '#34d399',
  'dataset.text': '#60a5fa',
  'dataset.json': '#fbbf24',
  'dataset.database': '#f87171',
  'dataset.api': '#a78bfa',
};

const TRANSFORM_ICON_MAP = {
  image: ImageIcon,
  tabular: Table,
  text: FileText,
  control: Activity,
  programming: GitBranchPlus,
  pipeline: ToyBrick,
  'data-ops': Database,
  core: ToyBrick,
};

const LIFECYCLE_ICON_MAP = {
  'data-control': GitBranchPlus,
  modeling: BrainCircuit,
  'training-config': PackageOpen,
  'training-execution': Activity,
  'core-workflow': Activity,
};

function buildNodeEntry(def) {
  const kind = def?.kind;
  if (kind === 'dataset') {
    return {
      id: def.type,
      type: def.type,
      label: def.label,
      icon: TYPE_ICON_MAP[def.type] ?? Database,
      color: TYPE_COLOR_MAP[def.type] ?? '#faebd7',
      def,
    };
  }
  if (kind === 'lifecycle') {
    return {
      id: def.type,
      type: def.type,
      label: def.label,
      icon: LIFECYCLE_ICON_MAP[def.category] ?? Activity,
      color: '#f59e0b',
      def,
    };
  }
  return {
    id: def.type,
    type: def.type,
    label: def.label,
    icon: TRANSFORM_ICON_MAP[def.category] ?? ToyBrick,
    color: '#67e8f9',
    def,
  };
}

function getBehaviorHint(def, requiredInputCount) {
  if (!def) return '';

  const acceptsWildcard = Array.isArray(def.accepts) && def.accepts.includes('*');
  if (acceptsWildcard && requiredInputCount === 0) {
    return 'Flexible behavior: output depends on config and upstream payload shape.';
  }

  if (def.type === 'transform.core.map') return 'Applies row/field-level mapping rules to one stream.';
  if (def.type === 'transform.core.join') return 'Combines two streams using strategy and optional key.';
  if (def.type === 'transform.core.route') return 'Routes payload into branches based on condition/type.';
  if (String(def.type || '').startsWith('transform.image.')) return 'Applies image preprocessing/augmentation to vision inputs.';
  if (String(def.type || '').startsWith('transform.tabular.')) return 'Applies tabular preprocessing for feature preparation.';
  if (String(def.type || '').startsWith('transform.text.')) return 'Applies text normalization/token shaping before modeling.';
  if (String(def.type || '').startsWith('lifecycle.')) return 'Coordinates training lifecycle stages and model artifacts.';

  return '';
}

export function getPaletteCategories() {
  const defs = listNodeDefs();
  const datasets = defs.filter((def) => def?.kind === 'dataset').map(buildNodeEntry);
  const transforms = defs.filter((def) => def?.kind === 'transform').map(buildNodeEntry);
  const lifecycles = defs.filter((def) => def?.kind === 'lifecycle').map(buildNodeEntry);

  return [
    { name: 'Core Data', nodes: datasets },
    { name: 'Core Transform', nodes: transforms },
    { name: 'Core Lifecycle', nodes: lifecycles },
  ];
}

export function getAvailableNodes() {
  return getPaletteCategories().flatMap((category) => category.nodes);
}

// ── Palette item ──────────────────────────────────────────────────────────────
function PaletteItem({ node, isInUse }) {
  const addNode = useUIStore(s => s.addNode);
  const getVisibleCenterPosition = useUIStore(s => s.getVisibleCenterPosition);
  const addExecutionNode = useExecutionStore(s => s.addExecutionNode);
  const ghostRef = useRef(null);

  const handleAdd = () => {
    const newId = `${node.id}-${uuidv4().slice(0, 6)}`;
    const center = getVisibleCenterPosition();
    const spawnPosition = {
      x: center.x + (Math.random() - 0.5) * 40,
      y: center.y + (Math.random() - 0.5) * 40,
    };
    const isDataset = node.id.startsWith('dataset.');
    const isTransform = node.id.startsWith('transform.');
    const isLifecycle = node.id.startsWith('lifecycle.');

    if (isDataset && node.def) {
      const def = node.def;
      const initialConfig = { ...def.defaultConfig };
      const pythonCode = generateDatasetPythonCode(def.type, initialConfig);

      addNode({
        id: newId,
        type: 'datasetNode',
        position: spawnPosition,
        zIndex: 100,
        data: {
          nodeModel: {
            type: def.type,
            label: def.label,
            inputs: def.inputs.map(p => p.name),
            outputs: def.outputs.map(p => p.name),
            config: initialConfig,
            schema: { ...def.schema },
            metadata: { ...def.metadata },
            kind: 'dataset',
            pythonCode,
          },
        },
      });

      addExecutionNode(newId, {
        type: def.type,
        label: def.label,
        inputs: def.inputs.map(p => p.name),
        outputs: def.outputs.map(p => p.name),
        portMap: {
          inputs: Object.fromEntries(def.inputs.map(p => [p.name, p])),
          outputs: Object.fromEntries(def.outputs.map(p => [p.name, p])),
        },
        config: initialConfig,
        schema: { ...def.schema },
        metadata: { ...def.metadata },
        pythonCode,
      });

    } else if ((isTransform || isLifecycle) && node.def) {
      const def = node.def;
      const initialConfig = { ...(def.defaultConfig || {}) };
      const pythonCode = isLifecycle
        ? generateLifecyclePythonCode(def.type, initialConfig)
        : generateTransformPythonCode(def.type, initialConfig);

      const inputs = (def.inputs || []).map(p => p.name);
      const outputs = (def.outputs || []).map(p => p.name);

      const newNodeModel = {
        type: def.type,
        label: def.label,
        inputs,
        outputs,
        params: initialConfig,
        config: initialConfig,
        uiSchema: { ...(def.uiSchema || {}) },
        accepts: def.accepts || [],
        produces: def.produces || [],
        kind: isLifecycle ? 'lifecycle' : 'transform',
        category: def.category,
        pythonCode,
      };

      addNode({
        id: newId,
        type: 'transformNode',
        position: spawnPosition,
        zIndex: 100,
        selected: true,
        data: { nodeModel: newNodeModel },
      });

      addExecutionNode(newId, {
        type: def.type,
        label: def.label,
        inputs,
        outputs,
        config: initialConfig,
        uiSchema: { ...(def.uiSchema || {}) },
        accepts: def.accepts || [],
        produces: def.produces || [],
        kind: isLifecycle ? 'lifecycle' : 'transform',
        category: def.category,
        pythonCode,
      });

    } else {
      let inputs = [], outputs = [];
      if (['cnn', 'transformer', 'optimizer'].includes(node.id)) {
        inputs = ['data']; outputs = ['data_out'];
      }
      if (node.id === 'accuracy') { inputs = ['data']; outputs = ['score']; }

      const newNodeModel = { type: node.type, label: node.label, inputs, outputs, params: {}, execution_code: 'function() { return {} }' };

      addNode({
        id: newId,
        type: 'custom',
        position: spawnPosition,
        zIndex: 100,
        data: { nodeModel: newNodeModel },
      });

      addExecutionNode(newId, {
        type: node.type,
        inputs,
        outputs,
        config: {},
      });
    }
  };

  // ── Drag start handler ────────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    e.dataTransfer.setData('application/proto-ml-node', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'copy';

    // Custom drag ghost
    if (ghostRef.current) {
      ghostRef.current.style.display = 'flex';
      e.dataTransfer.setDragImage(ghostRef.current, 60, 18);
      // Hide it again shortly after the browser captures the ghost
      requestAnimationFrame(() => {
        if (ghostRef.current) ghostRef.current.style.display = 'none';
      });
    }
  }, [node]);

  const Icon = node.icon;
  const color = node.color ?? '#faebd7';
  const requiredInputCount = (node.def?.inputs || []).filter((port) => port?.optional !== true).length;
  const outputCount = node.def?.outputs?.length || 0;
  const acceptsSummary = Array.isArray(node.def?.accepts) && node.def.accepts.length > 0
    ? node.def.accepts.join(', ')
    : '*';
  const producesSummary = Array.isArray(node.def?.produces) && node.def.produces.length > 0
    ? node.def.produces.join(', ')
    : '*';
  const guidanceTitle = node.def
    ? `${node.label}\nRequired inputs: ${requiredInputCount}\nOutputs: ${outputCount}\nAccepts: ${acceptsSummary}\nProduces: ${producesSummary}${getBehaviorHint(node.def, requiredInputCount) ? `\nBehavior: ${getBehaviorHint(node.def, requiredInputCount)}` : ''}`
    : node.label;
  const behaviorHint = node.def ? getBehaviorHint(node.def, requiredInputCount) : '';

  return (
    <>
      {/* Hidden drag ghost element */}
      <div
        ref={ghostRef}
        style={{
          display: 'none',
          position: 'fixed',
          top: -9999,
          left: -9999,
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          background: '#1a1a1a',
          border: `1px solid ${color}66`,
          boxShadow: `0 4px 20px ${color}30, 0 0 0 1px ${color}22`,
          opacity: 0.92,
          pointerEvents: 'none',
          zIndex: 99999,
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          background: color + '30',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={11} color={color} />
        </div>
        <span style={{ fontSize: 10, color: '#faebd7cc', fontWeight: 600 }}>{node.label}</span>
      </div>

      <div
        draggable
        onDragStart={onDragStart}
        title={guidanceTitle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 8px',
          borderRadius: 6,
          background: '#111',
          border: '1px solid transparent',
          transition: 'border-color 0.15s, background 0.15s, opacity 0.2s',
          cursor: 'grab',
          opacity: isInUse ? 0.4 : 1,
          position: 'relative',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.background = color + '0d'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#111'; }}
      >
        {/* In-use indicator dot */}
        {isInUse && (
          <div style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#67e8f9',
            boxShadow: '0 0 6px #67e8f9aa',
            zIndex: 2,
          }} title="Already on canvas" />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24,
            borderRadius: 5,
            background: color + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}>
            <Icon size={13} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#faebd7cc', fontFamily: 'monospace', fontWeight: 600 }}>{node.label}</div>
            {node.def && (
              <div style={{ fontSize: 9, color: color + 'aa', fontFamily: 'monospace' }}>
                {requiredInputCount} required inputs • {outputCount} outputs
              </div>
            )}
            {node.def && (
              <div style={{ fontSize: 9, color: '#faebd780', fontFamily: 'monospace' }}>
                {`accepts ${acceptsSummary} -> produces ${producesSummary}`}
              </div>
            )}
            {behaviorHint && (
              <div style={{ fontSize: 9, color: '#faebd760', fontFamily: 'monospace' }}>
                {behaviorHint}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleAdd(); }}
          style={{
            width: 22, height: 22,
            borderRadius: 4,
            border: `1px solid ${color}44`,
            background: color + '18',
            color,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
          title={`Add ${node.label}`}
          onMouseEnter={e => { e.currentTarget.style.background = color + '35'; }}
          onMouseLeave={e => { e.currentTarget.style.background = color + '18'; }}
        >
          <Plus size={13} />
        </button>
      </div>
    </>
  );
}

function parseTemplateParameter(rawValue, type) {
  if (type === 'number') {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (type === 'boolean') {
    return rawValue === true || rawValue === 'true';
  }
  if (type && type.startsWith('array:')) {
    return String(rawValue || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return rawValue;
}

function TemplateLibrarySection() {
  const setNodes = useUIStore((state) => state.setNodes);
  const setEdges = useUIStore((state) => state.setEdges);
  const saveToHistory = useUIStore((state) => state.saveToHistory);
  const addToast = useUIStore((state) => state.addToast);
  const setExecutionGraph = useExecutionStore((state) => state.setExecutionGraph);

  const [openTemplateId, setOpenTemplateId] = useState(null);
  const [templateParams, setTemplateParams] = useState(() => {
    return BUILTIN_PIPELINE_TEMPLATES.reduce((acc, template) => {
      acc[template.id] = (template.parameters || []).reduce((params, param) => {
        params[param.name] = param.defaultValue ?? '';
        return params;
      }, {});
      return acc;
    }, {});
  });

  const updateParam = (templateId, paramName, value) => {
    setTemplateParams((prev) => ({
      ...prev,
      [templateId]: {
        ...(prev[templateId] || {}),
        [paramName]: value,
      },
    }));
  };

  const applyTemplate = (template) => {
    const values = templateParams[template.id] || {};
    const typedParams = Object.fromEntries(
      (template.parameters || []).map((param) => [
        param.name,
        parseTemplateParameter(values[param.name], param.type),
      ]),
    );

    const instantiation = instantiatePipelineTemplate(template, {
      parameters: typedParams,
    });

    if (!instantiation.ok || !instantiation.graph) {
      addToast(`Template error: ${(instantiation.errors || []).join(' ')}`, 'error');
      return;
    }

    const payload = applyTemplateGraphToStores({
      graph: instantiation.graph,
      uiStore: {
        setNodes,
        setEdges,
        saveToHistory,
      },
      executionStore: {
        setExecutionGraph,
      },
      options: {
        idPrefix: `${template.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${Date.now()}`,
      },
    });

    if ((payload.warnings || []).length > 0) {
      addToast(`Template loaded with notes: ${payload.warnings[0]}`, 'info');
    } else if ((instantiation.unresolvedParameters || []).length > 0) {
      addToast(`Template loaded, unresolved: ${instantiation.unresolvedParameters.join(', ')}`, 'info');
    } else {
      addToast(`Template loaded: ${template.name}`, 'success');
    }
  };

  return (
    <div style={{ border: '1px solid #faebd715', borderRadius: 7, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 6, background: '#0d0d0d' }}>
        {BUILTIN_PIPELINE_TEMPLATES.map((template) => {
          const isOpen = openTemplateId === template.id;
          const params = template.parameters || [];
          const values = templateParams[template.id] || {};

          return (
            <div key={template.id} style={{ border: '1px solid #faebd712', borderRadius: 6, background: '#111' }}>
              <button
                onClick={() => setOpenTemplateId(isOpen ? null : template.id)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isOpen ? '#1b1b1b' : '#111',
                  border: 'none',
                  color: '#faebd7cc',
                  cursor: 'pointer',
                }}
              >
                <span style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>{template.name}</div>
                  <div style={{ fontSize: 8, color: '#faebd755', fontFamily: 'monospace' }}>{template.id}</div>
                </span>
                {isOpen ? <ChevronDown size={12} color="#faebd777" /> : <ChevronRight size={12} color="#faebd777" />}
              </button>

              {isOpen && (
                <div style={{ padding: 8, borderTop: '1px solid #faebd710', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {params.map((param) => {
                    const value = values[param.name] ?? '';
                    const inputType = param.type === 'number' ? 'number' : 'text';
                    const placeholder = param.description || param.name;
                    const displayValue = param.type && param.type.startsWith('array:')
                      ? (Array.isArray(value) ? value.join(', ') : String(value || ''))
                      : value;

                    if (param.type === 'boolean') {
                      return (
                        <label key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#faebd799' }}>
                            {param.name}{param.required ? ' *' : ''}
                          </span>
                          <select
                            value={String(value)}
                            onChange={(e) => updateParam(template.id, param.name, e.target.value)}
                            style={{
                              background: '#0b0b0b',
                              border: '1px solid #faebd720',
                              borderRadius: 4,
                              color: '#faebd7',
                              fontFamily: 'monospace',
                              fontSize: 10,
                              padding: '5px 6px',
                            }}
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        </label>
                      );
                    }

                    return (
                      <label key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#faebd799' }}>
                          {param.name}{param.required ? ' *' : ''}
                        </span>
                        <input
                          type={inputType}
                          value={typeof displayValue === 'string' || typeof displayValue === 'number' ? displayValue : ''}
                          placeholder={placeholder}
                          onChange={(e) => updateParam(template.id, param.name, e.target.value)}
                          style={{
                            background: '#0b0b0b',
                            border: '1px solid #faebd720',
                            borderRadius: 4,
                            color: '#faebd7',
                            fontFamily: 'monospace',
                            fontSize: 10,
                            padding: '5px 6px',
                          }}
                        />
                      </label>
                    );
                  })}
                  <button
                    onClick={() => applyTemplate(template)}
                    style={{
                      marginTop: 2,
                      border: '1px solid #67e8f944',
                      background: '#67e8f91a',
                      color: '#67e8f9',
                      borderRadius: 4,
                      padding: '6px 8px',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Apply Template
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Palette root ──────────────────────────────────────────────────────────────
export default function NodePalette() {
  const [openCategory, setOpenCategory] = useState('Core Data');
  const [paletteVersion, setPaletteVersion] = useState(0);

  useEffect(() => {
    bootstrapClientPlugins()
      .then(() => setPaletteVersion((v) => v + 1))
      .catch(() => {
        // Non-fatal: palette can still use built-in nodes.
      });
  }, []);

  const categories = useMemo(() => getPaletteCategories(), [paletteVersion]);

  // Derive a set of node types currently on the canvas
  const canvasNodes = useUIStore(s => s.nodes);
  const inUseTypes = useMemo(() => {
    const set = new Set();
    canvasNodes.forEach(n => {
      const modelType = n.data?.nodeModel?.type;
      if (modelType) set.add(modelType);
    });
    return set;
  }, [canvasNodes]);

  const headingStyle = {
    fontFamily: 'monospace',
    color: '#faebd7',
    fontWeight: 700,
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid #faebd715',
    paddingBottom: 8,
  };

  return (
    <div style={{ width: '100%', marginTop: 16 }}>
      <h3 style={headingStyle}>
        Node Palette
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {categories.map(cat => (
          <div key={cat.name} style={{ border: '1px solid #faebd715', borderRadius: 7, overflow: 'hidden' }}>
            <button
              onClick={() => setOpenCategory(openCategory === cat.name ? null : cat.name)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px',
                background: openCategory === cat.name ? '#1c1c1c' : '#161616',
                border: 'none',
                color: '#faebd7cc',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                {cat.name}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: '#faebd744', fontFamily: 'monospace' }}>{cat.nodes.length}</span>
                {openCategory === cat.name
                  ? <ChevronDown size={13} color="#faebd755" />
                  : <ChevronRight size={13} color="#faebd755" />
                }
              </span>
            </button>

            {openCategory === cat.name && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: '#0d0d0d', borderTop: '1px solid #faebd710' }}>
                {cat.nodes.map(node => (
                  <PaletteItem key={node.id} node={node} isInUse={inUseTypes.has(node.type)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <h3 style={headingStyle}>
          Templates
        </h3>
        <TemplateLibrarySection />
      </div>
    </div>
  );
}
