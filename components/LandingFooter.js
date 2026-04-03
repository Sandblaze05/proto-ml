"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

function useMediaQuery(query) {
  const [value, setValue] = useState(false)

  useEffect(() => {
    function check() {
      const m = window.matchMedia(query)
      setValue(m.matches)
    }

    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [query])

  return value
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "").trim()
  if (cleaned.length !== 6) return null
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  return { r, g, b }
}

function colorWithOpacity(color, opacity) {
  const rgb = hexToRgb(color)
  if (!rgb) return color
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
}

function getRGBAColor(color) {
  // Used only as a base color; actual opacity is applied per square.
  return color
}

export default function LandingFooter() {
  const tablet = useMediaQuery("(max-width: 1024px)")

  return (
    <footer
      id="footer"
      className="w-full pb-0 relative overflow-hidden border-t border-white/5"
      style={{ backgroundColor: "#171717" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(125% 125% at 50% 10%, rgba(23, 23, 23, 0.88) 45%, rgba(250, 235, 215, 0.1) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between p-10">
        <div className="flex flex-col items-start justify-start gap-y-5 max-w-xs">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="proto-ML"
              width={28}
              height={28}
              unoptimized
              className="object-contain"
            />
            <p className="text-xl font-semibold" style={{ color: "#faebd7" }}>
              proto-ML
            </p>
          </Link>

          <p className="tracking-tight text-sm font-medium" style={{ color: "#faebd7cc" }}>
            Create ML pipelines on the go — from graph authoring to production-ready code.
          </p>

          <div className="flex items-center gap-2 opacity-90">
            <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "#faebd7" }}>
              SECURE • FAST • VISUAL
            </span>
          </div>
        </div>

        <div className="pt-5 md:w-1/2">
          <div className="flex flex-col items-start justify-start md:flex-row md:items-center md:justify-between gap-y-5 lg:pl-10">
            <FooterColumn
              title="Company"
              items={[
                { title: "About", href: "/about" },
                { title: "Contact", href: "#" },
                { title: "Blog", href: "#" },
                { title: "Story", href: "/about" },
              ]}
            />
            <FooterColumn
              title="Products"
              items={[
                { title: "Compiler", href: "#" },
                { title: "Graph Editor", href: "#" },
                { title: "Export", href: "#" },
                { title: "More", href: "#" },
              ]}
            />
            <FooterColumn
              title="Resources"
              items={[
                { title: "Docs", href: "#" },
                { title: "Careers", href: "#" },
                { title: "Changelog", href: "#" },
                { title: "Support", href: "#" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="w-full h-48 md:h-64 relative mt-10 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[#171717] z-10 from-40%" />
        <div className="absolute inset-0 mx-6">
          <FlickeringGrid
            text={tablet ? "proto-ML" : "proto-ML"}
            fontSize={tablet ? 70 : 150}
            className="h-full w-full"
            squareSize={2}
            gridGap={tablet ? 2 : 3}
            color="#faebd7"
            maxOpacity={0.22}
            flickerChance={0.1}
          />
        </div>
      </div>

      <div className="relative z-10 w-full py-4 text-center border-t border-white/10">
        <span className="text-[10px] uppercase tracking-[0.5em]" style={{ color: "#faebd733" }}>
          Architecture Defined by Code — Design Defined by Light
        </span>
      </div>
    </footer>
  )
}

function FooterColumn({ title, items }) {
  return (
    <ul className="flex flex-col gap-y-2">
      <li className="mb-2 text-sm font-semibold" style={{ color: "#faebd7" }}>
        {title}
      </li>
      {items.map((link) => (
        <li
          key={link.title}
          className="group inline-flex cursor-pointer items-center justify-start gap-2 text-[15px]/snug"
          style={{ color: "#faebd7cc" }}
        >
          <Link
            href={link.href}
            className="hover:opacity-90 transition-opacity"
            style={{ color: "inherit" }}
          >
            {link.title}
          </Link>
          <span
            className="flex size-4 items-center justify-center border border-white/10 rounded translate-x-0 transform opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100"
          >
            <span style={{ color: "#faebd7", fontSize: 12 }}>&rsaquo;</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function FlickeringGrid({
  squareSize = 3,
  gridGap = 3,
  flickerChance = 0.2,
  color = "#B4B4B4",
  width,
  height,
  className,
  maxOpacity = 0.15,
  text = "",
  fontSize = 140,
  fontWeight = 600,
  ...props
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [isInView, setIsInView] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const memoizedColor = useMemo(() => getRGBAColor(color), [color])

  const drawGrid = useCallback(
    (ctx, widthPx, heightPx, cols, rows, squares, dpr) => {
      if (widthPx <= 0 || heightPx <= 0) return
      ctx.clearRect(0, 0, widthPx, heightPx)

      const maskCanvas = document.createElement("canvas")
      maskCanvas.width = widthPx
      maskCanvas.height = heightPx
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true })
      if (!maskCtx) return

      if (text) {
        maskCtx.save()
        maskCtx.scale(dpr, dpr)
        maskCtx.fillStyle = "white"
        maskCtx.font = `${fontWeight} ${fontSize}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        maskCtx.textAlign = "center"
        maskCtx.textBaseline = "middle"
        maskCtx.fillText(text, widthPx / (2 * dpr), heightPx / (2 * dpr))
        maskCtx.restore()
      }

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * (squareSize + gridGap) * dpr
          const y = j * (squareSize + gridGap) * dpr
          const sw = Math.max(1, Math.floor(squareSize * dpr))
          const sh = Math.max(1, Math.floor(squareSize * dpr))

          let finalOpacity = squares[i * rows + j]

          if (text && maskCanvas.width > 0 && maskCanvas.height > 0) {
            const maskData = maskCtx.getImageData(x, y, sw, sh).data
            const hasText = maskData.some((v, idx) => idx % 4 === 0 && v > 0)
            if (hasText) finalOpacity = Math.min(1, finalOpacity * 3 + 0.4)
          }

          ctx.fillStyle = colorWithOpacity(memoizedColor, finalOpacity)
          ctx.fillRect(x, y, sw, sh)
        }
      }
    },
    [memoizedColor, squareSize, gridGap, text, fontSize, fontWeight],
  )

  const setupCanvas = useCallback(
    (canvas, newWidth, newHeight) => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = newWidth * dpr
      canvas.height = newHeight * dpr
      canvas.style.width = `${newWidth}px`
      canvas.style.height = `${newHeight}px`

      const cols = Math.ceil(newWidth / (squareSize + gridGap))
      const rows = Math.ceil(newHeight / (squareSize + gridGap))

      const squares = new Float32Array(cols * rows)
      for (let i = 0; i < squares.length; i++) squares[i] = Math.random() * maxOpacity

      return { cols, rows, squares, dpr }
    },
    [squareSize, gridGap, maxOpacity],
  )

  const updateSquares = useCallback(
    (squares, deltaTime) => {
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * deltaTime) squares[i] = Math.random() * maxOpacity
      }
    },
    [flickerChance, maxOpacity],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId = 0
    let gridParams

    const updateCanvasSize = () => {
      const w = width || container.clientWidth
      const h = height || container.clientHeight
      setCanvasSize({ width: w, height: h })
      gridParams = setupCanvas(canvas, w, h)
    }

    updateCanvasSize()

    let lastTime = 0
    const animate = (time) => {
      if (!isInView) return

      const deltaTime = (time - lastTime) / 1000
      lastTime = time

      updateSquares(gridParams.squares, deltaTime)
      drawGrid(ctx, canvas.width, canvas.height, gridParams.cols, gridParams.rows, gridParams.squares, gridParams.dpr)
      animationFrameId = requestAnimationFrame(animate)
    }

    const resizeObserver = new ResizeObserver(() => updateCanvasSize())
    resizeObserver.observe(container)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0 },
    )
    intersectionObserver.observe(canvas)

    if (isInView) animationFrameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [setupCanvas, updateSquares, drawGrid, width, height, isInView])

  return (
    <div ref={containerRef} className={cn(`h-full w-full ${className ?? ""}`)} {...props}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{ width: canvasSize.width, height: canvasSize.height }}
      />
    </div>
  )
}

