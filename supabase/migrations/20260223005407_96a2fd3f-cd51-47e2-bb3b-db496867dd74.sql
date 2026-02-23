-- GRADE-003: Custom instruments, default exam board, grade descriptions in LoopAssist
-- Allows orgs to add custom instruments and set a default exam board.

----------------------------------------------------------------------
-- 1. Add default_exam_board_id to organisations
----------------------------------------------------------------------
ALTER TABLE public.organisations
  ADD COLUMN default_exam_board_id UUID REFERENCES public.exam_boards(id) ON DELETE SET NULL;

----------------------------------------------------------------------
-- 2. Allow org admins to manage custom instruments (INSERT/UPDATE/DELETE)
--    RLS policies for built-in instruments (SELECT-only) already exist from GRADE-001.
--    We just need an index for org custom instrument lookups.
----------------------------------------------------------------------
CREATE INDEX idx_instruments_org_custom ON public.instruments(org_id)
  WHERE org_id IS NOT NULL;
