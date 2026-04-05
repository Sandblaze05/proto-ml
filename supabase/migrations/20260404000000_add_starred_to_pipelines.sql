-- Add starred/pinned column to pipelines table
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- Create an index for quick pinned lookups
CREATE INDEX IF NOT EXISTS idx_pipelines_starred ON pipelines(user_id, is_starred) WHERE is_starred = TRUE;
