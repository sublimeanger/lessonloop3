-- FIX 2 [8A.2]: Prevent duplicate active waitlist entries per student
--
-- A student should not have multiple active (waiting/matched/offered) entries
-- for the same org. The auto_add_to_waitlist trigger checks per-lesson but
-- nothing prevents manual duplicates via AddToWaitlistDialog or race conditions.
--
-- Fix: Add a partial unique index on (student_id, org_id) for active statuses.

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_active_student
  ON make_up_waitlist (student_id, org_id)
  WHERE status IN ('waiting', 'matched', 'offered');
