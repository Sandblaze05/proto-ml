-- Extend pipeline_shares to support authenticated public links.
ALTER TABLE pipeline_shares
ADD COLUMN IF NOT EXISTS share_scope TEXT NOT NULL DEFAULT 'email' CHECK (share_scope IN ('email', 'public'));

ALTER TABLE pipeline_shares
ALTER COLUMN shared_with_email DROP NOT NULL;

ALTER TABLE pipeline_shares
DROP CONSTRAINT IF EXISTS pipeline_shares_pipeline_id_shared_with_email_key;

DROP INDEX IF EXISTS pipeline_shares_pipeline_id_shared_with_email_key;
DROP INDEX IF EXISTS pipeline_shares_unique_email_share;
DROP INDEX IF EXISTS pipeline_shares_unique_public_share;

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_shares_unique_email_share
ON pipeline_shares (pipeline_id, shared_with_email)
WHERE share_scope = 'email' AND shared_with_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_shares_unique_public_share
ON pipeline_shares (pipeline_id, share_scope)
WHERE share_scope = 'public';

DROP POLICY IF EXISTS "Recipients can view their shares" ON pipeline_shares;
CREATE POLICY "Recipients can view their shares" ON pipeline_shares
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND (
    (share_scope = 'email' AND lower(shared_with_email) = lower(auth.jwt() ->> 'email'))
    OR share_scope = 'public'
  )
);

DROP POLICY IF EXISTS "Users can view pipelines shared with them" ON pipelines;
CREATE POLICY "Users can view pipelines shared with them" ON pipelines
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM pipeline_shares s
    WHERE s.pipeline_id = pipelines.id
      AND (
        (s.share_scope = 'email' AND lower(s.shared_with_email) = lower(auth.jwt() ->> 'email'))
        OR s.share_scope = 'public'
      )
  )
);

DROP POLICY IF EXISTS "Users can update edit-shared pipelines" ON pipelines;
CREATE POLICY "Users can update edit-shared pipelines" ON pipelines
FOR UPDATE USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM pipeline_shares s
    WHERE s.pipeline_id = pipelines.id
      AND s.permission = 'edit'
      AND (
        (s.share_scope = 'email' AND lower(s.shared_with_email) = lower(auth.jwt() ->> 'email'))
        OR s.share_scope = 'public'
      )
  )
);
