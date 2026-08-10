'use client';

import React, { useMemo } from 'react';
import { Handle, useStore, Position } from 'reactflow';
import { useExecutionStore } from '../../store/useExecutionStore';
import { portHex } from '../../lib/portUtils';

const connectionStartHandleSelector = (s) => s.connectionStartHandle;

export default function BaseHandle({ 
  type, 
  position, 
  id, 
  nodeId, 
  datatype = 'default', 
  label,
  showBadge = false,
  style,
  ...props 
}) {
  const connectionStartHandle = useStore(connectionStartHandleSelector);
  const validateConnection = useExecutionStore(s => s.validateConnection);
  
  const isConnecting = !!connectionStartHandle;
  const isSource = connectionStartHandle?.nodeId === nodeId && connectionStartHandle?.handleId === id && connectionStartHandle?.type === type;

  const isValidTarget = useMemo(() => {
    if (!isConnecting || isSource) return false;
    
    // If we are dragging from an output, we are a potential target if we are an input
    if (connectionStartHandle.type === 'source' && type === 'target') {
      const res = validateConnection(
        connectionStartHandle.nodeId,
        nodeId,
        connectionStartHandle.handleId,
        id
      );
      return res.ok;
    }
    
    // If we are dragging from an input, we are a potential target if we are an output
    if (connectionStartHandle.type === 'target' && type === 'source') {
      const res = validateConnection(
        nodeId,
        connectionStartHandle.nodeId,
        id,
        connectionStartHandle.handleId
      );
      return res.ok;
    }
    
    return false;
  }, [isConnecting, isSource, connectionStartHandle, nodeId, id, type, validateConnection]);

  const color = portHex(datatype);
  
  // Highlight valid targets, dim others
  const opacity = isConnecting ? (isValidTarget || isSource ? 1 : 0.2) : 1;
  const scale = isValidTarget ? 1.4 : 1;
  const boxShadow = isValidTarget ? `0 0 12px 2px ${color}` : 'none';

  const directionLabel = type === 'target' ? 'Input' : type === 'source' ? 'Output' : type;

  const badgePositionStyle = position === Position.Left
    ? { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }
    : position === Position.Right
    ? { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }
    : { left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)' };

  // Tooltip position adjustment based on handle position
  const tooltipStyle = position === Position.Left 
    ? { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }
    : position === Position.Right
    ? { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }
    : { left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)' };

  return (
    <div className="relative group/handle">
      <Handle
        type={type}
        position={position}
        id={id}
        style={{
          ...style,
          background: color,
          opacity,
          transform: `${style?.transform || ''} scale(${scale})`,
          boxShadow,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: isValidTarget ? 50 : (style?.zIndex || 10),
        }}
        {...props}
      />

      {showBadge && (
        <div
          className="absolute px-2 py-1 bg-[#111111] border border-white/10 text-white text-[9px] font-mono rounded-md pointer-events-none whitespace-nowrap z-[190] shadow-xl"
          style={badgePositionStyle}
        >
          <div className="text-[8px] uppercase tracking-[0.2em] text-white/45 leading-none">
            {directionLabel}
          </div>
          <div className="font-bold leading-tight">
            {label || id}
          </div>
        </div>
      )}
      
      {/* Tooltip */}
      <div 
        className="absolute px-2 py-1.5 bg-[#1a1a1a] border border-white/10 text-white text-[10px] font-mono rounded-md opacity-0 group-hover/handle:opacity-100 pointer-events-none whitespace-nowrap z-[200] transition-all shadow-xl"
        style={tooltipStyle}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            <span className="font-bold">{label || id}</span>
          </div>
          <div className="text-white/50 text-[9px] uppercase tracking-wider">{datatype}</div>
          
          {isConnecting && !isSource && (
            <div className={`mt-1 pt-1 border-t border-white/5 flex items-center gap-1.5 ${isValidTarget ? "text-emerald-400" : "text-red-400"}`}>
              <div className={`w-1 h-1 rounded-full ${isValidTarget ? "bg-emerald-400" : "bg-red-400"}`} />
              {isValidTarget ? "Compatible" : "Incompatible"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
