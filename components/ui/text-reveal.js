"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"

import { cn } from "@/lib/utils"

export function TextReveal({
  children,
  className,
  accentColor = "currentColor",
  mutedColor = "currentColor",
  ...props
}) {
  const sectionRef = useRef(null)

  if (typeof children !== "string") {
    throw new Error("TextReveal: children must be a string")
  }

  const words = children.split(" ")
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 75%", "end 30%"],
  })

  return (
    <div ref={sectionRef} className={cn("relative z-0", className)} {...props}>
      <div className="mx-auto flex w-full max-w-6xl items-center">
        <span
          style={{ color: accentColor }}
          className="flex flex-wrap text-2xl font-semibold leading-[1.08] tracking-tighter md:text-4xl lg:text-5xl xl:text-6xl"
        >
          {words.map((word, index) => {
            const start = index / words.length
            const end = start + 1 / words.length

            return (
              <Word key={`${word}-${index}`} progress={scrollYProgress} range={[start, end]} accentColor={accentColor} mutedColor={mutedColor}>
                {word}
              </Word>
            )
          })}
        </span>
      </div>
    </div>
  )
}

function Word({ children, progress, range, accentColor, mutedColor }) {
  const opacity = useTransform(progress, range, [0.15, 1])

  return (
    <span className="relative mx-1 md:mx-1.5">
      <span style={{ color: mutedColor }} className="absolute inset-0 opacity-30">
        {children}
      </span>
      <motion.span style={{ opacity, color: accentColor }} className="relative">
        {children}
      </motion.span>
    </span>
  )
}

export default TextReveal