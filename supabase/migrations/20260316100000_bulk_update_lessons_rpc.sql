-- ============================================================
-- BE-1: Atomic bulk update/cancel RPCs for lessons
-- BE-2: Completed lesson guard (all fields, not just cancel)
-- BE-3: Conflict detection on teacher/room changes
-- BE-4: Invoiced lesson guard on status changes
-- BE-5: Server-side 100-lesson cap
-- ============================================================

-- Return type for bulk operation results
CREATE TYPE public.bulk_lesson_result AS (
  updated_count   integer,
  skipped_ids     uuid[],
  skipped_reasons text[],
  conflict_ids    uuid[],
  conflict_details text[]
);

-- ============================================================
-- bulk_update_lessons: atomic bulk edit with all guards
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_lessons(
  p_lesson_ids uuid[],
  p_changes    jsonb
)
RETURNS public.bulk_lesson_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id    uuid := auth.uid();
  _org_id       uuid;
  _caller_role  app_role;
  _teacher_id_for_role uuid;
  _result       public.bulk_lesson_result;
  _ids_to_update uuid[];
  _lesson       RECORD;
  _new_teacher_id uuid;
  _new_location_id uuid;
  _new_room_id  uuid;
  _new_status   text;
  _new_lesson_type text;
  _new_teacher_user_id uuid;
  _update_fields jsonb;
  _skip_ids     uuid[] := '{}';
  _skip_reasons text[] := '{}';
  _conf_ids     uuid[] := '{}';
  _conf_details text[] := '{}';
