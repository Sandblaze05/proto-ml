/**
 * commitService.js — CRUD operations for pipeline version commits.
 *
 * All Supabase interactions for creating, fetching, listing, and restoring
 * pipeline commits. Designed for use from both client components and API routes.
 */

import { computeGraphHash } from './graphHash.js';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const COMMITS_TABLE = 'pipeline_commits';
const BRANCHES_TABLE = 'pipeline_branches';
const PIPELINES_TABLE = 'pipelines';

/** Fields to return for commit list queries (excludes large payloads). */
const COMMIT_META_FIELDS = `
  id, pipeline_id, branch_name, parent_id,
  message, tag, author_id, commit_number,
  graph_hash, node_count, edge_count,
  execution_meta, created_at
`;

/** All fields including node/edge payloads. */
const COMMIT_FULL_FIELDS = `${COMMIT_META_FIELDS}, nodes, edges, drawings`;

// --------------------------------------------------------------------------
// Create commit
// --------------------------------------------------------------------------

/**
 * Create a new immutable commit for a pipeline.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} params
 * @param {string} params.pipelineId
 * @param {string} params.branchName
 * @param {Object[]} params.nodes
 * @param {Object[]} params.edges
 * @param {Object[]} [params.drawings=[]]
 * @param {string} [params.message='']
 * @param {string|null} [params.tag=null]
 * @param {string|null} [params.authorId=null]
 * @param {Object} [params.executionMeta={}]
 * @returns {Promise<{ ok: boolean, commit?: Object, error?: string }>}
 */
