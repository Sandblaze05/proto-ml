"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const BG = "#171717";
const FG = "#faebd7";

const RAW_TEXT =
  "import torch; model = nn.Sequential(nn.Conv2d(3,64,3), nn.ReLU()) # TODO: fix this ~~~ " +
  "x = torch.randn(32,3,224,224) # hope this works lol ~~~ " +
  "RuntimeError: CUDA out of memory ~~~ " +
  "# copy-pasted from StackOverflow ~~~ ";

const CLEAN_TEXT =
  "● Input  →  ● Conv2D  →  ● ReLU  →  ● BatchNorm  →  ● Linear  →  ● Output  ~~~ " +
  "[B,3,224,224] → [B,64,112,112] → [B,128,56,56] → [B,10]  ~~~ ";

const VIEW_W = 1048;
const VIEW_H = 500;

const round = (n) => Math.round(n * 1000) / 1000;
const rp = (p) => ({ x: round(p.x), y: round(p.y) });
const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Smooth S-curve from left to right, peaking at center where the pill sits
const DEFAULT_PATH = {
  start: rp({ x: -200, y: 360 }),
  segments: [
    {
      c1: rp({ x: 100, y: 360 }),
      c2: rp({ x: 300, y: 160 }),
      end: rp({ x: 524, y: 260 }),
    },
    {
      c1: rp({ x: 748, y: 360 }),
      c2: rp({ x: 900, y: 360 }),
      end: rp({ x: 1200, y: 360 }),
    },
  ],
};

const handleKey = (id) =>
  id.type === "start" ? "start" : `${id.type}-${id.seg}`;

function getPoint(state, id) {
  if (id.type === "start") return state.start;
  return state.segments[id.seg][id.type];
}

function setPoint(state, id, p) {
  if (id.type === "start") return { ...state, start: p };
  return {
    ...state,
    segments: state.segments.map((seg, i) =>
      i === id.seg ? { ...seg, [id.type]: p } : seg,
    ),
  };
}

const shift = (p, dx, dy) => ({
  x: p.x + dx,
  y: p.y + dy,
});

function moveAnchor(state, id, p) {
  const old = getPoint(state, id);
  const dx = p.x - old.x;
  const dy = p.y - old.y;
  let next = setPoint(state, id, p);
  if (id.type === "start") {
    next = setPoint(
      next,
      { type: "c1", seg: 0 },
      shift(state.segments[0].c1, dx, dy),
    );
  } else if (id.type === "end") {
    const i = id.seg;
    next = setPoint(
      next,
      { type: "c2", seg: i },
      shift(state.segments[i].c2, dx, dy),
    );
    if (i < state.segments.length - 1) {
      next = setPoint(
        next,
        { type: "c1", seg: i + 1 },
        shift(state.segments[i + 1].c1, dx, dy),
      );
    }
  }
  return next;
}

function toPathD({ start, segments }) {
  let d = `M${round(start.x)} ${round(start.y)}`;
  for (const s of segments) {
    d += `C${round(s.c1.x)} ${round(s.c1.y)} ${round(s.c2.x)} ${round(s.c2.y)} ${round(s.end.x)} ${round(s.end.y)}`;
  }
  return d;
}

function clientToSvg(svg, clientX, clientY) {
  const ctm = svg.getScreenCTM();
  if (ctm) {
    const local = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }
  const r = svg.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * VIEW_W,
    y: ((clientY - r.top) / r.height) * VIEW_H,
  };
}

