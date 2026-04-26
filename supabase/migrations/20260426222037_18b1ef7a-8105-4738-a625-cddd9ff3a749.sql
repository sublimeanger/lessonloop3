-- T01-P3: entity_type normalisation across triggers, RPCs, and historical rows.

-- Step 1: Rewrite the 8 grandfathered triggers to use canonical singular helper

DROP TRIGGER IF EXISTS audit_students ON public.students;
CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('student');

DROP TRIGGER IF EXISTS audit_lessons ON public.lessons;
CREATE TRIGGER audit_lessons
  AFTER INSERT OR UPDATE OR DELETE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('lesson');

DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('invoice');

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('payment');

DROP TRIGGER IF EXISTS audit_org_memberships ON public.org_memberships;
CREATE TRIGGER audit_org_memberships
  AFTER INSERT OR UPDATE OR DELETE ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('org_membership');

DROP TRIGGER IF EXISTS audit_ai_action_proposals ON public.ai_action_proposals;
CREATE TRIGGER audit_ai_action_proposals
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_action_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('ai_action_proposal');

DROP TRIGGER IF EXISTS audit_teachers_changes ON public.teachers;
CREATE TRIGGER audit_teachers_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('teacher');

DROP TRIGGER IF EXISTS audit_internal_messages ON public.internal_messages;
CREATE TRIGGER audit_internal_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('internal_message');

-- Step 2: Rewrite _notify_streak_milestone to write singular entity_type
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
  INSERT INTO public.audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    _org_id, NULL, 'streak_milestone', 'practice_streak', _student_id,
    jsonb_build_object('streak', _new_current, 'student_id', _student_id)
  );

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

-- Step 3: Backfill historical action 'create' → 'insert' (filtered on plural entity_type)
UPDATE public.audit_log
SET action = 'insert'
WHERE action = 'create'
  AND entity_type IN (
    'students','lessons','invoices','payments','org_memberships',
    'ai_action_proposals','teachers','internal_messages'
  );

-- Step 4: Backfill historical entity_type plural → singular
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

-- Step 5: Drop the now-unused log_audit_event() function
DROP FUNCTION IF EXISTS public.log_audit_event();

NOTIFY pgrst, 'reload schema';