import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge as reactFlowAddEdge } from 'reactflow';

export const useUIStore = create((set, get) => ({
  nodes: [],
  edges: [],
  
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
    set({ edges: reactFlowAddEdge(edgeParams, get().edges) });
  },
  
  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
  },
  
  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
    });
  },
  
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));
