'use client';

import * as React from 'react';
import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import { MousePointer2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs) {
  return twMerge(clsx(inputs));
}

const MouseTrackerContext = React.createContext(undefined);

export const useMouseTracker = () => {
  const context = React.useContext(MouseTrackerContext);
  if (!context) {
    throw new Error('useMouseTracker must be used within MouseTrackerProvider');
  }
  return context;
};

export const MouseTrackerProvider = React.forwardRef(function MouseTrackerProvider(
  { children, className, style, ...rest },
  ref,
) {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [active, setActive] = React.useState(false);
  const wrapperRef = React.useRef(null);
  const pointerRef = React.useRef(null);

  React.useImperativeHandle(ref, () => wrapperRef.current);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const container = wrapper.parentElement;
    if (!container) return;

    const previousPosition = container.style.position;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    const updatePosition = (event) => {
      const bounds = container.getBoundingClientRect();
      setPosition({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      setActive(true);
    };

    const clearPosition = () => setActive(false);

    container.addEventListener('mousemove', updatePosition);
    container.addEventListener('mouseleave', clearPosition);

    return () => {
      container.removeEventListener('mousemove', updatePosition);
      container.removeEventListener('mouseleave', clearPosition);
      container.style.position = previousPosition;
    };
  }, []);

  return (
    <MouseTrackerContext.Provider value={{ position, active, wrapperRef, pointerRef }}>
      <div ref={wrapperRef} data-role="tracker-wrapper" className={className} style={style} {...rest}>
        {children}
      </div>
    </MouseTrackerContext.Provider>
  );
});

export const CursorMark = React.forwardRef(function CursorMark(
  { x = 0, y = 0, color = '#67e8f9', label, className, style, showLabel = false, ...rest },
  ref,
) {
  const pointerRef = React.useRef(null);
  React.useImperativeHandle(ref, () => pointerRef.current);

  return (
    <motion.div
      ref={pointerRef}
      data-role="cursor-mark"
      className={cx('pointer-events-none absolute z-9999 -translate-x-1/2 -translate-y-1/2', className)}
      style={{ top: y, left: x, ...style }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      {...rest}
    >
      <div className="flex items-start gap-1">
        <MousePointer2
          size={16}
          className="shrink-0"
          style={{ color, filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))', transform: 'rotate(-18deg)' }}
        />
        {(showLabel || label) && label ? (
          <span
            className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
            style={{ color }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
});

export const Cursor = React.forwardRef(function Cursor({ className, style, ...rest }, ref) {
  const { position, active, wrapperRef, pointerRef } = useMouseTracker();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  React.useImperativeHandle(ref, () => pointerRef.current);

  React.useEffect(() => {
    x.set(position.x);
    y.set(position.y);
  }, [position, x, y]);

  React.useEffect(() => {
    const container = wrapperRef.current?.parentElement;
    if (!container) return;

    if (active) {
      const previousCursor = container.style.cursor;
      container.style.cursor = 'none';

      return () => {
        container.style.cursor = previousCursor;
      };
    }

    container.style.cursor = '';
    return undefined;
  }, [active, wrapperRef]);

  return (
    <AnimatePresence>
      {active && (
        <CursorMark
          ref={pointerRef}
          x={x}
          y={y}
          className={className}
          style={style}
          {...rest}
        />
      )}
    </AnimatePresence>
  );
});

export { MouseTrackerProvider as CursorProvider };
