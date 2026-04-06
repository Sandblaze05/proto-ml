ALTER TABLE public.pipelines 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS fork_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL;

-- Function to increment fork count
CREATE OR REPLACE FUNCTION increment_fork_count(row_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE pipelines
  SET fork_count = fork_count + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;
