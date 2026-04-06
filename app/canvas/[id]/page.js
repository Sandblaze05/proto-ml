'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Share2, Layout, Copy, GitFork, Eye } from 'lucide-react';
import InfiniteCanvas from '@/components/InfiniteCanvas';
import DashboardNav from '@/components/DashboardNav';
import DashboardProfile from '@/components/DashboardProfile';
import PipelineCompilerPanel from '@/components/PipelineCompilerPanel';
import { useUIStore } from '@/store/useUIStore';
import { createClient } from '@/lib/supabase/client';
import { bootstrapClientPlugins } from '@/lib/plugins/clientPluginBootstrap';
import { forkPipeline } from '@/lib/community';

const CURSOR_COLORS = ['#67e8f9', '#f472b6', '#f59e0b', '#34d399', '#a78bfa', '#fb7185', '#22c55e', '#60a5fa'];

const pickCursorColor = (seed) => {
  const value = String(seed || '');
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};

const supabase = createClient();

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [channel, setChannel] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isSnapshot, setIsSnapshot] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState([]);
  const [remoteNodeEditors, setRemoteNodeEditors] = useState([]);
  const isUpdatingFromRemote = useRef(false);
  const lastSavedState = useRef(null);
  const pendingSaveSnapshot = useRef(null);
  const saveInFlight = useRef(false);
  const hasHydratedPipeline = useRef(false);
  const activeUserId = useRef(null);
  const activeUserLabel = useRef('Collaborator');
  const activeUserColor = useRef('#67e8f9');
  const lastCursorBroadcastAt = useRef(0);
  const lastNodeEditBroadcast = useRef({ nodeId: undefined, ts: 0 });
  const remoteAnimationFrame = useRef(null);
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

  const queueAutosave = useCallback((newNodes, newEdges) => {
    if (!canEdit || isUpdatingFromRemote.current || !hasHydratedPipeline.current) return;

    const snapshot = JSON.stringify({ nodes: newNodes, edges: newEdges });
    if (snapshot === lastSavedState.current) return;

    pendingSaveSnapshot.current = {
      nodes: newNodes,
      edges: newEdges,
      snapshot,
    };
  }, [canEdit]);

  useEffect(() => {
    bootstrapClientPlugins().catch(() => {
      // Non-fatal: shared canvas can run with built-in nodes only.
    });
  }, []);

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
        const { error } = await supabase
          .from('pipelines')
          .update({
            nodes: pending.nodes,
            edges: pending.edges,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pipelineId);

        if (error) throw error;

        lastSavedState.current = pending.snapshot;
        pendingSaveSnapshot.current = null;
      } catch (err) {
        console.error('Error auto-saving pipeline:', err);
      } finally {
        saveInFlight.current = false;
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [canEdit, pathname, supabase]);

  // Function to broadcast local changes to other users
  const broadcastChanges = useCallback((newNodes, newEdges, newDrawings, meta = {}) => {
    if (!canEdit || !hasHydratedPipeline.current) return;

    if (channel && !isUpdatingFromRemote.current) {
      channel.send({
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

    queueAutosave(newNodes, newEdges);
  }, [canEdit, channel, queueAutosave]);

  const broadcastEditingNode = useCallback((nodeId) => {
    if (!canEdit || !channel) return;

    const now = Date.now();
    if (lastNodeEditBroadcast.current.nodeId === nodeId && now - lastNodeEditBroadcast.current.ts < 120) {
      return;
    }
    lastNodeEditBroadcast.current = { nodeId, ts: now };

    channel.send({
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
  }, [canEdit, channel]);

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
    if (!canEdit || !channel) return;

    const now = Date.now();
    if (now - lastCursorBroadcastAt.current < 33) return;
    lastCursorBroadcastAt.current = now;

    channel.send({
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
  }, [canEdit, channel]);

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

      // We need the full pipeline object to fork it
      const { data: pipeline, error: fetchError } = await supabase
        .from('pipelines')
        .select('*')
        .eq('id', pipelineId)
        .single();
        
      if (fetchError) throw fetchError;

      await forkPipeline(supabase, user.id, pipeline);
      addToast('Pipeline forked successfully! Returning to dashboard...', 'success');
      
      // Delay slightly for toast visibility
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Error forking pipeline:', err);
      addToast(`Fork error: ${err.message || 'Failed to fork'}`, 'error');
    } finally {
      setIsCopying(false);
    }
  }, [pathname, router, supabase, addToast]);

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
        // Duplicate share claim is harmless (already claimed in another tab/session).
        if (error.code === '23505') return;
        console.error('Failed to claim public share:', normalizeError(error));
      }
    } catch (err) {
      console.error('Unexpected claim public share error:', normalizeError(err));
    }
  }, [supabase]);

  useEffect(() => {
    const pipelineId = pathname.split('/').pop();
    if (!pipelineId) return;

    let channelRef = null;
    let isMounted = true;

    const bootstrap = async () => {
      // ── 1. Fetch pipeline data ───────────────────────────────────────────
      try {
        hasHydratedPipeline.current = false;
        if (isMounted) setRemoteCursors([]);
        if (isMounted) setRemoteNodeEditors([]);
        
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        
        if (!isMounted) return;

        const user = authData?.user;

        if (!user) {
          setLoading(false);
          router.push('/?signup=true');
          return;
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

        // Snapshots (community copies) are always read-only, even for the owner.
        // This prevents cursor/node movement from leaking to community viewers.
        const canEdit = pipelineIsSnapshot
          ? false
          : (owner || (sharedPermission === 'edit' && requestedAccess === 'edit'));

        if (!isMounted) return;
        useUIStore.getState().setReadOnly(!canEdit);
        setCanEdit(canEdit);

        isUpdatingFromRemote.current = true;
        const normalizedNodes = normalizeGraphData(data.nodes);
        const normalizedEdges = normalizeGraphData(data.edges);
        const normalizedDrawings = normalizeGraphData(data.drawings);
        setNodes(normalizedNodes);
        setEdges(normalizedEdges);
        setDrawings(normalizedDrawings);
        lastSavedState.current = JSON.stringify({ nodes: normalizedNodes, edges: normalizedEdges });
        pendingSaveSnapshot.current = null;
        hasHydratedPipeline.current = true;
        setTimeout(() => { if (isMounted) isUpdatingFromRemote.current = false; }, 100);

        // ── 2. Real-time channel (only for non-snapshot pipelines) ────────
        // Snapshots are frozen community copies — no cursors, no live sync.
        if (pipelineIsSnapshot) {
          setLoading(false);
          return;
        }

        const newChannel = supabase.channel(`pipeline:${pipelineId}`);
        channelRef = newChannel;

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
              activeUserId.current = user?.id || `anon-${Math.random().toString(36).slice(2, 10)}`;
              const emailLabel = user?.email ? user.email.split('@')[0] : 'Collaborator';
              activeUserLabel.current = emailLabel;
              activeUserColor.current = pickCursorColor(user?.id || user?.email || activeUserId.current);
              await newChannel.track({
                user: user ? user.email : 'Anonymous',
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
      if (remoteAnimationFrame.current) {
        cancelAnimationFrame(remoteAnimationFrame.current);
        remoteAnimationFrame.current = null;
      }
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [animateRemoteGraphTo, claimPublicShare, normalizeGraphData, pathname, requestedAccess, setNodes, setEdges, setDrawings]);

  useEffect(() => {
    const cleanupId = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => prev.filter((cursor) => now - (cursor.ts || 0) < 4000));
      setRemoteNodeEditors((prev) => prev.filter((entry) => now - (entry.ts || 0) < 8000));
    }, 1000);

    return () => clearInterval(cleanupId);
  }, []);

  if (loading) {
    return <div className="w-full h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
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

      {/* Projects Button */}
      <Link 
        href="/dashboard" 
        className="absolute bottom-4 left-4 z-100 flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs font-bold rounded-full hover:opacity-90 transition-all shadow-xl"
      >
        <Layout size={14} /> My Projects
      </Link>
    </div>
  );
};

export default SharedCanvasPage;
