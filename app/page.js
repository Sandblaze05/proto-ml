'use client'

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import RegisterForm from "@/components/RegisterForm"
import { Features } from "@/components/Features"
import { ProjectTimelineDemo } from "@/components/ProjectTimelineDemo"
import LandingFooter from "@/components/LandingFooter"
import HorizontalWords from "@/components/HorizontalWords"
import { LogoCloud } from "@/components/ui/logo-cloud"
import { ShaderAnimation } from "@/components/ShaderAnimation"
import HowItWorks from "@/components/HowItWorks"
import { PointerHighlight } from "@/components/ui/pointer-highlight"
import MorphSlider from "@/components/MorphSlider"
import TrueFocus from "@/components/ui/true-focus"
import { CountUp } from "@/components/ui/count-up"
import gsap from "gsap"


const FAQ_ITEMS = [
  {
    q: "Can I export to existing frameworks?",
    a: "Absolutely. proto-ML generates native PyTorch, TensorFlow, and JAX code. It doesn't lock you into a proprietary format; it's an accelerator for standard ML development.",
  },
  {
    q: "Does it support custom layer definitions?",
    a: 'Yes. You can write custom Python logic directly inside "Code Nodes" which are then integrated into the visual pipeline graph during the compilation step.',
  },
  {
    q: "How is data security handled?",
    a: "Data never leaves your environment if you choose the self-hosted runner. On our cloud version, all data is encrypted at rest and in transit with SOC2 compliance.",
  },
]

// Shared inline style tokens
const BG = "#171717"
const FG = "#faebd7"

