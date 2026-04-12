'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Share2, Layout, Copy, GitFork, Eye, X, Pencil, LogOut } from 'lucide-react';
import InfiniteCanvas from '@/components/InfiniteCanvas';
import DashboardNav from '@/components/DashboardNav';
import DashboardProfile from '@/components/DashboardProfile';
import PipelineCompilerPanel from '@/components/PipelineCompilerPanel';
import { useUIStore } from '@/store/useUIStore';
import { createClient } from '@/lib/supabase/client';
import { bootstrapClientPlugins } from '@/lib/plugins/clientPluginBootstrap';
import { forkPipeline } from '@/lib/community';
import CanvasSkeleton from '@/components/canvas/CanvasSkeleton';

const hueToHex = (hue) => {
  const saturation = 0.76;
  const lightness = 0.62;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return [red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('');
};

const pickCursorColor = (seed) => {
  const value = String(seed || '');
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return `#${hueToHex(hash % 360)}`;
};

const supabase = createClient();

// ─── Helper: detect whether a name is "unnamed" ────────────────────────────────
const isUnnamedPipeline = (name) => {
  if (!name || name.trim() === '') return true;
  const trimmed = name.trim();
  if (trimmed === 'Unsaved Pipeline') return true;
  // Matches "Untitled Pipeline", "Untitled Pipeline (2)", "Untitled Pipeline (15)" …
  return /^Untitled Pipeline(\s\(\d+\))?$/i.test(trimmed);
};

// ─── Helper: generate next "Untitled Pipeline (N)" label ─────────────────────────────────
const nextUnnamedLabel = async (userId) => {
  const { data } = await supabase
    .from('pipelines')
    .select('name')
    .eq('user_id', userId);

  const existingNames = new Set((data || []).map((p) => (p.name || '').trim()));

  if (!existingNames.has('Untitled Pipeline')) return 'Untitled Pipeline';

  let n = 2;
  while (existingNames.has(`Untitled Pipeline (${n})`)) n++;
  return `Untitled Pipeline (${n})`;
};

// ─── LeaveModal ────────────────────────────────────────────────────────────────
const LeaveModal = ({ currentName, pipelineId, onSaveAndLeave, onDiscardAndLeave, onCancel, isSaving }) => {
  const [name, setName] = useState(currentName || '');

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative bg-background border border-foreground/20 rounded-2xl p-7 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
        style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-full text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all"
          aria-label="Stay on canvas"
        >
          <X size={16} />
        </button>

        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20">
            <Pencil size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-foreground leading-tight">Name this pipeline</h2>
            <p className="text-[11px] text-foreground/50 mt-0.5">Give it a name before you leave</p>
          </div>
        </div>

        {/* Name input */}
        <div className="mb-5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/50 mb-1.5">
            Pipeline Name
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onSaveAndLeave(name.trim());
            }}
            placeholder="My awesome pipeline…"
            className="w-full h-10 rounded-xl border-2 border-foreground/25 bg-foreground/5 px-4 text-sm font-medium text-foreground outline-none transition-colors focus:border-foreground/60 placeholder:text-foreground/25"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => onSaveAndLeave(name.trim() || null)}
            disabled={isSaving}
            className="w-full py-2.5 bg-foreground text-background rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
            ) : null}
            {isSaving ? 'Saving…' : 'Save & Leave'}
          </button>
          <button
            onClick={onDiscardAndLeave}
            className="w-full py-2.5 border border-foreground/15 text-foreground/70 rounded-xl font-bold text-sm hover:bg-foreground/5 hover:text-foreground transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            Discard & Leave
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────

const SharedCanvasPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setNodes = useUIStore(state => state.setNodes);
  const setEdges = useUIStore(state => state.setEdges);
  const setDrawings = useUIStore(state => state.setDrawings);
  const { addToast } = useUIStore();
  const nodes = useUIStore(state => state.nodes);
  const edges = useUIStore(state => state.edges);
  const drawings = useUIStore(state => state.drawings);
  const savedPipelineName = useUIStore(state => state.savedPipelineName);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [channel, setChannel] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isSnapshot, setIsSnapshot] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState([]);
  const [remoteNodeEditors, setRemoteNodeEditors] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  // ── Leave modal state ──────────────────────────────────────────────────────
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [isSavingLeave, setIsSavingLeave] = useState(false);
  const pendingNavTarget = useRef(null); // href to navigate to after modal resolves
  const leaveAllowed = useRef(false);   // when true, skip interception

  // ── Refs ───────────────────────────────────────────────────────────────────
  const isUpdatingFromRemote = useRef(false);
  const lastSavedState = useRef(null);
  const pendingSaveSnapshot = useRef(null);
  const saveInFlight = useRef(false);
  const hasHydratedPipeline = useRef(false);
  const supportsDrawingsColumn = useRef(true);
  const drawingsSchemaWarned = useRef(false);
  const activeUserId = useRef(null);
  const activeUserLabel = useRef('Collaborator');
  const activeUserColor = useRef('#67e8f9');
  const lastCursorBroadcastAt = useRef(0);
  const lastNodeEditBroadcast = useRef({ nodeId: undefined, ts: 0 });
  const remoteAnimationFrame = useRef(null);
  const channelRef = useRef(null);
  const isChannelReadyRef = useRef(false);

  // KEY FIX: canEditRef is always current — avoids stale closures in callbacks
  const canEditRef = useRef(false);
  useEffect(() => { canEditRef.current = canEdit; }, [canEdit]);

  const requestedAccess = searchParams.get('access') === 'edit' ? 'edit' : 'view';

  const normalizeGraphData = useCallback((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  // ── Autosave — reads canEditRef (stable), no stale closure ─────────────────
  const queueAutosave = useCallback((newNodes, newEdges, newDrawings = []) => {
    if (!canEditRef.current || isUpdatingFromRemote.current || !hasHydratedPipeline.current) return;

    const snapshot = supportsDrawingsColumn.current
      ? JSON.stringify({ nodes: newNodes, edges: newEdges, drawings: newDrawings })
      : JSON.stringify({ nodes: newNodes, edges: newEdges });
    if (snapshot === lastSavedState.current) return;

    pendingSaveSnapshot.current = {
      nodes: newNodes,
      edges: newEdges,
      drawings: newDrawings,
      snapshot,
    };
  }, []); // no canEdit dependency — reads ref instead

  useEffect(() => {
    bootstrapClientPlugins().catch(() => {
      // Non-fatal: shared canvas can run with built-in nodes only.
    });
  }, []);

  // ── Interval flush — runs whenever canEdit becomes true ────────────────────
  useEffect(() => {
    if (!canEdit) return;

    const pipelineId = pathname.split('/').pop();
    if (!pipelineId) return;

    const intervalId = setInterval(async () => {
      const pending = pendingSaveSnapshot.current;
      if (!pending || saveInFlight.current) return;
      if (pending.snapshot === lastSavedState.current) {
        pendingSaveSnapshot.current = null;
        return;
      }

      saveInFlight.current = true;
      try {
        useUIStore.getState().setSyncState('saving');

        const basePayload = {
          nodes: pending.nodes,
          edges: pending.edges,
          updated_at: new Date().toISOString(),
        };

        const payload = supportsDrawingsColumn.current
          ? { ...basePayload, drawings: pending.drawings }
          : basePayload;

        let { error } = await supabase
          .from('pipelines')
          .update(payload)
          .eq('id', pipelineId);

        const missingDrawingsColumn =
          error?.code === 'PGRST204' &&
          String(error?.message || '').includes("'drawings' column");

        if (missingDrawingsColumn) {
          supportsDrawingsColumn.current = false;
          ({ error } = await supabase
            .from('pipelines')
            .update(basePayload)
            .eq('id', pipelineId));

          if (!drawingsSchemaWarned.current) {
            drawingsSchemaWarned.current = true;
            const toast = useUIStore.getState().addToast;
            if (toast) {
              toast('Drawings sync is unavailable until the database schema is updated.', 'info');
            }
          }
        }

        if (error) throw error;

        lastSavedState.current = pending.snapshot;
        pendingSaveSnapshot.current = null;
        useUIStore.getState().setSyncState('saved');
        localStorage.removeItem(`pipeline_backup_${pipelineId}`);
      } catch (err) {
        console.error('Error auto-saving pipeline:', err);
        useUIStore.getState().setSyncState('error');
        localStorage.setItem(`pipeline_backup_${pipelineId}`, JSON.stringify({
          nodes: pending.nodes,
          edges: pending.edges,
          drawings: pending.drawings,
          ts: Date.now()
        }));
      } finally {
        saveInFlight.current = false;
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [canEdit, pathname]);

  // ── Mobile Check ───────────────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── Broadcast local changes ────────────────────────────────────────────────
  const broadcastChanges = useCallback((newNodes, newEdges, newDrawings, meta = {}) => {
    if (!canEditRef.current || !hasHydratedPipeline.current) return;

    const ch = channelRef.current;
    if (ch && isChannelReadyRef.current && !isUpdatingFromRemote.current) {
      ch.send({
        type: 'broadcast',
        event: 'canvas-update',
        payload: {
          nodes: newNodes,
          edges: newEdges,
          drawings: Array.isArray(newDrawings) ? newDrawings : [],
          reason: meta.reason || 'graph-change',
        }
      });
    }

    queueAutosave(newNodes, newEdges, newDrawings);
  }, [queueAutosave]); // stable ref — no channel/canEdit dep

  const broadcastEditingNode = useCallback((nodeId) => {
    if (!canEditRef.current) return;
    const ch = channelRef.current;
    if (!ch || !isChannelReadyRef.current) return;

    const now = Date.now();
    if (lastNodeEditBroadcast.current.nodeId === nodeId && now - lastNodeEditBroadcast.current.ts < 120) {
      return;
    }
    lastNodeEditBroadcast.current = { nodeId, ts: now };

    ch.send({
      type: 'broadcast',
      event: 'node-focus-update',
      payload: {
        userId: activeUserId.current,
        nodeId: nodeId || null,
        label: activeUserLabel.current,
        color: activeUserColor.current,
        ts: now,
      },
    });
  }, []); // stable ref — no channel dep

  const animateRemoteGraphTo = useCallback((nextNodes, nextEdges) => {
    if (remoteAnimationFrame.current) {
      cancelAnimationFrame(remoteAnimationFrame.current);
      remoteAnimationFrame.current = null;
    }

    const startNodes = useUIStore.getState().nodes || [];
    const startPositions = new Map(startNodes.map((node) => [node.id, node.position]));

    const duration = 160;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);

      const interpolatedNodes = nextNodes.map((node) => {
        const from = startPositions.get(node.id);
        if (!from || !node?.position) return node;

        return {
          ...node,
          position: {
            x: from.x + (node.position.x - from.x) * eased,
            y: from.y + (node.position.y - from.y) * eased,
          },
        };
      });

      setNodes(interpolatedNodes);
      setEdges(nextEdges);

      if (t < 1) {
        remoteAnimationFrame.current = requestAnimationFrame(step);
      } else {
        remoteAnimationFrame.current = null;
        setNodes(nextNodes);
        setEdges(nextEdges);
      }
    };

    remoteAnimationFrame.current = requestAnimationFrame(step);
  }, [setEdges, setNodes]);

  const handlePointerMove = useCallback((x, y) => {
    if (!canEditRef.current) return;
    const ch = channelRef.current;
    if (!ch || !isChannelReadyRef.current) return;

    const now = Date.now();
    if (now - lastCursorBroadcastAt.current < 33) return;
    lastCursorBroadcastAt.current = now;

    ch.send({
      type: 'broadcast',
      event: 'cursor-update',
      payload: {
        userId: activeUserId.current,
        x,
        y,
        space: 'flow',
        label: activeUserLabel.current,
        color: activeUserColor.current,
        ts: now,
      },
    });
  }, []); // stable ref — no channel dep

  const handleFork = useCallback(async () => {
    const pipelineId = pathname.split('/').pop();
    if (!pipelineId) return;

    setIsCopying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addToast('You must be logged in to fork pipelines.', 'error');
        return;
      }

      const { data: pipeline, error: fetchError } = await supabase
        .from('pipelines')
        .select('*')
        .eq('id', pipelineId)
        .single();
        
      if (fetchError) throw fetchError;

      await forkPipeline(supabase, user.id, pipeline);
      addToast('Pipeline forked successfully! Returning to dashboard...', 'success');
      
      setTimeout(() => {
        leaveAllowed.current = true;
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Error forking pipeline:', err);
      addToast(`Fork error: ${err.message || 'Failed to fork'}`, 'error');
    } finally {
      setIsCopying(false);
    }
  }, [pathname, router, addToast]);

  const claimPublicShare = useCallback(async ({ pipelineId, ownerId, userEmail, permission }) => {
    if (!pipelineId || !ownerId || !userEmail) return;

    const normalizeError = (err) => {
      if (!err) return null;
      return {
        message: err.message || 'Unknown error',
        details: err.details || null,
        hint: err.hint || null,
        code: err.code || null,
      };
    };

    try {
      const normalizedEmail = userEmail.toLowerCase();

      const { data: existingShare, error: lookupError } = await supabase
        .from('pipeline_shares')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .eq('share_scope', 'email')
        .eq('shared_with_email', normalizedEmail)
        .maybeSingle();

      if (lookupError) {
        console.error('Failed to lookup existing claimed share:', normalizeError(lookupError));
        return;
      }

      if (existingShare?.id) return;

      const { error } = await supabase
        .from('pipeline_shares')
        .insert({
          pipeline_id: pipelineId,
          owner_id: ownerId,
          share_scope: 'email',
          shared_with_email: normalizedEmail,
          permission: permission === 'edit' ? 'edit' : 'view',
        });

      if (error) {
        if (error.code === '23505') return;
        console.error('Failed to claim public share:', normalizeError(error));
      }
    } catch (err) {
      console.error('Unexpected claim public share error:', normalizeError(err));
    }
  }, []);

  // ── Leave-canvas flow helpers ───────────────────────────────────────────────

  /** Returns true if we should intercept navigation (unnamed + owner + not snapshot). */
  const shouldInterceptLeave = useCallback(() => {
    if (!canEditRef.current) return false;
    if (leaveAllowed.current) return false;
    return isUnnamedPipeline(savedPipelineName);
  }, [savedPipelineName]);

  /** Programmatic navigation that respects the leave gate. */
  const guardedNavigate = useCallback((href) => {
    if (shouldInterceptLeave()) {
      pendingNavTarget.current = href;
      setLeaveModalOpen(true);
    } else {
      leaveAllowed.current = true;
      router.push(href);
    }
  }, [shouldInterceptLeave, router]);

  /** Save + rename then navigate. If nameOverride is null/empty, auto-generate an "Unnamed (N)" label. */
  const handleSaveAndLeave = useCallback(async (nameOverride) => {
    setIsSavingLeave(true);
    const pipelineId = pathname.split('/').pop();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const finalName = (nameOverride && nameOverride.trim())
        ? nameOverride.trim()
        : await nextUnnamedLabel(user.id);

      if (pipelineId) {
        await supabase
          .from('pipelines')
          .update({ name: finalName, updated_at: new Date().toISOString() })
          .eq('id', pipelineId)
          .eq('user_id', user.id);
      }

      setLeaveModalOpen(false);
      leaveAllowed.current = true;
      router.push(pendingNavTarget.current || '/dashboard');
    } catch (err) {
      console.error('Save & leave error:', err);
      addToast('Failed to save pipeline name.', 'error');
    } finally {
      setIsSavingLeave(false);
    }
  }, [pathname, router, addToast]);

  /** Discard: just navigate without saving. */
  const handleDiscardAndLeave = useCallback(async () => {
    const pipelineId = pathname.split('/').pop();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && pipelineId) {
        const shouldDeleteEmptyDraft = isUnnamedPipeline(savedPipelineName)
          && Array.isArray(nodes)
          && nodes.length === 0
          && Array.isArray(drawings)
          && drawings.length === 0;

        if (shouldDeleteEmptyDraft) {
          await supabase
            .from('pipelines')
            .delete()
            .eq('id', pipelineId)
            .eq('user_id', user.id);
        } else {
          const autoName = await nextUnnamedLabel(user.id);
          await supabase
            .from('pipelines')
            .update({ name: autoName, updated_at: new Date().toISOString() })
            .eq('id', pipelineId)
            .eq('user_id', user.id);
        }
      }
    } catch {
      // Non-fatal — just navigate
    }
    setLeaveModalOpen(false);
    leaveAllowed.current = true;
    router.push(pendingNavTarget.current || '/dashboard');
  }, [pathname, router, savedPipelineName, nodes, drawings]);

  // ── beforeunload interception (tab/window close) ──────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!shouldInterceptLeave()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldInterceptLeave]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const pipelineId = pathname.split('/').pop();
    if (!pipelineId) return;

    let localChannel = null;
    let isMounted = true;

    const bootstrap = async () => {
      try {
        hasHydratedPipeline.current = false;
        if (isMounted) setRemoteCursors([]);
        if (isMounted) setRemoteNodeEditors([]);
        
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        
        if (!isMounted) return;

        const user = authData?.user;
        let userHandle = null;

        if (!user) {
          setLoading(false);
          router.push('/?signup=true');
          return;
        } else {
          // Fetch handle
          const { data: profile } = await supabase
            .from('profiles')
            .select('handle')
            .eq('id', user.id)
            .maybeSingle();
          if (profile?.handle) {
            userHandle = profile.handle;
          }
        }

        const { data, error } = await supabase
          .from('pipelines')
          .select('*')
          .eq('id', pipelineId)
          .single();

        if (error) throw error;
        if (!isMounted) return;

        if (!data) {
          setError('Pipeline not found.');
          setLoading(false);
          return;
        }

        const owner = user?.id === data.user_id;
        const pipelineIsSnapshot = Boolean(data.is_snapshot);
        setIsSnapshot(pipelineIsSnapshot);
        let sharedPermission = null;

        if (!owner) {
          if (!user?.email) {
            setError('You do not have access to this pipeline.');
            setLoading(false);
            return;
          }

          const { data: shareData, error: shareError } = await supabase
            .from('pipeline_shares')
            .select('permission, share_scope, shared_with_email')
            .eq('pipeline_id', pipelineId)
            .in('share_scope', ['email', 'public']);

          if (shareError) throw shareError;
          if (!isMounted) return;

          const normalizedEmail = user.email.toLowerCase();
          const directShare = (shareData || []).find(
            (share) => share.share_scope === 'email' && (share.shared_with_email || '').toLowerCase() === normalizedEmail
          );
          const publicShare = (shareData || []).find((share) => share.share_scope === 'public');
          const effectiveShare = directShare || publicShare || null;

          if (!effectiveShare && !data.is_public) {
            setError('You do not have access to this pipeline.');
            setLoading(false);
            return;
          }

          if (!directShare && publicShare) {
            claimPublicShare({
              pipelineId,
              ownerId: data.user_id,
              userEmail: user.email,
              permission: publicShare.permission,
            });
          }

          sharedPermission = effectiveShare?.permission || 'view';
        }

        const resolvedCanEdit = pipelineIsSnapshot
          ? false
          : (owner || (sharedPermission === 'edit' && requestedAccess === 'edit'));

        if (!isMounted) return;
        useUIStore.getState().setReadOnly(!resolvedCanEdit);
        setCanEdit(resolvedCanEdit);
        canEditRef.current = resolvedCanEdit;

        isUpdatingFromRemote.current = true;
        let normalizedNodes = normalizeGraphData(data.nodes);
        let normalizedEdges = normalizeGraphData(data.edges);
        let normalizedDrawings = normalizeGraphData(data.drawings);
        
        // Recover fallback locally saved progress
        try {
          const fallbackStr = localStorage.getItem(`pipeline_backup_${pipelineId}`);
          if (fallbackStr) {
            const fallback = JSON.parse(fallbackStr);
            if (fallback.nodes && fallback.edges) {
              normalizedNodes = normalizeGraphData(fallback.nodes);
              normalizedEdges = normalizeGraphData(fallback.edges);
              normalizedDrawings = normalizeGraphData(fallback.drawings);
              setTimeout(() => {
                const addToast = useUIStore.getState().addToast;
                if (addToast) addToast("Recovered unsaved local changes.", "info");
                // Force an autosave of recovered changes shortly after load
                queueAutosave(normalizedNodes, normalizedEdges, normalizedDrawings);
              }, 500);
            }
          }
        } catch (e) { console.error('Fallback read error', e); }

        setNodes(normalizedNodes);
        setEdges(normalizedEdges);
        setDrawings(normalizedDrawings);
        lastSavedState.current = JSON.stringify({ nodes: normalizedNodes, edges: normalizedEdges, drawings: normalizedDrawings });
        pendingSaveSnapshot.current = null;
        useUIStore.getState().setSyncState('saved');
        hasHydratedPipeline.current = true;
        setTimeout(() => { if (isMounted) isUpdatingFromRemote.current = false; }, 100);

        if (pipelineIsSnapshot) {
          setLoading(false);
          return;
        }

        const newChannel = supabase.channel(`pipeline:${pipelineId}`, {
          config: {
            broadcast: { self: false, ack: false },
          },
        });
        localChannel = newChannel;
        channelRef.current = newChannel;
        isChannelReadyRef.current = false;

        newChannel
          .on('presence', { event: 'sync' }, () => {
            if (!isMounted) return;
            const newState = newChannel.presenceState();
            const collaborators = Object.values(newState).map(p => p[0]);
            setCollaborators(collaborators);
          })
          .on('broadcast', { event: 'canvas-update' }, ({ payload }) => {
            if (!isMounted) return;
            isUpdatingFromRemote.current = true;
            if (payload?.reason === 'drag-end') {
              animateRemoteGraphTo(payload.nodes || [], payload.edges || []);
              setDrawings(Array.isArray(payload.drawings) ? payload.drawings : []);
            } else {
              if (remoteAnimationFrame.current) {
                cancelAnimationFrame(remoteAnimationFrame.current);
                remoteAnimationFrame.current = null;
              }
              setNodes(payload.nodes || []);
              setEdges(payload.edges || []);
              setDrawings(Array.isArray(payload.drawings) ? payload.drawings : []);
            }
            setTimeout(() => { if (isMounted) isUpdatingFromRemote.current = false; }, 100);
          })
          .on('broadcast', { event: 'cursor-update' }, ({ payload }) => {
            if (!isMounted || !payload || !payload.userId || payload.userId === activeUserId.current) return;

            setRemoteCursors((prev) => {
              const withoutSender = prev.filter((cursor) => cursor.userId !== payload.userId);
              return [
                ...withoutSender,
                {
                  userId: payload.userId,
                  x: payload.x,
                  y: payload.y,
                  space: payload.space || 'screen',
                  label: payload.label,
                  color: payload.color,
                  ts: payload.ts || Date.now(),
                },
              ];
            });
          })
          .on('broadcast', { event: 'node-focus-update' }, ({ payload }) => {
            if (!isMounted || !payload || !payload.userId || payload.userId === activeUserId.current) return;

            setRemoteNodeEditors((prev) => {
              const withoutSender = prev.filter((entry) => entry.userId !== payload.userId);
              if (!payload.nodeId) return withoutSender;

              return [
                ...withoutSender,
                {
                  userId: payload.userId,
                  nodeId: payload.nodeId,
                  label: payload.label,
                  color: payload.color,
                  ts: payload.ts || Date.now(),
                },
              ];
            });
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && isMounted) {
              isChannelReadyRef.current = true;
              activeUserId.current = user?.id || `anon-${Math.random().toString(36).slice(2, 10)}`;
              
              let label = 'Collaborator';
              if (userHandle) {
                label = `@${userHandle}`;
              } else if (user?.email) {
                label = user.email.split('@')[0];
              }
              
              activeUserLabel.current = label;
              activeUserColor.current = pickCursorColor(user?.id || user?.email || activeUserId.current);
              await newChannel.track({
                user: label,
                user_id: activeUserId.current,
                avatar_url: user?.user_metadata.avatar_url,
              });
            }
          });

        if (isMounted) setChannel(newChannel);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching pipeline raw:', err);
        const errorDetails = {
          message: err?.message || (typeof err === 'string' ? err : 'Unknown error'),
          status: err?.status || null,
          code: err?.code || null,
          details: err?.details || null,
          hint: err?.hint || null,
        };
        console.error('Error fetching pipeline details:', errorDetails);
        setError('Failed to load pipeline. Please check your login status.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      isChannelReadyRef.current = false;
      channelRef.current = null;
      if (remoteAnimationFrame.current) {
        cancelAnimationFrame(remoteAnimationFrame.current);
        remoteAnimationFrame.current = null;
      }
      if (localChannel) {
        supabase.removeChannel(localChannel);
      }
    };
  }, [animateRemoteGraphTo, claimPublicShare, normalizeGraphData, pathname, queueAutosave, requestedAccess, router, setNodes, setEdges, setDrawings]);

  useEffect(() => {
    const cleanupId = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => prev.filter((cursor) => now - (cursor.ts || 0) < 4000));
      setRemoteNodeEditors((prev) => prev.filter((entry) => now - (entry.ts || 0) < 8000));
    }, 1000);

    return () => clearInterval(cleanupId);
  }, []);

  if (isMobile) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-background text-foreground p-8 text-center bg-linear-to-b from-background to-amber-500/5">
        <div className="w-20 h-20 bg-amber-400/10 rounded-3xl flex items-center justify-center text-amber-400 mb-6 border border-amber-400/20 shadow-[0_0_30px_rgba(251,191,36,0.1)]">
          <Layout size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-4 tracking-tight">Desktop Only Experience</h2>
        <p className="text-foreground/60 text-sm max-w-xs leading-relaxed mb-8">
          The Proto-ML canvas is a high-performance workspace designed for precision and complex workflows. For the best experience, please view this from a larger screen.
        </p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-8 py-3 bg-foreground text-background font-bold rounded-xl hover:opacity-90 transition-all shadow-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return <CanvasSkeleton />;
  }

  if (error) {
    return <div className="w-full h-screen flex items-center justify-center bg-background text-foreground">{error}</div>;
  }

  return (
    <div className="w-full h-screen relative">
      {canEdit ? (
        <>
          <DashboardNav />
          <DashboardProfile activeCollaborators={collaborators} />
          <PipelineCompilerPanel />
        </>
      ) : (
        <DashboardProfile activeCollaborators={collaborators} />
      )}

      <InfiniteCanvas
        onCanvasChange={broadcastChanges}
        onPointerMove={handlePointerMove}
        onEditingNodeChange={broadcastEditingNode}
        remoteCursors={remoteCursors}
        remoteNodeEditors={remoteNodeEditors}
        readOnly={!canEdit}
      />
      
      {/* Shared View Controls (Read Only Badge + Fork Action) */}
      {!canEdit && (
        <div className="absolute top-4 left-4 z-100 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase rounded-full border border-cyan-500/20 backdrop-blur-md shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
            <Eye size={12} className="opacity-60" /> Read Only Mode
          </div>
          <button
            onClick={handleFork}
            disabled={isCopying}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-400 text-black text-[10px] font-black rounded-full hover:bg-amber-500 transition-all shadow-xl disabled:opacity-40 uppercase border border-amber-300/30"
          >
            <GitFork size={13} /> {isCopying ? 'Forking...' : 'Fork & Edit'}
          </button>
        </div>
      )}



      {/* Leave modal */}
      {leaveModalOpen && (
        <LeaveModal
          currentName={savedPipelineName && !isUnnamedPipeline(savedPipelineName) ? savedPipelineName : ''}
          pipelineId={pathname.split('/').pop()}
          onSaveAndLeave={handleSaveAndLeave}
          onDiscardAndLeave={handleDiscardAndLeave}
          onCancel={() => {
            setLeaveModalOpen(false);
            pendingNavTarget.current = null;
          }}
          isSaving={isSavingLeave}
        />
      )}
    </div>
  );
};

export default SharedCanvasPage;
