-- Add increment_likes_count function to safely update like counts without owner-only RLS restrictions
CREATE OR REPLACE FUNCTION public.adjust_likes_count(pipeline_id UUID, adjustment INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.pipelines
  SET likes_count = GREATEST(0, likes_count + adjustment)
  WHERE id = pipeline_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
