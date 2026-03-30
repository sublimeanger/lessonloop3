-- RPC to undo/rollback an entire CSV import batch.
-- Deletes all dependent data in correct order, then soft-deletes the students.

CREATE OR REPLACE FUNCTION undo_student_import(
  _org_id UUID,
  _batch_id UUID,
  _user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _student_ids UUID[];
  _student_count INT;
  _lesson_count INT := 0;
  _recurrence_ids UUID[];
  _membership RECORD;
BEGIN
  -- Verify auth + admin role
  SELECT role INTO _membership
  FROM org_memberships
  WHERE org_id = _org_id AND user_id = _user_id AND status = 'active';

  IF _membership IS NULL OR _membership.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Get all students from this batch
  SELECT ARRAY_AGG(id) INTO _student_ids
  FROM students
  WHERE org_id = _org_id AND import_batch_id = _batch_id AND deleted_at IS NULL;

  IF _student_ids IS NULL OR array_length(_student_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'No students found for this import batch');
  END IF;

  _student_count := array_length(_student_ids, 1);

  -- Collect recurrence_ids from lessons that will be deleted (for cleanup)
  SELECT ARRAY_AGG(DISTINCT l.recurrence_id) INTO _recurrence_ids
  FROM lessons l
  WHERE l.org_id = _org_id
    AND l.recurrence_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM lesson_participants lp
      WHERE lp.lesson_id = l.id
      AND lp.student_id != ALL(_student_ids)
    )
    AND EXISTS (
      SELECT 1 FROM lesson_participants lp
      WHERE lp.lesson_id = l.id
      AND lp.student_id = ANY(_student_ids)
    );

  -- Delete in dependency order:

  -- 1. Attendance records
  DELETE FROM attendance_records
  WHERE student_id = ANY(_student_ids) AND org_id = _org_id;

  -- 2. Lesson participants
  DELETE FROM lesson_participants
  WHERE student_id = ANY(_student_ids) AND org_id = _org_id;

  -- 3. Student instruments
  DELETE FROM student_instruments
  WHERE student_id = ANY(_student_ids) AND org_id = _org_id;

  -- 4. Student teacher assignments
  DELETE FROM student_teacher_assignments
  WHERE student_id = ANY(_student_ids) AND org_id = _org_id;

  -- 5. Student guardian links
  DELETE FROM student_guardians
  WHERE student_id = ANY(_student_ids) AND org_id = _org_id;

  -- 6. Lessons that ONLY have students from this batch
  --    (don't delete lessons that also have non-import students)
  WITH import_only_lessons AS (
    SELECT l.id FROM lessons l
    WHERE l.org_id = _org_id
    AND NOT EXISTS (
      SELECT 1 FROM lesson_participants lp
      WHERE lp.lesson_id = l.id
      AND lp.student_id != ALL(_student_ids)
    )
    AND EXISTS (
      SELECT 1 FROM lesson_participants lp
      WHERE lp.lesson_id = l.id
      AND lp.student_id = ANY(_student_ids)
    )
  )
  DELETE FROM lessons WHERE id IN (SELECT id FROM import_only_lessons);
  GET DIAGNOSTICS _lesson_count = ROW_COUNT;

  -- 7. Clean up orphaned recurrence rules from deleted lessons
  IF _recurrence_ids IS NOT NULL AND array_length(_recurrence_ids, 1) > 0 THEN
    DELETE FROM recurrence_rules r
    WHERE r.id = ANY(_recurrence_ids)
    AND r.org_id = _org_id
    AND NOT EXISTS (
      SELECT 1 FROM lessons l WHERE l.recurrence_id = r.id
    );
  END IF;

  -- 8. Soft-delete students (set deleted_at instead of hard delete for safety)
  UPDATE students SET deleted_at = NOW()
  WHERE id = ANY(_student_ids) AND org_id = _org_id;

  -- 9. Audit log
  INSERT INTO audit_log (org_id, entity_type, action, actor_user_id, after)
  VALUES (_org_id, 'import', 'undo_import', _user_id, json_build_object(
    'batch_id', _batch_id,
    'students_removed', _student_count,
    'lessons_removed', _lesson_count
  ));

  RETURN json_build_object(
    'studentsRemoved', _student_count,
    'lessonsRemoved', _lesson_count,
    'batchId', _batch_id
  );
END;
$$;
