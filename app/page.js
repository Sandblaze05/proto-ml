'use client'

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Image from "next/image"
import RegisterForm from "@/components/RegisterForm"
import { ShaderAnimation } from "@/components/ShaderAnimation"
import { Features } from "@/components/Features"

const MARQUEE_ITEMS = [
  { label: "Drag & Drop" },
  { label: "Real-time Compilation" },
  { label: "Export to Python" },
  { label: "No Setup Required" },
  { label: "Visually Stunning" },
]

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

const TESTIMONIALS = [
  { name: "Tejas", role: "Software Architect", quote: "The spatial engine is a game changer for our workflow." },
  { name: "Sarang", role: "Data Scientist", quote: "Generating tensor code has never been this intuitive." },
  { name: "Akshat", role: "ML Engineer", quote: "Finally, a visual tool that doesn't sacrifice power for simplicity." },
  { name: "Yash", role: "Research Head", quote: "The real-time compiler is absolutely stunning." },
  { name: "Samyak", role: "Frontend Dev", quote: "Breathtaking design and even better functionality." },
  { name: "Digvijay", role: "AI Researcher", quote: "Moving from idea to implementation takes minutes now." },
  { name: "Angad", role: "Product Manager", quote: "This is the future of collaborative ML development." },
  { name: "Jayant", role: "Backend Architect", quote: "Reliable, scalable, and beautifully designed." },
  { name: "Modi Ji", role: "Policy Maker", quote: "Innovation at its finest. Proud to see such tools." },
  { name: "Virat Kohli", role: "Brand Ambassador", quote: "Precision and speed - that's what proto-ML delivers." },
  { name: "Naina", role: "Creative Director", quote: "The spatial interface is a masterpiece of UI/UX." },
  { name: "Janvi", role: "Data Analyst", quote: "Interpreting complex datasets is now a visual pleasure." },
  { name: "Ruqayya", role: "Security Lead", quote: "Secure, fast, and remarkably robust architecture." },
  { name: "Zoya", role: "Operations Head", quote: "Optimizing our pipelines has never been smoother." },
]

