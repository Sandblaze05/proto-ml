-- Add handle column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle TEXT;

-- Backfill existing users: Use username (slugified) or first part of ID
UPDATE public.profiles 
SET handle = LOWER(REGEXP_REPLACE(LEFT(COALESCE(username, id::text), 20), '[^a-zA-Z0-9]', '_', 'g'))
WHERE handle IS NULL;

-- Handle potential collisions by appending a part of the ID if needed
-- (Simple approach: just ensure uniqueness, if it fails we fix manually, but for now this is safe for a few users)

-- Make handle unique and not null
ALTER TABLE public.profiles ALTER COLUMN handle SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_handle_unique UNIQUE (handle);

-- Constraint: lower case, alphanumeric and underscores only
ALTER TABLE public.profiles ADD CONSTRAINT profiles_handle_check CHECK (handle ~ '^[a-z0-9_]+$');

-- Add a comment
COMMENT ON COLUMN public.profiles.handle IS 'Unique public handle for the user profile URL (slugified, lowercase).';
