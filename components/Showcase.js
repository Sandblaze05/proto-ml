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

        // Recomputed on every ScrollTrigger refresh, not just once on mount
        const getTotalWidth = () =>
            imgConRef.current.scrollWidth - containerRef.current.offsetWidth;

        gsap.to(imgConRef.current, {
            x: () => -getTotalWidth(),
            ease: "none",
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top top",
                end: () => `+=${getTotalWidth()}`,
                scrub: true,
                pin: true,
                invalidateOnRefresh: true, // recalc x/end fresh on refresh
            }
        });

        // Layout can still shift after mount (fonts swapping, images
        // loading elsewhere on the page) — force a recalculation once
        // everything is actually settled.
        const refresh = () => ScrollTrigger.refresh();

        window.addEventListener("load", refresh);
        document.fonts?.ready?.then(refresh);

        // Optional but very useful for catching future layout shifts
        const ro = new ResizeObserver(refresh);
        ro.observe(imgConRef.current);

        return () => {
            window.removeEventListener("load", refresh);
            ro.disconnect();
        };
    }, { scope: containerRef });

    return (
        // ...unchanged JSX
        <section ref={containerRef} className='relative w-full h-dvh overflow-hidden'>
            <div ref={imgConRef} className="absolute top-0 left-0 h-full flex items-center justify-start gap-2 p-2 overflow-hidden">
                {/* slides unchanged */}
            </div>
        </section>
    );
};

export default Showcase;
