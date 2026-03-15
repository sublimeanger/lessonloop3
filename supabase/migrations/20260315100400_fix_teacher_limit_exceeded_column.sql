-- FIX 9: Add column to flag orgs that exceed teacher limits after downgrade
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS teacher_limit_exceeded BOOLEAN NOT NULL DEFAULT false;
