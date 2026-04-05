-- Preserve the folder a pipeline belonged to before it was starred.
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS original_folder TEXT;

-- Backfill existing starred pipelines so unstar restores them to their previous folder.
UPDATE pipelines
SET original_folder = CASE
  WHEN original_folder IS NULL AND folder IS NOT NULL AND folder <> 'Starred' THEN folder
  ELSE original_folder
END
WHERE is_starred = TRUE;
