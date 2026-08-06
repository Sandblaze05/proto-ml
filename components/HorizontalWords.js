'use client'

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const words = 'Build where the future lives'

function LetteredText() {
  return words.split('').map((char, index) => {
    if (char === ' ') return ' '

    return (
      <span
        key={`${char}-${index}`}
        className="letter"
        aria-hidden="true"
        style={{ position: 'relative', display: 'inline-block' }}
      >
        {char}
      </span>
    )
  })
}

export default function HorizontalWords() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const container = sectionRef.current
      const textRef = container?.querySelector('.horizontal-words__relative')
      if (!container || !textRef) return

      const letters = container.querySelectorAll('.letter')
      const stickers = container.querySelectorAll(
        '.horizontal-words__sticker-watch, .horizontal-words__sticker-cursor, .horizontal-words__sticker-phone'
      )
      const arrows = container.querySelectorAll(
        '.horizontal-words__arrow-svg path, .horizontal-words__arrow-end-svg path'
      )

      const entranceDistance = window.innerHeight
      const pinnedDistance = 2500

      const scrollTween = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top bottom',
          end: () => `+=${entranceDistance + pinnedDistance}`,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      })

      scrollTween
        .fromTo(
          textRef,
          { x: window.innerWidth },
          {
            x: window.innerWidth * 0.5,
            ease: 'none',
            duration: entranceDistance,
          }
        )
        .to(textRef, {
          x: () => -(textRef.scrollWidth - window.innerWidth * 0.5),
          ease: 'none',
          duration: pinnedDistance,
        })

      ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: () => `+=${pinnedDistance}`,
        pin: true,
        pinSpacing: true,
        invalidateOnRefresh: true,
      })

      letters.forEach((letter) => {
        gsap.from(letter, {
          yPercent: (Math.random() - 0.5) * 500,
          rotation: (Math.random() - 0.5) * 60,
          ease: 'elastic.out(1.2, 1)',
          scrollTrigger: {
            trigger: letter,
            containerAnimation: scrollTween,
            start: 'left 90%',
            end: 'left 50%',
            scrub: 0.5,
          },
        })
      })

      stickers.forEach((sticker) => {
        gsap.from(sticker, {
          scale: 0,
          yPercent: (Math.random() - 0.5) * 400,
          rotation: (Math.random() - 0.5) * 60,
          ease: 'elastic.out(1.2, 1)',
          scrollTrigger: {
            trigger: sticker,
            containerAnimation: scrollTween,
            start: 'left 90%',
            end: 'left 50%',
            scrub: 0.5,
          },
        })
      })

      arrows.forEach((arrowPath) => {
        if (!arrowPath.getTotalLength) return

        const pathLen = arrowPath.getTotalLength()
        gsap.set(arrowPath, { strokeDasharray: pathLen, strokeDashoffset: pathLen })
        gsap.to(arrowPath, {
          strokeDashoffset: 0,
          duration: 1,
          scrollTrigger: {
            trigger: arrowPath.parentElement,
            containerAnimation: scrollTween,
            start: 'left 90%',
            end: 'left 50%',
            scrub: 0.5,
          },
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="horizontal-words-section content-section">
      <div className="horizontal-words__relative">
        <div className="horizontal-words__sticker-svg">
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 386 127" fill="none" className="horizontal-words__arrow-svg" aria-hidden="true">
            <path d="M2 123C9 35.9999 84.5 17 124 25.9999C217.764 47.3635 207 115 177.5 123C105.777 142.45 110.737 1.99991 232.5 2C310.5 2.00006 366.5 79 376 118L356.5 105.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 123C9 35.9999 84.5 17 124 25.9999C217.764 47.3635 207 115 177.5 123C105.777 142.45 110.737 1.99991 232.5 2C310.5 2.00006 366.5 79 376 118L384 97" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <svg className="horizontal-words__sticker-watch" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="var(--foreground)" />
            <path d="M43 58l11 12 25-31" stroke="var(--background)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <svg className="horizontal-words__sticker-cursor" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <path d="M25 13l60 56-31 4-15 32L25 13z" fill="var(--foreground)" />
            <path d="M53 73l18 30" stroke="var(--background)" strokeWidth="10" strokeLinecap="round" />
          </svg>

          <svg className="horizontal-words__sticker-phone" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <rect x="34" y="10" width="52" height="100" rx="14" fill="var(--foreground)" />
            <rect x="42" y="24" width="36" height="66" rx="4" fill="var(--background)" opacity="0.88" />
            <circle cx="60" cy="99" r="4" fill="var(--background)" />
          </svg>

          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 140 127" fill="none" className="horizontal-words__arrow-end-svg" aria-hidden="true">
            <path d="M2.03125 2.42188C100.469 2.42188 130.156 52.4219 118.437 125.078L99.6875 107.891" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.03125 2.42188C100.469 2.42188 130.156 52.4219 118.438 125.078L137.969 110.234" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <h2 className="display horizontal-words__h2" aria-label={words}>
            <LetteredText />
          </h2>
        </div>
      </div>

      <div className="horizontal-words__bottom-text">
        <div className="horizontal-words__bottom-text-l">
          Build visually, compile cleanly, and keep teams aligned as ideas move from canvas to production.
        </div>
      </div>
    </section>
  )
}
