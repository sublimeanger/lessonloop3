-- Batch RPC to check lesson counts on multiple dates in a single query.
-- Replaces the N+1 per-date queries in useClosureDateSettings.checkLessonsOnDates().

CREATE OR REPLACE FUNCTION public.count_lessons_on_dates(
  _org_id uuid,
  _dates date[]
)
RETURNS TABLE(lesson_date date, lesson_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (start_at AT TIME ZONE COALESCE(
      (SELECT timezone FROM organisations WHERE id = _org_id),
      'Europe/London'
    ))::date AS lesson_date,
    count(*) AS lesson_count
  FROM lessons
  WHERE org_id = _org_id
    AND status != 'cancelled'
    AND (start_at AT TIME ZONE COALESCE(
      (SELECT timezone FROM organisations WHERE id = _org_id),
      'Europe/London'
    ))::date = ANY(_dates)
  GROUP BY lesson_date;
$$;

GRANT EXECUTE ON FUNCTION public.count_lessons_on_dates TO authenticated;
