"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

const WORDS = [
  "design.",
  "prototype.",
  "solve.",
  "build.",
  "develop.",
  "debug.",
  "learn.",
  "cook.",
  "ship.",
  "prompt.",
  "create.",
  "test.",
  "scale.",
  "visualize.",
];

const COLORS = [
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#38bdf8",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

const STACK_ITEMS = ["", ...WORDS, ""];
const SCROLL_PER_WORD_VH = 0.55; // scroll distance per word, relative to viewport height

export default function YouCanScroll() {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const indexRef = useRef(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!section || !viewport || !track) return undefined;

    const words = Array.from(track.querySelectorAll(".you-can-scroll__word"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const segments = Math.max(1, WORDS.length - 1); // N words = N-1 transitions
    const clampIndex = (i) => Math.min(segments, Math.max(0, i));

    const setActiveWord = (index) => {
      words.forEach((word, wordIndex) => {
        word.classList.toggle("is-active", wordIndex === index + 1);
      });
    };

    // Single source of truth: this is the ONLY place that sets position or
    // the active word, and both always come from the same integer index.
    // offsetTop is measured live and ignores any current transform, so this
    // is correct no matter what the CSS does.
    const centerOn = (index, animate) => {
      const word = words[index + 1]; // STACK_ITEMS is offset by the leading spacer
      if (!word) return;
      const targetY = viewport.clientHeight / 2 - (word.offsetTop + word.offsetHeight / 2);
      gsap.to(track, {
        y: targetY,
        duration: animate ? 0.32 : 0,
        ease: "power2.out",
        overwrite: true,
      });
      setActiveWord(index);
    };

    indexRef.current = 0;
    centerOn(0, false); // shows "design." centered and active immediately, before any scroll

    if (reduceMotion) return undefined;

    const getTravel = () =>
      Math.max(window.innerHeight * SCROLL_PER_WORD_VH * segments, window.innerHeight * 0.8);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => `+=${getTravel()}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const nearest = clampIndex(Math.round(self.progress * segments));
        if (nearest !== indexRef.current) {
          indexRef.current = nearest;
          centerOn(nearest, true);
        }
      },
    });

    const resync = () => {
      centerOn(indexRef.current, false);
      ScrollTrigger.refresh();
    };

    window.addEventListener("resize", resync);
    document.fonts?.ready?.then(resync); // re-center once webfonts swap in, in case metrics shift

    return () => {
      window.removeEventListener("resize", resync);
      trigger.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} className="you-can-scroll-section">
      <div className="you-can-scroll__shell">
        <div className="you-can-scroll__copy">
          <span className="you-can-scroll__prefix">you can</span>
        </div>

        <div ref={viewportRef} className="you-can-scroll__viewport">
          <ul ref={trackRef} aria-hidden="true" className="you-can-scroll__track">
            {STACK_ITEMS.map((text, index) => {
              const wordIndex = index - 1;
              const color = COLORS[((wordIndex % COLORS.length) + COLORS.length) % COLORS.length];
              return (
                <li
                  key={`${text || "spacer"}-${index}`}
                  className={`you-can-scroll__word${index === 1 ? " is-active" : ""}${text === "" ? " is-spacer" : ""}`}
                  style={text ? { color } : undefined}
                >
                  {text}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}