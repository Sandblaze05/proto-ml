-- Allow all authenticated users to view pipelines marked as public
-- Prior to this, users could likely only see their own pipelines or explicitly shared ones.
CREATE POLICY "Anyone can view public pipelines" 
ON public.pipelines FOR SELECT 
USING (is_public = true);
