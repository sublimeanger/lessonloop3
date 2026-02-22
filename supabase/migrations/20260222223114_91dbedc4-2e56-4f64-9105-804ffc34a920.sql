-- RES-002: Add FK constraint on resources.uploaded_by with ON DELETE SET NULL
ALTER TABLE public.resources ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;