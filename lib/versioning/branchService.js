/**
 * branchService.js — CRUD operations for pipeline branches.
 *
 * Manages lightweight branch pointers (create, list, switch, delete/archive).
 * Each branch references a HEAD commit and an optional base commit (branch point).
 */

const BRANCHES_TABLE = 'pipeline_branches';
const COMMITS_TABLE = 'pipeline_commits';
const PIPELINES_TABLE = 'pipelines';

const BRANCH_FIELDS = `
  id, pipeline_id, name, head_commit_id, base_commit_id,
  description, is_default, is_archived, created_by,
  created_at, updated_at
`;

// --------------------------------------------------------------------------
// Create & initialize branches
// --------------------------------------------------------------------------

/**
 * Ensure the default "main" branch exists for a pipeline.
 * Idempotent — safe to call multiple times.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pipelineId
 * @param {string|null} [userId=null]
 * @returns {Promise<{ ok: boolean, branch?: Object, created?: boolean, error?: string }>}
 */
export async function ensureDefaultBranch(supabase, pipelineId, userId = null) {
  if (!pipelineId) {
    return { ok: false, error: 'Missing pipelineId' };
  }

  try {
    // Check if main already exists
    const { data: existing } = await supabase
      .from(BRANCHES_TABLE)
      .select(BRANCH_FIELDS)
      .eq('pipeline_id', pipelineId)
      .eq('name', 'main')
      .maybeSingle();

    if (existing) {
      return { ok: true, branch: existing, created: false };
    }

    // Create main branch
    const { data: branch, error } = await supabase
      .from(BRANCHES_TABLE)
      .insert({
        pipeline_id: pipelineId,
        name: 'main',
        is_default: true,
        created_by: userId,
        description: 'Default branch',
      })
      .select(BRANCH_FIELDS)
      .single();

    if (error) {
      // Handle race condition where another call created it
      if (error.code === '23505') {
        const { data: raced } = await supabase
          .from(BRANCHES_TABLE)
          .select(BRANCH_FIELDS)
          .eq('pipeline_id', pipelineId)
          .eq('name', 'main')
          .single();
        return { ok: true, branch: raced, created: false };
      }
      return { ok: false, error: error.message };
    }

    // Update pipeline active_branch
    await supabase
      .from(PIPELINES_TABLE)
      .update({ active_branch: 'main' })
      .eq('id', pipelineId);

    return { ok: true, branch, created: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Create a new branch from a specific commit.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} params
 * @param {string} params.pipelineId
 * @param {string} params.name
 * @param {string} params.fromCommitId
 * @param {string} [params.description='']
 * @param {string|null} [params.userId=null]
 * @returns {Promise<{ ok: boolean, branch?: Object, error?: string }>}
 */
export async function createBranch(supabase, {
  pipelineId,
  name,
  fromCommitId,
  description = '',
  userId = null,
}) {
  if (!pipelineId || !name) {
    return { ok: false, error: 'Missing pipelineId or branch name' };
  }

  // Validate branch name (no spaces, slashes OK for namespacing)
  const sanitized = name.trim();
  if (!sanitized || /\s/.test(sanitized)) {
    return { ok: false, error: 'Branch name cannot contain spaces' };
  }

  if (sanitized === 'main') {
    return { ok: false, error: 'Cannot create a branch named "main" — it already exists' };
  }

  try {
    const { data: branch, error } = await supabase
      .from(BRANCHES_TABLE)
      .insert({
        pipeline_id: pipelineId,
        name: sanitized,
        head_commit_id: fromCommitId || null,
        base_commit_id: fromCommitId || null,
        description,
        is_default: false,
        created_by: userId,
      })
      .select(BRANCH_FIELDS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: `Branch "${sanitized}" already exists` };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true, branch };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// --------------------------------------------------------------------------
// List & get branches
// --------------------------------------------------------------------------

/**
 * List all branches for a pipeline.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pipelineId
 * @param {Object} [options={}]
 * @param {boolean} [options.includeArchived=false]
 * @returns {Promise<{ ok: boolean, branches?: Object[], error?: string }>}
 */
export async function listBranches(supabase, pipelineId, options = {}) {
  const { includeArchived = false } = options;

  if (!pipelineId) {
    return { ok: false, error: 'Missing pipelineId', branches: [] };
  }

  try {
    let query = supabase
      .from(BRANCHES_TABLE)
      .select(BRANCH_FIELDS)
      .eq('pipeline_id', pipelineId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false, error: error.message, branches: [] };
    }

    return { ok: true, branches: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), branches: [] };
  }
}

/**
 * Get a specific branch by name.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pipelineId
 * @param {string} branchName
 * @returns {Promise<{ ok: boolean, branch?: Object|null, error?: string }>}
 */
export async function getBranch(supabase, pipelineId, branchName) {
  try {
    const { data, error } = await supabase
      .from(BRANCHES_TABLE)
      .select(BRANCH_FIELDS)
      .eq('pipeline_id', pipelineId)
      .eq('name', branchName)
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, branch: data || null };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// --------------------------------------------------------------------------
// Switch branch
// --------------------------------------------------------------------------

/**
 * Switch the active branch for a pipeline.
 * Updates the pipeline's active_branch field.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pipelineId
 * @param {string} branchName
 * @returns {Promise<{ ok: boolean, branch?: Object, headCommit?: Object|null, error?: string }>}
 */
export async function switchBranch(supabase, pipelineId, branchName) {
  if (!pipelineId || !branchName) {
    return { ok: false, error: 'Missing pipelineId or branchName' };
  }

  try {
    // 1. Verify the branch exists
    const { data: branch, error: branchError } = await supabase
      .from(BRANCHES_TABLE)
      .select(BRANCH_FIELDS)
      .eq('pipeline_id', pipelineId)
      .eq('name', branchName)
      .eq('is_archived', false)
      .single();

    if (branchError || !branch) {
      return { ok: false, error: `Branch "${branchName}" not found` };
    }

    // 2. Fetch the HEAD commit's full payload (if exists)
    let headCommit = null;
    if (branch.head_commit_id) {
      const { data: commit } = await supabase
        .from(COMMITS_TABLE)
        .select('id, nodes, edges, drawings, commit_number, message, graph_hash, created_at')
        .eq('id', branch.head_commit_id)
        .single();
      headCommit = commit || null;
    }

    // 3. Update pipeline working state if we have a commit
    const updatePayload = {
      active_branch: branchName,
      current_commit_id: branch.head_commit_id || null,
      updated_at: new Date().toISOString(),
    };

    if (headCommit) {
      updatePayload.nodes = headCommit.nodes;
      updatePayload.edges = headCommit.edges;
      updatePayload.drawings = headCommit.drawings || [];
    }

    const { error: updateError } = await supabase
      .from(PIPELINES_TABLE)
      .update(updatePayload)
      .eq('id', pipelineId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    return { ok: true, branch, headCommit };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// --------------------------------------------------------------------------
// Update & delete branches
// --------------------------------------------------------------------------

/**
 * Update a branch's metadata (rename, archive, description).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} branchId
 * @param {Object} patch - Fields to update: { name, description, is_archived }
 * @returns {Promise<{ ok: boolean, branch?: Object, error?: string }>}
 */
export async function updateBranch(supabase, branchId, patch) {
  if (!branchId) {
    return { ok: false, error: 'Missing branchId' };
  }

  const allowedFields = ['name', 'description', 'is_archived'];
  const safePatch = {};
  for (const key of allowedFields) {
    if (patch[key] !== undefined) safePatch[key] = patch[key];
  }
  safePatch.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from(BRANCHES_TABLE)
      .update(safePatch)
      .eq('id', branchId)
      .select(BRANCH_FIELDS)
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, branch: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Archive (soft-delete) a branch.
 * The default branch cannot be archived.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pipelineId
 * @param {string} branchName
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function archiveBranch(supabase, pipelineId, branchName) {
  if (branchName === 'main') {
    return { ok: false, error: 'Cannot archive the default branch' };
  }

  try {
    const { error } = await supabase
      .from(BRANCHES_TABLE)
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('pipeline_id', pipelineId)
      .eq('name', branchName);

    if (error) {
      return { ok: false, error: error.message };
    }

    // If the pipeline's active branch is the archived one, switch to main
    const { data: pipeline } = await supabase
      .from(PIPELINES_TABLE)
      .select('active_branch')
      .eq('id', pipelineId)
      .single();

    if (pipeline?.active_branch === branchName) {
      await supabase
        .from(PIPELINES_TABLE)
        .update({ active_branch: 'main' })
        .eq('id', pipelineId);
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
