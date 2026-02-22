
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
BEGIN
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
