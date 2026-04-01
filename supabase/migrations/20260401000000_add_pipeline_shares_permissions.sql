-- Add per-recipient sharing with granular permissions.
CREATE TABLE IF NOT EXISTS pipeline_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pipeline_id, shared_with_email)
);

ALTER TABLE pipeline_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can create shares" ON pipeline_shares
FOR INSERT WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (
    SELECT 1
    FROM pipelines p
    WHERE p.id = pipeline_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can view shares for their pipelines" ON pipeline_shares
FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Recipients can view their shares" ON pipeline_shares
FOR SELECT USING (
  lower(shared_with_email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Owners can update shares" ON pipeline_shares
FOR UPDATE USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete shares" ON pipeline_shares
FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can view shared pipelines" ON pipelines;

CREATE POLICY "Users can view pipelines shared with them" ON pipelines
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM pipeline_shares s
    WHERE s.pipeline_id = pipelines.id
      AND lower(s.shared_with_email) = lower(auth.jwt() ->> 'email')
  )
);

CREATE POLICY "Users can update edit-shared pipelines" ON pipelines
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM pipeline_shares s
    WHERE s.pipeline_id = pipelines.id
      AND lower(s.shared_with_email) = lower(auth.jwt() ->> 'email')
      AND s.permission = 'edit'
  )
);
