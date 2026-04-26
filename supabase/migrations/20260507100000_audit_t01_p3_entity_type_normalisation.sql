-- T01-P3: entity_type normalisation across triggers, RPCs, and historical rows.
--
-- Closes Track 0.1 by aligning the 8 grandfathered audit triggers and
-- _notify_streak_milestone RPC to the canonical singular entity_type +
-- LOWER(TG_OP) action verb pattern established by T01-P1.
--
-- Order is significant:
--   1. Rewrite the 8 triggers to use log_audit_event_singular(<singular>).
--   2. CREATE OR REPLACE _notify_streak_milestone with singular entity_type.
--   3. Backfill audit_log historical rows: action 'create' → 'insert',
--      filtered on plural entity_type (only triggers wrote those).
--   4. Backfill audit_log historical rows: plural entity_type → singular.
--   5. DROP log_audit_event() (zero callers post step 1).
--
-- Step 3 must precede step 4: once entity_type is singular across the table,
-- there is no clean way to distinguish trigger-emitted 'create' rows from
-- logAudit('create', '<singular>', ...) rows that callers in src/ deliberately
-- write as a domain verb. Filtering on plural entity_type (pre-step-4 state)
-- isolates trigger rows precisely.

-- ---------------------------------------------------------------------------
-- Step 1: Rewrite the 8 grandfathered triggers
-- ---------------------------------------------------------------------------

-- 1. audit_students
DROP TRIGGER IF EXISTS audit_students ON public.students;
CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('student');

-- 2. audit_lessons
DROP TRIGGER IF EXISTS audit_lessons ON public.lessons;
CREATE TRIGGER audit_lessons
  AFTER INSERT OR UPDATE OR DELETE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('lesson');

-- 3. audit_invoices
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('invoice');

-- 4. audit_payments
DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('payment');

-- 5. audit_org_memberships
DROP TRIGGER IF EXISTS audit_org_memberships ON public.org_memberships;
CREATE TRIGGER audit_org_memberships
  AFTER INSERT OR UPDATE OR DELETE ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('org_membership');

-- 6. audit_ai_action_proposals
DROP TRIGGER IF EXISTS audit_ai_action_proposals ON public.ai_action_proposals;
CREATE TRIGGER audit_ai_action_proposals
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_action_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('ai_action_proposal');

-- 7. audit_teachers_changes
DROP TRIGGER IF EXISTS audit_teachers_changes ON public.teachers;
CREATE TRIGGER audit_teachers_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('teacher');

-- 8. audit_internal_messages
DROP TRIGGER IF EXISTS audit_internal_messages ON public.internal_messages;
CREATE TRIGGER audit_internal_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('internal_message');

-- ---------------------------------------------------------------------------
-- Step 2: Rewrite _notify_streak_milestone to write singular entity_type
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notify_streak_milestone(
  _student_id uuid,
  _org_id uuid,
  _new_current integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log to audit_log (singular entity_type per T01-P3)
  INSERT INTO public.audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    _org_id, NULL, 'streak_milestone', 'practice_streak', _student_id,
    jsonb_build_object('streak', _new_current, 'student_id', _student_id)
  );

  -- Fire the streak-notification edge function via pg_net
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
           || '/functions/v1/streak-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'student_id', _student_id,
      'new_streak', _new_current,
      'org_id', _org_id
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Step 3: Backfill historical action 'create' → 'insert'
-- Filter on PLURAL entity_type to isolate trigger-emitted rows. Domain-verb
-- 'create' rows from logAudit('create', '<singular>', ...) callers are NOT
-- affected because their entity_type values are already singular and excluded
-- by this filter.
-- ---------------------------------------------------------------------------
UPDATE public.audit_log
SET action = 'insert'
WHERE action = 'create'
  AND entity_type IN (
    'students','lessons','invoices','payments','org_memberships',
    'ai_action_proposals','teachers','internal_messages'
  );

-- ---------------------------------------------------------------------------
-- Step 4: Backfill historical entity_type plural → singular
-- Includes the 5 edge-fn-written plurals (calendar_connections, xero_connections)
-- and the RPC-written practice_streaks.
-- ---------------------------------------------------------------------------
UPDATE public.audit_log SET entity_type = 'student'              WHERE entity_type = 'students';
UPDATE public.audit_log SET entity_type = 'lesson'               WHERE entity_type = 'lessons';
UPDATE public.audit_log SET entity_type = 'invoice'              WHERE entity_type = 'invoices';
UPDATE public.audit_log SET entity_type = 'payment'              WHERE entity_type = 'payments';
UPDATE public.audit_log SET entity_type = 'org_membership'       WHERE entity_type = 'org_memberships';
UPDATE public.audit_log SET entity_type = 'ai_action_proposal'   WHERE entity_type = 'ai_action_proposals';
UPDATE public.audit_log SET entity_type = 'teacher'              WHERE entity_type = 'teachers';
UPDATE public.audit_log SET entity_type = 'internal_message'     WHERE entity_type = 'internal_messages';
UPDATE public.audit_log SET entity_type = 'practice_streak'      WHERE entity_type = 'practice_streaks';
UPDATE public.audit_log SET entity_type = 'calendar_connection'  WHERE entity_type = 'calendar_connections';
UPDATE public.audit_log SET entity_type = 'xero_connection'      WHERE entity_type = 'xero_connections';

-- ---------------------------------------------------------------------------
-- Step 5: Drop log_audit_event() — zero callers post step 1.
-- If a future migration is found that still calls this, the
-- "function does not exist" error is louder and more actionable than a
-- swallowed RAISE NOTICE shim would be.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.log_audit_event();

NOTIFY pgrst, 'reload schema';
