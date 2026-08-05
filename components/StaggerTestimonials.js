"use client"

import React, { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Quote } from "lucide-react"

const SQRT_5000 = Math.sqrt(5000)

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function TestimonialCard({ item, position, onMove, cardSize, fg, bg }) {
  const isCenter = position === 0
  const depth = Math.abs(position)
  const xOffset = cardSize * 0.98 * position
  const yOffset = isCenter ? -44 : position % 2 ? 18 : -18
  const rotation = isCenter ? 0 : position % 2 ? 2.75 : -2.75

  return (
    <button
      type="button"
      onClick={() => onMove(position)}
      className="absolute left-1/2 top-1/2 cursor-pointer text-left transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        width: cardSize,
        height: cardSize * 1.08,
        zIndex: isCenter ? 20 : 10 - depth,
        transform: `translate(-50%, -50%) translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg) scale(${isCenter ? 1 : 1 - depth * 0.02})`,
        opacity: isCenter ? 1 : Math.max(0.86, 1 - depth * 0.04),
        filter: isCenter ? "none" : "saturate(0.98)",
      }}
      aria-label={`Open testimonial from ${item.name}`}
    >
      <div
        className="relative h-full border p-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-all duration-700"
        style={{
          background:
            isCenter
              ? `linear-gradient(180deg, ${fg} 0%, #f3e4c8 100%)`
              : `linear-gradient(180deg, rgba(250,235,215,0.24) 0%, rgba(250,235,215,0.14) 100%)`,
          color: isCenter ? bg : fg,
          borderColor: isCenter ? fg : `${fg}38`,
          clipPath:
            "polygon(38px 0%, calc(100% - 38px) 0%, 100% 38px, 100% 100%, calc(100% - 38px) 100%, 38px 100%, 0 100%, 0 0)",
          boxShadow: isCenter
            ? "0 12px 0 rgba(250, 235, 215, 0.22)"
            : "0 20px 50px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(250, 235, 215, 0.18)",
        }}
      >
        <span
          className="absolute block origin-top-right rotate-45"
          style={{
            right: -2,
            top: 40,
            width: SQRT_5000,
            height: 2,
            backgroundColor: isCenter ? bg : fg,
            opacity: isCenter ? 0.45 : 0.28,
          }}
        />

        <div className="mb-6 flex items-start justify-between gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center border text-base font-extrabold tracking-tight"
            style={{
              backgroundColor: isCenter ? bg : fg,
              color: isCenter ? fg : bg,
              borderColor: isCenter ? bg : `${fg}40`,
              boxShadow: "3px 3px 0 rgba(0,0,0,0.12)",
            }}
          >
            {getInitials(item.name)}
          </div>

          <Quote
            size={34}
            strokeWidth={1.75}
            style={{
              color: isCenter ? bg : fg,
              opacity: isCenter ? 0.22 : 0.18,
              flexShrink: 0,
            }}
          />
        </div>

        <p
          className="text-balance text-[1.02rem] leading-relaxed sm:text-[1.08rem]"
          style={{
            opacity: isCenter ? 0.95 : 0.98,
          }}
        >
          &ldquo;{item.quote}&rdquo;
        </p>

        <div className="absolute bottom-7 left-7 right-7">
          <div
            className="mb-4 h-px w-full"
            style={{
              backgroundColor: isCenter ? `${bg}18` : `${fg}16`,
            }}
          />
          <p className="text-sm font-semibold tracking-wide">{item.name}</p>
          <p
            className="mt-1 text-[11px] font-medium uppercase tracking-[0.24em]"
            style={{
              opacity: isCenter ? 0.7 : 0.68,
            }}
          >
            {item.role}
          </p>
        </div>
      </div>
    </button>
  )
}

export default function StaggerTestimonials({ testimonials, fg = "#faebd7", bg = "#171717" }) {
  const [cardSize, setCardSize] = useState(360)
  const [list, setList] = useState(testimonials)

  useEffect(() => {
    setList(testimonials)
  }, [testimonials])

  useEffect(() => {
    const updateSize = () => {
      const isSm = window.matchMedia("(min-width: 640px)").matches
      setCardSize(isSm ? 360 : 292)
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setList((current) => {
        if (current.length < 2) return current
        return [...current.slice(1), current[0]]
      })
    }, 4200)

    return () => window.clearInterval(timer)
  }, [])

  const handleMove = (steps) => {
    if (!steps) return

    setList((current) => {
      const next = [...current]

      if (steps > 0) {
        for (let i = 0; i < steps; i += 1) {
          const item = next.shift()
          if (!item) break
          next.push(item)
        }
      } else {
        for (let i = steps; i < 0; i += 1) {
          const item = next.pop()
          if (!item) break
          next.unshift(item)
        }
      }

      return next
    })
  }

  return (
    <div
      className="relative w-full overflow-visible"
      style={{
        minHeight: 680,
      }}
    >
      <div className="absolute inset-0 pointer-events-none" />

      <div className="relative min-h-[680px] w-full">
        {list.map((item, index) => {
          const centerIndex = Math.floor(list.length / 2)
          const position = index - centerIndex

          return (
            <TestimonialCard
              key={`${item.name}-${item.role}-${index}`}
              item={item}
              position={position}
              onMove={handleMove}
              cardSize={cardSize}
              fg={fg}
              bg={bg}
            />
          )
        })}
      </div>

      <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-3">
        <button
          type="button"
          onClick={() => handleMove(-1)}
          className="flex h-14 w-14 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            backgroundColor: `${bg}d8`,
            borderColor: `${fg}30`,
            color: fg,
          }}
          aria-label="Previous testimonial"
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          onClick={() => handleMove(1)}
          className="flex h-14 w-14 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            backgroundColor: `${bg}d8`,
            borderColor: `${fg}30`,
            color: fg,
          }}
          aria-label="Next testimonial"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
