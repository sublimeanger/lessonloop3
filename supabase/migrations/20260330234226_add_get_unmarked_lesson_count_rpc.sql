-- Fix 1: Create get_unmarked_lesson_count RPC for accurate dashboard count.
-- Counts only lessons that genuinely need attendance marking
-- (at least one participant has no attendance record).

CREATE OR REPLACE FUNCTION get_unmarked_lesson_count(
  _org_id UUID,
  _teacher_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT l.id)::integer
  FROM lessons l
  JOIN lesson_participants lp ON lp.lesson_id = l.id
  LEFT JOIN attendance_records ar
    ON ar.lesson_id = l.id AND ar.student_id = lp.student_id
  WHERE l.org_id = _org_id
    AND l.status = 'scheduled'
    AND l.end_at < NOW()
    AND l.end_at > NOW() - INTERVAL '30 days'
    AND ar.id IS NULL
    AND (_teacher_id IS NULL OR l.teacher_id = _teacher_id);
$$;
