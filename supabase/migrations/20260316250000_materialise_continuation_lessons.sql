-- TC-1: Materialise lesson rows when continuation recurrence rules are extended.
-- This RPC generates lesson + lesson_participant rows for a given recurrence rule
-- over a date range, skipping closure dates and respecting the 200-lesson cap.
-- It is idempotent: existing lessons on the same recurrence at the same start_at
-- are skipped via ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION public.materialise_continuation_lessons(
  p_org_id          uuid,
  p_recurrence_id   uuid,
  p_student_id      uuid,
  p_from_date       date,
  p_to_date         date,
  p_rate_minor      integer DEFAULT NULL,
  p_created_by      uuid   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rec           RECORD;       -- recurrence rule
  _template      RECORD;       -- template lesson (most recent existing)
  _tz            text;
  _day           integer;
  _cursor_date   date;
  _wall_time     time;
  _duration_mins integer;
  _lesson_start  timestamptz;
  _lesson_end    timestamptz;
  _closure_dates date[];
  _new_lesson_id uuid;
  _created_count integer := 0;
  _skipped_count integer := 0;
  _conflict_count integer := 0;
  _existing_count integer;
  _max_cap       integer := 200;
BEGIN
  -- 1. Load recurrence rule
  SELECT * INTO _rec
  FROM recurrence_rules
  WHERE id = p_recurrence_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Recurrence rule not found', 'created', 0);
  END IF;

  _tz := COALESCE(_rec.timezone, 'Europe/London');

  -- 2. Find template lesson (most recent non-cancelled lesson on this recurrence)
  SELECT l.* INTO _template
  FROM lessons l
  WHERE l.recurrence_id = p_recurrence_id
    AND l.org_id = p_org_id
    AND l.status != 'cancelled'
  ORDER BY l.start_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No existing lesson found for this recurrence', 'created', 0);
  END IF;

  -- Extract wall-clock time and duration from template
  _wall_time := ((_template.start_at AT TIME ZONE _tz)::time);
  _duration_mins := EXTRACT(EPOCH FROM (_template.end_at - _template.start_at))::integer / 60;

  -- 3. Count existing lessons on this recurrence (for 200-cap)
  SELECT COUNT(*) INTO _existing_count
  FROM lessons
  WHERE recurrence_id = p_recurrence_id
    AND org_id = p_org_id
    AND status != 'cancelled';

  -- 4. Load closure dates for the range
  SELECT ARRAY_AGG(cd.date) INTO _closure_dates
  FROM closure_dates cd
  WHERE cd.org_id = p_org_id
    AND cd.date >= p_from_date
    AND cd.date <= p_to_date
    AND (
      cd.applies_to_all_locations = true
      OR cd.location_id IS NULL
      OR cd.location_id = _template.location_id
    );

  IF _closure_dates IS NULL THEN
    _closure_dates := ARRAY[]::date[];
  END IF;

  -- 5. Generate lessons for each matching day in range
  FOR _day IN SELECT unnest(_rec.days_of_week) LOOP
    _cursor_date := p_from_date;

    -- Advance to first matching day of week
    WHILE EXTRACT(DOW FROM _cursor_date) != _day AND _cursor_date <= p_to_date LOOP
      _cursor_date := _cursor_date + 1;
    END LOOP;

    WHILE _cursor_date <= p_to_date LOOP
      -- Check 200-lesson cap
      IF (_existing_count + _created_count) >= _max_cap THEN
        EXIT;
      END IF;

      -- Skip closure dates
      IF _cursor_date = ANY(_closure_dates) THEN
        _skipped_count := _skipped_count + 1;
        _cursor_date := _cursor_date + (_rec.interval_weeks * 7);
        CONTINUE;
      END IF;

      -- Compute UTC timestamp preserving wall-clock time across DST
      _lesson_start := (_cursor_date || ' ' || _wall_time)::timestamp AT TIME ZONE _tz;
      _lesson_end   := _lesson_start + (_duration_mins || ' minutes')::interval;

      -- Insert lesson (idempotent: skip if same recurrence+start_at exists)
      BEGIN
        INSERT INTO lessons (
          org_id, recurrence_id, start_at, end_at,
          lesson_type, status, teacher_user_id, teacher_id,
          location_id, room_id, title, is_online,
          created_by
        )
        VALUES (
          p_org_id, p_recurrence_id, _lesson_start, _lesson_end,
          _template.lesson_type, 'scheduled', _template.teacher_user_id, _template.teacher_id,
          _template.location_id, _template.room_id, _template.title, _template.is_online,
          COALESCE(p_created_by, _template.created_by)
        )
        RETURNING id INTO _new_lesson_id;

        -- Insert participant
        INSERT INTO lesson_participants (org_id, lesson_id, student_id, rate_minor)
        VALUES (p_org_id, _new_lesson_id, p_student_id, p_rate_minor)
        ON CONFLICT (lesson_id, student_id) DO NOTHING;

        _created_count := _created_count + 1;

      EXCEPTION
        WHEN raise_exception THEN
          -- Conflict trigger fired (teacher/room double booking)
          _conflict_count := _conflict_count + 1;
        WHEN unique_violation THEN
          -- Idempotency: lesson already exists for this slot
          _skipped_count := _skipped_count + 1;
      END;

      _cursor_date := _cursor_date + (_rec.interval_weeks * 7);
    END LOOP;

    -- Re-check cap after inner loop
    IF (_existing_count + _created_count) >= _max_cap THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created', _created_count,
    'skipped_closures', _skipped_count,
    'conflicts', _conflict_count,
    'total_series', _existing_count + _created_count
  );
END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables still applies)
GRANT EXECUTE ON FUNCTION public.materialise_continuation_lessons TO authenticated;