export async function createCommit(supabase, {
  pipelineId,
  branchName = 'main',
  nodes = [],
  edges = [],
  drawings = [],
  message = '',
  tag = null,
  authorId = null,
  executionMeta = {},
}) {
  if (!pipelineId) {
    return { ok: false, error: 'Missing pipelineId' };
  }

  try {
    // 1. Compute graph hash
    const graphHash = computeGraphHash(nodes, edges);
    const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
    const edgeCount = Array.isArray(edges) ? edges.length : 0;

    // 2. Check if HEAD already has this exact hash (skip duplicate commits)
    const { data: branch } = await supabase
      .from(BRANCHES_TABLE)
      .select('head_commit_id')
      .eq('pipeline_id', pipelineId)
      .eq('name', branchName)
      .maybeSingle();

    if (branch?.head_commit_id) {
      const { data: headCommit } = await supabase
        .from(COMMITS_TABLE)
        .select('graph_hash')
        .eq('id', branch.head_commit_id)
        .single();

      if (headCommit?.graph_hash === graphHash) {
        return {
          ok: true,
          commit: null,
          skipped: true,
          reason: 'Graph unchanged from HEAD',
        };
      }
    }

    // 3. Get next commit number
    const { data: maxResult } = await supabase
      .from(COMMITS_TABLE)
      .select('commit_number')
      .eq('pipeline_id', pipelineId)
      .order('commit_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const commitNumber = (maxResult?.commit_number || 0) + 1;

    // 4. Insert commit
    const { data: commit, error: insertError } = await supabase
      .from(COMMITS_TABLE)
      .insert({
        pipeline_id: pipelineId,
        branch_name: branchName,
        parent_id: branch?.head_commit_id || null,
        nodes,
        edges,
        drawings: drawings || [],
        message,
        tag: tag || null,
        author_id: authorId,
        commit_number: commitNumber,
        graph_hash: graphHash,
        node_count: nodeCount,
        edge_count: edgeCount,
        execution_meta: executionMeta,
      })
      .select(COMMIT_META_FIELDS)
      .single();

    if (insertError) {
      return { ok: false, error: insertError.message || 'Failed to create commit' };
    }

    // 5. Update branch HEAD
    const { error: branchError } = await supabase
      .from(BRANCHES_TABLE)
      .update({
        head_commit_id: commit.id,
        updated_at: new Date().toISOString(),
      })
      .eq('pipeline_id', pipelineId)
      .eq('name', branchName);

    if (branchError) {
      console.error('Failed to update branch HEAD:', branchError);
    }

    // 6. Update pipeline's current_commit_id
    await supabase
      .from(PIPELINES_TABLE)
      .update({ current_commit_id: commit.id })
      .eq('id', pipelineId);

    return { ok: true, commit, skipped: false };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// --------------------------------------------------------------------------
// Fetch commits
// --------------------------------------------------------------------------

/**
 * List commits for a pipeline (metadata only, no payloads).
 * Supports cursor-based pagination.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} params
 * @param {string} params.pipelineId
 * @param {string} [params.branchName] - Filter by branch (optional)
 * @param {number} [params.limit=50]
 * @param {number} [params.cursor] - Commit number to paginate from (exclusive, fetch older)
 * @returns {Promise<{ ok: boolean, commits?: Object[], hasMore?: boolean, error?: string }>}
 */
export async function listCommits(supabase, {
  pipelineId,
  branchName,
  limit = 50,
  cursor,
}) {
  if (!pipelineId) {
    return { ok: false, error: 'Missing pipelineId', commits: [] };
  }

  try {
    let query = supabase
      .from(COMMITS_TABLE)
      .select(COMMIT_META_FIELDS)
      .eq('pipeline_id', pipelineId)
      .order('commit_number', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check hasMore

    if (branchName) {
      query = query.eq('branch_name', branchName);
    }

    if (cursor !== undefined && cursor !== null) {
      query = query.lt('commit_number', cursor);
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false, error: error.message, commits: [] };
    }

    const commits = data || [];
    const hasMore = commits.length > limit;
    if (hasMore) commits.pop(); // Remove the extra

    return { ok: true, commits, hasMore };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), commits: [] };
  }
}

/**
 * Fetch a single commit with full payload (nodes, edges, drawings).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} commitId
 * @returns {Promise<{ ok: boolean, commit?: Object, error?: string }>}
 */
export async function getCommit(supabase, commitId) {
  if (!commitId) {
    return { ok: false, error: 'Missing commitId' };
  }

  try {
    const { data, error } = await supabase
      .from(COMMITS_TABLE)
      .select(COMMIT_FULL_FIELDS)
      .eq('id', commitId)
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, commit: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// --------------------------------------------------------------------------
// Restore commit
// --------------------------------------------------------------------------

/**
 * Restore a pipeline's working state to a specific commit's snapshot.
 * Creates a new commit on the active branch pointing to the restored state.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} params
 * @param {string} params.pipelineId
 * @param {string} params.commitId
 * @param {string} params.branchName
 * @param {string|null} [params.authorId]
 * @returns {Promise<{ ok: boolean, commit?: Object, error?: string }>}
 */
export async function restoreCommit(supabase, {
  pipelineId,
  commitId,
  branchName = 'main',
  authorId = null,
}) {
  try {
    // 1. Fetch the target commit's full payload
    const { ok, commit: sourceCommit, error: fetchError } = await getCommit(supabase, commitId);
    if (!ok) {
      return { ok: false, error: fetchError || 'Failed to fetch source commit' };
    }

    // 2. Update pipeline working state
    const { error: updateError } = await supabase
      .from(PIPELINES_TABLE)
      .update({
        nodes: sourceCommit.nodes,
        edges: sourceCommit.edges,
        drawings: sourceCommit.drawings || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', pipelineId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // 3. Create a restore commit on the active branch
    const result = await createCommit(supabase, {
      pipelineId,
      branchName,
      nodes: sourceCommit.nodes,
      edges: sourceCommit.edges,
      drawings: sourceCommit.drawings || [],
      message: `Restored from commit #${sourceCommit.commit_number}${sourceCommit.message ? ` ("${sourceCommit.message}")` : ''}`,
      authorId,
    });

    return result;
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Get the HEAD commit for a specific branch.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pipelineId
 * @param {string} branchName
 * @returns {Promise<{ ok: boolean, commit?: Object|null, error?: string }>}
 */
export async function getHeadCommit(supabase, pipelineId, branchName = 'main') {
  try {
    const { data: branch } = await supabase
      .from(BRANCHES_TABLE)
      .select('head_commit_id')
      .eq('pipeline_id', pipelineId)
      .eq('name', branchName)
      .maybeSingle();

    if (!branch?.head_commit_id) {
      return { ok: true, commit: null };
    }

    return getCommit(supabase, branch.head_commit_id);
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
