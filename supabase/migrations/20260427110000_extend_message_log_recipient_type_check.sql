-- J9 Phase 3 follow-up — extend message_log.recipient_type CHECK to
-- include operator-side recipient categories.
--
-- Background: send-dispute-notification (J5) writes recipient_type
-- = 'owner' — not in the existing CHECK ('guardian', 'student',
-- 'teacher', 'parent', 'staff'). The .insert(...) call silently
-- rejects the row but doesn't surface the error to the caller, so
-- dispute notifications send via Resend but produce no message_log
-- audit entry. send-recurring-billing-alert (J9-P3-C2) had the same
-- bug for 'finance_team'.
--
-- Fix: extend CHECK to add 'owner', 'admin', 'finance' (matching
-- org_memberships.role values for system fns picking specific roles)
-- and 'finance_team' (for batched-recipient writes targeting
-- multiple finance-team members).
--
-- Idempotent via DROP CONSTRAINT IF EXISTS.

ALTER TABLE public.message_log
  DROP CONSTRAINT IF EXISTS message_log_recipient_type_check;

ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_recipient_type_check
  CHECK (recipient_type = ANY (ARRAY[
    'guardian'::text,
    'student'::text,
    'teacher'::text,
    'parent'::text,
    'staff'::text,
    'owner'::text,
    'admin'::text,
    'finance'::text,
    'finance_team'::text
  ]));

COMMENT ON COLUMN public.message_log.recipient_type IS
  'Recipient role bucket. Customer-side: guardian, student, parent. Staff-side: teacher, staff, owner, admin, finance. Batched: finance_team (single message_log row representing a send to multiple finance-team members; recipient_email holds comma-joined addresses).';
