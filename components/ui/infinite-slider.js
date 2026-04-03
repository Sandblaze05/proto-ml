"use client"

import { useEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue } from "framer-motion"
import { cn } from "@/lib/utils"

export function InfiniteSlider({
  children,
  gap = 16,
  duration = 25,
  durationOnHover,
  direction = "horizontal",
  reverse = false,
  className,
}) {
  const [currentDuration, setCurrentDuration] = useState(duration)
  const translation = useMotionValue(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [key, setKey] = useState(0)
  const trackRef = useRef(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const node = trackRef.current
    if (!node) return

    const updateSize = () => {
      const next = direction === "horizontal" ? node.scrollWidth / 2 : node.scrollHeight / 2
      setSize(next)
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(node)

    return () => {
      resizeObserver.disconnect()
    }
  }, [children, gap, direction])

  useEffect(() => {
    if (!size) return

    let controls
    const contentSize = size + gap
    const from = reverse ? -contentSize / 2 : 0
    const to = reverse ? 0 : -contentSize / 2

    if (isTransitioning) {
      controls = animate(translation, to, {
        ease: "linear",
        duration: currentDuration * Math.abs((translation.get() - to) / contentSize),
        onComplete: () => {
          setIsTransitioning(false)
          setKey((prevKey) => prevKey + 1)
        },
      })
    } else {
      translation.set(from)
      controls = animate(translation, to, {
        ease: "linear",
        duration: currentDuration,
        repeat: Infinity,
        repeatType: "loop",
        repeatDelay: 0,
        onRepeat: () => {
          translation.set(from)
        },
      })
    }

    return () => controls?.stop()
  }, [key, translation, currentDuration, gap, isTransitioning, direction, reverse, size])

  const hoverProps = durationOnHover
    ? {
        onHoverStart: () => {
          setIsTransitioning(true)
          setCurrentDuration(durationOnHover)
        },
        onHoverEnd: () => {
          setIsTransitioning(true)
          setCurrentDuration(duration)
        },
      }
    : {}

  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        className="flex w-max"
        style={{
          ...(direction === "horizontal" ? { x: translation } : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === "horizontal" ? "row" : "column",
        }}
        ref={trackRef}
        {...hoverProps}
      >
        {children}
        {children}
      </motion.div>
    </div>
  )
}
