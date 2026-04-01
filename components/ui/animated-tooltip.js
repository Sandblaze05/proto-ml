"use client";

import React, { useState } from "react";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";

export function AnimatedTooltip({ items = [], maxVisible = 3 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const springConfig = { stiffness: 100, damping: 8 };
  const x = useMotionValue(0);

  const rotate = useSpring(useTransform(x, [-100, 100], [-35, 35]), springConfig);
  const translateX = useSpring(useTransform(x, [-100, 100], [-40, 40]), springConfig);

  const handleMouseMove = (event) => {
    const halfWidth = event.currentTarget.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  const visibleItems = items.slice(0, maxVisible);
  const overflowCount = Math.max(0, items.length - visibleItems.length);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center">
      {visibleItems.map((item) => (
        <div
          className="group relative -mr-3"
          key={item.id}
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: -8, x: 8, scale: 0.82 }}
                animate={{
                  opacity: 1,
                  y: 10,
                  x: -8,
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 260,
                    damping: 14,
                  },
                }}
                exit={{ opacity: 0, y: -4, x: 8, scale: 0.82 }}
                style={{
                  translateX,
                  rotate,
                  whiteSpace: "nowrap",
                }}
                className="absolute left-1/2 top-full z-220 mt-2 flex -translate-x-[62%] flex-col items-start justify-center rounded-md border border-foreground/20 bg-background/95 px-3 py-2 text-xs shadow-xl"
              >
                <div className="relative z-30 text-[11px] font-bold text-white">{item.name}</div>
                <div className="text-[10px] text-white/70">{item.designation}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <img
            onMouseMove={handleMouseMove}
            height={56}
            width={56}
            src={item.image}
            alt={item.name}
            title={item.name}
            className="relative h-10 w-10 rounded-full border-2 border-foreground object-cover object-top bg-background transition duration-300 group-hover:z-30 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </div>
      ))}

      {overflowCount > 0 && (
        <div className="ml-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-foreground/40 bg-background/95 px-2 text-[10px] font-bold text-foreground/80">
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
