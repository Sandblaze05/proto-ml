'use client';

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollToPlugin from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const Showcase = () => {
    const containerRef = useRef(null);
    const imgConRef = useRef(null);

    useGSAP(() => {
        if (!imgConRef.current || !containerRef.current) return;

        const images = gsap.utils.toArray(".image-item");

        const totalWidth =
            imgConRef.current.scrollWidth - containerRef.current.offsetWidth;

        let lastScroll = window.scrollY;
        let velocity = 0;

        gsap.to(imgConRef.current, {
            x: () => -totalWidth,
            ease: "none",
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top top",
                end: () => `+=${totalWidth}`,
                scrub: true,
                pin: true,
            }
        });
    }, { scope: containerRef });

    return (
        <section
            ref={containerRef}
            className='relative w-full h-dvh overflow-hidden'
        >
            <div
                ref={imgConRef}
                className="absolute top-0 left-0 h-full flex items-center justify-start gap-2 p-2 overflow-hidden"
            >
                {/* Slide 1 */}
                <div className="relative flex-shrink-0 w-[80vw] h-full overflow-hidden">
                    <div className="w-[77vw] absolute top-10 left-5 flex justify-between items-start text-[#f4efe7] z-10">
                        <h1 className="text-3xl font-bold">Visual Pipeline<br />Builder</h1>
                        <p className="border-[1px] rounded-3xl px-2 py-1 text-center text-[0.7rem]">Drag & Drop</p>
                    </div>
                    <div
                        className="image-item w-full h-full rounded-[2.5rem] flex items-center justify-center"
                        style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(250,235,215,0.1)" }}
                    >
                        <div className="flex flex-col items-center gap-3 opacity-30">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#faebd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M8 12h1M15 12h1"/></svg>
                            <span style={{ color: "#faebd7", fontSize: "0.75rem", letterSpacing: "0.1em" }}>DEMO COMING SOON</span>
                        </div>
                    </div>
                    <div className="w-[77vw] absolute bottom-10 left-5 flex justify-between items-start z-10">
                        <p className="text-[0.68rem] font-bold text-[#f4efe7]">Design complex ML workflows visually. Connect nodes, define data flows, and iterate in real-time without writing boilerplate.</p>
                        <div className="flex justify-center items-center">
                            <p className="text-[#f4efe7] border-[1px] rounded-3xl px-[1vw] py-1 text-center text-[0.7rem]">01</p>
                            <p className="text-[#4e484e] border-[1px] rounded-3xl px-[1vw] py-1 text-center text-[0.7rem]">03</p>
                        </div>
                    </div>
                </div>

                {/* Slide 2 */}
                <div className="relative flex-shrink-0 w-[80vw] h-full overflow-hidden">
                    <div className="w-[77vw] absolute top-10 left-5 flex justify-between items-start text-[#f4efe7] z-10">
                        <h1 className="text-3xl font-bold">Real-time<br />Compiler</h1>
                        <p className="border-[1px] rounded-3xl px-2 py-1 text-center text-[0.7rem]">Instant</p>
                    </div>
                    <div
                        className="image-item w-full h-full rounded-[2.5rem] flex items-center justify-center"
                        style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(250,235,215,0.1)" }}
                    >
                        <div className="flex flex-col items-center gap-3 opacity-30">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#faebd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M8 12h1M15 12h1"/></svg>
                            <span style={{ color: "#faebd7", fontSize: "0.75rem", letterSpacing: "0.1em" }}>DEMO COMING SOON</span>
                        </div>
                    </div>
                    <div className="w-[77vw] absolute bottom-10 left-5 flex justify-between items-start z-10">
                        <p className="text-[0.68rem] font-bold text-[#f4efe7]">Watch your pipeline compile into production-ready PyTorch, TensorFlow, or JAX code instantly as you design.</p>
                        <div className="flex justify-center items-center">
                            <p className="text-[#f4efe7] border-[1px] rounded-3xl px-[1vw] py-1 text-center text-[0.7rem]">02</p>
                            <p className="text-[#4e484e] border-[1px] rounded-3xl px-[1vw] py-1 text-center text-[0.7rem]">03</p>
                        </div>
                    </div>
                </div>

                {/* Slide 3 */}
                <div className="relative flex-shrink-0 w-[80vw] h-full overflow-hidden">
                    <div className="w-[77vw] absolute top-10 left-5 flex justify-between items-start text-[#f4efe7] z-10">
                        <h1 className="text-3xl font-bold">One-Click<br />Deploy</h1>
                        <p className="border-[1px] rounded-3xl px-2 py-1 text-center text-[0.7rem]">Scalable</p>
                    </div>
                    <div
                        className="image-item w-full h-full rounded-[2.5rem] flex items-center justify-center"
                        style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(250,235,215,0.1)" }}
                    >
                        <div className="flex flex-col items-center gap-3 opacity-30">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#faebd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M8 12h1M15 12h1"/></svg>
                            <span style={{ color: "#faebd7", fontSize: "0.75rem", letterSpacing: "0.1em" }}>DEMO COMING SOON</span>
                        </div>
                    </div>
                    <div className="w-[77vw] absolute bottom-10 left-5 flex justify-between items-start z-10">
                        <p className="text-[0.68rem] font-bold text-[#f4efe7]">Ship your model to any cloud or edge device with a single click. Scale from prototype to production in minutes.</p>
                        <div className="flex justify-center items-center">
                            <p className="text-[#f4efe7] border-[1px] rounded-3xl px-[1vw] py-1 text-center text-[0.7rem]">03</p>
                            <p className="text-[#4e484e] border-[1px] rounded-3xl px-[1vw] py-1 text-center text-[0.7rem]">03</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Showcase;
