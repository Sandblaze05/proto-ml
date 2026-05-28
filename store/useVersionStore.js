/**
 * useVersionStore.js — Zustand store for pipeline version control.
 *
 * Manages commit history, branches, dirty tracking, diff state, and coordinates
 * with useUIStore for branch switching / restore operations.
 *
 * This store does NOT own nodes/edges — it reads them from useUIStore and
 * writes them back only during branch switch or restore.
 */

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { computeGraphHash } from '@/lib/versioning/graphHash';
import { computeGraphDiff, buildDiffStatusMap, buildEdgeDiffSets } from '@/lib/versioning/graphDiff';
import { createCommit, listCommits, getCommit, restoreCommit, getHeadCommit } from '@/lib/versioning/commitService';
import { ensureDefaultBranch, createBranch, listBranches, switchBranch, archiveBranch } from '@/lib/versioning/branchService';

// --------------------------------------------------------------------------
// Auto-commit debounce interval
// --------------------------------------------------------------------------
const AUTO_COMMIT_INTERVAL_MS = 60_000;

// --------------------------------------------------------------------------
// Store
// --------------------------------------------------------------------------

export const useVersionStore = create((set, get) => ({
  // ── Identity ──────────────────────────────────────────────────────────────
  pipelineId: null,
  userId: null,
  initialized: false,

  // ── Current branch state ──────────────────────────────────────────────────
  activeBranch: 'main',
  headCommit: null,
  isDirty: false,
  lastHeadHash: null,        // graph_hash of HEAD commit, for dirty detection

  // ── Branch & commit lists ─────────────────────────────────────────────────
  branches: [],
  commits: [],
  commitsHasMore: false,
  commitsLoading: false,

  // ── Diff state ────────────────────────────────────────────────────────────
  compareMode: false,
  diffSource: null,          // commit id (before)
  diffTarget: null,          // commit id (after)
  diffResult: null,          // GraphDiff object
  diffStatusMap: null,       // Map<nodeId, { status, changes }>
  diffEdgeSets: null,        // { addedEdgeKeys, removedEdgeKeys }
  diffLoading: false,

  // ── UI panel visibility ───────────────────────────────────────────────────
  historyPanelOpen: false,
  branchExplorerOpen: false,
  commitDialogOpen: false,

  // ── Auto-commit timer ─────────────────────────────────────────────────────
  _autoCommitTimerId: null,

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize version control for a pipeline.
   * Ensures the default branch exists and loads the HEAD commit + branch list.
   */
  initVersioning: async (pipelineId, userId = null) => {
    if (!pipelineId) return;

    const supabase = createClient();
    set({ pipelineId, userId, initialized: false });

    // Ensure main branch
    await ensureDefaultBranch(supabase, pipelineId, userId);

    // Fetch the pipeline's active branch
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('active_branch, current_commit_id')
      .eq('id', pipelineId)
      .single();

    const activeBranch = pipeline?.active_branch || 'main';

    // Load branches
    const { branches } = await listBranches(supabase, pipelineId);

    // Load HEAD commit
    const { commit: headCommit } = await getHeadCommit(supabase, pipelineId, activeBranch);

    set({
      activeBranch,
      branches: branches || [],
      headCommit: headCommit || null,
      lastHeadHash: headCommit?.graph_hash || null,
      isDirty: false,
      initialized: true,
    });

    // Load recent commits
    await get().loadCommits();

    // Start auto-commit timer
    get()._startAutoCommitTimer();
  },

  /**
   * Tear down version control (clear timer, reset state).
   */
  destroy: () => {
    const timerId = get()._autoCommitTimerId;
    if (timerId) clearInterval(timerId);
    set({
      pipelineId: null,
      userId: null,
      initialized: false,
      activeBranch: 'main',
      headCommit: null,
      isDirty: false,
      lastHeadHash: null,
      branches: [],
      commits: [],
      commitsHasMore: false,
      compareMode: false,
      diffSource: null,
      diffTarget: null,
      diffResult: null,
      diffStatusMap: null,
      diffEdgeSets: null,
      historyPanelOpen: false,
      branchExplorerOpen: false,
      commitDialogOpen: false,
      _autoCommitTimerId: null,
    });
  },

  // ========================================================================
  // DIRTY TRACKING
  // ========================================================================

  /**
   * Mark the working state as dirty (graph has changed since HEAD).
   * Called from useUIStore change hooks.
   */
  markDirty: () => {
    if (!get().isDirty) set({ isDirty: true });
  },

  /**
   * Check if the current graph differs from HEAD and update isDirty.
   */
  checkDirty: (nodes, edges) => {
    const lastHash = get().lastHeadHash;
    if (!lastHash) {
      // No HEAD commit yet — always dirty if there are nodes
      set({ isDirty: (nodes || []).length > 0 });
      return;
    }
    const currentHash = computeGraphHash(nodes, edges);
    set({ isDirty: currentHash !== lastHash });
  },

  // ========================================================================
  // COMMITS
  // ========================================================================

  /**
   * Create a new commit from the current working state.
   *
   * @param {Object} params
   * @param {string} [params.message='']
   * @param {string|null} [params.tag=null]
   * @param {Object[]} params.nodes - Current nodes from useUIStore
   * @param {Object[]} params.edges - Current edges from useUIStore
   * @param {Object[]} [params.drawings=[]] - Current drawings from useUIStore
   * @param {boolean} [params.isAuto=false] - Whether this is an auto-commit
   * @returns {Promise<{ ok: boolean, commit?: Object, skipped?: boolean, error?: string }>}
   */
  doCommit: async ({ message = '', tag = null, nodes, edges, drawings = [], isAuto = false }) => {
    const { pipelineId, activeBranch, userId } = get();
    if (!pipelineId) return { ok: false, error: 'No pipeline loaded' };

    const supabase = createClient();
    const result = await createCommit(supabase, {
      pipelineId,
      branchName: activeBranch,
      nodes,
      edges,
      drawings,
      message: message || (isAuto ? 'Auto-save' : ''),
      tag,
      authorId: userId,
    });

    if (result.ok && !result.skipped) {
      const newHash = computeGraphHash(nodes, edges);
      set({
        headCommit: result.commit,
        lastHeadHash: newHash,
        isDirty: false,
      });

      // Prepend to commit list
      if (result.commit) {
        set((state) => ({
          commits: [result.commit, ...state.commits],
        }));
      }
    }

    return result;
  },

  /**
   * Load commits for the current pipeline/branch (paginated).
   */
  loadCommits: async (loadMore = false) => {
    const { pipelineId, activeBranch, commits: existing, commitsLoading } = get();
    if (!pipelineId || commitsLoading) return;

    set({ commitsLoading: true });

    const supabase = createClient();
    const cursor = loadMore && existing.length > 0
      ? existing[existing.length - 1].commit_number
      : undefined;

    const { ok, commits: fetched, hasMore } = await listCommits(supabase, {
      pipelineId,
      branchName: activeBranch,
      limit: 50,
      cursor,
    });

    if (ok) {
      set({
        commits: loadMore ? [...existing, ...fetched] : fetched,
        commitsHasMore: hasMore || false,
        commitsLoading: false,
      });
    } else {
      set({ commitsLoading: false });
    }
  },

  // ========================================================================
  // RESTORE
  // ========================================================================

  /**
   * Restore a specific commit to the working state.
   * Returns the commit's nodes/edges/drawings so the caller can apply them
   * to useUIStore.
   *
   * @param {string} commitId
   * @returns {Promise<{ ok: boolean, nodes?: Object[], edges?: Object[], drawings?: Object[], error?: string }>}
   */
  doRestore: async (commitId) => {
    const { pipelineId, activeBranch, userId } = get();
    if (!pipelineId) return { ok: false, error: 'No pipeline loaded' };

    const supabase = createClient();

    // Fetch the full commit payload
    const { ok, commit, error } = await getCommit(supabase, commitId);
    if (!ok) return { ok: false, error };

    // Create a restore commit
    const result = await restoreCommit(supabase, {
      pipelineId,
      commitId,
      branchName: activeBranch,
      authorId: userId,
    });

    if (result.ok) {
      const newHash = computeGraphHash(commit.nodes, commit.edges);
      set({
        headCommit: result.commit,
        lastHeadHash: newHash,
        isDirty: false,
      });

      // Refresh commits
      await get().loadCommits();
    }

    return {
      ok: true,
      nodes: commit.nodes,
      edges: commit.edges,
      drawings: commit.drawings || [],
    };
  },

  // ========================================================================
  // BRANCHES
  // ========================================================================

  /**
   * Refresh the branch list.
   */
  loadBranches: async () => {
    const { pipelineId } = get();
    if (!pipelineId) return;

    const supabase = createClient();
    const { ok, branches } = await listBranches(supabase, pipelineId);
    if (ok) set({ branches });
  },

  /**
   * Create a new branch from the current HEAD (or a specific commit).
   *
   * @param {string} name
   * @param {string} [fromCommitId] - defaults to current HEAD
   * @param {string} [description='']
   * @returns {Promise<{ ok: boolean, branch?: Object, error?: string }>}
   */
  doCreateBranch: async (name, fromCommitId, description = '') => {
    const { pipelineId, userId, headCommit } = get();
    if (!pipelineId) return { ok: false, error: 'No pipeline loaded' };

    const supabase = createClient();
    const result = await createBranch(supabase, {
      pipelineId,
      name,
      fromCommitId: fromCommitId || headCommit?.id || null,
      description,
      userId,
    });

    if (result.ok) {
      await get().loadBranches();
    }

    return result;
  },

  /**
   * Switch to a different branch.
   * Returns the HEAD commit's payload so the caller can apply it to useUIStore.
   *
   * @param {string} branchName
   * @param {Object} [currentState] - { nodes, edges, drawings } to auto-commit before switching
   * @returns {Promise<{ ok: boolean, nodes?: Object[], edges?: Object[], drawings?: Object[], error?: string }>}
   */
  doSwitchBranch: async (branchName, currentState) => {
    const { pipelineId, activeBranch, isDirty, userId } = get();
    if (!pipelineId) return { ok: false, error: 'No pipeline loaded' };
    if (branchName === activeBranch) return { ok: true };

    const supabase = createClient();

    // Auto-commit current dirty state before switching
    if (isDirty && currentState) {
      await get().doCommit({
        message: `Auto-save before switching to ${branchName}`,
        nodes: currentState.nodes,
        edges: currentState.edges,
        drawings: currentState.drawings || [],
        isAuto: true,
      });
    }

    // Switch branch in DB
    const result = await switchBranch(supabase, pipelineId, branchName);
    if (!result.ok) return { ok: false, error: result.error };

    const headCommit = result.headCommit;
    const newHash = headCommit?.graph_hash || null;

    set({
      activeBranch: branchName,
      headCommit: headCommit || null,
      lastHeadHash: newHash,
      isDirty: false,
      commits: [],
      commitsHasMore: false,
      // Reset diff state on branch switch
      compareMode: false,
      diffSource: null,
      diffTarget: null,
      diffResult: null,
      diffStatusMap: null,
      diffEdgeSets: null,
    });

    // Load new branch's commits
    await get().loadCommits();

    return {
      ok: true,
      nodes: headCommit?.nodes || [],
      edges: headCommit?.edges || [],
      drawings: headCommit?.drawings || [],
    };
  },

  /**
   * Archive (soft-delete) a branch.
   */
  doArchiveBranch: async (branchName) => {
    const { pipelineId } = get();
    if (!pipelineId) return { ok: false, error: 'No pipeline loaded' };

    const supabase = createClient();
    const result = await archiveBranch(supabase, pipelineId, branchName);
    if (result.ok) {
      await get().loadBranches();
    }
    return result;
  },

  // ========================================================================
  // DIFF / COMPARE
  // ========================================================================

  /**
   * Enter comparison mode between two commits.
   *
   * @param {string} sourceCommitId - "before" commit
   * @param {string} targetCommitId - "after" commit
   */
  enterCompareMode: async (sourceCommitId, targetCommitId) => {
    set({ diffLoading: true, compareMode: true });

    const supabase = createClient();

    const [sourceRes, targetRes] = await Promise.all([
      getCommit(supabase, sourceCommitId),
      getCommit(supabase, targetCommitId),
    ]);

    if (!sourceRes.ok || !targetRes.ok) {
      set({
        diffLoading: false,
        compareMode: false,
        diffResult: null,
      });
      return;
    }

    const diff = computeGraphDiff(
      { nodes: sourceRes.commit.nodes, edges: sourceRes.commit.edges },
      { nodes: targetRes.commit.nodes, edges: targetRes.commit.edges },
    );

    set({
      diffSource: sourceCommitId,
      diffTarget: targetCommitId,
      diffResult: diff,
      diffStatusMap: buildDiffStatusMap(diff),
      diffEdgeSets: buildEdgeDiffSets(diff),
      diffLoading: false,
    });
  },

  /**
   * Compare current working state against a specific commit.
   *
   * @param {string} commitId - The commit to compare against
   * @param {Object} currentGraph - { nodes, edges } from useUIStore
   */
  compareWithCommit: async (commitId, currentGraph) => {
    set({ diffLoading: true, compareMode: true });

    const supabase = createClient();
    const { ok, commit } = await getCommit(supabase, commitId);

    if (!ok) {
      set({ diffLoading: false, compareMode: false });
      return;
    }

    const diff = computeGraphDiff(
      { nodes: commit.nodes, edges: commit.edges },
      currentGraph,
    );

    set({
      diffSource: commitId,
      diffTarget: 'working',
      diffResult: diff,
      diffStatusMap: buildDiffStatusMap(diff),
      diffEdgeSets: buildEdgeDiffSets(diff),
      diffLoading: false,
    });
  },

  /**
   * Exit comparison mode and clear diff state.
   */
  exitCompareMode: () => {
    set({
      compareMode: false,
      diffSource: null,
      diffTarget: null,
      diffResult: null,
      diffStatusMap: null,
      diffEdgeSets: null,
    });
  },

  // ========================================================================
  // UI TOGGLES
  // ========================================================================

  toggleHistoryPanel: () => set((s) => ({ historyPanelOpen: !s.historyPanelOpen })),
  toggleBranchExplorer: () => set((s) => ({ branchExplorerOpen: !s.branchExplorerOpen })),
  openCommitDialog: () => set({ commitDialogOpen: true }),
  closeCommitDialog: () => set({ commitDialogOpen: false }),

  setHistoryPanelOpen: (open) => set({ historyPanelOpen: open }),
  setBranchExplorerOpen: (open) => set({ branchExplorerOpen: open }),

  // ========================================================================
  // AUTO-COMMIT TIMER
  // ========================================================================

  _startAutoCommitTimer: () => {
    const existing = get()._autoCommitTimerId;
    if (existing) clearInterval(existing);

    const timerId = setInterval(() => {
      const { isDirty, pipelineId } = get();
      if (!isDirty || !pipelineId) return;

      // We need to read from useUIStore — but we can't import it here
      // to avoid circular deps. The integration hook handles auto-commits.
      // This timer just fires a "should-auto-commit" flag.
      set({ _autoCommitPending: true });
    }, AUTO_COMMIT_INTERVAL_MS);

    set({ _autoCommitTimerId: timerId });
  },

  _autoCommitPending: false,
  clearAutoCommitPending: () => set({ _autoCommitPending: false }),
}));
