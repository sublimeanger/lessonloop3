-- Track 0.8 Phase 1 patch (C5).
--
-- The C1 migration (20260501100000) covered 12 cron registrations identified
-- in the brief. Production reconnaissance during deploy verification surfaced
-- 4 additional crons not in committed migrations:
--   - complete-expired-assignments (SQL-only, no HTTP, no auth concern — left alone)
--   - reset-stale-practice-streaks (SQL-only, same — left alone)
--   - send-lesson-reminders (HTTP, Pattern A, silently dead — folded in below)
--   - calendar-refresh-busy (HTTP, Pattern A, silently dead — folded in below; 15-min cadence preserved)
--
-- Also drops the legacy refresh-calendar-busy-blocks cron, a 30-min duplicate
-- of calendar-refresh-busy targeting the same edge fn. Operator decision: keep
-- the 15-min cadence.
--
-- Findings addressed: T08-F1 (extends to 3 newly-found broken HTTP crons),
-- T08-F4 (canonical pattern coverage extends to 14 of 14 HTTP crons).

-- ─── 1. Drop the duplicate refresh-calendar-busy-blocks ───────────
-- Targets the same edge fn as calendar-refresh-busy at half the
-- cadence. Both registrations existed in production simultaneously;
-- operator confirmed the 15-minute one is canonical.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-calendar-busy-blocks') THEN
    PERFORM cron.unschedule('refresh-calendar-busy-blocks');
  END IF;
END $$;

-- ─── 2. calendar-refresh-busy — */15 * * * * ──────────────────────
-- Was registered with Pattern A (Authorization: Bearer service_role)
-- but the edge fn checks x-cron-secret via validateCronAuth — header
-- name mismatch, 401 every run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calendar-refresh-busy') THEN
    PERFORM cron.unschedule('calendar-refresh-busy');
  END IF;
END $$;

SELECT cron.schedule(
  'calendar-refresh-busy',
  '*/15 * * * *',
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

-- ─── 3. send-lesson-reminders — 0 * * * * ─────────────────────────
-- Same shape: registered with Pattern A but the edge fn uses
-- validateCronAuth. 401 every hour since deploy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-lesson-reminders') THEN
    PERFORM cron.unschedule('send-lesson-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'send-lesson-reminders',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/send-lesson-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
