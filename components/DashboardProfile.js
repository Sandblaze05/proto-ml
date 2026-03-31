'use client'

import React, { useEffect, useState, useRef } from 'react'
import { LogOut, Settings, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { useUIStore } from '@/store/useUIStore'
import gsap from 'gsap'

const DashboardProfile = () => {
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  
  const menuRef = useRef(null)
  const panelRef = useRef(null)
  const contentRef = useRef(null)
  
  const supabase = createClient()

  const showMinimap = useUIStore(s => s.showMinimap)
  const setShowMinimap = useUIStore(s => s.setShowMinimap)
  const hydrateShowMinimap = useUIStore(s => s.hydrateShowMinimap)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
  }, [])

  useEffect(() => {
    hydrateShowMinimap()
  }, [hydrateShowMinimap])

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (panelRef.current && !panelRef.current.contains(e.target)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // GSAP Animation for Settings Panel
  useEffect(() => {
    if (!panelRef.current || !contentRef.current) return;

    if (settingsOpen) {
      const tl = gsap.timeline();
      tl.to(panelRef.current, {
        width: 288,
        height: 116,
        padding: 16,
        borderRadius: 16,
        duration: 0.5,
        ease: 'power3.out',
        overwrite: 'auto'
      })
      .fromTo(contentRef.current, 
        { filter: 'blur(8px)' }, 
        { filter: 'blur(0px)', duration: 0.5, ease: 'power3.out', overwrite: 'auto' },
        '<'
      );
    } else {
      const tl = gsap.timeline();
      tl.to(panelRef.current, {
        width: 40,
        height: 40,
        padding: 0,
        borderRadius: 20,
        duration: 0.4,
        ease: 'power3.out',
        overwrite: 'auto'
      })
      .to(contentRef.current, {
        filter: 'blur(0px)',
        duration: 0.4,
        ease: 'power3.out',
        overwrite: 'auto'
      }, '<');
    }
  }, [settingsOpen])

  const avatarUrl = user?.user_metadata?.avatar_url
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'U'
  const initials = name.slice(0, 1).toUpperCase()

  return (
    <div className='z-[200] fixed top-3 right-3 flex flex-row items-start gap-3'>

      {/* Settings Panel Expanding Box */}
      <div 
        ref={panelRef}
        className={`bg-background/95 backdrop-blur-xl border-2 border-foreground shadow-[0_15px_30px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative z-[200] ${settingsOpen ? '' : 'cursor-pointer hover:border-foreground/70 border-foreground/40 hover:bg-background'}`}
        style={{ width: 40, height: 40, borderRadius: 20, padding: 0 }}
        onClick={(e) => { 
          if (!settingsOpen) {
            setSettingsOpen(true);
          }
        }}
        aria-label="Preferences"
      >
        <div ref={contentRef} className="w-full h-full flex flex-col relative">
          {/* Top bar */}
          <div className={`flex items-center w-full shrink-0 relative ${settingsOpen ? 'justify-between' : 'justify-center h-full'}`}>
            <h2 className={`text-xs font-bold font-mono text-foreground/60 tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${settingsOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
              Preferences
            </h2>
            
            <button
              onClick={(e) => { e.stopPropagation(); setSettingsOpen(s => !s) }}
              className={`flex items-center justify-center text-foreground/60 hover:text-foreground transition-all cursor-pointer rounded-full shrink-0 bg-transparent outline-none ${settingsOpen ? 'w-6 h-6 hover:bg-foreground/10' : ''}`}
              aria-label={settingsOpen ? "Close Preferences" : "Open Preferences"}
            >
              <div className={`flex items-center justify-center transition-transform duration-300 ${settingsOpen ? 'rotate-90' : 'rotate-0'}`}>
                {settingsOpen ? <X size={18} /> : <Settings size={18} />}
              </div>
            </button>
          </div>

          {/* Content */}
          <div className={`flex items-center justify-between transition-all duration-300 ${settingsOpen ? 'opacity-100 mt-5 pt-3 border-t border-foreground/10 pointer-events-auto' : 'opacity-0 h-0 w-0 border-0 m-0 p-0 pointer-events-none'}`}>
            <span className="font-mono text-sm text-foreground whitespace-nowrap">Show Minimap</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMinimap(!showMinimap) }}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-300 outline-none cursor-pointer ${showMinimap ? 'bg-cyan-600/60' : 'bg-foreground/20'}`}
              aria-label="Toggle Minimap"
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-foreground transition-transform duration-300 ${showMinimap ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Avatar Container */}
      <div className="relative z-[200]" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(s => !s)}
          className='border-2 border-foreground rounded-full w-10 h-10 overflow-hidden flex items-center justify-center cursor-pointer hover:border-foreground/70 transition-colors bg-background relative z-[200]'
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className='w-full h-full object-cover' referrerPolicy='no-referrer' />
          ) : (
            <span className='font-extrabold text-foreground text-base'>{initials}</span>
          )}
        </button>

        {/* Dropdown menu */}
        <div 
          className={`absolute top-14 right-0 w-52 bg-background/95 backdrop-blur-xl border-2 border-foreground rounded-2xl overflow-hidden shadow-xl transition-all duration-300 origin-top-right z-[201] ${menuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
        >
          <div className='px-4 py-3 border-b border-foreground/20'>
            <p className='font-mono font-bold text-sm truncate'>{name}</p>
            <p className='font-mono text-xs text-foreground/50 truncate'>{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className='w-full flex items-center gap-2 px-4 py-3 text-sm font-mono text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer'
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>

    </div>
  )
}

export default DashboardProfile