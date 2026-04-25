-- Track 0.8 Phase 1 C1 — Standardise all cron auth on Pattern C
-- (vault.INTERNAL_CRON_SECRET → x-cron-secret header → validateCronAuth).
--
-- Findings addressed: T08-F1, T08-F2, T08-F3, T08-F4.
--
-- Why: 10 of 12 production crons silently 401-fail daily because of
-- inconsistent auth patterns layered onto stores that were never
-- populated. Standardising on a single canonical pattern fixes all 10
-- in one migration, removes the hardcoded JWT in cleanup-orphaned-
-- resources, drops two dead PostgreSQL config dependencies
-- (app.settings.internal_cron_secret, app.settings.cron_secret), and
-- gives every future cron one template to copy from.
--
-- Pattern: each cron unscheduled-then-rescheduled with the canonical
-- header set { 'Content-Type', 'x-cron-secret' } where x-cron-secret
-- is read from vault.decrypted_secrets at call time. The 12 DO blocks
-- are intentionally repeated (not refactored into a loop) so each
-- cron can be read in isolation.
--
-- Prerequisite: vault.decrypted_secrets MUST contain INTERNAL_CRON_SECRET
-- (operator-populated 2026-04-25). All cron edge fns must export
-- validateCronAuth (Pattern A inline auth removed in T08-P1-C2 / C3).

-- ─── 1. auto-pay-upcoming-reminder-daily — 0 8 * * * ──────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-pay-upcoming-reminder-daily') THEN
    PERFORM cron.unschedule('auto-pay-upcoming-reminder-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-pay-upcoming-reminder-daily',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/auto-pay-upcoming-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 2. stripe-auto-pay-installment-daily — 0 9 * * * ─────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stripe-auto-pay-installment-daily') THEN
    PERFORM cron.unschedule('stripe-auto-pay-installment-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'stripe-auto-pay-installment-daily',
  '0 9 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/stripe-auto-pay-installment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 3. auto-pay-final-reminder-daily — 0 8 * * * ─────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-pay-final-reminder-daily') THEN
    PERFORM cron.unschedule('auto-pay-final-reminder-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-pay-final-reminder-daily',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/auto-pay-final-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 4. overdue-reminders-daily — 0 9 * * * ───────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'overdue-reminders-daily') THEN
    PERFORM cron.unschedule('overdue-reminders-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'overdue-reminders-daily',
  '0 9 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/overdue-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 5. recurring-billing-scheduler-daily — 0 4 * * * ─────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recurring-billing-scheduler-daily') THEN
    PERFORM cron.unschedule('recurring-billing-scheduler-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'recurring-billing-scheduler-daily',
  '0 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/recurring-billing-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 6. credit-expiry-daily — 0 2 * * * ───────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'credit-expiry-daily') THEN
    PERFORM cron.unschedule('credit-expiry-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'credit-expiry-daily',
  '0 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/credit-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 7. invoice-overdue-check — 30 5 * * * ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-overdue-check') THEN
    PERFORM cron.unschedule('invoice-overdue-check');
  END IF;
END $$;

SELECT cron.schedule(
  'invoice-overdue-check',
  '30 5 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/invoice-overdue-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 8. installment-overdue-check-daily — 0 6 * * * ───────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'installment-overdue-check-daily') THEN
    PERFORM cron.unschedule('installment-overdue-check-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'installment-overdue-check-daily',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/installment-overdue-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 9. installment-upcoming-reminder-daily — 0 8 * * * ───────────
-- Body kept as '{}'::jsonb — verified the receiving fn does not read
-- req.json() / req.body. Earlier registration sent { "time": now() }
-- but that field was never consumed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'installment-upcoming-reminder-daily') THEN
    PERFORM cron.unschedule('installment-upcoming-reminder-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'installment-upcoming-reminder-daily',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/installment-upcoming-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 10. credit-expiry-warning-daily — 0 8 * * * ──────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'credit-expiry-warning-daily') THEN
    PERFORM cron.unschedule('credit-expiry-warning-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'credit-expiry-warning-daily',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/credit-expiry-warning',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 11. cleanup-orphaned-resources — 0 3 * * * ───────────────────
-- Schedule sourced from the fn header doc-comment in
-- supabase/functions/cleanup-orphaned-resources/index.ts ("Runs daily
-- at 3 AM via pg_cron"). Was registered out-of-band — no committed
-- migration. Operator should verify against `SELECT schedule FROM
-- cron.job WHERE jobname = 'cleanup-orphaned-resources'` after deploy
-- and reconcile if production was running on a different cadence.
-- Hardcoded anon JWT (legacy artefact) is removed by re-registering
-- with the canonical Pattern C header set.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphaned-resources') THEN
    PERFORM cron.unschedule('cleanup-orphaned-resources');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-orphaned-resources',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/cleanup-orphaned-resources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 12. refresh-calendar-busy-blocks — */30 * * * * ──────────────
-- Name preserved without -daily suffix to match the existing
-- registration in 20260223100000_calsync_cron_guardian_health.sql.
-- That migration used current_setting('app.settings.cron_secret')
-- (Pattern E), which was never set in production — re-registering
-- with vault.INTERNAL_CRON_SECRET fixes the silently-dead state.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-calendar-busy-blocks') THEN
    PERFORM cron.unschedule('refresh-calendar-busy-blocks');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-calendar-busy-blocks',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/calendar-refresh-busy',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
