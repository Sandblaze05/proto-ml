'use client'

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Image from "next/image"
import RegisterForm from "@/components/RegisterForm"

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
  {
    quote:
      "proto-ML has fundamentally changed how our research team iterates. Moving from visual concepts to production-ready tensor code in minutes is pure magic.",
    name: "Dr. Aris Varma",
    role: "Lead AI Scientist @ NeuralCore",
    imgSrc:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDnuY0XQ2cFs1rv5mb8iLkCapiOIlviWja9-quIZQifnrpemD1fvHDgVDoUdgenzjfLrGmnTHJYbuT8zKsbw1twc7iFDVCdJwD3YhPo7YhpuhU18sBzRS0xXyNhXrmzsISUmqs61ZZlk1eE4cSAUgp7KmuQdgi7Aapobd8Xk_tZur5L8lsPOu0M15YR2iKk-pGEP2zv0V5veVl5ZGdL4Kr8-PiHQS6qDWKJHUVfKZO0fBvQG8TqYfYoEy7agKw_IVNf9Iqyr4aXEmzX",
    imgAlt: "Portrait of Dr. Aris Varma",
  },
  {
    quote:
      "The spatial interface isn't just eye candy—it's functional. Seeing the flow of data visually prevents some of the most common architectural mistakes.",
    name: "Elena Rossi",
    role: "Founder @ Flux-AI Systems",
    imgSrc:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD-tKX2ycx829t2jEq_aDow3eBDyNfDHjp8blw8SBa2yBCsi2_TXIMMWMzRZcnNjtyKCJk8f2gF0vN3ASqAVaYo5qwfSJZiCcqIieuQEFhzaAda6n2aZTKG69ABWgYvuXkKVVvheSNPojQrxGy70BsQERYrt654U4Q0AQll908Bp3CGNZiovukNihgOCYgxaeLFbSllHqdu6S8qdx5iIidElgTpFmxirxALzH39b8U6dLGZ8Jf5sowbJ9_huytgg-IaiBi4KyPOUByI",
    imgAlt: "Portrait of Elena Rossi",
  },
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
        <section className="relative min-h-[921px] flex flex-col items-center justify-center px-6 overflow-hidden">
          {/* subtle glow using FG color */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div
              style={{ backgroundColor: `${FG}08` }}
              className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]"
            />
            <div
              style={{ backgroundColor: `${FG}05` }}
              className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[150px]"
            />
          </div>

          <div className="relative z-10 text-center max-w-5xl mx-auto">
            <h1
              style={{ color: FG }}
              className="font-headline text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-[0.95]"
            >
              Create ML pipelines <br />
              <span style={{ color: FG, opacity: 0.6 }}>on the go</span>
            </h1>

            {/* Pipeline visualiser */}
            <div className="relative w-full aspect-[21/9] mb-12 flex items-center justify-center">
              <div className="hidden md:flex absolute inset-0 items-center justify-center opacity-20 pointer-events-none">
                <svg
                  className="w-full h-full fill-none"
                  style={{ stroke: FG }}
                  viewBox="0 0 800 300"
                >
                  <path d="M100,150 Q250,50 400,150 T700,150" strokeWidth="0.5" />
                  <path d="M100,150 Q250,250 400,150 T700,150" strokeWidth="0.5" />
                  <circle cx="100" cy="150" fill={FG} r="4" className="animate-pulse" />
                  <circle cx="400" cy="150" fill={FG} r="6" opacity="0.5" />
                  <circle cx="700" cy="150" fill={FG} r="4" />
                </svg>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl relative z-10">
                {[
                  { label: "Input_Node", icon: "database", value: "training_data_v1", side: "border-l" },
                  { label: "Transformer", icon: "psychology", value: "attention_layer", side: "border-t" },
                  { label: "Output", icon: "terminal", value: "inference_api", side: "border-r" },
                ].map(({ label, icon, value, side }) => (
                  <div
                    key={label}
                    style={{
                      backgroundColor: `${FG}08`,
                      borderColor: `${FG}20`,
                      [`border${side === "border-l" ? "Left" : side === "border-t" ? "Top" : "Right"}Color`]: `${FG}60`,
                    }}
                    className={`p-6 rounded-xl border ${side}-2`}
                  >
                    <span
                      style={{ color: FG, opacity: 0.5 }}
                      className="font-label text-[10px] mb-2 block tracking-widest uppercase"
                    >
                      {label}
                    </span>
                    <div
                      style={{ backgroundColor: `${FG}0a` }}
                      className="h-12 w-full rounded flex items-center px-4"
                    >
                      <span style={{ color: FG }} className="material-symbols-outlined text-sm mr-2">{icon}</span>
                      <span style={{ color: FG }} className="font-label text-xs opacity-70">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 justify-center">
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
                  className="border p-10 rounded-xl hover:bg-opacity-10 transition-colors duration-500 relative z-10 min-h-[320px] flex flex-col justify-end"
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
        <section style={{ backgroundColor: `${FG}05` }} className="py-32 px-8 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
              <div className="max-w-2xl">
                <span style={{ color: `${FG}50` }} className="font-label text-xs tracking-[0.3em] uppercase block mb-4">
                  Transmission Logs
                </span>
                <h2 style={{ color: FG }} className="font-headline text-4xl md:text-6xl font-extrabold tracking-tighter">
                  Voices from the <br />Intelligence Frontier
                </h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {TESTIMONIALS.map(({ quote, name, role, imgSrc, imgAlt }) => (
                <div
                  key={name}
                  style={{ backgroundColor: `${FG}06`, borderColor: `${FG}15` }}
                  className="border p-12 rounded-xl relative group"
                >
                  <span
                    style={{ color: FG, opacity: 0.15 }}
                    className="material-symbols-outlined absolute top-10 right-10 text-5xl"
                  >
                    format_quote
                  </span>
                  <p style={{ color: FG }} className="text-xl md:text-2xl font-medium leading-relaxed mb-10 italic">
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgSrc}
                        alt={imgAlt}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p style={{ color: FG }} className="font-bold">{name}</p>
                      <p style={{ color: `${FG}50` }} className="font-label text-[10px] uppercase tracking-widest">
                        {role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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