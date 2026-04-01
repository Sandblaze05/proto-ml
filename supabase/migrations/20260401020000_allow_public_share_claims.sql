-- Allow authenticated users to claim a public pipeline share to their own email.
-- This makes public-link pipelines appear in "Shared With Me" after first open.

DROP POLICY IF EXISTS "Recipients can claim public links" ON pipeline_shares;
CREATE POLICY "Recipients can claim public links" ON pipeline_shares
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND share_scope = 'email'
  AND lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  AND EXISTS (
    SELECT 1
    FROM pipelines p
    WHERE p.id = pipeline_id
      AND p.user_id = owner_id
  )
  AND EXISTS (
    SELECT 1
    FROM pipeline_shares s
    WHERE s.pipeline_id = pipeline_id
      AND s.share_scope = 'public'
      AND s.permission = permission
  )
);
