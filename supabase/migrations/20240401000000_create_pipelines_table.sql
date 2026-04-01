-- Create the pipelines table
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  nodes JSONB,
  edges JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at timestamp on any change
CREATE TRIGGER update_pipelines_updated_at
BEFORE UPDATE ON pipelines
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime on the pipelines table
ALTER TABLE pipelines REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE pipelines;

-- RLS Policies for the pipelines table
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pipelines" ON pipelines
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pipelines" ON pipelines
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pipelines" ON pipelines
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pipelines" ON pipelines
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared pipelines" ON pipelines
FOR SELECT USING (true); -- For now, allow all users to view all pipelines