// Shared inline style tokens
const BG = "#171717"
const FG = "#faebd7"

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const authError = searchParams.get("error") === "auth"
  const [formOpen, setFormOpen] = useState(authError)
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    if (authError) {
      router.replace("/", { scroll: false })
    }
  }, [authError, router])

  const handleOpenForm = () => setFormOpen(true)
  const handleCloseForm = () => setFormOpen(false)

  return (
    <div style={{ backgroundColor: BG, color: FG }} className="font-body min-h-screen">
      {formOpen && (
        <RegisterForm
          onClose={handleCloseForm}
          initialError={authError ? "Authentication failed. Please try again." : ""}
        />
      )}

      {/* ── Header ── */}
      <header
        style={{ backgroundColor: `${BG}cc`, borderColor: `${FG}18` }}
        className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl z-50 border backdrop-blur-xl rounded-full shadow-2xl"
      >
        <nav className="flex justify-between items-center px-4 md:px-6 py-1 w-full">
          <div className="flex items-center gap-3">
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
          </div>
          <button
            onClick={handleOpenForm}
            style={{ backgroundColor: FG, color: BG }}
            className="font-manrope tracking-tight text-sm px-6 py-2 font-bold rounded-full hover:opacity-80 duration-150 transition-all cursor-pointer"
          >
            Login
          </button>
        </nav>
      </header>

      <main className="pt-24">
        {/* ── Hero ── */}
        <section className="relative min-h-230.25 flex flex-col md:flex-row items-center justify-center px-6 overflow-hidden">
          <ShaderAnimation />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between w-full max-w-6xl mx-auto gap-12 md:gap-0">
            <div className="flex-1 text-center md:text-left">
              <h1
                style={{ color: FG }}
                className="font-headline text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-[0.95]"
              >
                Create ML pipelines <br />
                <span style={{ color: FG, opacity: 0.6 }}>on the go</span>
              </h1>
              <div className="flex flex-col md:flex-row gap-6 justify-center md:justify-start">
                <button
                  onClick={handleOpenForm}
                  style={{ backgroundColor: FG, color: BG }}
                  className="px-10 py-4 font-bold rounded-lg shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  Get Started
                </button>
                <a
                  href="#"
                  style={{ color: FG, borderColor: `${FG}30`, backgroundColor: `${FG}08` }}
                  className="px-10 py-4 border font-medium rounded-lg hover:opacity-80 transition-all text-center"
                >
                  View Documentation
                </a>
              </div>
            </div>
            <div className="flex-1 flex justify-center items-center w-full md:w-auto mt-12 md:mt-0">
              {/* Radial Orbital Timeline in hero */}
              {typeof window !== 'undefined' && require("@/components/ProjectTimelineDemo").ProjectTimelineDemo()}
            </div>
          </div>
        </section>

        {/* ── Marquee ── */}
        <section
          style={{ borderColor: `${FG}10`, backgroundColor: `${FG}05` }}
          className="py-12 border-y overflow-hidden"
        >
          <div className="animate-marquee whitespace-nowrap flex gap-16 items-center">
            {[0, 1].map((set) => (
              <div
                key={set}
                style={{ color: `${FG}60` }}
                className="flex items-center gap-16 font-label text-sm uppercase tracking-[0.3em]"
              >
                {MARQUEE_ITEMS.map(({ label }) => (
                  <span key={label} className="flex items-center gap-2">
                    <span style={{ backgroundColor: FG, opacity: 0.4 }} className="w-1.5 h-1.5 rounded-full" />
                    {label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>


        <Features />

        {/* ── Project Timeline (Radial Orbital) ── */}
        <section className="py-32 px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 style={{ color: FG }} className="font-headline text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              proto-ML Project Timeline
            </h2>
            <p style={{ color: `${FG}70` }} className="max-w-xl mx-auto">
              Explore the journey of proto-ML from planning to release, visualized as an interactive orbital timeline.
            </p>
          </div>
          <div className="flex justify-center">
            {/* Timeline Demo Component */}
            {typeof window !== 'undefined' && require("@/components/ProjectTimelineDemo").ProjectTimelineDemo()}
          </div>
        </section>

        {/* ── Pipeline Protocol ── */}
        <section className="py-32 px-8 max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 style={{ color: FG }} className="font-headline text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              The Pipeline Protocol
            </h2>
            <p style={{ color: `${FG}70` }} className="max-w-xl mx-auto">
              Architecture simplified. Orchestrate neural networks through a spatial canvas
              designed for speed.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: "01", icon: "token", title: "Initialize Data", body: "Connect your dataset clusters. Our spatial engine auto-detects schemas and prepares the tensor flow." },
              { num: "02", icon: "layers", title: "Draft Architecture", body: "Drag and connect visual nodes to build sophisticated model architectures without touching a single line of boilerplate." },
              { num: "03", icon: "rocket_launch", title: "Deploy & Scale", body: "Compile your pipeline to highly optimized Python code or deploy directly to our serverless inference edge." },
            ].map(({ num, icon, title, body }) => (
              <div key={num} className="group relative">
                <div
                  style={{ color: `${FG}06` }}
                  className="absolute -top-12 -left-4 text-8xl font-bold font-headline select-none"
                >
                  {num}
                </div>
                <div
                  style={{ backgroundColor: `${FG}06`, borderColor: `${FG}15` }}
                  className="border p-10 rounded-xl hover:bg-opacity-10 transition-colors duration-500 relative z-10 min-h-80 flex flex-col justify-end"
                >
                  <div
                    style={{ backgroundColor: `${FG}12`, color: FG }}
                    className="mb-8 w-14 h-14 rounded-full flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-3xl">{icon}</span>
                  </div>
                  <h3 style={{ color: FG }} className="font-headline text-2xl font-bold mb-4">{title}</h3>
                  <p style={{ color: `${FG}70` }} className="text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section style={{ backgroundColor: `${FG}05` }} className="py-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-8 mb-20">
            <div className="flex flex-col md:flex-row items-end justify-between gap-8">
              <div className="max-w-2xl">
                <span style={{ color: `${FG}50` }} className="font-label text-xs tracking-[0.3em] uppercase block mb-4">
                  Transmission Logs
                </span>
                <h2 style={{ color: FG }} className="font-headline text-4xl md:text-6xl font-extrabold tracking-tighter">
                  Voices from the <br />Intelligence Frontier
                </h2>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {/* Single Row: Left scroll */}
            <div className="overflow-hidden flex">
              <div 
                className="animate-marquee hover:[animation-play-state:paused] flex gap-8 items-center py-4"
                style={{ animationDuration: '60s' }}
              >
                {[...TESTIMONIALS, ...TESTIMONIALS].map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    style={{ backgroundColor: `${FG}06`, borderColor: `${FG}15` }}
                    className="border p-8 rounded-2xl w-100 shrink-0 relative group"
                  >
                    <span style={{ color: FG, opacity: 0.1 }} className="material-symbols-outlined absolute top-4 right-4 text-3xl">format_quote</span>
                    <p style={{ color: FG }} className="text-md font-medium leading-relaxed mb-6 italic opacity-90">&ldquo;{item.quote}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div style={{ backgroundColor: FG, color: BG }} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm">
                        {item.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: FG }} className="font-bold text-sm">{item.name}</p>
                        <p style={{ color: `${FG}50` }} className="font-label text-[9px] uppercase tracking-widest">{item.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-32 px-8 max-w-4xl mx-auto">
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
                      className="p-6 pt-0 leading-relaxed border-t"
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
          <div
            style={{ background: `radial-gradient(ellipse at center, ${FG}08 0%, transparent 70%)` }}
            className="absolute inset-0"
          />
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 style={{ color: FG }} className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter mb-8 leading-tight">
              Ready to orchestrate <br />the future?
            </h2>
            <p style={{ color: `${FG}70` }} className="text-lg mb-12">
              Join 15,000+ developers building the next generation of intelligence.
            </p>
            <button
              onClick={handleOpenForm}
              style={{ backgroundColor: FG, color: BG }}
              className="px-12 py-5 font-bold text-lg rounded-lg hover:opacity-90 transition-all duration-300 shadow-2xl cursor-pointer"
            >
              Deploy Your First Node
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ backgroundColor: BG, borderColor: `${FG}10` }} className="w-full border-t">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-16 gap-8 max-w-screen-2xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="proto-ML logo"
                width={36}
                height={36}
                className="object-contain"
                unoptimized
              />
              <div style={{ color: FG }} className="text-lg font-bold font-headline tracking-tighter uppercase">
                proto-ML
              </div>
            </div>
            <div style={{ color: `${FG}50` }} className="font-space-grotesk text-xs uppercase tracking-widest">
              © {new Date().getFullYear()} proto-ML. Made by Tejas
            </div>
          </div>
          <div className="flex gap-10">
            {["Privacy", "Terms", "Github", "Twitter"].map((link) => (
              <a
                key={link}
                style={{ color: `${FG}40` }}
                className="font-space-grotesk text-xs uppercase tracking-widest hover:opacity-80 transition-all hover:-translate-y-0.5 duration-300"
                href="#"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
        <div style={{ borderColor: `${FG}08`, color: `${FG}30` }} className="w-full py-4 text-center border-t">
          <span className="font-label text-[10px] uppercase tracking-[0.5em]">
            Architecture Defined by Code — Design Defined by Light
          </span>
        </div>
      </footer>
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