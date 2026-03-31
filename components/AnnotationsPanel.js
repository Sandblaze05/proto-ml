'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';

// ── SVG shape icon previews ───────────────────────────────────────────────────
export function RectIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <rect x="2" y="2" width="28" height="18" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
export function RoundedRectIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <rect x="2" y="2" width="28" height="18" rx="5" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
export function EllipseIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <ellipse cx="16" cy="11" rx="13" ry="8.5" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
export function FrameIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <rect x="2" y="8" width="28" height="12" rx="3" stroke={color} strokeWidth="1.5" fill="none" />
      <rect x="2" y="3" width="12" height="6" rx="2" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    </svg>
  );
}
export function LineIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <line x1="3" y1="11" x2="29" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
export function ArrowIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <line x1="3" y1="11" x2="24" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="24,7 31,11 24,15" fill={color} />
    </svg>
  );
}
export function DoubleArrowIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <line x1="8" y1="11" x2="24" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="8,7 1,11 8,15" fill={color} />
      <polygon points="24,7 31,11 24,15" fill={color} />
    </svg>
  );
}
export function DottedLineIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <line x1="3" y1="11" x2="29" y2="11" stroke={color} strokeWidth="1.5" strokeDasharray="2,3" strokeLinecap="round" />
    </svg>
  );
}
export function DottedArrowIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <line x1="3" y1="11" x2="24" y2="11" stroke={color} strokeWidth="1.5" strokeDasharray="2,3" strokeLinecap="round" />
      <polygon points="24,7 31,11 24,15" fill={color} />
    </svg>
  );
}
export function ElbowIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <polyline points="3,5 16,5 16,17 29,17" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function TextBoxIcon({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22">
      <text x="4" y="16" fontFamily="monospace" fontSize="14" fill={color} fontWeight="700">T</text>
      <line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="1" strokeDasharray="2,2" />
    </svg>
  );
}

// ── Shape definitions ─────────────────────────────────────────────────────────
export const ANNOTATION_SHAPES = [
  { id: 'rect',         label: 'Rectangle',       Icon: RectIcon,        defaultSize: { w: 200, h: 120 } },
  { id: 'rounded-rect', label: 'Rounded Rect',    Icon: RoundedRectIcon, defaultSize: { w: 200, h: 120 } },
  { id: 'ellipse',      label: 'Ellipse',          Icon: EllipseIcon,     defaultSize: { w: 180, h: 110 } },
  { id: 'frame',        label: 'Frame',          Icon: FrameIcon,       defaultSize: { w: 400, h: 300 } },
  { id: 'line',         label: 'Line',           Icon: LineIcon,        defaultSize: { w: 200, h: 60 } },
];

// ── AnnotationsPanel ──────────────────────────────────────────────────────────
export default function AnnotationsPanel() {
  const [open, setOpen] = useState(false);
  const { activeAnnotationShape, setActiveAnnotationShape } = useUIStore();

  const accentColor = '#faebd7';

  const handleShapeClick = (shapeId) => {
    if (activeAnnotationShape === shapeId) {
      setActiveAnnotationShape(null);
    } else {
      setActiveAnnotationShape(shapeId);
    }
  };

  return (
    <div style={{ width: '100%', marginTop: 16 }}>
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderBottom: '1px solid #faebd715',
          marginBottom: 10,
        }}
      >
        <span style={{
          fontFamily: 'monospace',
          color: accentColor,
          fontWeight: 700,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Annotations
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {activeAnnotationShape && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#67e8f9',
              boxShadow: '0 0 6px #67e8f9',
              display: 'inline-block',
            }} />
          )}
          {open
            ? <ChevronDown size={13} color="#faebd755" />
            : <ChevronRight size={13} color="#faebd755" />
          }
        </span>
      </button>

      {open && (
        <div>
          {/* Hint text */}
          {activeAnnotationShape ? (
            <div style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#67e8f9',
              marginBottom: 8,
              padding: '4px 7px',
              background: '#67e8f912',
              borderRadius: 5,
              border: '1px solid #67e8f930',
              lineHeight: 1.5,
            }}>
              <strong style={{ textTransform: 'uppercase' }}>{activeAnnotationShape}</strong> selected<br />
              Click &amp; drag on canvas · ESC to cancel
            </div>
          ) : (
            <div style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#faebd744',
              marginBottom: 8,
              lineHeight: 1.5,
            }}>
              Click a shape to enter draw mode
            </div>
          )}

          {/* Shape grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 5,
          }}>
            {ANNOTATION_SHAPES.map(shape => {
              const isActive = activeAnnotationShape === shape.id;
              return (
                <button
                  key={shape.id}
                  onClick={() => handleShapeClick(shape.id)}
                  title={shape.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    padding: '7px 4px 5px',
                    borderRadius: 7,
                    background: isActive ? '#67e8f912' : '#111',
                    border: isActive
                      ? '1.5px solid #67e8f9'
                      : '1px solid #faebd715',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? '0 0 8px #67e8f940' : 'none',
                    outline: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#faebd740';
                      e.currentTarget.style.background = '#faebd70a';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#faebd715';
                      e.currentTarget.style.background = '#111';
                    }
                  }}
                >
                  <shape.Icon color={isActive ? '#67e8f9' : '#faebd7aa'} />
                  <span style={{
                    fontSize: 8,
                    fontFamily: 'monospace',
                    color: isActive ? '#67e8f9' : '#faebd766',
                    fontWeight: isActive ? 700 : 400,
                    lineHeight: 1,
                    textAlign: 'center',
                    display: 'block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 56,
                  }}>
                    {shape.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
