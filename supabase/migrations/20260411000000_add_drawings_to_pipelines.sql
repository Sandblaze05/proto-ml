ALTER TABLE pipelines
ADD COLUMN IF NOT EXISTS drawings JSONB DEFAULT '[]'::jsonb;

UPDATE pipelines
SET drawings = '[]'::jsonb
WHERE drawings IS NULL;
