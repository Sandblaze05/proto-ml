-- Add community publishing fields to pipelines
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT 'Anonymous';
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS pipeline_likes (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, pipeline_id)
);

-- Enable RLS
ALTER TABLE pipeline_likes ENABLE ROW LEVEL SECURITY;

-- Allow all users to read pipeline_likes (for counting or checking)
CREATE POLICY "Anyone can view likes" 
ON pipeline_likes FOR SELECT 
USING (true);

-- Allow users to insert their own likes
CREATE POLICY "Users can insert their own likes" 
ON pipeline_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own likes
CREATE POLICY "Users can delete their own likes" 
ON pipeline_likes FOR DELETE 
USING (auth.uid() = user_id);
