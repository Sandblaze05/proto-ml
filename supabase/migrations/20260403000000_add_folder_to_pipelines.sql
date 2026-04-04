-- Add folder column to pipelines table
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS folder TEXT;

-- Create an index on the folder column for better performance
CREATE INDEX IF NOT EXISTS idx_pipelines_folder ON pipelines(folder);
