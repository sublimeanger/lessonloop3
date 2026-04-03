-- Add optional description column for room equipment and features
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.rooms.description IS
  'Optional description of room equipment and features (e.g. "Grand piano, 6 chairs, whiteboard")';
