'use client'

import { useEffect, useRef } from 'react'
import { FileCode, Settings2, Terminal, Rocket } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
  {
    icon: FileCode,
    title: 'Design on Canvas',
    description:
      'Drag dataset, transform, and lifecycle nodes onto an infinite canvas. Wire ports to build your ML pipeline visually, no syntax required.',
  },
  {
    icon: Settings2,
    title: 'Configure & Preview',
    description:
      'Set node parameters, preview synthetic samples per node, and validate data shapes before running anything.',
  },
  {
    icon: Terminal,
    title: 'Compile to Python',
    description:
      'One click compiles your graph into deterministic, readable Python with a single pipeline entrypoint ready for review.',
  },
  {
    icon: Rocket,
    title: 'Run & Validate',
    description:
      'Execute through the real Python/Jupyter-backed runner, inspect logs, and iterate fast with full pipeline visibility.',
  },
]

const HowItWorks = () => {
  const sectionRef = useRef(null)
  const iconsRef = useRef([])
  const barsRef = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const icons = iconsRef.current.filter(Boolean)
      const bars = barsRef.current.filter(Boolean)

      // Initial state
      gsap.set(icons, {
        opacity: 0.3,
        scale: 1,
      })

      gsap.set(bars, {
        scaleX: 0,
      })

      // First icon starts lit
      gsap.set(icons[0], {
        opacity: 1,
      })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      })

      icons.forEach((icon, i) => {
        // Light up current icon
        if (i !== 0) {
          tl.to(
            icon,
            {
              opacity: 1,
              duration: 0.35,
              ease: 'power2.out',
            },
            '>'
          )
        }

        // Fill connector after current icon
        if (bars[i]) {
          tl.to(
            bars[i],
            {
              scaleX: 1,
              duration: 0.7,
              ease: 'power2.inOut',
            },
            '+=0.1'
          )

          // Dim previous icon slightly as progress moves forward
          if (icons[i]) {
            tl.to(
              icons[i],
              {
                opacity: 0.55,
                duration: 0.2,
              },
              '>-0.2'
            )
          }

          // Re-light next icon
          if (icons[i + 1]) {
            tl.to(
              icons[i + 1],
              {
                opacity: 1,
                duration: 0.35,
                ease: 'power2.out',
              },
              '>'
            )
          }
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={sectionRef}
      className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 w-full"
    >
      {STEPS.map((step, i) => {
        const Icon = step.icon
        const isLast = i === STEPS.length - 1

        return (
          <div
            key={step.title}
            className="flex flex-col justify-between w-full h-full p-4"
          >
            <div>
              {/* Icon + Connector */}
              <div className="flex items-center w-full gap-4 mb-5">
                <span
                  ref={(el) => {
                    iconsRef.current[i] = el
                  }}
                  className="shrink-0 rounded-full bg-foreground text-background p-2.5 flex items-center justify-center"
                >
                  <Icon size={20} strokeWidth={1.5} />
                </span>

                {!isLast && (
                  <div className="hidden md:block flex-1 h-0.5 bg-white/10 relative overflow-hidden">
                    <div
                      ref={(el) => {
                        barsRef.current[i] = el
                      }}
                      className="absolute inset-0 bg-foreground"
                      style={{
                        transformOrigin: 'left center',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Title + Description */}
              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-lg">
                  {step.title}
                </h3>

                <p className="text-sm opacity-70 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Step Number */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs font-mono opacity-30">
                0{i + 1}
              </span>

              {!isLast && (
                <div className="md:hidden flex-1 ml-4 h-0.5 bg-white/10 relative overflow-hidden">
                  <div
                    className="absolute inset-0 bg-foreground"
                    style={{
                      transformOrigin: 'left center',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default HowItWorks