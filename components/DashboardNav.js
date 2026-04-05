'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SidebarClose, Menu, Share2, Copy, Check, Save } from 'lucide-react'
import gsap from 'gsap'
import NodePalette from './NodePalette'
import { useUIStore } from '@/store/useUIStore'
import { createClient } from '@/lib/supabase/client'
import { usePathname, useRouter } from 'next/navigation'



const DashboardNav = () => {

  const navRef = useRef(null)
  const [navOpen, setNavOpen] = useState(true)
  const [navHover, setNavHover] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [currentPipelineId, setCurrentPipelineId] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [shareMode, setShareMode] = useState('email');
  const [sharePermission, setSharePermission] = useState('view');
  const [shareGenerated, setShareGenerated] = useState(false);
  const { nodes, edges, addToast, draftPipelineName } = useUIStore();
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const pathPipelineId = pathname?.startsWith('/canvas/') ? pathname.split('/').pop() : null;
  const effectivePipelineId = pathPipelineId || currentPipelineId;

  useEffect(() => {
    const resolvePipelineContext = async () => {
      const pipelineId = pathPipelineId;

      if (!pipelineId) {
        setCurrentPipelineId(null);
        setIsOwner(true);
        return;
      }

      setCurrentPipelineId(pipelineId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setIsOwner(false);
        return;
      }

      const { data, error } = await supabase
        .from('pipelines')
        .select('user_id, name')
        .eq('id', pipelineId)
        .single();

      if (error || !data) {
        setCurrentPipelineId(null);
        return;
      }

      setIsOwner(user.id === data.user_id);
    };
    resolvePipelineContext();
  }, [pathname, supabase]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        addToast('You must be logged in to save a pipeline.', 'error');
        return;
      }

      const cleanNodes = JSON.parse(JSON.stringify(nodes, (key, val) => key === '_gsap' ? undefined : val));
      const cleanEdges = JSON.parse(JSON.stringify(edges, (key, val) => key === '_gsap' ? undefined : val));
      const pipelineName = draftPipelineName.trim() || 'Untitled Pipeline';

      let activeId = effectivePipelineId;
      let error = null;

      if (activeId) {
        const response = await supabase
          .from('pipelines')
          .update({
            name: pipelineName,
            nodes: cleanNodes,
            edges: cleanEdges,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeId)
          .eq('user_id', user.id)
          .select('id')
          .maybeSingle();

        error = response.error;
        if (!error && !response.data) {
          // Stale active id (e.g. shared/non-owned row in local storage): create a fresh owned pipeline.
          activeId = null;
        }
      } else {
        const response = await supabase
          .from('pipelines')
          .insert({
            user_id: user.id,
            name: pipelineName,
            nodes: cleanNodes,
            edges: cleanEdges,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        error = response.error;
        if (!error && response.data?.id) {
          activeId = response.data.id;
          setCurrentPipelineId(activeId);
        }
      }

      if (!activeId && !error) {
        const response = await supabase
          .from('pipelines')
          .insert({
            user_id: user.id,
            name: pipelineName,
            nodes: cleanNodes,
            edges: cleanEdges,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        error = response.error;
        if (!error && response.data?.id) {
          activeId = response.data.id;
          setCurrentPipelineId(activeId);
        }
      }

      if (error) throw error;
      addToast('Pipeline saved successfully!', 'success');

      if (activeId && !pathPipelineId) {
        router.push(`/canvas/${activeId}`);
      }
    } catch (error) {
      console.error('Error saving pipeline:', error);
      addToast(`Error: ${error.message || 'Failed to save pipeline.'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        addToast('You must be logged in to share a pipeline.', 'error');
        return;
      }

      const pipelineIdForShare = effectivePipelineId;

      if (!pipelineIdForShare) {
        addToast('Save this pipeline first, then share it from here.', 'error');
        return;
      }

      const normalizedEmail = recipientEmail.trim().toLowerCase();
      if (shareMode === 'email') {
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
        if (!isValidEmail) {
          addToast('Enter a valid recipient email address.', 'error');
          return;
        }
      }

      const { data: pipelineData, error: pipelineError } = await supabase
        .from('pipelines')
        .select('user_id')
        .eq('id', pipelineIdForShare)
        .single();

      if (pipelineError) throw pipelineError;
      if (!pipelineData || pipelineData.user_id !== user.id) {
        addToast('Only the pipeline owner can share this pipeline.', 'error');
        return;
      }

      let error = null;
      if (shareMode === 'email') {
        const response = await supabase
          .from('pipeline_shares')
          .upsert(
            {
              pipeline_id: pipelineIdForShare,
              owner_id: user.id,
              share_scope: 'email',
              shared_with_email: normalizedEmail,
              permission: sharePermission,
            },
            { onConflict: 'pipeline_id,shared_with_email' }
          );
        error = response.error;
      } else {
        const deleteResponse = await supabase
          .from('pipeline_shares')
          .delete()
          .eq('pipeline_id', pipelineIdForShare)
          .eq('share_scope', 'public');

        if (deleteResponse.error) {
          error = deleteResponse.error;
        } else {
          const insertResponse = await supabase
            .from('pipeline_shares')
            .insert({
              pipeline_id: pipelineIdForShare,
              owner_id: user.id,
              share_scope: 'public',
              shared_with_email: null,
              permission: sharePermission,
            });
          error = insertResponse.error;
        }
      }

      if (error) {
        console.error('Supabase Error:', error.message, error.details, error.hint);
        throw new Error(error.message || 'Failed to create share permission');
      }

      const link = `${window.location.origin}/canvas/${pipelineIdForShare}?access=${sharePermission}`;
      setShareLink(link);
      setShareGenerated(true);
      addToast(shareMode === 'public' ? 'Public share link generated.' : 'Share link generated.', 'success');
    } catch (error) {
      console.error('Detailed Error Sharing Pipeline:', error);
      addToast(`Error: ${error.message || 'Failed to generate share link.'}`, 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
  }, [navHover, navOpen]);

  return (
    <>
      <div
        ref={navRef}
        onMouseEnter={() => setNavHover(true)}
        onMouseLeave={() => setNavHover(false)}
        className={`z-100 fixed py-4 px-4 flex flex-col gap-2 items-center left-4 top-1/2 -translate-y-[50%] rounded-2xl border-3 border-foreground h-170 bg-background/90 backdrop-blur-md w-100 overflow-hidden shadow-2xl`}
      >
        <span className='w-full flex items-center justify-between'>
          <span className='flex flex-col gap-3 items-center w-full'>
            <span className='w-full flex items-center justify-between gap-3'>
              <h1 className={`text-3xl font-bold font-mono ${navOpen && 'pointer-events-none'}`}>
                Control Panel
              </h1>
            </span>
            <div className='mx-5 w-full bg-foreground h-px' />
          </span>
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <button
                  aria-label="Save Project"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`p-1 text-foreground pb-3 cursor-pointer hover:opacity-80 transition-opacity ${isSaving ? 'animate-pulse' : ''}`}
                >
                  <Save size={20} />
                </button>
                <button
                  aria-label="Share Project"
                  onClick={() => {
                    setShareModalOpen(true);
                    setShareMode('email');
                    setRecipientEmail('');
                    setSharePermission('view');
                    setShareGenerated(false);
                    setShareLink('');
                  }}
                  disabled={isSharing}
                  className={`p-1 text-foreground pb-3 cursor-pointer hover:opacity-80 transition-opacity ${isSharing ? 'animate-pulse' : ''}`}
                >
                  <Share2 size={20} />
                </button>
              </>
            )}
            <button
              aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setNavOpen((s) => !s)}
              className='p-1 text-foreground pb-3 cursor-pointer hover:opacity-80 transition-opacity'
            >
              {navOpen ? <SidebarClose size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </span>
        <div className={`nowheel w-full px-4 overflow-y-auto transition-opacity duration-200 ${navOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <NodePalette />
        </div>
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-foreground/20 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold font-mono text-foreground mb-4">Share Pipeline</h2>
            <p className="text-foreground/70 mb-4 text-sm">Choose who gets access and whether they can edit or only view.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">Share Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setShareMode('email');
                      setShareGenerated(false);
                      setShareLink('');
                    }}
                    className={`py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${shareMode === 'email' ? 'bg-foreground text-background border-foreground' : 'border-foreground/20 text-foreground hover:bg-foreground/5'}`}
                  >
                    Specific Email
                  </button>
                  <button
                    onClick={() => {
                      setShareMode('public');
                      setRecipientEmail('');
                      setShareGenerated(false);
                      setShareLink('');
                    }}
                    className={`py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${shareMode === 'public' ? 'bg-foreground text-background border-foreground' : 'border-foreground/20 text-foreground hover:bg-foreground/5'}`}
                  >
                    Public Link
                  </button>
                </div>
              </div>

              <div>
                {shareMode === 'email' ? (
                  <>
                    <label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">Recipient Email</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-foreground/5 border border-foreground/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/50"
                    />
                  </>
                ) : (
                  <p className="text-[11px] text-foreground/50">Anyone with this link and a Proto-ML account can access.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">Permission</label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/50"
                >
                  <option value="view">View Only</option>
                  <option value="edit">Can Edit</option>
                </select>
              </div>

              <button
                onClick={handleShare}
                disabled={isSharing || !effectivePipelineId}
                className="w-full py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity font-bold disabled:opacity-40"
              >
                {isSharing ? 'Generating Link...' : 'Generate Share Link'}
              </button>
            </div>

            {shareGenerated && (
              <div className="flex items-center gap-2 bg-foreground/5 p-2 rounded-lg border border-foreground/10 mt-4">
                <input 
                  type="text" 
                  readOnly 
                  value={shareLink} 
                  className="flex-1 bg-transparent border-none outline-none text-foreground text-sm font-mono px-2"
                />
                <button 
                  onClick={handleCopy}
                  className="p-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span className="text-sm font-bold">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            )}

            {!effectivePipelineId && (
              <p className="text-xs text-red-400 mt-3">Open a saved pipeline to share it.</p>
            )}

            <button 
              onClick={() => {
                setShareModalOpen(false);
                setShareMode('email');
                setRecipientEmail('');
                setShareGenerated(false);
                setShareLink('');
                setCopied(false);
              }}
              className="mt-6 w-full py-2 border border-foreground/20 text-foreground rounded-lg hover:bg-foreground/5 transition-colors font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default DashboardNav