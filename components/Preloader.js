'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// ─── Design tokens (mirror Hero / page.js) ───────────────────────────────────
const BG = '#171717';  // dark charcoal background
const FG = '#faebd7';  // warm cream foreground

// ─── Preloader ────────────────────────────────────────────────────────────────
export default function Preloader({ onComplete }) {
  // Start as true so overlay covers screen from frame 0 (no hero flash)
  const [show, setShow] = useState(true);

  // Refs for every animated element
  const overlayRef  = useRef(null); // full-screen panel
  const counterRef  = useRef(null); // large number
  const percentRef  = useRef(null); // "%" suffix
  const barFillRef  = useRef(null); // progress bar fill
  const wordmarkRef = useRef(null); // "PROTO-ML" container
  const lettersRef  = useRef([]);   // individual letter <span>s
  const svgRef      = useRef(null); // node-graph SVG wrapper
  const edgesRef    = useRef([]);   // SVG line edges
  const nodesRef    = useRef([]);   // SVG circle nodes

  // ── Lock body scroll on mount ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.body.style.overflow = 'hidden';
  }, []);

  // ── Exit animation (called by main tl's onComplete) ──────────────────────
  function exitAnimation() {
    const exitTl = gsap.timeline({
      onComplete() {
        sessionStorage.setItem('proto-ml-preloader', '1');
        document.body.style.overflow = '';
        setShow(false);
        onComplete?.();
        // Fire event so Hero can kick off its own entrance timeline
        window.dispatchEvent(new CustomEvent('preloader:done'));
      },
    });

    // Counter, %, wordmark, icon — snap out smoothly
    exitTl.to(
      [counterRef.current, percentRef.current, wordmarkRef.current, svgRef.current],
      { opacity: 0, y: -30, duration: 0.4, ease: 'power2.in', stagger: 0.05 },
      0
    );

    // ╔══════════════════════════════════════════════════════════╗
    // ║  CURTAIN WIPE — clip-path sweeps upward                 ║
    // ║  Reveals the saturated hero underneath.                 ║
    // ╚══════════════════════════════════════════════════════════╝
    exitTl.fromTo(
      overlayRef.current,
      { clipPath: 'inset(0% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.0, ease: 'power4.inOut' },
      0.2
    );
  }

  // ── Main GSAP timeline ────────────────────────────────────────────────────
  useEffect(() => {
    if (!show) return;

    const letters = lettersRef.current.filter(Boolean);
    const counter = { value: 0 };

    const tl = gsap.timeline({ defaults: { ease: 'none' }, onComplete: exitAnimation });

    // ╔══════════════════════════════════════════════════════════╗
    // ║  STAGE 1 — ENTRANCE: overlay & nodes                    ║
    // ╚══════════════════════════════════════════════════════════╝
    tl.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out' },
      0
    );
    tl.fromTo(
      nodesRef.current.filter(Boolean),
      { scale: 0, opacity: 0, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.7)' },
      0.2
    );

    // ╔══════════════════════════════════════════════════════════╗
    // ║  STAGE 2 — LOGO DRAW: edges stroke-dashoffset → 0       ║
    // ╚══════════════════════════════════════════════════════════╝
    edgesRef.current.filter(Boolean).forEach((edge) => {
      const len = edge.getTotalLength?.() ?? 60;
      gsap.set(edge, { strokeDasharray: len, strokeDashoffset: len });
    });
    tl.to(
      edgesRef.current.filter(Boolean),
      { strokeDashoffset: 0, duration: 0.8, stagger: 0.15, ease: 'power2.inOut' },
      0.4
    );

    // ╔══════════════════════════════════════════════════════════╗
    // ║  STAGE 3 — PROGRESS: counter 0→100 over ~3s             ║
    // ╚══════════════════════════════════════════════════════════╝
    tl.to(
      counter,
      {
        value: 100,
        duration: 3.0,
        ease: 'power1.inOut',
        onUpdate() {
          const raw = Math.floor(counter.value);
          const jitter = Math.random() > 0.85 ? 1 : 0;
          const display = Math.min(100, raw + jitter);
          if (counterRef.current) counterRef.current.textContent = String(display);
        },
      },
      0.6
    );
    // Progress bar fill synced with counter
    tl.fromTo(
      barFillRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 3.0, ease: 'power1.inOut' },
      0.6
    );

    // ╔══════════════════════════════════════════════════════════╗
    // ║  STAGE 4 — WORDMARK: letter stagger slide-up reveal      ║
    // ╚══════════════════════════════════════════════════════════╝
    tl.fromTo(
      letters,
      { y: '110%', opacity: 0 },
      { y: '0%', opacity: 1, duration: 0.65, stagger: 0.05, ease: 'power3.out' },
      1.2
    );

    // ── Continuous logo rotation ──────────────────────────────────────────
    gsap.to(svgRef.current, {
      rotation: 360,
      duration: 10,
      ease: 'none',
      repeat: -1,
      transformOrigin: '50% 50%',
    });

    return () => { tl.kill(); };
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const WORDMARK = 'PROTO-ML';

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: BG,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: 'clamp(2rem, 5vw, 4rem)',
        // clipPath animated for curtain-wipe exit
        clipPath: 'inset(0% 0% 0% 0%)',
        willChange: 'clip-path',
        overflow: 'hidden',
      }}
    >
      {/* ── Dot-grid texture (mirrors the quote section) ─────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(250,235,215,0.12) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />

      {/* ── Top-right: spinning network-node glyph ────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 'clamp(2rem, 5vw, 4rem)',
          right: 'clamp(2rem, 5vw, 4rem)',
        }}
      >
        {/*
          SVG: three nodes connected in a triangle — mirrors the logo concept.
          Edges are drawn via strokeDashoffset in STAGE 2.
          The whole SVG rotates continuously (STAGE 3 side-effect).
        */}
        <svg
          ref={svgRef}
          width="60"
          height="60"
          viewBox="0 0 60 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="proto-ml node graph icon"
          style={{ display: 'block' }}
        >
          {/* Edges */}
          <line
            ref={(el) => (edgesRef.current[0] = el)}
            x1="30" y1="8" x2="52" y2="46"
            stroke={FG} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.65"
          />
          <line
            ref={(el) => (edgesRef.current[1] = el)}
            x1="30" y1="8" x2="8" y2="46"
            stroke={FG} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.65"
          />
          <line
            ref={(el) => (edgesRef.current[2] = el)}
            x1="8" y1="46" x2="52" y2="46"
            stroke={FG} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.65"
          />
          {/* Nodes — top, bottom-left, bottom-right */}
          <circle ref={(el) => (nodesRef.current[0] = el)} cx="30" cy="8"  r="5" fill={FG} fillOpacity="0.95" />
          <circle ref={(el) => (nodesRef.current[1] = el)} cx="8"  cy="46" r="5" fill={FG} fillOpacity="0.95" />
          <circle ref={(el) => (nodesRef.current[2] = el)} cx="52" cy="46" r="5" fill={FG} fillOpacity="0.95" />
        </svg>
      </div>

      {/* ── Main content — bottom-left (mirrors hero h1 placement) ─────── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>

        {/* Large percentage counter */}
        <div
          style={{ display: 'flex', alignItems: 'baseline', marginBottom: '1.25rem' }}
        >
          <span
            ref={counterRef}
            style={{
              color: FG,
              fontSize: 'clamp(5rem, 18vw, 14rem)',
              fontWeight: 900,
              fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 0.88,
              display: 'block',
              userSelect: 'none',
            }}
          >
            0
          </span>
          <span
            ref={percentRef}
            style={{
              color: FG,
              fontSize: 'clamp(2rem, 7vw, 6rem)',
              fontWeight: 900,
              fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
              letterSpacing: '-0.04em',
              opacity: 0.5,
              marginLeft: '0.12em',
              lineHeight: 0.88,
              userSelect: 'none',
            }}
          >
            %
          </span>
        </div>

        {/* Thin progress bar */}
        <div
          style={{
            width: '100%',
            height: '1px',
            backgroundColor: `${FG}18`,
            borderRadius: 999,
            overflow: 'hidden',
            marginBottom: '1.25rem',
          }}
        >
          <div
            ref={barFillRef}
            style={{
              height: '100%',
              backgroundColor: FG,
              borderRadius: 999,
              transformOrigin: 'left center',
              transform: 'scaleX(0)',
            }}
          />
        </div>

        {/* PROTO-ML wordmark — each letter individually staggered in */}
        <div
          ref={wordmarkRef}
          style={{ overflow: 'hidden', display: 'flex', alignItems: 'baseline' }}
          aria-label="PROTO-ML"
        >
          {WORDMARK.split('').map((char, i) => (
            <span
              key={`${char}-${i}`}
              ref={(el) => (lettersRef.current[i] = el)}
              style={{
                display: 'inline-block',
                color: FG,
                fontSize: 'clamp(1.4rem, 3.5vw, 2.75rem)',
                fontWeight: 900,
                fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                letterSpacing: '-0.02em',
                opacity: char === '-' ? 0.35 : 1,
                // Starts at 110% — GSAP translates to 0% in STAGE 4
                transform: 'translateY(110%)',
                userSelect: 'none',
              }}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
