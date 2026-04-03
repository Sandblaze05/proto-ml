"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LandingFooter from "@/components/LandingFooter";
import RegisterForm from "@/components/RegisterForm";

gsap.registerPlugin(ScrollTrigger);

const BG = "#171717";
const FG = "#faebd7";

export default function AboutPage() {
  const mainRef = useRef(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    })
  }, [])

  const handleOpenForm = () => setFormOpen(true)
  const handleCloseForm = () => setFormOpen(false)
  const setLandingTarget = (id) => {
    sessionStorage.setItem("protoMlLandingTarget", id)
    setMobileNavOpen(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {
        // Fade in
        gsap.utils.toArray(".fade-in").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            duration: 1.5,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          });
        });

        // Reveal from bottom
        gsap.utils.toArray(".reveal-bottom").forEach((el) => {
          gsap.from(el, {
            y: 50,
            opacity: 0,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          });
        });

        // Reveal from left
        gsap.utils.toArray(".reveal-left").forEach((el) => {
          gsap.from(el, {
            x: -50,
            opacity: 0,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          });
        });
      }, mainRef.current);

      return () => {
        ctx.revert();
        clearTimeout(timer);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ backgroundColor: BG, color: FG }} className="font-body min-h-screen w-full relative overflow-x-hidden">
      {formOpen && (
        <RegisterForm
          onClose={handleCloseForm}
        />
      )}

      {/* ── Header ── */}
      <header
        style={{
          backgroundColor: `${BG}cc`,
          borderColor: `${FG}18`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl z-50 border rounded-full shadow-none bg-opacity-70 backdrop-blur-lg"
      >
        <nav className="flex justify-between items-center px-4 md:px-6 py-1 w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="proto-ML logo"
              width={60}
              height={60}
              className="object-contain"
              unoptimized
            />
            <div
              style={{ color: FG }}
              className="hidden md:block text-2xl font-bold tracking-tighter uppercase font-headline"
            >
              proto-ML
            </div>
          </Link>
          {/* Navbar Links (Desktop) */}
          <div className="hidden md:flex gap-8 items-center text-lg font-semibold">
            <Link href="/#features-section" onClick={() => setLandingTarget("features-section")} className="hover:opacity-80 transition-all relative group opacity-60" style={{ color: FG }}>
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-current transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="/#pipeline" onClick={() => setLandingTarget("pipeline")} className="hover:opacity-80 transition-all relative group opacity-60" style={{ color: FG }}>
              Pipeline
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-current transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="/#faqs" onClick={() => setLandingTarget("faqs")} className="hover:opacity-80 transition-all relative group opacity-60" style={{ color: FG }}>
              FAQs
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-current transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="/about" className="hover:opacity-80 transition-all relative group opacity-100" style={{ color: FG }}>
              About
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-current transition-all duration-300"></span>
            </Link>
          </div>
          {/* Hamburger (Mobile) */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileNavOpen((v) => !v)} aria-label="Open navigation" className="p-2 rounded-full hover:bg-white/10 transition">
              <svg width="28" height="28" fill="none" stroke={FG} strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
          {/* Login or Dashboard Button */}
          {user ? (
            <Link
              href="/dashboard"
              style={{ backgroundColor: FG, color: BG }}
              className="font-manrope tracking-tight text-sm px-6 py-2 font-bold rounded-full hover:opacity-80 duration-150 transition-all cursor-pointer hidden md:block"
            >
              Dashboard
            </Link>
          ) : (
            <button
              onClick={handleOpenForm}
              style={{ backgroundColor: FG, color: BG }}
              className="font-manrope tracking-tight text-sm px-6 py-2 font-bold rounded-full hover:opacity-80 duration-150 transition-all cursor-pointer hidden md:block"
            >
              Login
            </button>
          )}

          {/* Mobile Nav Dropdown */}
          <div 
            className={`absolute top-full left-0 right-0 mt-2 mx-4 md:hidden overflow-hidden transition-all duration-300 ease-in-out z-100 ${mobileNavOpen ? 'max-h-125 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div 
              style={{ 
                backgroundColor: `${BG}f8`, 
                borderColor: `${FG}25`, 
                backdropFilter: 'blur(30px)', 
                WebkitBackdropFilter: 'blur(30px)',
                boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.8)`
              }}
              className="border rounded-2xl flex flex-col p-4 gap-1"
            >
              <Link href="/#features-section" className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl hover:bg-white/10 transition" style={{ color: FG }} onClick={() => setLandingTarget("features-section")}>Features</Link>
              <Link href="/#pipeline" className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl hover:bg-white/10 transition" style={{ color: FG }} onClick={() => setLandingTarget("pipeline")}>Pipeline</Link>
              <Link href="/#faqs" className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl hover:bg-white/10 transition" style={{ color: FG }} onClick={() => setLandingTarget("faqs")}>FAQs</Link>
              <Link href="/about" className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl bg-white/10 pl-6 transition" style={{ color: FG }} onClick={() => setMobileNavOpen(false)}>About</Link>
              <div className="h-px w-full my-2" style={{ backgroundColor: `${FG}10` }} />
              {user ? (
                <Link
                  href="/dashboard"
                  style={{ backgroundColor: FG, color: BG }}
                  className="font-manrope tracking-tight text-sm px-6 py-3 font-bold rounded-xl hover:opacity-80 duration-150 transition-all cursor-pointer w-full text-center"
                  onClick={() => setMobileNavOpen(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <button
                  onClick={() => { setMobileNavOpen(false); handleOpenForm(); }}
                  style={{ backgroundColor: FG, color: BG }}
                  className="font-manrope tracking-tight text-sm px-6 py-3 font-bold rounded-xl hover:opacity-80 duration-150 transition-all cursor-pointer w-full"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main ref={mainRef} className="pt-48 pb-32 px-6">
        {/* ── Hero Section ── */}
        <section className="max-w-6xl mx-auto text-center mb-32">
          <h1
            style={{ color: FG }}
            className="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-tight reveal-bottom"
          >
            The Architect <br />
            <span style={{ color: FG, opacity: 0.6 }}>Behind the Code</span>
          </h1>
          <p
            style={{ color: `${FG}70` }}
            className="max-w-2xl mx-auto text-xl leading-relaxed reveal-bottom"
          >
            proto-ML was born from a simple observation: Machine Learning is complex, but its design shouldn&apos;t be. 
            We are building a future where visual intuition and production performance coexist.
          </p>
        </section>

        {/* ── Quote Section ── */}
        <section className="max-w-4xl mx-auto mb-48 text-center reveal-bottom">
          <div className="relative">
            <span
              style={{ color: `${FG}10` }}
              className="absolute -top-12 -left-8 text-9xl font-serif italic pointer-events-none select-none"
            >
              &ldquo;
            </span>
            <p className="text-3xl md:text-4xl font-medium italic leading-tight mb-8 relative z-10">
              AI is the new electricity.
            </p>
            <cite style={{ color: `${FG}60` }} className="text-lg uppercase tracking-widest font-bold not-italic">
              — Andrew Ng
            </cite>
          </div>
        </section>

        {/* ── Leadership Section ── */}
        <section className="max-w-6xl mx-auto mb-48">
          <h2
            style={{ color: FG }}
            className="font-headline text-4xl md:text-5xl font-bold mb-20 tracking-tight text-center reveal-bottom"
          >
            Founding Leadership
          </h2>

          <div className="grid md:grid-cols-2 gap-24">
            {/* Tejas Chauhan */}
            <div className="group reveal-left mx-auto max-w-sm">
              <div className="relative mb-8 aspect-square overflow-hidden rounded-2xl grayscale hover:grayscale-0 transition-all duration-700 shadow-2xl">
                <Image
                  src="/tejas.png"
                  alt="Tejas Chauhan"
                  fill
                  loading="eager"
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#171717] to-transparent opacity-60" />
              </div>
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight mb-1">Tejas Chauhan</h3>
                  <p style={{ color: `${FG}60` }} className="uppercase tracking-[0.2em] text-xs font-bold">
                    Chief Executive Officer
                  </p>
                </div>
                {/* Signature Simulation */}
                <div className="opacity-40 italic font-serif text-xl -rotate-6 select-none pb-6" style={{ color: FG }}>
                  Tejas
                </div>
              </div>
              <p style={{ color: `${FG}70` }} className="leading-relaxed text-base">
                Visionary behind the spatial canvas engine. Tejas leads the strategic growth and 
                architectural direction of proto-ML, ensuring the product remains the fastest path to production.
              </p>
            </div>

            {/* Sarang Rastogi */}
            <div className="group reveal-left mx-auto max-w-sm">
              <div className="relative mb-8 aspect-square overflow-hidden rounded-2xl grayscale hover:grayscale-0 transition-all duration-700 shadow-2xl">
                <Image
                  src="/sarang.png"
                  alt="Sarang Rastogi"
                  fill
                  loading="eager"
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#171717] to-transparent opacity-60" />
              </div>
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight mb-1">Sarang Rastogi</h3>
                  <p style={{ color: `${FG}60` }} className="uppercase tracking-[0.2em] text-xs font-bold">
                    Chief Technology Officer
                  </p>
                </div>
                {/* Signature Simulation */}
                <div className="opacity-40 italic font-serif text-xl -rotate-6 select-none pb-4" style={{ color: FG }}>
                  $arang
                </div>
              </div>
              <p style={{ color: `${FG}70` }} className="leading-relaxed text-base">
                Leading the technological frontier. As CTO, Sarang architects the core compilation engine 
                and infrastructure, ensuring proto-ML provides the most robust and scalable visual pipeline protocol in the industry.
              </p>
            </div>
          </div>
        </section>

        {/* ── Story Section ── */}
        <section className="max-w-4xl mx-auto py-32 border-t border-white/10 reveal-bottom">
          <h2 className="font-headline text-4xl font-bold mb-12 tracking-tight text-center">Our Story</h2>
          <div className="space-y-8 text-lg leading-relaxed opacity-80">
            <p>
              It started in a small lab with a single question: Why does building a neural network feel like 
              fighting with the machine? We saw brilliant researchers spending 80% of their time on boilerplate 
              code and 20% on actual innovation.
            </p>
            <p>
              We decided to flip that ratio. By creating a spatial environment where the architecture is 
              defined visually but compiled natively, we removed the barrier between thought and execution.
            </p>
            <p>
              Today, proto-ML is used by thousands of developers to orchestrate the next generation of 
              intelligence. We&apos;re not just building a tool; we&apos;re building the infrastructure for human-AI collaboration.
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
