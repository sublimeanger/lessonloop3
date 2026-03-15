-- =============================================================================
-- Fix all lessons & calendar audit findings (LES-01 through LES-05 DB parts)
-- =============================================================================

-- =============================================================================
-- LES-01 CRITICAL: Add org membership check to shift_recurring_lesson_times()
-- The SECURITY DEFINER RPC had no authorization — any authenticated user could
-- shift lessons in any org by knowing a recurrence_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.shift_recurring_lesson_times(
  p_recurrence_id UUID,
  p_after_start_at TIMESTAMPTZ,
  p_offset_ms BIGINT,
  p_new_duration_ms BIGINT,
  p_exclude_lesson_id UUID
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
  _org_id uuid;
BEGIN
  -- Resolve the org that owns this recurrence
  SELECT org_id INTO _org_id
  FROM public.recurrence_rules
  WHERE id = p_recurrence_id;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Recurrence rule not found.';
  END IF;

  -- Verify caller is an active member of that org
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = auth.uid()
      AND org_id = _org_id
      AND status = 'active'
      AND role IN ('owner', 'admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify lessons in this organisation.';
  END IF;

  UPDATE lessons
  SET
    start_at = start_at + (p_offset_ms || ' milliseconds')::interval,
    end_at   = start_at + (p_offset_ms || ' milliseconds')::interval + (p_new_duration_ms || ' milliseconds')::interval,
    updated_at = now()
  WHERE recurrence_id = p_recurrence_id
    AND start_at > p_after_start_at
    AND id != p_exclude_lesson_id
    AND status != 'cancelled';

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;


-- =============================================================================
-- LES-02 HIGH: Add CHECK constraint ensuring end_at > start_at on lessons
-- Prevents zero-duration or negative-duration lessons at the DB level.
-- =============================================================================

ALTER TABLE public.lessons
  ADD CONSTRAINT chk_lesson_time_range
  CHECK (end_at > start_at);


-- =============================================================================
-- LES-03 HIGH: Prevent deletion of lessons that have linked invoice items
-- The FK is ON DELETE SET NULL, which silently orphans billing records.
-- This trigger blocks the delete and forces the user to cancel instead.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_invoiced_lesson_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.invoice_items
    WHERE linked_lesson_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete a lesson that has invoice items. Cancel the lesson instead.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_invoiced_lesson_delete
  BEFORE DELETE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invoiced_lesson_delete();
