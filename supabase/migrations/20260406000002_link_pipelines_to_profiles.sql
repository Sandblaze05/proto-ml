-- Add explicit link between pipelines and profiles for easier Supabase joining
ALTER TABLE public.pipelines
ADD CONSTRAINT pipelines_user_id_profiles_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
