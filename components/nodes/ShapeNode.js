'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeResizer, useStore } from 'reactflow';
import { Lock } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

// ── helpers ──────────────────────────────────────────────────────────────────
function strokeDashArray(style, width) {
  if (style === 'dashed') return `${width * 4},${width * 3}`;
  if (style === 'dotted') return `${width},${width * 2}`;
  return 'none';
}

function arrowMarker(id, color, direction) {
  // direction: 'end', 'start', or 'both'
  return (
    <defs>
      {(direction === 'end' || direction === 'both') && (
        <marker
          id={`${id}-arrow-end`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={color} />
        </marker>
      )}
      {(direction === 'start' || direction === 'both') && (
        <marker
          id={`${id}-arrow-start`}
          markerWidth="10"
          markerHeight="7"
          refX="1"
          refY="3.5"
          orient="auto-start-reverse"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={color} />
        </marker>
      )}
    </defs>
  );
}

// ── ShapeNode ─────────────────────────────────────────────────────────────────
export default function ShapeNode({ id, data, selected }) {
  const { setNodes } = useUIStore();
  const nodes = useUIStore(s => s.nodes);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [localLabel, setLocalLabel] = useState(data.label || '');
  const [midpointOffset, setMidpointOffset] = useState(data.midpointOffset || 0);
  const midDragRef = useRef(null);
  const labelRef = useRef(null);

  // Use useStore to get the actual width and height of the node in the React Flow store
  const nodeWidth = useStore(s => s.nodeInternals.get(id)?.width);
  const nodeHeight = useStore(s => s.nodeInternals.get(id)?.height);
  const isLocked = useStore(s => s.nodeInternals.get(id)?.draggable === false);

  const shapeType = data.shapeType || 'rect';
  const strokeColor = data.strokeColor || '#67e8f9';
  const fillColor = data.fillColor || 'none';
  const strokeWidth = data.strokeWidth || 2;
  const strokeStyle = data.strokeStyle || 'solid';
  const opacity = data.opacity !== undefined ? data.opacity : 1;
  const arrowheads = data.arrowheads || 'none'; // 'none', 'end', 'start', 'both'
  
  // Use width/height from store, then from data, then fallback
  const w = nodeWidth || data.width || 180;
  const h = nodeHeight || data.height || 100;

  const markerId = `shape-${id}`;
  const dashArray = strokeDashArray(strokeStyle, strokeWidth);

  // Commit label edit to store
  const commitLabel = useCallback((val) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n));
  }, [nodes, id, setNodes]);

  // Sync width/height to data when they change (optional but good for persistence)
  useEffect(() => {
    if (nodeWidth && nodeHeight && (nodeWidth !== data.width || nodeHeight !== data.height)) {
      setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, width: nodeWidth, height: nodeHeight } } : n));
    }
  }, [nodeWidth, nodeHeight, id, data.width, data.height, nodes, setNodes]);

  // Auto-focus label textarea when frame is placed
  useEffect(() => {
    if (shapeType === 'frame' && data.label === '' && labelRef.current) {
      setTimeout(() => labelRef.current?.focus(), 80);
    }
  }, [shapeType, data.label]);

  // Selection glow style
  const selectedStyle = selected ? {
    filter: 'drop-shadow(0 0 6px rgba(103, 232, 249, 0.55))',
  } : {};

  // ── Line / arrow shapes ────────────────────────────────────────────────────
  if (['line', 'arrow', 'double-arrow', 'dotted-line', 'dotted-arrow', 'elbow'].includes(shapeType)) {
    const isElbow = shapeType === 'elbow';
    const isArrow = shapeType === 'arrow' || shapeType === 'dotted-arrow';
    const isDouble = shapeType === 'double-arrow';
    const isDotted = shapeType === 'dotted-line' || shapeType === 'dotted-arrow';
    const effectiveDash = isDotted
      ? strokeDashArray('dotted', strokeWidth)
      : strokeDashArray(strokeStyle, strokeWidth);

    const hasEnd = isArrow || isDouble || arrowheads === 'end' || arrowheads === 'both';
    const hasStart = isDouble || arrowheads === 'start' || arrowheads === 'both';
    const direction = hasStart && hasEnd ? 'both' : hasEnd ? 'end' : hasStart ? 'start' : null;

    const svgW = Math.max(w, 80);
    const svgH = Math.max(h, 40);
    const pad = 10;

    let pathD;
    if (isElbow) {
      const mid = midpointOffset;
      const mx = svgW / 2 + mid;
      pathD = `M ${pad} ${svgH / 2} L ${mx} ${svgH / 2} L ${mx} ${svgH / 2} L ${svgW - pad} ${svgH / 2}`;
      // orthogonal: horizontal then vertical then horizontal
      pathD = `M ${pad} ${pad} L ${mx} ${pad} L ${mx} ${svgH - pad} L ${svgW - pad} ${svgH - pad}`;
    } else {
      pathD = `M ${pad} ${svgH / 2} L ${svgW - pad} ${svgH / 2}`;
    }

    // Midpoint drag for elbow
    const onMidMouseDown = (e) => {
      if (!isElbow) return;
      e.stopPropagation();
      const startX = e.clientX;
      const startOffset = midpointOffset;
      const onMove = (me) => {
        const dx = me.clientX - startX;
        const newOff = startOffset + dx;
        setMidpointOffset(newOff);
        setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, midpointOffset: newOff } } : n));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    return (
      <div style={{ width: svgW, height: svgH, opacity, ...selectedStyle, position: 'relative' }}>
        <NodeResizer isVisible={selected && !isLocked} minWidth={80} minHeight={30} color="#67e8f9" />
        {isLocked && (
          <div className="absolute top-1 right-1 z-20 pointer-events-none opacity-60">
            <Lock size={12} color={strokeColor} />
          </div>
        )}
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        >
          {direction && arrowMarker(markerId, strokeColor, direction)}
          <path
            d={pathD}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={effectiveDash}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={hasEnd ? `url(#${markerId}-arrow-end)` : undefined}
            markerStart={hasStart ? `url(#${markerId}-arrow-start)` : undefined}
          />
          {/* Midpoint handle for elbow */}
          {isElbow && selected && (
            <circle
              cx={svgW / 2 + midpointOffset}
              cy={svgH / 2}
              r={6}
              fill={strokeColor}
              opacity={0.8}
              style={{ cursor: 'ew-resize' }}
              onMouseDown={onMidMouseDown}
              className="nodrag"
            />
          )}
        </svg>
      </div>
    );
  }

  // ── Text box ───────────────────────────────────────────────────────────────
  if (shapeType === 'text') {
    return (
      <div
        style={{
          width: w,
          height: h,
          minWidth: 80,
          minHeight: 28,
          opacity,
          ...selectedStyle,
          padding: '2px 4px',
          outline: isEditingLabel ? '1px dashed ' + strokeColor : 'none',
          borderRadius: 2,
          position: 'relative',
        }}
        onDoubleClick={() => !isLocked && setIsEditingLabel(true)}
      >
        <NodeResizer isVisible={selected && !isLocked} minWidth={80} minHeight={28} color="#67e8f9" />
        {isLocked && (
          <div className="absolute top-0 right-0 z-20 pointer-events-none opacity-60">
            <Lock size={10} color={strokeColor} />
          </div>
        )}
        {isEditingLabel ? (
          <textarea
            autoFocus
            className="nodrag bg-transparent border-none outline-none resize-none w-full font-mono text-sm leading-relaxed"
            style={{ color: strokeColor, minHeight: 28, minWidth: 80 }}
            value={localLabel}
            spellCheck={false}
            onChange={e => { setLocalLabel(e.target.value); commitLabel(e.target.value); }}
            onBlur={() => setIsEditingLabel(false)}
          />
        ) : (
          <span
            style={{
              color: strokeColor,
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              display: 'block',
              minWidth: 80,
              minHeight: 28,
              cursor: 'default',
            }}
          >
            {localLabel || <span style={{ opacity: 0.3 }}>Text…</span>}
          </span>
        )}
      </div>
    );
  }

  // ── Frame ─────────────────────────────────────────────────────────────────
  if (shapeType === 'frame') {
    return (
      <div
        style={{
          width: w,
          height: h,
          opacity,
          position: 'relative',
          ...selectedStyle,
          borderRadius: 10,
          border: `${strokeWidth}px solid ${strokeColor}`,
          backgroundColor: fillColor === 'none' ? 'rgba(103,232,249,0.03)' : fillColor,
        }}
      >
        <NodeResizer isVisible={selected && !isLocked} minWidth={120} minHeight={80} color="#67e8f9" handleStyle={{ borderColor: '#67e8f9' }} />
        {isLocked && (
          <div className="absolute top-2 right-2 z-20 pointer-events-none opacity-60">
            <Lock size={12} color={strokeColor} />
          </div>
        )}
        {/* Label top-left */}
        <div
          style={{
            position: 'absolute',
            top: -26,
            left: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isEditingLabel ? (
            <input
              ref={labelRef}
              autoFocus
              className="nodrag bg-transparent border-none outline-none font-mono text-xs"
              style={{ color: strokeColor, fontSize: 11, minWidth: 60 }}
              value={localLabel}
              onChange={e => { setLocalLabel(e.target.value); commitLabel(e.target.value); }}
              onBlur={() => setIsEditingLabel(false)}
              onKeyDown={e => { if (e.key === 'Enter') setIsEditingLabel(false); }}
            />
          ) : (
            <span
              style={{
                color: strokeColor,
                fontFamily: 'monospace',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                cursor: 'text',
                padding: '1px 4px',
                borderRadius: 3,
                background: `${strokeColor}18`,
                border: `1px solid ${strokeColor}33`,
              }}
              onDoubleClick={() => setIsEditingLabel(true)}
            >
              {localLabel || 'Frame'}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Closed shapes: rect, rounded-rect, ellipse ─────────────────────────────
  const svgW = Math.max(w, 40);
  const svgH = Math.max(h, 30);
  const half = strokeWidth / 2;

  const getShapeElement = () => {
    if (shapeType === 'ellipse') {
      return (
        <ellipse
          cx={svgW / 2}
          cy={svgH / 2}
          rx={svgW / 2 - half}
          ry={svgH / 2 - half}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill={fillColor === 'none' ? 'transparent' : fillColor}
          strokeDasharray={dashArray}
        />
      );
    }
    const rx = shapeType === 'rounded-rect' ? 12 : 0;
    return (
      <rect
        x={half}
        y={half}
        width={svgW - strokeWidth}
        height={svgH - strokeWidth}
        rx={rx}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={fillColor === 'none' ? 'transparent' : fillColor}
        strokeDasharray={dashArray}
      />
    );
  };

  return (
    <div style={{ width: svgW, height: svgH, opacity, position: 'relative', ...selectedStyle }}>
      <NodeResizer isVisible={selected && !isLocked} minWidth={40} minHeight={30} color="#67e8f9" />
      {isLocked && (
        <div className="absolute top-1 right-1 z-20 pointer-events-none opacity-60">
          <Lock size={12} color={strokeColor} />
        </div>
      )}
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {getShapeElement()}
      </svg>
    </div>
  );
}
