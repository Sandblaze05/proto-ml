'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SidebarClose, Menu, Share2, Copy, Check, Save, Edit2, Eye, Layout, Cloud, RefreshCcw, CloudOff, Download, Upload } from 'lucide-react'
import CustomDropdown from './ui/CustomDropdown'
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
  const permissionOptions = [
    { value: 'view', label: 'View Only', icon: Eye },
    { value: 'edit', label: 'Can Edit', icon: Edit2 },
  ]

  const { nodes, edges, drawings, addToast, draftPipelineName, syncState, setNodes, setEdges, setDrawings } = useUIStore();
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const importRef = useRef(null);
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        addToast('You must be logged in to save a pipeline.', 'error');
        return;
      }

      // Safety check: ensure the user has a profile record to satisfy foreign key constraints.
      // This is especially important for accounts created before current migrations or on first save.
      const { error: profileCheckError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        }, { onConflict: 'id' });
      
      if (profileCheckError) {
        console.warn('Profile sync warning (you might need to create a profile manually):', profileCheckError);
      }

      // Safety check for nodes/edges to prevent save failures if one is corrupted or cyclic
      let cleanNodes, cleanEdges;
      try {
        const replacer = (key, val) => key === '_gsap' ? undefined : val;
        cleanNodes = JSON.parse(JSON.stringify(nodes, replacer));
        cleanEdges = JSON.parse(JSON.stringify(edges, replacer));
      } catch (err) {
        console.error('State serialization error:', err);
        throw new Error('Could not prepare pipeline data for saving. Please check for circular references in custom node data.');
      }

      const pipelineName = draftPipelineName.trim() || 'Untitled Pipeline';
      let activeId = effectivePipelineId;
      let finalError = null;

      if (activeId) {
        // Try updating existing pipeline
        const { data, error } = await supabase
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

        if (error) {
          finalError = error;
        } else if (!data) {
          // If we couldn't update (e.g. not the owner or ID doesn't exist), 
          // we treat it as a new pipeline save.
          activeId = null;
        }
      }

      // If we don't have an activeId or the update fallback to insert
      if (!activeId && !finalError) {
        const { data, error } = await supabase
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

        if (error) {
          finalError = error;
        } else if (data?.id) {
          activeId = data.id;
          setCurrentPipelineId(activeId);
        }
      }

      if (finalError) throw finalError;
      
      addToast('Pipeline saved successfully!', 'success');

      // If we're on a new canvas (/canvas), redirect to the specific ID
      if (activeId && !pathPipelineId) {
        router.push(`/canvas/${activeId}`);
      }
    } catch (error) {
      console.error('Detailed Save Error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      });
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

  // ── Export pipeline as JSON ──────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const pipelineName = (draftPipelineName || 'pipeline').trim().replace(/\s+/g, '_') || 'pipeline';
      const payload = {
        version: 1,
        name: draftPipelineName || 'Exported Pipeline',
        exportedAt: new Date().toISOString(),
        nodes: nodes || [],
        edges: edges || [],
        drawings: drawings || [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pipelineName}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Pipeline exported as JSON.', 'success');
    } catch (err) {
      console.error('Export error:', err);
      addToast('Failed to export pipeline.', 'error');
    }
  };

  // ── Import pipeline from JSON ────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const importedNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
        const importedEdges = Array.isArray(parsed.edges) ? parsed.edges : [];
        const importedDrawings = Array.isArray(parsed.drawings) ? parsed.drawings : [];
        if (!importedNodes.length && !importedEdges.length) {
          addToast('No valid pipeline data found in file.', 'error');
          return;
        }
        setNodes(importedNodes);
        setEdges(importedEdges);
        setDrawings(importedDrawings);
        addToast(`Imported "${parsed.name || file.name}" successfully.`, 'success');
      } catch {
        addToast('Invalid JSON file. Please export a valid pipeline.', 'error');
      } finally {
        // Reset so the same file can be re-imported
        if (importRef.current) importRef.current.value = '';
      }
    };
    reader.readAsText(file);
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
      {/* Floating Top Controls above the sidebar - Aligned with the Rename input on the right */}
      <div className={`z-200 fixed left-4 top-3 flex items-center gap-2 transition-all duration-400 ${navOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 px-4 h-10 bg-foreground text-background text-[11px] font-black uppercase rounded-full hover:opacity-90 transition-all shadow-xl cursor-pointer whitespace-nowrap border-2 border-foreground box-border"
        >
          <Layout size={14} /> My Projects
        </button>

        <div className='flex items-center bg-background/95 border-2 border-foreground/40 rounded-full h-10 px-4 shadow-lg backdrop-blur box-border'>
          {syncState === 'saving' && (
            <div className="flex items-center gap-2 opacity-80 pointer-events-none">
              <RefreshCcw size={14} className="animate-spin text-foreground" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-foreground pt-px">Saving...</span>
            </div>
          )}
          {syncState === 'saved' && (
            <div className="flex items-center gap-2 opacity-60 pointer-events-none">
              <Cloud size={15} className="text-foreground" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-foreground pt-px">Saved to DB</span>
            </div>
          )}
          {syncState === 'error' && (
            <div className="flex items-center gap-2 text-rose-500 opacity-90 cursor-help" title="Saved strictly to browser local storage due to connection error">
              <CloudOff size={15} />
              <span className="text-[10px] uppercase font-bold tracking-wider pt-px">Local Backup</span>
            </div>
          )}
        </div>

        {/* Export / Import JSON */}
        <div className="flex items-center bg-background/95 border-2 border-foreground/40 rounded-full h-10 shadow-lg backdrop-blur overflow-hidden box-border transition-colors group">
          <button
            onClick={handleExport}
            title="Export pipeline as JSON"
            className="flex items-center gap-1.5 px-3 h-full text-foreground text-[10px] font-black uppercase hover:bg-foreground hover:text-background transition-all whitespace-nowrap"
          >
            <Download size={13} />
            Export
          </button>
          
          <div className="w-px h-full bg-foreground/30 group-hover:bg-foreground/50 transition-colors" />

          <button
            onClick={() => importRef.current?.click()}
            title="Import pipeline from JSON"
            className="flex items-center gap-1.5 px-3 h-full text-foreground text-[10px] font-black uppercase hover:bg-foreground hover:text-background transition-all whitespace-nowrap"
          >
            <Upload size={13} />
            Import
          </button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      <div
        ref={navRef}
        onMouseEnter={() => setNavHover(true)}
        onMouseLeave={() => setNavHover(false)}
        className={`z-100 fixed py-4 px-4 flex flex-col gap-2 items-center left-4 top-16 rounded-2xl border-3 border-foreground h-auto max-h-[calc(100vh-80px)] bg-background/90 backdrop-blur-md w-100 overflow-hidden shadow-2xl`}
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
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">Permission</label>
                <CustomDropdown
                  value={sharePermission}
                  onChange={setSharePermission}
                  options={permissionOptions}
                  variant="input"
                  label="Select Access Level"
                />
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