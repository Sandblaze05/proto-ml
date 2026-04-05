-- Create folders table to persist user-created folders
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one folder name per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_user_name ON folders(user_id, name);

-- RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own folders" ON folders
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders" ON folders
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON folders
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON folders
FOR DELETE USING (auth.uid() = user_id);
