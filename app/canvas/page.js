'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CanvasPage() {
  const router = useRouter()
  const initStarted = useRef(false)

  const toHandle = (value, userId) => {
    const normalized = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20)

    if (normalized) return normalized

    const suffix = String(userId || '').replace(/-/g, '').slice(0, 8)
    return `user_${suffix || 'profile'}`
  }

  useEffect(() => {
    if (initStarted.current) return
    initStarted.current = true

    const supabase = createClient()

    const createPipelineAndNavigate = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/?signup=true')
        return
      }

      // Ensure profile row exists before creating pipeline (FK: pipelines.user_id -> profiles.id).
      const preferredUsername = user.user_metadata?.full_name || user.email?.split('@')[0] || null
      const preferredHandle = toHandle(preferredUsername || user.email, user.id)
      const fallbackHandle = toHandle(null, user.id)

      const { error: profileSyncError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            username: preferredUsername,
            handle: preferredHandle,
          },
          { onConflict: 'id' }
        )

      if (profileSyncError) {
        const { error: profileFallbackError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              username: null,
              handle: fallbackHandle,
            },
            { onConflict: 'id' }
          )

        if (profileFallbackError) {
          console.error('Failed to ensure profile from /canvas route', {
            primary: profileSyncError,
            fallback: profileFallbackError,
          })
          router.replace('/dashboard')
          return
        }
      }

      const { data, error } = await supabase
        .from('pipelines')
        .insert({
          user_id: user.id,
          name: '',
          nodes: [],
          edges: [],
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        console.error('Failed to create new pipeline from /canvas route', error)
        router.replace('/dashboard')
        return
      }

      router.replace(`/canvas/${data.id}`)
    }

    createPipelineAndNavigate()
  }, [router])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <p className="text-sm font-medium text-foreground/70">Preparing your new canvas...</p>
    </div>
  )
}
