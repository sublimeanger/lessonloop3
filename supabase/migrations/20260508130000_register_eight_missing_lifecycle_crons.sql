-- Register 8 lifecycle edge functions that existed in the codebase
-- but had no pg_cron schedule. Discovered 2026-05-08 in audit:
-- audit/findings/2026-05-08-eight-edge-fns-never-registered-as-crons.md
--
-- All 8 functions had `validateCronAuth` gates and were ready to be
-- cron-triggered, but no `cron.schedule(...)` migration was ever
-- applied to the destination project. Without these crons:
--
--  * trial-expired never fires → expired trials never get downgraded
--    (users keep full functionality after the 30-day trial — silent
--    revenue leak).
--  * enrolment-offer-expiry never fires → parents could accept stale
--    offers indefinitely (data integrity).
--  * waitlist-expiry never fires → make-up waitlist offers stay
--    "offered" forever (UX confusion + booking conflicts).
--  * trial-reminder-{7,3,1}day, trial-winback, ical-expiry-reminder
--    never fire → engagement / lifecycle emails simply don't go out.
--
-- Hours of day chosen to spread across the schedule and avoid the
-- existing 09:00 UTC cluster which already has 4 jobs (see
-- 2026-05-08-cron-net-http-post-5s-timeout.md).

DO $$
DECLARE
  base_url TEXT := 'https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/';
  spec TEXT[][] := ARRAY[
    ARRAY['trial-reminder-7day-daily',     '15 8 * * *',   'trial-reminder-7day'],
    ARRAY['trial-reminder-3day-daily',     '20 8 * * *',   'trial-reminder-3day'],
    ARRAY['trial-reminder-1day-daily',     '25 8 * * *',   'trial-reminder-1day'],
    ARRAY['trial-expired-daily',           '0 7 * * *',    'trial-expired'],
    ARRAY['trial-winback-weekly',          '0 10 * * 1',   'trial-winback'],
    ARRAY['ical-expiry-reminder-daily',    '15 7 * * *',   'ical-expiry-reminder'],
    ARRAY['waitlist-expiry-daily',         '30 4 * * *',   'waitlist-expiry'],
    ARRAY['enrolment-offer-expiry-hourly', '5 * * * *',    'enrolment-offer-expiry']
  ];
  row TEXT[];
  cmd TEXT;
  jname TEXT;
  jsched TEXT;
  jfn TEXT;
  exists_row BOOLEAN;
BEGIN
  FOREACH row SLICE 1 IN ARRAY spec
  LOOP
    jname := row[1];
    jsched := row[2];
    jfn := row[3];

    cmd := format($cmd$
      WITH req AS (
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
          ),
          body := '{}'::jsonb
        ) AS request_id
      )
      SELECT request_id::text FROM req;
    $cmd$, base_url || jfn);

    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = jname) INTO exists_row;
    IF exists_row THEN
      PERFORM cron.unschedule(jname);
    END IF;

    PERFORM cron.schedule(jname, jsched, cmd);
  END LOOP;
END $$;
