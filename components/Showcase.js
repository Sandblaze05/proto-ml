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
                    <video
                        src="/hero.mp4"
                        alt="Activity 1"
                        className="image-item w-full h-full object-cover rounded-[2.5rem]"
                        autoPlay
                        loop
                        muted
                        playsInline
                    />
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
                    <video
                        src="/hero.mp4"
                        alt="Activity 2"
                        className="image-item w-full h-full object-cover rounded-[2.5rem]"
                        autoPlay
                        loop
                        muted
                        playsInline
                    />
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
                    <video
                        src="/hero.mp4"
                        alt="Activity 3"
                        className="image-item w-full h-full object-cover rounded-[2.5rem]"
                        autoPlay
                        loop
                        muted
                        playsInline
                    />
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
