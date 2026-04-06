-- Add a flag to distinguish between user's active pipelines and community snapshots
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_snapshot BOOLEAN DEFAULT FALSE;

-- Ensure the parent_id is there (it was added in versioning mig)
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;
