'use client';
import React, { useState } from 'react';
import {
  Database, ImageIcon, FileText, Braces, Globe, Table,
  ToyBrick, Activity, GitBranchPlus, PackageOpen, BrainCircuit,
  Plus, ChevronDown, ChevronRight,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useUIStore } from '@/store/useUIStore';
import { useExecutionStore } from '@/store/useExecutionStore';
import { DATASET_NODES, TRANSFORM_NODES, LIFECYCLE_NODES } from '@/nodes/nodeRegistry';
import { generateDatasetPythonCode } from '@/lib/pythonTemplates/datasetNodeTemplate';
import { generateTransformPythonCode } from '@/lib/pythonTemplates/transformNodeTemplate';
import { generateLifecyclePythonCode } from '@/lib/pythonTemplates/lifecycleNodeTemplate';

// ── Icon map for dataset node types ──────────────────────────────────────────
const TYPE_ICON_MAP = {
  'dataset.image':    ImageIcon,
  'dataset.csv':      Table,
  'dataset.text':     FileText,
  'dataset.json':     Braces,
  'dataset.database': Database,
  'dataset.api':      Globe,
};

const TYPE_COLOR_MAP = {
  'dataset.image':    '#c084fc',
  'dataset.csv':      '#34d399',
  'dataset.text':     '#60a5fa',
  'dataset.json':     '#fbbf24',
  'dataset.database': '#f87171',
  'dataset.api':      '#a78bfa',
};

const TRANSFORM_ICON_MAP = {
  image: ImageIcon,
  tabular: Table,
  text: FileText,
  control: Activity,
  pipeline: ToyBrick,
  'data-ops': Database,
};

const LIFECYCLE_ICON_MAP = {
  'data-control': GitBranchPlus,
  modeling: BrainCircuit,
  'training-config': PackageOpen,
  'training-execution': Activity,
};

// ── Build palette categories ──────────────────────────────────────────────────
export const CATEGORIES = [
  {
    name: 'Data',
    nodes: DATASET_NODES.map(def => ({
      id: def.type,
      type: def.type,
      label: def.label,
      icon: TYPE_ICON_MAP[def.type] ?? Database,
      color: TYPE_COLOR_MAP[def.type] ?? '#faebd7',
      // Attach the entire definition so PaletteItem can build the execution model
      def,
    })),
  },
  {
    name: 'Transform Basic',
    nodes: TRANSFORM_NODES
      .filter(def => def.level === 1)
      .map(def => ({
        id: def.type,
        type: def.type,
        label: def.label,
        icon: TRANSFORM_ICON_MAP[def.metadata?.domain] ?? ToyBrick,
        color: '#67e8f9',
        def,
      })),
  },
  {
    name: 'Transform Advanced',
    nodes: TRANSFORM_NODES
      .filter(def => def.level === 2)
      .map(def => ({
        id: def.type,
        type: def.type,
        label: def.label,
        icon: TRANSFORM_ICON_MAP[def.category] ?? TRANSFORM_ICON_MAP[def.metadata?.domain] ?? ToyBrick,
        color: '#38bdf8',
        def,
      })),
  },
  {
    name: 'Lifecycle',
    nodes: LIFECYCLE_NODES.map(def => ({
      id: def.type,
      type: def.type,
      label: def.label,
      icon: LIFECYCLE_ICON_MAP[def.category] ?? Activity,
      color: '#f59e0b',
      def,
    })),
  },
];

// ── Palette item ──────────────────────────────────────────────────────────────
function PaletteItem({ node }) {
  const addNode          = useUIStore(s => s.addNode);
  const addExecutionNode = useExecutionStore(s => s.addExecutionNode);

  const handleAdd = () => {
    const newId = `${node.id}-${uuidv4().slice(0, 6)}`;
    const isDataset = node.id.startsWith('dataset.');
    const isTransform = node.id.startsWith('transform.');
    const isLifecycle = node.id.startsWith('lifecycle.');

    if (isDataset && node.def) {
      const def = node.def;
      const initialConfig = { ...def.defaultConfig };
      const pythonCode = generateDatasetPythonCode(def.type, initialConfig);

      // UI node — use 'datasetNode' type so InfiniteCanvas routes it to DatasetNode component
      addNode({
        id: newId,
        type: 'datasetNode',
        position: { x: 250, y: 200 + Math.random() * 60 },
        data: {
          nodeModel: {
            type: def.type,
            label: def.label,
            inputs:  def.inputs,
            outputs: def.outputs,
            config:  initialConfig,
            schema:  { ...def.schema },
            metadata: { ...def.metadata },
            pythonCode,
          },
        },
      });

      // Execution node — full typed model
      addExecutionNode(newId, {
        type:     def.type,
        label:    def.label,
        inputs:   def.inputs.map(p => p.name),
        outputs:  def.outputs.map(p => p.name),
        portMap:  {
          inputs:  Object.fromEntries(def.inputs.map(p  => [p.name, p])),
          outputs: Object.fromEntries(def.outputs.map(p => [p.name, p])),
        },
        config:   initialConfig,
        schema:   { ...def.schema },
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
        position: { x: 250, y: 200 + Math.random() * 60 },
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
      // Generic non-dataset node (Process / Model / Optimize)
      let inputs = [], outputs = [];
      if (['cnn', 'transformer', 'optimizer'].includes(node.id)) {
        inputs = ['data']; outputs = ['data_out'];
      }
      if (node.id === 'accuracy') { inputs = ['data']; outputs = ['score']; }

      const newNodeModel = { type: node.type, label: node.label, inputs, outputs, params: {}, execution_code: 'function() { return {} }' };

      addNode({
        id: newId,
        type: 'custom',
        position: { x: 250, y: 200 },
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

  const Icon  = node.icon;
  const color = node.color ?? '#faebd7';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 8px',
        borderRadius: 6,
        background: '#111',
        border: '1px solid transparent',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.background = color + '0d'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#111'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24,
          borderRadius: 5,
          background: color + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={13} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#faebd7cc', fontFamily: 'monospace', fontWeight: 600 }}>{node.label}</div>
          {node.def && (
            <div style={{ fontSize: 9, color: color + 'aa', fontFamily: 'monospace' }}>
              {node.def.outputs.length} outputs
            </div>
          )}
        </div>
      </div>
      <button
        onClick={handleAdd}
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
  );
}

// ── Palette root ──────────────────────────────────────────────────────────────
export default function NodePalette() {
  const [openCategory, setOpenCategory] = useState('Data');

  return (
    <div style={{ width: '100%', marginTop: 16 }}>
      <h3 style={{
        fontFamily: 'monospace',
        color: '#faebd7',
        fontWeight: 700,
        fontSize: 12,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        borderBottom: '1px solid #faebd715',
        paddingBottom: 8,
      }}>
        Node Palette
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {CATEGORIES.map(cat => (
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
                  <PaletteItem key={node.id} node={node} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
