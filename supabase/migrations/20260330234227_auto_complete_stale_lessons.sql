-- Fix 2: One-time data cleanup — auto-complete stale lessons where all
-- participants already have attendance records but lesson status is still
-- 'scheduled'. These are legacy records from before auto-complete logic.

DO $$
DECLARE
  _updated_count INTEGER;
BEGIN
  UPDATE lessons SET status = 'completed'
  WHERE status = 'scheduled'
    AND end_at < NOW()
    AND EXISTS (
      SELECT 1 FROM lesson_participants lp2 WHERE lp2.lesson_id = lessons.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM lesson_participants lp
      WHERE lp.lesson_id = lessons.id
      AND NOT EXISTS (
        SELECT 1 FROM attendance_records ar
        WHERE ar.lesson_id = lessons.id AND ar.student_id = lp.student_id
      )
    );

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RAISE NOTICE 'Auto-completed % stale lessons where all attendance was already recorded', _updated_count;
END $$;
