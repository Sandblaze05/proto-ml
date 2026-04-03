'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Share2, Layout, Copy } from 'lucide-react';
import InfiniteCanvas from '@/components/InfiniteCanvas';
import DashboardNav from '@/components/DashboardNav';
import DashboardProfile from '@/components/DashboardProfile';
import PipelineCompilerPanel from '@/components/PipelineCompilerPanel';
import { useUIStore } from '@/store/useUIStore';
import { createClient } from '@/lib/supabase/client';

const CURSOR_COLORS = ['#67e8f9', '#f472b6', '#f59e0b', '#34d399', '#a78bfa', '#fb7185', '#22c55e', '#60a5fa'];

const pickCursorColor = (seed) => {
  const value = String(seed || '');
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};

const SharedCanvasPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setNodes = useUIStore(state => state.setNodes);
  const setEdges = useUIStore(state => state.setEdges);
  const setDrawings = useUIStore(state => state.setDrawings);
  const nodes = useUIStore(state => state.nodes);
  const edges = useUIStore(state => state.edges);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [channel, setChannel] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState([]);
  const [remoteNodeEditors, setRemoteNodeEditors] = useState([]);
  const supabase = createClient();
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

  const handleCreateCopy = useCallback(async () => {
    const pipelineId = pathname.split('/').pop();
    if (!pipelineId) return;

    setIsCopying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to create a copy.');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('pipelines')
        .insert({
          user_id: user.id,
          name: 'Copied Pipeline',
          nodes,
          edges,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      router.push(`/canvas/${data.id}`);
    } catch (err) {
      console.error('Error creating copy:', err);
      setError('Failed to create a copy of this pipeline.');
    } finally {
      setIsCopying(false);
    }
  }, [edges, nodes, pathname, router, supabase]);

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

    if (pipelineId) {
      const fetchPipeline = async () => {
        try {
          hasHydratedPipeline.current = false;
          setRemoteCursors([]);
          setRemoteNodeEditors([]);
          const { data: { user } } = await supabase.auth.getUser();

          // Redirect to landing page if not logged in
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

          if (data) {
            const owner = user?.id === data.user_id;
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
              const normalizedEmail = user.email.toLowerCase();
              const directShare = (shareData || []).find(
                (share) => share.share_scope === 'email' && (share.shared_with_email || '').toLowerCase() === normalizedEmail
              );
              const publicShare = (shareData || []).find((share) => share.share_scope === 'public');
              const effectiveShare = directShare || publicShare || null;

              if (!effectiveShare) {
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

              sharedPermission = effectiveShare.permission;
            }

            const hasEditPermission = owner || (sharedPermission === 'edit' && requestedAccess === 'edit');

            setCanEdit(hasEditPermission);
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
            setTimeout(() => { isUpdatingFromRemote.current = false; }, 100);
          } else {
            setError('Pipeline not found.');
          }
        } catch (err) {
          const errorDetails = {
            message: err?.message || 'Unknown error',
            status: err?.status || null,
            code: err?.code || null,
            details: err?.details || null,
            hint: err?.hint || null,
          };
          console.error('Error fetching pipeline:', errorDetails);
          setError('Failed to load pipeline. Please check your login status.');
        } finally {
          setLoading(false);
        }
      };

      fetchPipeline();

      // Real-time channel for both presence and canvas updates
      const newChannel = supabase.channel(`pipeline:${pipelineId}`);

      newChannel
        .on('presence', { event: 'sync' }, () => {
          const newState = newChannel.presenceState();
          const collaborators = Object.values(newState).map(p => p[0]);
          setCollaborators(collaborators);
        })
        .on('broadcast', { event: 'canvas-update' }, ({ payload }) => {
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
          setTimeout(() => { isUpdatingFromRemote.current = false; }, 100);
        })
        .on('broadcast', { event: 'cursor-update' }, ({ payload }) => {
          if (!payload || !payload.userId || payload.userId === activeUserId.current) return;

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
          if (!payload || !payload.userId || payload.userId === activeUserId.current) return;

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
          if (status === 'SUBSCRIBED') {
            const { data: { user } } = await supabase.auth.getUser();
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

      setChannel(newChannel);

      return () => {
        if (remoteAnimationFrame.current) {
          cancelAnimationFrame(remoteAnimationFrame.current);
          remoteAnimationFrame.current = null;
        }
        supabase.removeChannel(newChannel);
      };
    }
  }, [animateRemoteGraphTo, claimPublicShare, normalizeGraphData, pathname, requestedAccess, setNodes, setEdges, setDrawings, supabase]);

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
      {canEdit && (
        <>
          <DashboardNav />
          <DashboardProfile activeCollaborators={collaborators} />
          <PipelineCompilerPanel />
        </>
      )}

      <InfiniteCanvas
        onCanvasChange={broadcastChanges}
        onPointerMove={handlePointerMove}
        onEditingNodeChange={broadcastEditingNode}
        remoteCursors={remoteCursors}
        remoteNodeEditors={remoteNodeEditors}
        readOnly={!canEdit}
      />
      
      {/* Share Restriction Overlay for non-owners */}
      {!canEdit && (
        <div className="absolute top-4 left-4 z-100 flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-full border border-blue-500/20 backdrop-blur-md">
          <Share2 size={12} className="opacity-60" /> Read Only Mode
        </div>
      )}

      {!canEdit && (
        <button
          onClick={handleCreateCopy}
          disabled={isCopying}
          className="absolute top-4 right-4 z-100 flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs font-bold rounded-full hover:opacity-90 transition-all shadow-xl disabled:opacity-40"
        >
          <Copy size={14} /> {isCopying ? 'Creating Copy...' : 'Create Editable Copy'}
        </button>
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
