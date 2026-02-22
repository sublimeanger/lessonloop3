
CREATE OR REPLACE FUNCTION public.find_waitlist_matches(
  _lesson_id UUID, _absent_student_id UUID, _org_id UUID
)
RETURNS TABLE (
  waitlist_id UUID, student_id UUID, student_name TEXT,
  guardian_name TEXT, guardian_email TEXT,
  missed_lesson_title TEXT, missed_lesson_date DATE,
  waiting_since TIMESTAMPTZ, match_quality TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lesson RECORD;
  _duration INTEGER;
  _day_name TEXT;
  _lesson_time TIME;
BEGIN
  SELECT * INTO _lesson FROM lessons WHERE id = _lesson_id AND org_id = _org_id;
  IF NOT FOUND THEN RETURN; END IF;

  _duration := EXTRACT(EPOCH FROM (_lesson.end_at::timestamp - _lesson.start_at::timestamp)) / 60;
  _day_name := TRIM(LOWER(TO_CHAR(_lesson.start_at AT TIME ZONE 'UTC', 'day')));
  _lesson_time := (_lesson.start_at AT TIME ZONE 'UTC')::TIME;

  RETURN QUERY
  SELECT w.id, w.student_id,
    (s.first_name || ' ' || s.last_name)::TEXT,
    g.full_name::TEXT, g.email::TEXT,
    w.lesson_title, w.missed_lesson_date, w.created_at,
    CASE
      WHEN w.teacher_id = _lesson.teacher_id AND w.lesson_duration_minutes = _duration
        AND (w.location_id IS NULL OR w.location_id = _lesson.location_id) THEN 'exact'
      WHEN w.teacher_id = _lesson.teacher_id AND w.lesson_duration_minutes = _duration THEN 'same_teacher'
      WHEN w.lesson_duration_minutes = _duration THEN 'same_duration'
      ELSE 'partial'
    END
  FROM make_up_waitlist w
  JOIN students s ON s.id = w.student_id
  LEFT JOIN guardians g ON g.id = w.guardian_id
  WHERE w.org_id = _org_id AND w.status = 'waiting'
    AND w.student_id != _absent_student_id
    AND w.lesson_duration_minutes <= _duration
    AND (w.expires_at IS NULL OR w.expires_at > NOW())
    AND (w.preferred_days IS NULL OR _day_name = ANY(w.preferred_days))
    AND (w.preferred_time_earliest IS NULL OR _lesson_time >= w.preferred_time_earliest)
    AND (w.preferred_time_latest IS NULL OR _lesson_time <= w.preferred_time_latest)
    AND NOT EXISTS (
      SELECT 1 FROM lesson_participants lp JOIN lessons l ON l.id = lp.lesson_id
      WHERE lp.student_id = w.student_id AND l.status = 'scheduled'
        AND l.start_at < _lesson.end_at AND l.end_at > _lesson.start_at
    )
  ORDER BY
    CASE
      WHEN w.teacher_id = _lesson.teacher_id AND w.lesson_duration_minutes = _duration THEN 0
      WHEN w.teacher_id = _lesson.teacher_id THEN 1
      WHEN w.lesson_duration_minutes = _duration THEN 2
      ELSE 3
    END,
    w.created_at ASC
  LIMIT 10;
END;
$$;
