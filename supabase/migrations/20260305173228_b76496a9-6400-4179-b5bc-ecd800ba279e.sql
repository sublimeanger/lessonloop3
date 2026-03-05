ALTER TABLE public.lessons ADD COLUMN is_open_slot BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_lessons_open_slot ON public.lessons (org_id, is_open_slot) WHERE is_open_slot = true;