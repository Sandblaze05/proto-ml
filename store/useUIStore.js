import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge as reactFlowAddEdge } from 'reactflow';

// Safety replacer for JSON.stringify to avoid circularity (e.g. from GSAP metadata)
const jsonReplacer = (key, value) => {
  if (key === '_gsap') return undefined;
  return value;
};

export const useUIStore = create((set, get) => ({
  nodes: [],
  edges: [],
  drawings: [],
  canvasViewport: { x: 0, y: 0, zoom: 1, width: 1280, height: 720 },
  history: [],
  future: [],
  annotationColor: '#faebd7',
  activeTool: 'select', // 'select', 'draw', 'erase', 'text'
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
  setCanvasViewport: (viewport) => {
    const prev = get().canvasViewport;
    const next = {
      x: Number.isFinite(viewport?.x) ? viewport.x : prev.x,
      y: Number.isFinite(viewport?.y) ? viewport.y : prev.y,
      zoom: Number.isFinite(viewport?.zoom) && viewport.zoom > 0 ? viewport.zoom : prev.zoom,
      width: Number.isFinite(viewport?.width) && viewport.width > 0 ? viewport.width : prev.width,
      height: Number.isFinite(viewport?.height) && viewport.height > 0 ? viewport.height : prev.height,
    };
    set({ canvasViewport: next });
  },
  getVisibleCenterPosition: () => {
    const { x, y, zoom, width, height } = get().canvasViewport;
    return {
      x: (-x + width / 2) / zoom,
      y: (-y + height / 2) / zoom,
    };
  },

  saveToHistory: () => {
    const { nodes, edges, drawings } = get();
    const currentState = JSON.stringify({ nodes, edges, drawings }, jsonReplacer);
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
    const currentState = JSON.stringify({ nodes, edges, drawings }, jsonReplacer);

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
    const currentState = JSON.stringify({ nodes, edges, drawings }, jsonReplacer);

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

  setDrawings: (drawings) => set({ drawings }),

  
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
  
  duplicateNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    
    get().saveToHistory();
    const newId = `${node.type}-${Math.random().toString(36).substring(2, 7)}`;
    const newNode = {
      ...JSON.parse(JSON.stringify(node, jsonReplacer)),
      id: newId,
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40,
      },
      selected: false,
    };
    
    set({ nodes: [...get().nodes, newNode] });
    get().addToast(`Duplicated ${node.data?.nodeModel?.label || node.type}`, 'success');
  },

  clearCanvas: () => {
    if (get().nodes.length === 0) return;
    get().saveToHistory();
    set({ nodes: [], edges: [], drawings: [] });
    get().addToast('Canvas cleared', 'info');
  },

  updateEdgeStyle: (id, type) => {
    get().saveToHistory();
    set({
      edges: get().edges.map((edge) => 
        edge.id === id ? { ...edge, type: type === 'straight' ? 'straight' : 'default' } : edge
      ),
    });
  },

  toggleNodeCollapse: (id) => {
    set({
      nodes: get().nodes.map((node) => 
        node.id === id ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } } : node
      ),
    });
  },
  
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));
