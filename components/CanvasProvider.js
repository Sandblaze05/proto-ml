'use client'

import React from 'react'
import { DndContext } from '@dnd-kit/core'
import { v4 as uuidv4 } from 'uuid'
import { useUIStore } from '@/store/useUIStore'
import { useExecutionStore } from '@/store/useExecutionStore'
import { AVAILABLE_NODES } from '@/components/NodePalette'

export default function CanvasProvider({ children }) {
  const { addNode } = useUIStore();

  const handleDragEnd = (event) => {
    const { over, active, delta } = event;
    if (over && over.id === 'canvas-droppable') {
      const nodeTypeId = active.data.current.nodeType;
      const template = AVAILABLE_NODES.find(n => n.id === nodeTypeId);
      if (!template) return;
      
      const newNodeId = `${nodeTypeId}-${uuidv4().slice(0, 6)}`;
      
      let inputs = [], outputs = [];
      if (['dataset', 'csv'].includes(nodeTypeId)) outputs = ['data'];
      if (['resize', 'tokenize', 'cnn', 'transformer', 'optimizer', 'accuracy'].includes(nodeTypeId)) { inputs = ['data']; outputs = ['data_out']; }
      if (nodeTypeId === 'accuracy') outputs = ['score'];

      const newNodeModel = {
        type: template.type,
        inputs,
        outputs,
        params: {},
        execution_code: "function() { return {} }"
      };

      addNode({
        id: newNodeId,
        type: 'custom',
        position: { x: delta.x > 0 ? delta.x : 200, y: delta.y > 0 ? delta.y : 200 },
        data: { nodeModel: newNodeModel },
      });

      useExecutionStore.getState().addExecutionNode(newNodeId, newNodeModel);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  )
}
