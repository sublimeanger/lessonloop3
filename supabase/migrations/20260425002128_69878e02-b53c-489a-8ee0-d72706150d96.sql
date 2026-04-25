-- J9 Phase 3 C1 — Extend message_log.source CHECK & register recurring-billing-scheduler cron

ALTER TABLE public.message_log DROP CONSTRAINT IF EXISTS message_log_source_check;
ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_source_check
  CHECK (source IN (
    'user_manual',
    'recurring_scheduler',
    'recurring_manual_run',
    'parent_portal',
    'recurring_scheduler_alert'
  ));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recurring-billing-scheduler-daily') THEN
    PERFORM cron.unschedule('recurring-billing-scheduler-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'recurring-billing-scheduler-daily',
  '0 4 * * *',
  $CRONBODY$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/recurring-billing-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $CRONBODY$
);

-- J9 Phase 3 follow-up — extend message_log.recipient_type CHECK
ALTER TABLE public.message_log DROP CONSTRAINT IF EXISTS message_log_recipient_type_check;
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