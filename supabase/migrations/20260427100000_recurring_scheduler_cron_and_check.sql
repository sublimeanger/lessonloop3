-- J9 Phase 3 C1 — Extend message_log.source CHECK for scheduler alerts;
-- register recurring-billing-scheduler cron.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS before ADD; cron.unschedule
-- guarded against missing job.

-- ─── 1. Extend message_log.source CHECK ──────────────────────────

ALTER TABLE public.message_log
  DROP CONSTRAINT IF EXISTS message_log_source_check;

ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_source_check
  CHECK (source IN (
    'user_manual',
    'recurring_scheduler',
    'recurring_manual_run',
    'parent_portal',
    'recurring_scheduler_alert'
  ));

-- ─── 2. Register recurring-billing-scheduler cron (0 4 * * * UTC) ─

-- Idempotent unschedule-then-schedule so re-runs don't duplicate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'recurring-billing-scheduler-daily'
  ) THEN
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

-- Schedule runs at 04:00 UTC daily. Rationale per design doc §4:
-- chosen before most UK-timezone academy operators start work, so
-- any partial-run alert lands in their inbox before they check it;
-- after midnight UTC so "due today" templates have correctly ticked
-- over. 04:00 UTC = 05:00 BST = 04:00 GMT. No org-specific tz
-- handling — the scheduler processes all orgs in a single run and
-- respects each template's next_run_date date-level semantics.
