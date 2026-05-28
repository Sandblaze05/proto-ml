-- ============================================================================
-- Fix User References & RLS Policies Migration
-- Alters foreign keys to point to public.profiles instead of auth.users
-- Fixes RLS policies to use auth.jwt() ->> 'email' instead of querying auth.users
-- Expands INSERT, UPDATE, DELETE policies to support shared editors
-- ============================================================================

-- 1. pipeline_commits: drop author_id constraint to keep as plain UUID
ALTER TABLE public.pipeline_commits
  DROP CONSTRAINT IF EXISTS pipeline_commits_author_id_fkey;

-- 2. pipeline_branches: drop created_by constraint to keep as plain UUID
ALTER TABLE public.pipeline_branches
  DROP CONSTRAINT IF EXISTS pipeline_branches_created_by_fkey;

-- 3. Fix SELECT RLS policies (avoid querying auth.users)
DROP POLICY IF EXISTS "Users can view commits for shared pipelines" ON public.pipeline_commits;
DROP POLICY IF EXISTS "Users can view branches for shared pipelines" ON public.pipeline_branches;

CREATE POLICY "Users can view commits for shared pipelines"
  ON public.pipeline_commits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_commits.pipeline_id
        AND (
          (pipeline_shares.share_scope = 'email'
           AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email'))
          OR pipeline_shares.share_scope = 'public'
        )
    )
  );

CREATE POLICY "Users can view branches for shared pipelines"
  ON public.pipeline_branches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND (
          (pipeline_shares.share_scope = 'email'
           AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email'))
          OR pipeline_shares.share_scope = 'public'
        )
    )
  );

-- 4. Fix INSERT, UPDATE, DELETE RLS policies to support shared editors
DROP POLICY IF EXISTS "Users can insert commits for own pipelines" ON public.pipeline_commits;
CREATE POLICY "Users can insert commits for own pipelines"
  ON public.pipeline_commits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = pipeline_commits.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_commits.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can manage branches for own pipelines" ON public.pipeline_branches;
CREATE POLICY "Users can manage branches for own pipelines"
  ON public.pipeline_branches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = pipeline_branches.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can update branches for own pipelines" ON public.pipeline_branches;
CREATE POLICY "Users can update branches for own pipelines"
  ON public.pipeline_branches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = pipeline_branches.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can delete branches for own pipelines" ON public.pipeline_branches;
CREATE POLICY "Users can delete branches for own pipelines"
  ON public.pipeline_branches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = pipeline_branches.pipeline_id
        AND pipelines.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.pipeline_shares
      WHERE pipeline_shares.pipeline_id = pipeline_branches.pipeline_id
        AND pipeline_shares.permission = 'edit'
        AND lower(pipeline_shares.shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );
