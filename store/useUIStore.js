import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge as reactFlowAddEdge } from 'reactflow';

export const useUIStore = create((set, get) => ({
  nodes: [],
  edges: [],
  drawings: [],
  history: [],
  future: [],
  annotationColor: '#faebd7',
  activeTool: 'select', // 'select', 'draw', 'text'
  showMinimap: false,
  hydrateShowMinimap: () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('proto-ml-minimap');
    if (stored === null) return;
    set({ showMinimap: stored === 'true' });
  },
  setShowMinimap: (val) => {
    set({ showMinimap: val });
    if (typeof window !== 'undefined') {
      localStorage.setItem('proto-ml-minimap', val);
    }
  },

  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // Auto-remove after 4s
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setAnnotationColor: (color) => set({ annotationColor: color }),
  setActiveTool: (tool) => set({ activeTool: tool }),

  saveToHistory: () => {
    const { nodes, edges, drawings } = get();
    const currentState = JSON.stringify({ nodes, edges, drawings });
    const { history } = get();
    
    // Only push if different from last state
    if (history.length > 0 && history[history.length - 1] === currentState) return;

    set({
      history: [...history.slice(-50), currentState],
      future: []
    });
  },

  undo: () => {
    const { history, future, nodes, edges, drawings } = get();
    if (history.length === 0) return;

    const prevStateStr = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const currentState = JSON.stringify({ nodes, edges, drawings });

    const prevState = JSON.parse(prevStateStr);
    set({
      ...prevState,
      history: newHistory,
      future: [currentState, ...future]
    });
  },

  redo: () => {
    const { history, future, nodes, edges, drawings } = get();
    if (future.length === 0) return;

    const nextStateStr = future[0];
    const newFuture = future.slice(1);
    const currentState = JSON.stringify({ nodes, edges, drawings });

    const nextState = JSON.parse(nextStateStr);
    set({
      ...nextState,
      history: [...history, currentState],
      future: newFuture
    });
  },

  addDrawing: (drawing) => {
    set((state) => ({
      drawings: [...state.drawings, drawing]
    }));
  },

  
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  
  addEdge: (edgeParams) => {
    get().saveToHistory();
    set({ edges: reactFlowAddEdge(edgeParams, get().edges) });
  },
  
  addNode: (node) => {
    get().saveToHistory();
    set({ nodes: [...get().nodes, node] });
  },
  
  removeNode: (id) => {
    get().saveToHistory();
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
    });
  },
  
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));
