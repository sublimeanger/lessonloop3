-- Medium-severity RLS & security fixes
-- [9.2]  enrolment_waitlist missing INSERT/UPDATE policies
-- [6.11] lesson_notes missing unique constraint
-- [6.12] lesson_notes orphaned on student delete (SET NULL → CASCADE)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- FIX 1 [9.2]: enrolment_waitlist missing INSERT/UPDATE RLS policies
-- Client-side writes exist in useEnrolmentWaitlist.ts (insert, update).
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY "Staff can insert waitlist entries"
  ON enrolment_waitlist FOR INSERT
  WITH CHECK (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can update waitlist entries"
  ON enrolment_waitlist FOR UPDATE
  USING (is_org_staff(auth.uid(), org_id));

-- ═══════════════════════════════════════════════════════════════════
-- FIX 2 [6.11]: lesson_notes missing unique constraint
-- Prevents duplicate notes per lesson/student/teacher combination.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE lesson_notes ADD CONSTRAINT uq_lesson_notes_combo
  UNIQUE (lesson_id, student_id, teacher_id);

-- ═══════════════════════════════════════════════════════════════════
-- FIX 3 [6.12]: lesson_notes student FK should CASCADE on delete
-- Prevents orphaned notes when a student is deleted.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE lesson_notes DROP CONSTRAINT IF EXISTS lesson_notes_student_id_fkey;
ALTER TABLE lesson_notes ADD CONSTRAINT lesson_notes_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

COMMIT;
