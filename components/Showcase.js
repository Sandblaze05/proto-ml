'use client';

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollToPlugin from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

// Register outside the component to avoid re-registering on re-renders
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
}

const Showcase = () => {
  const containerRef = useRef(null);
  const sliderRef = useRef(null);

  useGSAP(() => {
    const container = containerRef.current;
    const slider = sliderRef.current;

    if (!container || !slider) return;

    // 1. Wrap the calculation in a function so GSAP can dynamically recalculate 
    // it when the DOM updates, fonts load, or the window resizes.
    const getScrollAmount = () => {
      let sliderWidth = slider.scrollWidth;
      return sliderWidth - window.innerWidth;
    };

    // 2. Separate the tween and the ScrollTrigger for cleaner calculation
    const tween = gsap.to(slider, {
      x: () => -getScrollAmount(), // Use the function here
      ease: "none"
    });

    ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: () => `+=${getScrollAmount()}`, // Use the function here
      pin: true,
      animation: tween,
      scrub: 1, // Adding a slight scrub delay (1 second) smooths out trackpad scrolling
      invalidateOnRefresh: true, // 3. CRUCIAL: Forces GSAP to recalculate functional values on resize/refresh
    });

    // Optional: Refresh ScrollTrigger after a slight delay to ensure all assets/fonts are loaded
    const timeout = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    return () => clearTimeout(timeout);
  }, { scope: containerRef });

  return (
    <section
      ref={containerRef}
      className='relative w-full h-dvh overflow-hidden bg-[#1a1a1a]' // Added background color for contrast
    >
      <div
        ref={sliderRef}
        // Changed absolute wrapper to a 'w-max' flex container for reliable width calculation
        className="flex h-full w-max items-center justify-start gap-4 px-4" 
      >
        {/* Slide 1 */}
        <div className="relative flex-shrink-0 w-[85vw] md:w-[60vw] h-[90%] overflow-hidden rounded-[2.5rem]">
          <div className="w-full absolute top-8 left-0 px-8 flex justify-between items-start text-[#f4efe7] z-10">
            <h1 className="text-3xl font-bold">Visual Pipeline<br />Builder</h1>
            <p className="border-[1px] rounded-3xl px-3 py-1 text-center text-[0.7rem]">Drag & Drop</p>
          </div>
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(250,235,215,0.1)" }}
          >
            <div className="flex flex-col items-center gap-3 opacity-30">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#faebd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4" /><circle cx="12" cy="12" r="4" /><path d="M12 8v1M12 15v1M8 12h1M15 12h1" /></svg>
              <span style={{ color: "#faebd7", fontSize: "0.75rem", letterSpacing: "0.1em" }}>DEMO COMING SOON</span>
            </div>
          </div>
          <div className="w-full absolute bottom-8 left-0 px-8 flex justify-between items-end z-10 gap-4">
            <p className="text-[0.75rem] max-w-sm font-bold text-[#f4efe7]">Design complex ML workflows visually. Connect nodes, define data flows, and iterate in real-time without writing boilerplate.</p>
            <div className="flex justify-center items-center flex-shrink-0">
              <p className="text-[#f4efe7] border-[1px] rounded-3xl px-4 py-1 text-center text-[0.7rem]">01</p>
              <p className="text-[#4e484e] border-[1px] rounded-3xl px-4 py-1 text-center text-[0.7rem] ml-2">03</p>
            </div>
          </div>
        </div>

        {/* Slide 2 */}
        <div className="relative flex-shrink-0 w-[85vw] md:w-[60vw] h-[90%] overflow-hidden rounded-[2.5rem]">
          <div className="w-full absolute top-8 left-0 px-8 flex justify-between items-start text-[#f4efe7] z-10">
            <h1 className="text-3xl font-bold">Real-time<br />Compiler</h1>
            <p className="border-[1px] rounded-3xl px-3 py-1 text-center text-[0.7rem]">Instant</p>
          </div>
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(250,235,215,0.1)" }}
          >
            <div className="flex flex-col items-center gap-3 opacity-30">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#faebd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4" /><circle cx="12" cy="12" r="4" /><path d="M12 8v1M12 15v1M8 12h1M15 12h1" /></svg>
              <span style={{ color: "#faebd7", fontSize: "0.75rem", letterSpacing: "0.1em" }}>DEMO COMING SOON</span>
            </div>
          </div>
          <div className="w-full absolute bottom-8 left-0 px-8 flex justify-between items-end z-10 gap-4">
            <p className="text-[0.75rem] max-w-sm font-bold text-[#f4efe7]">Watch your pipeline compile into production-ready PyTorch, TensorFlow, or JAX code instantly as you design.</p>
            <div className="flex justify-center items-center flex-shrink-0">
              <p className="text-[#f4efe7] border-[1px] rounded-3xl px-4 py-1 text-center text-[0.7rem]">02</p>
              <p className="text-[#4e484e] border-[1px] rounded-3xl px-4 py-1 text-center text-[0.7rem] ml-2">03</p>
            </div>
          </div>
        </div>

        {/* Slide 3 */}
        <div className="relative flex-shrink-0 w-[85vw] md:w-[60vw] h-[90%] overflow-hidden rounded-[2.5rem]">
          <div className="w-full absolute top-8 left-0 px-8 flex justify-between items-start text-[#f4efe7] z-10">
            <h1 className="text-3xl font-bold">One-Click<br />Deploy</h1>
            <p className="border-[1px] rounded-3xl px-3 py-1 text-center text-[0.7rem]">Scalable</p>
          </div>
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(250,235,215,0.1)" }}
          >
            <div className="flex flex-col items-center gap-3 opacity-30">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#faebd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4" /><circle cx="12" cy="12" r="4" /><path d="M12 8v1M12 15v1M8 12h1M15 12h1" /></svg>
              <span style={{ color: "#faebd7", fontSize: "0.75rem", letterSpacing: "0.1em" }}>DEMO COMING SOON</span>
            </div>
          </div>
          <div className="w-full absolute bottom-8 left-0 px-8 flex justify-between items-end z-10 gap-4">
            <p className="text-[0.75rem] max-w-sm font-bold text-[#f4efe7]">Ship your model to any cloud or edge device with a single click. Scale from prototype to production in minutes.</p>
            <div className="flex justify-center items-center flex-shrink-0">
              <p className="text-[#f4efe7] border-[1px] rounded-3xl px-4 py-1 text-center text-[0.7rem]">03</p>
              <p className="text-[#4e484e] border-[1px] rounded-3xl px-4 py-1 text-center text-[0.7rem] ml-2">03</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Showcase;