export default function Hero() {
  const svgRef = useRef(null);
  const draggingRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState(DEFAULT_PATH);

  const d = useMemo(() => toPathD(path), [path]);

  const anchors = useMemo(
    () => [
      { type: "start" },
      ...path.segments.map((_, i) => ({ type: "end", seg: i })),
    ],
    [path.segments],
  );

  const controlPoints = useMemo(
    () =>
      path.segments.flatMap((_, i) => [
        { type: "c1", seg: i },
        { type: "c2", seg: i },
      ]),
    [path.segments],
  );

  const guides = useMemo(
    () =>
      path.segments.flatMap((s, i) => {
        const prevAnchor = i === 0 ? path.start : path.segments[i - 1].end;
        return [
          { a: prevAnchor, b: s.c1 },
          { a: s.end, b: s.c2 },
        ];
      }),
    [path],
  );

  const handlePointerDown = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = id;
  }, []);

  const handlePointerMove = useCallback((e) => {
    const id = draggingRef.current;
    if (!id || !svgRef.current) return;
    const p = clientToSvg(svgRef.current, e.clientX, e.clientY);
    setPath((prev) =>
      id.type === "c1" || id.type === "c2"
        ? setPoint(prev, id, p)
        : moveAnchor(prev, id, p),
    );
  }, []);

  const handlePointerUp = useCallback((e) => {
    draggingRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const speed = 28;
  const duration = `${65 - speed}s`;

  return (
    <section
      className="relative flex w-full flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: BG, color: FG, height: 580 }}
    >
      {/* SVG Pipeline */}
      <div className="relative mx-auto flex w-full max-w-[1100px] items-center justify-center">
        <svg
          ref={svgRef}
          className="h-full w-full"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block", touchAction: editing ? "none" : "auto" }}
        >
          <defs>
            <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={FG} stopOpacity="0.08" />
              <stop offset="40%" stopColor={FG} stopOpacity="0.25" />
              <stop offset="50%" stopColor={FG} stopOpacity="0.6" />
              <stop offset="60%" stopColor={FG} stopOpacity="0.25" />
              <stop offset="100%" stopColor={FG} stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Subtle path line */}
          <path
            id="first-curve"
            fill="transparent"
            stroke="url(#pathGrad)"
            strokeWidth={1.5}
            strokeDasharray="4 6"
            opacity={0.35}
            d={d}
          />

          {/* BEFORE PILL: messy gray code */}
          <text
            x="0"
            style={{ fontSize: 15, fontFamily: "'JetBrains Mono', monospace" }}
          >
            <textPath
              href="#first-curve"
              className="[baseline-shift:-15%]"
              style={{ fill: `${FG}50`, opacity: 0.6 }}
            >
              {RAW_TEXT}
            </textPath>
            <animate
              attributeName="x"
              dur={duration}
              values="-2000;0"
              repeatCount="indefinite"
            />
          </text>

          {/* AFTER PILL: clean white nodes (starts at 50% of path = center/pill) */}
          <text
            x="0"
            style={{ fontSize: 16, fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
          >
            <textPath
              href="#first-curve"
              startOffset="50%"
              className="[baseline-shift:15%]"
              style={{ fill: FG, opacity: 0.95 }}
            >
              {CLEAN_TEXT}
            </textPath>
            <animate
              attributeName="x"
              dur={duration}
              values="-2000;0"
              repeatCount="indefinite"
            />
          </text>

          {/* Editing overlay */}
          {editing && (
            <g>
              <path
                d={d}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth={1.5}
                strokeDasharray="3 5"
                strokeOpacity={0.6}
                style={{ pointerEvents: "none" }}
              />
              {guides.map((g, i) => (
                <line
                  key={`guide-${i}`}
                  x1={g.a.x}
                  y1={g.a.y}
                  x2={g.b.x}
                  y2={g.b.y}
                  stroke="#0ea5e9"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  strokeOpacity={0.5}
                  style={{ pointerEvents: "none" }}
                />
              ))}
              {controlPoints.map((id) => {
                const p = getPoint(path, id);
                return (
                  <circle
                    key={handleKey(id)}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill="#ffffff"
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    style={{ cursor: "grab", touchAction: "none" }}
                    onPointerDown={(e) => handlePointerDown(e, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                );
              })}
              {anchors.map((id) => {
                const p = getPoint(path, id);
                return (
                  <circle
                    key={handleKey(id)}
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    fill="#0ea5e9"
                    stroke="#ffffff"
                    strokeWidth={1}
                    style={{ cursor: "grab", touchAction: "none" }}
                    onPointerDown={(e) => handlePointerDown(e, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Center pill — sits ON the path where text transitions */}
        <div className="pointer-events-none absolute left-1/2 top-[52%] z-20 -translate-x-1/2 -translate-y-1/2">
          <div
            className="relative flex items-center justify-center rounded-full px-10 py-4 text-xl font-bold tracking-wide"
            style={{
              color: BG,
              background: `linear-gradient(135deg, ${FG} 0%, ${FG}dd 50%, ${FG}aa 100%)`,
              boxShadow: `0 0 50px ${FG}25, 0 0 100px ${FG}10, inset 0 1px 0 rgba(255,255,255,0.25)`,
              border: `1.5px solid ${FG}50`,
            }}
          >
            proto-ml
            {/* Glow ring */}
            <div
              className="absolute inset-[-4px] -z-10 rounded-full opacity-40 blur-[10px]"
              style={{ background: `linear-gradient(135deg, ${FG}70, ${FG}30)` }}
            />
          </div>
        </div>
      </div>

      {/* Edit toggle */}
      <AnimatePresence mode="popLayout" initial={false}>
        {editing ? (
          <motion.button
            key="done"
            layoutId="edit-toggle"
            type="button"
            onClick={() => setEditing(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ layout: { type: "spring", bounce: 0, duration: 0.35 } }}
            className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-sky-500 px-5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-sky-500/10 transition-colors hover:bg-sky-600"
          >
            <motion.p
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              layoutId="edit-toggle-text"
              transition={{ layout: { type: "spring", bounce: 0, duration: 0.2 } }}
            >
              Done editing
            </motion.p>
          </motion.button>
        ) : (
          <motion.button
            key="edit"
            layoutId="edit-toggle"
            type="button"
            onClick={() => setEditing(true)}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ layout: { type: "spring", bounce: 0, duration: 0.2 } }}
            className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full px-5 py-2 text-sm font-medium shadow-sm ring-1 backdrop-blur-sm transition-colors"
            style={{ backgroundColor: `${FG}08`, color: FG, borderColor: `${FG}15` }}
          >
            <motion.p
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              layoutId="edit-toggle-text"
              transition={{ duration: 0.2 }}
            >
              Edit path
            </motion.p>
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
}