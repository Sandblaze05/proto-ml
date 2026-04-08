'use client'

import React from 'react'
import { DndContext } from '@dnd-kit/core'
import { v4 as uuidv4 } from 'uuid'
import { useUIStore } from '@/store/useUIStore'
import { useExecutionStore } from '@/store/useExecutionStore'
import { getAvailableNodes } from '@/components/NodePalette'

export default function CanvasProvider({ children }) {
  const addNode = useUIStore(s => s.addNode);
  const getVisibleCenterPosition = useUIStore(s => s.getVisibleCenterPosition);

  const handleDragEnd = (event) => {
    const { over, active, delta } = event;
    if (over && over.id === 'canvas-droppable') {
      const nodeTypeId = active.data.current.nodeType;
      const template = getAvailableNodes().find(n => n.id === nodeTypeId);
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

      const center = getVisibleCenterPosition();
      const spawnPosition = {
        x: center.x + (Math.random() - 0.5) * 40,
        y: center.y + (Math.random() - 0.5) * 40,
      };

      addNode({
        id: newNodeId,
        type: 'custom',
        position: spawnPosition,
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
