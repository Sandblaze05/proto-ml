'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SidebarClose, Menu } from 'lucide-react'
import gsap from 'gsap'

const DashboardNav = () => {

  const navRef = useRef(null)
  const [navOpen, setNavOpen] = useState(true)
  const [navHover, setNavHover] = useState(false);

  useEffect(() => {
    if (!navRef.current) return

    const tween = gsap.to(navRef.current, {
      xPercent: navOpen ? 0 : -85,
      duration: 0.4,
      ease: 'power3.out',
      overwrite: 'auto',
    })

    return () => tween.kill()
  }, [navOpen])

  useEffect(() => {
    if (!navRef.current || navOpen) return;

    const tween = gsap.to(navRef.current, {
      xPercent: navHover ? -80 : -85,
      duration: 0.2,
      ease: 'power3.out',
      overwrite: 'auto'
    })

    return () => tween.kill();
  }, [navHover]);

  return (
    <div
      ref={navRef}
      onMouseEnter={() => setNavHover(true)}
      onMouseLeave={() => setNavHover(false)}
      className={`z-100 fixed py-4 px-4 flex flex-col gap-2 items-center left-4 top-1/2 -translate-y-[50%] rounded-2xl border-3 border-foreground h-170 bg-background w-100 overflow-hidden`}
    >
      <span className='w-full flex items-center justify-between'>
        <h1 className={`text-3xl font-bold font-mono ${navOpen && 'pointer-events-none'}`}>
          Control Panel
        </h1>
        <button
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setNavOpen((s) => !s)}
          className='p-1 text-foreground'
        >
          {navOpen ? <SidebarClose size={24} /> : <Menu size={24} />}
        </button>
      </span>
      <div className='mx-5 w-full bg-foreground h-px' />
    </div>
  )
}

export default DashboardNav