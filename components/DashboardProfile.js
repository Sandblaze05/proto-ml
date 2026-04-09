'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { LogOut, Settings, X, Cloud, RefreshCcw, CloudOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUIStore } from '@/store/useUIStore'
import gsap from 'gsap'
import { usePathname } from 'next/navigation'
import { AnimatedTooltip } from '@/components/ui/animated-tooltip'


const DashboardProfile = ({ activeCollaborators = [] }) => {
  const [user, setUser] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pipelineId, setPipelineId] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [pipelineName, setPipelineName] = useState('Unsaved Pipeline')
  const [pipelineNameDraft, setPipelineNameDraft] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [isSnapshot, setIsSnapshot] = useState(false)

  const panelRef = useRef(null)
  const contentRef = useRef(null)
  const supabase = createClient()
  const pathname = usePathname()
  const setDraftPipelineName = useUIStore(s => s.setDraftPipelineName)
  const setStorePipelineId = useUIStore(s => s.setPipelineId)
  const setSavedPipelineName = useUIStore(s => s.setSavedPipelineName)
  const showMinimap = useUIStore(s => s.showMinimap)
  const setShowMinimap = useUIStore(s => s.setShowMinimap)
  const hydrateShowMinimap = useUIStore(s => s.hydrateShowMinimap)
  const syncState = useUIStore(s => s.syncState)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
  }, [supabase])

  useEffect(() => {
    const hydratePipelineMeta = async () => {
      const pathPipelineId = pathname?.startsWith('/canvas/') ? pathname.split('/').pop() : null
      const currentPipelineId = pathPipelineId
      if (!currentPipelineId) {
        setStorePipelineId(null)
        setSavedPipelineName('')
        setIsOwner(true)
        setPipelineName('Unsaved Pipeline')
        setPipelineNameDraft('')
        setDraftPipelineName('')
        return
      }

      setPipelineId(currentPipelineId)
      const { data: { user: authedUser } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('pipelines')
        .select('user_id, name, is_snapshot')
        .eq('id', currentPipelineId)
        .single()

      if (error || !data) {
        setStorePipelineId(null)
        setSavedPipelineName('')
        setIsOwner(true)
        setPipelineName('Unsaved Pipeline')
        setPipelineNameDraft('')
        setDraftPipelineName('')
        return
      }

      const loadedName = (data.name || 'Untitled Pipeline').trim()
      setPipelineName(loadedName)
      setPipelineNameDraft(loadedName)
      setDraftPipelineName(loadedName)
      setStorePipelineId(currentPipelineId)
      setSavedPipelineName(loadedName)
      
      const ownerMatch = Boolean(authedUser?.id) && authedUser.id === data.user_id;
      const pipelineIsSnapshot = Boolean(data.is_snapshot);
      // Snapshots (community copies) are read-only even for the owner.
      setIsOwner(ownerMatch && !pipelineIsSnapshot);
      setIsSnapshot(pipelineIsSnapshot);
    }

    hydratePipelineMeta()
  }, [pathname, supabase])

  useEffect(() => {
    setDraftPipelineName(pipelineNameDraft)
  }, [pipelineNameDraft, setDraftPipelineName])

  useEffect(() => {
    hydrateShowMinimap()
  }, [hydrateShowMinimap])

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleRenamePipeline = async () => {
    const nextName = pipelineNameDraft.trim()
    if (!nextName) {
      setPipelineNameDraft(pipelineId ? pipelineName : '')
      return
    }
    if (!pipelineId) {
      setPipelineName(nextName)
      setDraftPipelineName(nextName)
      return
    }
    if (!isOwner || nextName === pipelineName) return

    setIsRenaming(true)
    try {
      const { data: { user: authedUser } } = await supabase.auth.getUser()
      if (!authedUser) return

      const { error } = await supabase
        .from('pipelines')
        .update({ name: nextName, updated_at: new Date().toISOString() })
        .eq('id', pipelineId)
        .eq('user_id', authedUser.id)

      if (error) throw error
      setPipelineName(nextName)
      setDraftPipelineName(nextName)
      setSavedPipelineName(nextName)
    } catch (error) {
      console.error('Error renaming pipeline:', error)
      setPipelineNameDraft(pipelineName)
    } finally {
      setIsRenaming(false)
    }
  }

  useEffect(() => {
    if (!panelRef.current || !contentRef.current) return

    if (settingsOpen) {
      const tl = gsap.timeline()
      tl.to(panelRef.current, {
        width: 360,
        height: 196,
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
      )
    } else {
      const tl = gsap.timeline()
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
      }, '<')
    }
  }, [settingsOpen])

  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'U'
  const collaboratorItems = useMemo(() => {
    if (!Array.isArray(activeCollaborators)) return []

    const uniqueByUserId = new Map()
    activeCollaborators.forEach((entry, index) => {
      const userId = entry?.user_id || entry?.user || `collab-${index}`
      if (!uniqueByUserId.has(userId)) {
        const displayName = entry?.user || 'Active user'
        uniqueByUserId.set(userId, {
          id: userId,
          name: displayName,
          designation: 'Active now',
          image: entry?.avatar_url || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${displayName}`,
        })
      }
    })

    return Array.from(uniqueByUserId.values())
  }, [activeCollaborators])

  return (
    <div className='z-200 fixed top-3 right-6 flex flex-row items-center gap-3 pr-2'>
      <div className='flex items-center bg-background/95 border-2 border-foreground/40 rounded-full h-10 px-3 shadow-md backdrop-blur'>
        {syncState === 'saving' && (
          <div className="flex items-center gap-1.5 opacity-60 pointer-events-none">
            <RefreshCcw size={12} className="animate-spin text-foreground" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-foreground pt-px">Saving...</span>
          </div>
        )}
        {syncState === 'saved' && (
          <div className="flex items-center gap-1.5 opacity-50 pointer-events-none">
            <Cloud size={13} className="text-foreground" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-foreground pt-px">Saved to DB</span>
          </div>
        )}
        {syncState === 'error' && (
          <div className="flex items-center gap-1.5 text-rose-500 opacity-90 cursor-help" title="Saved strictly to browser local storage due to connection error">
            <CloudOff size={13} />
            <span className="text-[10px] uppercase font-bold tracking-wider pt-px">Local Backup</span>
          </div>
        )}
      </div>

      <div className='w-56'>
        <input
          type='text'
          value={pipelineNameDraft}
          onChange={(e) => setPipelineNameDraft(e.target.value)}
          onBlur={handleRenamePipeline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
              handleRenamePipeline()
            }
            if (e.key === 'Escape') {
              setPipelineNameDraft(pipelineName)
            }
          }}
          disabled={isRenaming || (pipelineId && !isOwner)}
          placeholder='Unsaved Pipeline'
          className='h-10 w-full rounded-full border-2 border-foreground/40 bg-background/95 px-4 text-xs font-bold uppercase tracking-wide text-foreground outline-none transition-colors focus:border-foreground/70 disabled:cursor-not-allowed disabled:opacity-50'
          title={
            isSnapshot 
              ? 'Snapshots cannot be renamed' 
              : (pipelineId && !isOwner ? 'Only owner can rename' : 'Name this pipeline')
          }
        />
      </div>

      <div
        ref={panelRef}
        className={`bg-background/95 backdrop-blur-xl border-2 border-foreground shadow-[0_15px_30px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative z-200 ${settingsOpen ? '' : 'cursor-pointer hover:border-foreground/70 border-foreground/40 hover:bg-background'}`}
        style={{ width: 40, height: 40, borderRadius: 20, padding: 0 }}
        onClick={() => {
          if (!settingsOpen) {
            setSettingsOpen(true)
          }
        }}
        aria-label='Settings'
      >
        <div ref={contentRef} className='w-full h-full flex flex-col relative'>
          <div className={`flex items-center w-full shrink-0 relative ${settingsOpen ? 'justify-between' : 'justify-center h-full'}`}>
            <h2 className={`text-xs font-bold font-mono text-foreground/60 tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${settingsOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
              Settings
            </h2>

            <button
              onClick={(e) => {
                e.stopPropagation()
                setSettingsOpen(s => !s)
              }}
              className={`flex items-center justify-center text-foreground/60 hover:text-foreground transition-all cursor-pointer rounded-full shrink-0 bg-transparent outline-none ${settingsOpen ? 'w-6 h-6 hover:bg-foreground/10' : ''}`}
              aria-label={settingsOpen ? 'Close Settings' : 'Open Settings'}
            >
              <div className={`flex items-center justify-center transition-transform duration-300 ${settingsOpen ? 'rotate-90' : 'rotate-0'}`}>
                {settingsOpen ? <X size={18} /> : <Settings size={18} />}
              </div>
            </button>
          </div>

          <div className={`transition-all duration-300 ${settingsOpen ? 'opacity-100 mt-5 pt-3 border-t border-foreground/10 pointer-events-auto space-y-3' : 'opacity-0 h-0 w-0 border-0 m-0 p-0 pointer-events-none'}`}>
            <div className='flex items-center justify-between'>
              <span className='font-mono text-sm text-foreground whitespace-nowrap'>Show Minimap</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMinimap(!showMinimap)
                }}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-300 outline-none cursor-pointer ${showMinimap ? 'bg-cyan-600/60' : 'bg-foreground/20'}`}
                aria-label='Toggle Minimap'
              >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-foreground transition-transform duration-300 ${showMinimap ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className='flex items-center justify-between rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2'>
              <div className='min-w-0'>
                <p className='font-mono font-bold text-xs truncate'>{name}</p>
                <p className='font-mono text-[10px] text-foreground/60 truncate'>{user?.email || 'No email'}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSignOut()
                }}
                className='ml-3 inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-400/10 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wide text-red-300 hover:bg-red-400/20'
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {collaboratorItems.length > 0 && <AnimatedTooltip items={collaboratorItems} maxVisible={3} />}
    </div>
  )
}

export default DashboardProfile