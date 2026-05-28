-- ============================================================================
-- Pipeline Version Control — Database Schema
-- Creates immutable commit history and lightweight branch pointers.
-- ============================================================================

-- 1. pipeline_commits — immutable version snapshots
CREATE TABLE IF NOT EXISTS pipeline_commits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  branch_name     TEXT NOT NULL DEFAULT 'main',
  parent_id       UUID REFERENCES pipeline_commits(id) ON DELETE SET NULL,

  -- Snapshot payload
  nodes           JSONB NOT NULL DEFAULT '[]',
  edges           JSONB NOT NULL DEFAULT '[]',
  drawings        JSONB DEFAULT '[]',

  -- Metadata
  message         TEXT DEFAULT '',
  tag             TEXT,
  author_id       UUID,
  commit_number   INTEGER NOT NULL,

  -- Graph fingerprint
  graph_hash      TEXT NOT NULL,
  node_count      INTEGER NOT NULL DEFAULT 0,
  edge_count      INTEGER NOT NULL DEFAULT 0,

  -- Execution context at commit time
  execution_meta  JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(pipeline_id, commit_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_commits_pipeline_branch
  ON pipeline_commits(pipeline_id, branch_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commits_tag
  ON pipeline_commits(tag) WHERE tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commits_hash
  ON pipeline_commits(graph_hash);

-- 2. pipeline_branches — lightweight refs
CREATE TABLE IF NOT EXISTS pipeline_branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  head_commit_id  UUID REFERENCES pipeline_commits(id) ON DELETE SET NULL,
  base_commit_id  UUID REFERENCES pipeline_commits(id) ON DELETE SET NULL,
  description     TEXT DEFAULT '',
  is_default      BOOLEAN DEFAULT FALSE,
  is_archived     BOOLEAN DEFAULT FALSE,
  created_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(pipeline_id, name)
);

-- 3. Add version control columns to pipelines
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS active_branch TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS current_commit_id UUID REFERENCES pipeline_commits(id) ON DELETE SET NULL;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE pipeline_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_branches ENABLE ROW LEVEL SECURITY;

-- Commits: users can read commits for pipelines they own or have access to
DROP POLICY IF EXISTS "Users can view commits for own pipelines" ON pipeline_commits;
CREATE POLICY "Users can view commits for own pipelines"
  ON pipeline_commits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_commits.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view commits for shared pipelines" ON pipeline_commits;
CREATE POLICY "Users can view commits for shared pipelines"
  ON pipeline_commits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_commits.pipeline_id
        AND (
          (pipeline_shares.share_scope = 'email'
           AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email'))
          OR pipeline_shares.share_scope = 'public'
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert commits for own pipelines" ON pipeline_commits;
CREATE POLICY "Users can insert commits for own pipelines"
  ON pipeline_commits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_commits.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_commits.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Branches: similar policies
DROP POLICY IF EXISTS "Users can view branches for own pipelines" ON pipeline_branches;
CREATE POLICY "Users can view branches for own pipelines"
  ON pipeline_branches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_branches.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view branches for shared pipelines" ON pipeline_branches;
CREATE POLICY "Users can view branches for shared pipelines"
  ON pipeline_branches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND (
          (pipeline_shares.share_scope = 'email'
           AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email'))
          OR pipeline_shares.share_scope = 'public'
        )
    )
  );

DROP POLICY IF EXISTS "Users can manage branches for own pipelines" ON pipeline_branches;
CREATE POLICY "Users can manage branches for own pipelines"
  ON pipeline_branches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_branches.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can update branches for own pipelines" ON pipeline_branches;
CREATE POLICY "Users can update branches for own pipelines"
  ON pipeline_branches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_branches.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can delete branches for own pipelines" ON pipeline_branches;
CREATE POLICY "Users can delete branches for own pipelines"
  ON pipeline_branches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_branches.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Function to get next commit number for a pipeline
CREATE OR REPLACE FUNCTION next_commit_number(p_pipeline_id UUID)
RETURNS INTEGER AS $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(commit_number), 0) INTO max_num
  FROM pipeline_commits
  WHERE pipeline_id = p_pipeline_id;
  RETURN max_num + 1;
END;
$$ LANGUAGE plpgsql;