BEGIN
  -- ── Validate input ──────────────────────────────────────
  IF p_lesson_ids IS NULL OR array_length(p_lesson_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No lesson IDs provided.';
  END IF;

  IF array_length(p_lesson_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Maximum 100 lessons per bulk operation.';
  END IF;

  IF p_changes IS NULL OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'No changes provided.';
  END IF;

  -- ── Resolve caller's org and role ───────────────────────
  -- All lessons must belong to the same org; pick from first lesson
  SELECT l.org_id INTO _org_id
  FROM public.lessons l
  WHERE l.id = p_lesson_ids[1];

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Lesson not found.';
  END IF;

  -- Get caller's role in this org
  SELECT om.role INTO _caller_role
  FROM public.org_memberships om
  WHERE om.user_id = _caller_id
    AND om.org_id = _org_id
    AND om.status = 'active';

  IF _caller_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organisation.';
  END IF;

  IF _caller_role NOT IN ('owner', 'admin', 'teacher') THEN
    RAISE EXCEPTION 'Insufficient permissions for bulk edit.';
  END IF;

  -- For teachers, get their teacher record ID
  IF _caller_role = 'teacher' THEN
    SELECT t.id INTO _teacher_id_for_role
    FROM public.teachers t
    WHERE t.user_id = _caller_id
      AND t.org_id = _org_id;
  END IF;

  -- ── Extract changes ─────────────────────────────────────
  _new_teacher_id   := (p_changes->>'teacher_id')::uuid;
  _new_location_id  := (p_changes->>'location_id')::uuid;
  _new_room_id      := (p_changes->>'room_id')::uuid;
  _new_status       := p_changes->>'status';
  _new_lesson_type  := p_changes->>'lesson_type';

  -- If changing teacher, resolve their user_id for teacher_user_id sync
  IF _new_teacher_id IS NOT NULL THEN
    SELECT t.user_id INTO _new_teacher_user_id
    FROM public.teachers t
    WHERE t.id = _new_teacher_id;
  END IF;

  -- ── Per-lesson validation ───────────────────────────────
  _ids_to_update := '{}';

  FOR _lesson IN
    SELECT l.id, l.org_id, l.status, l.teacher_id, l.teacher_user_id,
           l.room_id, l.start_at, l.end_at
    FROM public.lessons l
    WHERE l.id = ANY(p_lesson_ids)
    ORDER BY l.start_at
    FOR UPDATE  -- lock rows for atomic update
  LOOP
    -- Verify all lessons belong to same org
    IF _lesson.org_id != _org_id THEN
      _skip_ids := array_append(_skip_ids, _lesson.id);
      _skip_reasons := array_append(_skip_reasons, 'Lesson belongs to different organisation');
      CONTINUE;
    END IF;

    -- BE-2: Teacher can only edit own lessons
    IF _caller_role = 'teacher' THEN
      IF _lesson.teacher_user_id != _caller_id
         AND (_teacher_id_for_role IS NULL OR _lesson.teacher_id != _teacher_id_for_role) THEN
        _skip_ids := array_append(_skip_ids, _lesson.id);
        _skip_reasons := array_append(_skip_reasons, 'Not your lesson');
        CONTINUE;
      END IF;
    END IF;

    -- BE-2: Completed lesson guard — block ALL changes
    IF _lesson.status = 'completed' THEN
      _skip_ids := array_append(_skip_ids, _lesson.id);
      _skip_reasons := array_append(_skip_reasons, 'Cannot edit completed lesson');
      CONTINUE;
    END IF;

    -- BE-4: Invoiced lesson — block status changes
    IF _new_status IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.invoice_items ii
        WHERE ii.linked_lesson_id = _lesson.id
      ) THEN
        _skip_ids := array_append(_skip_ids, _lesson.id);
        _skip_reasons := array_append(_skip_reasons, 'Cannot change status of invoiced lesson');
        CONTINUE;
      END IF;
    END IF;

    -- BE-3: Conflict detection — teacher conflicts
    IF _new_teacher_id IS NOT NULL AND _new_teacher_user_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.lessons other
        WHERE other.id != _lesson.id
          AND other.org_id = _org_id
          AND other.status != 'cancelled'
          AND (other.teacher_id = _new_teacher_id OR other.teacher_user_id = _new_teacher_user_id)
          AND other.start_at < _lesson.end_at
          AND other.end_at > _lesson.start_at
      ) THEN
        _conf_ids := array_append(_conf_ids, _lesson.id);
        _conf_details := array_append(_conf_details,
          'Teacher conflict at ' || to_char(_lesson.start_at AT TIME ZONE 'Europe/London', 'YYYY-MM-DD HH24:MI'));
        CONTINUE;
      END IF;
    END IF;

    -- BE-3: Conflict detection — room conflicts
    IF _new_room_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.lessons other
        WHERE other.id != _lesson.id
          AND other.org_id = _org_id
          AND other.status != 'cancelled'
          AND other.room_id = _new_room_id
          AND other.start_at < _lesson.end_at
          AND other.end_at > _lesson.start_at
      ) THEN
        _conf_ids := array_append(_conf_ids, _lesson.id);
        _conf_details := array_append(_conf_details,
          'Room conflict at ' || to_char(_lesson.start_at AT TIME ZONE 'Europe/London', 'YYYY-MM-DD HH24:MI'));
        CONTINUE;
      END IF;
    END IF;

    -- All checks passed — include this lesson
    _ids_to_update := array_append(_ids_to_update, _lesson.id);
  END LOOP;

  -- ── Apply the update atomically ─────────────────────────
  IF array_length(_ids_to_update, 1) IS NOT NULL AND array_length(_ids_to_update, 1) > 0 THEN
    -- Build dynamic update based on which fields were provided
    UPDATE public.lessons
    SET
      teacher_id = CASE WHEN _new_teacher_id IS NOT NULL THEN _new_teacher_id ELSE teacher_id END,
      teacher_user_id = CASE WHEN _new_teacher_id IS NOT NULL THEN _new_teacher_user_id ELSE teacher_user_id END,
      location_id = CASE WHEN _new_location_id IS NOT NULL THEN _new_location_id ELSE location_id END,
      room_id = CASE WHEN _new_room_id IS NOT NULL THEN _new_room_id ELSE room_id END,
      status = CASE WHEN _new_status IS NOT NULL THEN _new_status::text ELSE status END,
      lesson_type = CASE WHEN _new_lesson_type IS NOT NULL THEN _new_lesson_type::text ELSE lesson_type END,
      updated_at = now()
    WHERE id = ANY(_ids_to_update);
  END IF;

  -- ── Build result ────────────────────────────────────────
  _result.updated_count   := COALESCE(array_length(_ids_to_update, 1), 0);
  _result.skipped_ids     := _skip_ids;
  _result.skipped_reasons := _skip_reasons;
  _result.conflict_ids    := _conf_ids;
  _result.conflict_details := _conf_details;

  RETURN _result;
END;
$$;

-- ============================================================
-- bulk_cancel_lessons: convenience wrapper for bulk cancel
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_cancel_lessons(
  p_lesson_ids uuid[]
)
RETURNS public.bulk_lesson_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.bulk_update_lessons(p_lesson_ids, '{"status": "cancelled"}'::jsonb);
END;
$$;

-- Grant execute to authenticated users (RPC access)
GRANT EXECUTE ON FUNCTION public.bulk_update_lessons(uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_cancel_lessons(uuid[]) TO authenticated;
