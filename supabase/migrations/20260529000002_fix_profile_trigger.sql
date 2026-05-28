-- ============================================================================
-- Fix public.handle_new_user() Trigger & Backfill Missing Profiles
-- Resolves profile creation failures due to the NOT NULL handle constraint.
-- ============================================================================

-- 1. Redefine trigger function to automatically generate a clean, unique handle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_handle TEXT;
  clean_handle TEXT;
  final_handle TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate a clean handle using full_name, email prefix, or user_id prefix
  base_handle := COALESCE(
    new.raw_user_meta_data->>'full_name', 
    split_part(new.email, '@', 1), 
    'user_' || substring(new.id::text from 1 for 8)
  );
  
  -- Clean it: lowercase, alphanumeric and underscores only, max 15 chars
  clean_handle := LOWER(REGEXP_REPLACE(LEFT(base_handle, 15), '[^a-zA-Z0-9]', '_', 'g'));
  clean_handle := REGEXP_REPLACE(clean_handle, '^_+|_+$', '', 'g');
  clean_handle := REGEXP_REPLACE(clean_handle, '_+', '_', 'g');
  
  IF clean_handle = '' THEN
    clean_handle := 'user';
  END IF;

  final_handle := clean_handle;

  -- Check for uniqueness and append suffix if collision occurs
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) LOOP
    counter := counter + 1;
    final_handle := clean_handle || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, handle, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User_' || substr(new.id::text, 1, 8)),
    final_handle,
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill profiles for existing users who signed up but triggers failed
INSERT INTO public.profiles (id, username, handle, avatar_url)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1), 'User_' || substr(id::text, 1, 8)),
  LOWER(REGEXP_REPLACE(LEFT(COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1), 'user_' || substring(id::text from 1 for 8)), 15), '[^a-zA-Z0-9]', '_', 'g')) || '_' || substring(id::text from 1 for 4),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