const curtainPaneStyle = {
  backgroundColor: BG,
  boxShadow: `1.5px 0 0 0 ${BG}, -1.5px 0 0 0 ${BG}`,
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const authError = searchParams.get("error") === "auth"
  const signupParam = searchParams.get("signup") === "true"
  const [formOpen, setFormOpen] = useState(authError || signupParam)
  const [openFaq, setOpenFaq] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("features-section")
  const [user, setUser] = useState(null)
  const [progress, setProgress] = useState(0)

  const panesRef = useRef(null)
  const progressRef = useRef(null)
  const heroVideoRef = useRef(null);
  const curtainRef = useRef(null);

  useEffect(() => {
    if (!heroVideoRef.current || !curtainRef.current) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let done = false
    const progressProxy = { value: 0 }
    const setPct = () => setProgress(Math.round(progressProxy.value))

    const loadTween = reduceMotion
      ? null
      : gsap.to(progressProxy, { value: 92, duration: 2.2, ease: "power2.out", onUpdate: setPct })

    const playCurtainAnimation = () => {
      if (done) return
      done = true
      loadTween?.kill()

      const panes = gsap.utils.toArray(panesRef.current.children)

      if (reduceMotion) {
        setProgress(100)
        gsap.to(panes, {
          opacity: 0,
          duration: 0.25,
          onComplete: () => { if (curtainRef.current) curtainRef.current.style.display = "none" },
        })
        return
      }

      gsap
        .timeline({
          onComplete: () => { if (curtainRef.current) curtainRef.current.style.display = "none" },
        })
        .to(progressProxy, { value: 100, duration: 0.3, ease: "power1.out", onUpdate: setPct })
        .to(progressRef.current, { opacity: 0, y: -8, duration: 0.25, ease: "power2.in" }, "-=0.05")
        .fromTo(
          panes,
          { scaleY: 1, transformOrigin: "top" },
          // ADDED force3D: true to force hardware acceleration and eliminate lag
          { scaleY: 0, force3D: true, duration: 0.7, ease: "expo.inOut", delay: 0.5, stagger: { each: 0.07, from: "edges" } },
          "-=0.1"
        )
    }

    if (heroVideoRef.current.readyState >= 3) {
      playCurtainAnimation()
    } else {
      heroVideoRef.current.addEventListener("canplay", playCurtainAnimation, { once: true })
    }

    const fallback = window.setTimeout(playCurtainAnimation, 2500)

    return () => {
      window.clearTimeout(fallback)
      loadTween?.kill()
      heroVideoRef.current?.removeEventListener("canplay", playCurtainAnimation)
    }
  }, [])

  useEffect(() => {
    if (authError || signupParam) {
      router.replace("/", { scroll: false })
    }
  }, [authError, signupParam, router])

  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    })
  }, [])

  useEffect(() => {
    const sectionIds = ["quote-section", "features-section", "how-it-works", "faqs"]

    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight * 0.3

      let current = sectionIds[0]
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (!el) continue
        if (scrollPos >= el.offsetTop) {
          current = id
        }
      }
      setActiveSection(current)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const hashTarget = window.location.hash?.replace("#", "")
    const storedTarget = sessionStorage.getItem("protoMlLandingTarget")
    const target = hashTarget || storedTarget

    if (!target) return

    const timer = window.setTimeout(() => {
      const el = document.getElementById(target)
      if (!el) return
      const y = el.getBoundingClientRect().top + window.scrollY - 132
      window.scrollTo({ top: y, behavior: "smooth" })
    }, 60)

    sessionStorage.removeItem("protoMlLandingTarget")
    return () => window.clearTimeout(timer)
  }, [])

  const handleOpenForm = () => setFormOpen(true)
  const handleCloseForm = () => setFormOpen(false)
  const handleNavScroll = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 132
    window.scrollTo({ top: y, behavior: "smooth" })
    setMobileNavOpen(false)
  }

  return (
    <div style={{ backgroundColor: BG, color: FG }} className="font-body min-h-screen">
      {formOpen && (
        <RegisterForm
          onClose={handleCloseForm}
          initialError={authError ? "Authentication failed. Please try again." : ""}
          initialMode={signupParam ? 'signup' : 'signin'}
        />
      )}

      {/* Fixed z-999 to valid tailwind z-[999] */}
      <div ref={curtainRef} className="fixed inset-0 z-[999] pointer-events-none overflow-hidden">
        <div ref={panesRef} className="absolute inset-0 flex">
          {/* Removed conflicting tailwind classes: scale-y-100 and origin-top (GSAP handles it now) */}
          <div style={curtainPaneStyle} className="flex flex-1 will-change-transform" />
          <div style={curtainPaneStyle} className="flex flex-1 will-change-transform" />
          <div style={curtainPaneStyle} className="flex flex-1 will-change-transform" />
          <div style={curtainPaneStyle} className="flex flex-1 will-change-transform" />
          <div style={curtainPaneStyle} className="flex flex-1 will-change-transform" />
        </div>

        <div
          ref={progressRef}
          className="absolute inset-x-0 bottom-12 md:bottom-16 z-10 flex flex-col items-center gap-3"
        >
          <span
            style={{ color: FG, fontVariantNumeric: "tabular-nums" }}
            className="font-headline text-sm tracking-[0.2em]"
          >
            {progress}%
          </span>
          <div style={{ backgroundColor: `${FG}20` }} className="h-px w-32 md:w-40 overflow-hidden">
            <div style={{ backgroundColor: FG, width: `${progress}%` }} className="h-full" />
          </div>
        </div>
      </div>

      {/* ── Header ── */}
      <header
        id="main-header"
        style={{
          backgroundColor: `${BG}cc`,
          borderColor: `${FG}18`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl z-50 border rounded-full shadow-none bg-opacity-70 backdrop-blur-lg"
      >
        <nav className="relative flex justify-between items-center px-4 md:px-6 py-1 w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="proto-ML logo"
              width={60}
              height={60}
              className="object-contain"
              priority
            />
            <div
              style={{ color: FG }}
              className="hidden md:block text-2xl font-bold tracking-tighter uppercase font-headline"
            >
              proto-ML
            </div>
          </Link>

          <div className="hidden md:flex gap-8 items-center text-lg font-semibold">
            {/* UPDATED NAV LINKS: Using hardware-accelerated transform: scaleX() instead of width: 100% */}
            <button
              onClick={() => handleNavScroll("features-section")}
              className={`hover:opacity-80 transition-all relative group ${activeSection === "features-section" ? "opacity-100" : "opacity-60"}`}
              style={{ color: FG }}
            >
              Features
              <span className={`absolute -bottom-1 left-0 h-0.5 w-full bg-current origin-left transition-transform duration-300 ${activeSection === "features-section" ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}></span>
            </button>

            <button
              onClick={() => handleNavScroll("how-it-works")}
              className={`hover:opacity-80 transition-all relative group ${activeSection === "how-it-works" ? "opacity-100" : "opacity-60"}`}
              style={{ color: FG }}
            >
              How It Works
              <span className={`absolute -bottom-1 left-0 h-0.5 w-full bg-current origin-left transition-transform duration-300 ${activeSection === "how-it-works" ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}></span>
            </button>

            <button
              onClick={() => handleNavScroll("faqs")}
              className={`hover:opacity-80 transition-all relative group ${activeSection === "faqs" ? "opacity-100" : "opacity-60"}`}
              style={{ color: FG }}
            >
              FAQs
              <span className={`absolute -bottom-1 left-0 h-0.5 w-full bg-current origin-left transition-transform duration-300 ${activeSection === "faqs" ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}></span>
            </button>

            <Link href="/about" className="hover:opacity-80 transition-all relative group opacity-60" style={{ color: FG }}>
              About
              <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-current origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
            </Link>
          </div>


          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileNavOpen((v) => !v)} aria-label="Open navigation" className="p-2 rounded-full hover:bg-white/10 transition">
              <svg width="28" height="28" fill="none" stroke={FG} strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>

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

          <div
            className={`absolute top-full left-0 right-0 mt-2 mx-4 md:hidden overflow-hidden transition-all duration-300 ease-in-out z-100 ${mobileNavOpen ? "max-h-125 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div
              style={{
                backgroundColor: `${BG}f8`,
                borderColor: `${FG}25`,
                backdropFilter: "blur(30px)",
                WebkitBackdropFilter: "blur(30px)",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.8)",
              }}
              className="border rounded-2xl flex flex-col p-4 gap-1"
            >
              <button onClick={() => handleNavScroll("features-section")} className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl hover:bg-white/10 transition" style={{ color: FG }}>Features</button>
              <button onClick={() => handleNavScroll("how-it-works")} className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl hover:bg-white/10 transition" style={{ color: FG }}>How It Works</button>
              <button onClick={() => handleNavScroll("faqs")} className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl hover:bg-white/10 transition" style={{ color: FG }}>FAQs</button>
              <Link href="/about" className="text-lg font-semibold py-3 px-4 w-full text-left rounded-xl hover:bg-white/10 transition" style={{ color: FG }} onClick={() => setMobileNavOpen(false)}>About</Link>
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
                  onClick={() => {
                    setMobileNavOpen(false)
                    handleOpenForm()
                  }}
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

      <main className="">
        {/* ── Hero ── */}
        <section className="relative h-screen flex flex-col justify-end px-8 pb-16 overflow-hidden">
          {/* Video Background */}
          <video
            ref={heroVideoRef}
            className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>

          {/* Bottom-to-Top Gradient Overlay for readability at the bottom */}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent z-0 pointer-events-none"></div>

          {/* Content Container */}
          <div className="relative z-10 flex flex-col md:flex-row items-end justify-between w-full max-w-7xl mx-auto gap-12 md:gap-8">

            {/* Bottom Left: 3-Line Headline */}
            <div id="hero-headline" className="w-full md:w-1/2 drop-shadow-md">
              <h1
                style={{ color: FG }}
                className="font-headline text-5xl sm:text-6xl md:text-9xl text-nowrap font-extrabold tracking-tighter leading-[0.95]"
              >
                Create <br />
                ML pipelines <br />
                <span style={{ color: FG, opacity: 0.7 }}>on the go</span>
              </h1>
            </div>

            {/* Bottom Right: Subtitle & CTAs */}
            <div className="w-full md:w-1/2 flex flex-col items-start md:items-end text-left md:text-right drop-shadow-md">
              <p
                id="hero-subtitle"
                style={{ color: FG }}
                className="max-w-md mb-8 text-lg opacity-80"
              >
                Build, train, and deploy machine learning models effortlessly from anywhere. No complex setup required.
              </p>

              <div id="hero-ctas" className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-end">
                <button
                  onClick={handleOpenForm}
                  style={{ backgroundColor: FG, color: BG }}
                  className="px-8 py-4 font-bold rounded-full shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer text-center"
                >
                  Get Started
                </button>
                <a
                  href="#"
                  style={{ color: FG, borderColor: `${FG}40` }}
                  className="px-8 py-4 border font-medium rounded-full hover:bg-white/10 backdrop-blur-sm transition-all duration-300 text-center"
                >
                  View Documentation
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Brand Marquee ── */}
        <section className="w-full py-2 md:py-4 relative overflow-hidden">
          <div className="relative w-full px-0">
            <LogoCloud />
          </div>
        </section>

        {/* ── Quote ── */}
        <section id="quote-section" className="px-8 py-10 md:py-14 max-w-7xl mx-auto">
          <div
            style={{
              borderColor: `${FG}12`,
            }}
            className="relative mx-auto max-w-7xl overflow-hidden border"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(250, 235, 215, 0.12) 1px, transparent 0)",
                backgroundSize: "5px 5px",
                opacity: 0.35,
              }}
            />
            <div className="absolute -left-1.5 -top-1.5 h-3 w-3" style={{ backgroundColor: FG }} />
            <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3" style={{ backgroundColor: FG }} />
            <div className="absolute -right-1.5 -top-1.5 h-3 w-3" style={{ backgroundColor: FG }} />
            <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3" style={{ backgroundColor: FG }} />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 md:p-10 xl:py-16">
              <p style={{ color: FG }} className="text-xs font-medium md:text-sm lg:text-lg xl:text-2xl">
                Your ideas are
              </p>
              <div className="text-2xl tracking-tighter md:text-5xl lg:text-7xl xl:text-8xl">
                <div className="flex flex-wrap gap-1 md:gap-2 lg:gap-3 xl:gap-4">
                  <h1 className="font-semibold">too powerful</h1>
                  <p className="font-thin">to be trapped</p>
                </div>
                <div className="flex flex-wrap gap-1 md:gap-2 lg:gap-3 xl:gap-4">
                  <p className="font-thin">in code.</p>
                  <h1 className="font-semibold">Build them</h1>
                  <p className="font-thin">visually.</p>
                </div>
                <h1 className="font-semibold">Set them free.</h1>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16" id="features-section">
          <div className="text-center mb-2 md:mb-4 max-w-7xl mx-auto px-8">
            <h2 style={{ color: FG }} className="font-headline text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Features
            </h2>
            <p style={{ color: `${FG}70` }} className="max-w-xl mx-auto">
              Build, validate, and ship visual ML workflows with production-grade speed.
            </p>
          </div>
          <Features />
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-8 px-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center">
            <h2 style={{ color: FG }} className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-center mb-24">
              How It Works
            </h2>
            <HowItWorks />
            <div className="mx-auto max-w-5xl py-20 text-4xl font-bold tracking-tight md:text-6xl whitespace-nowrap">
              The best way to grow is to
              <PointerHighlight>
                <span>collaborate</span>
              </PointerHighlight>
            </div>
          </div>
        </section>

        <section id="faqs" className="py-32 px-8 max-w-4xl mx-auto">
          <h2 style={{ color: FG }} className="font-headline text-3xl md:text-4xl font-bold mb-16 text-center">
            Frequently Queried
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map(({ q, a }, i) => {
              const isOpen = openFaq === i
              return (
                <div
                  key={q}
                  style={{ backgroundColor: `${FG}06`, borderColor: `${FG}18` }}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between p-6 cursor-pointer transition-colors text-left"
                    style={{ color: FG }}
                    aria-expanded={isOpen}
                  >
                    <span className="font-headline font-semibold text-lg">{q}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: FG }}
                      className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-300"
                    style={{ maxHeight: isOpen ? '400px' : '0px' }}
                  >
                    <div
                      style={{ color: `${FG}80`, borderColor: `${FG}15` }}
                      className="p-6 pt-4 leading-relaxed border-t"
                    >
                      {a}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-32 px-8 text-center relative overflow-hidden">
          <ShaderAnimation />
          <div
            style={{ background: `radial-gradient(ellipse at center, ${FG}08 0%, transparent 70%)` }}
            className="absolute inset-0"
          />
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 style={{ color: FG }} className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter mb-8 leading-tight">
              Ready to orchestrate <br />the future?
            </h2>
            <div className="flex min-h-64 flex-col items-center justify-center gap-12 text-foreground">
              <div className="flex flex-wrap items-end justify-center gap-12">
                <div className="flex flex-col items-center gap-1">
                  <CountUp
                    to={1000000}
                    separator=","
                    digitEffect="slide"
                    className="text-5xl font-bold tabular-nums tracking-tight"
                  />
                  <span className="text-xs text-muted-foreground">users</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <CountUp
                    to={99.9}
                    digitEffect="blur"
                    className="text-5xl font-bold tabular-nums tracking-tight"
                  />
                  <span className="text-xs text-muted-foreground">uptime %</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <CountUp
                    to={0}
                    from={5}
                    direction="down"
                    separator=","
                    digitEffect="slide"
                    className="text-5xl font-bold tabular-nums tracking-tight"
                  />
                  <span className="text-xs text-muted-foreground">issues</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleOpenForm}
              style={{ backgroundColor: FG, color: BG }}
              className="px-12 py-5 font-bold text-lg rounded-full hover:opacity-90 transition-all duration-300 shadow-2xl cursor-pointer"
            >
              Deploy Your First Node
            </button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
