# Eight scheduled edge functions exist but have no pg_cron schedule

**Severity:** high (P1; trial flow gaps approach P0)
**Status:** fixed (live)
**Area:** crons / lifecycle automation
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** migration `20260508130000_register_eight_missing_lifecycle_crons.sql` applied via Management API. 8 jobs verified active in `cron.job`
**Affected components:** `cron.job` (Postgres pg_cron), 8 edge functions

## Symptom

`SELECT jobname FROM cron.job WHERE jobname LIKE ANY (ARRAY['%trial%','%ical%','%waitlist%','%enrolment%'])` returns **zero rows**, but the corresponding 8 edge functions exist and are properly cron-auth gated:

| edge fn | expected cadence | LoC | impact if not running |
|---|---|---|---|
| `trial-reminder-7day` | daily | 137 | Trial users never get a 7-day-left email |
| `trial-reminder-3day` | daily | 137 | Trial users never get a 3-day-left email |
| `trial-reminder-1day` | daily | 139 | Trial users never get a 1-day-left email |
| `trial-expired` | daily | 149 | **Expired trials never get downgraded** — users stay on full functionality forever post-trial |
| `trial-winback` | weekly | 154 | No re-engagement of churned trials |
| `ical-expiry-reminder` | daily | 144 | iCal tokens silently lapse without notice |
| `enrolment-offer-expiry` | hourly | 85 | **Offers never auto-expire** — parents could accept stale offers indefinitely |
| `waitlist-expiry` | daily | 75 | Make-up offers never expire from `make_up_waitlist` |

Each function has `validateCronAuth` at the top — they're built to be cron-triggered, but nothing schedules them.

## Risk

- **Revenue loss / fraud risk**: `trial-expired` not running means a user can sign up for a 30-day trial and use full functionality indefinitely. This is the most material business impact.
- **Operational debt**: stale offers/waitlist entries pile up; admin UI shows zombie offers that can be accepted by parents months later, causing booking conflicts.
- **GDPR adjacent**: iCal tokens never get refreshed-or-revoked reminders; users may not realise their iCal subscription is using a stale token.

## Root cause

These edge functions were written but the corresponding `cron.schedule(...)` migrations were never applied to the destination project. Either they shipped on the source environment (Lovable Cloud) and didn't make it into the migration dump, or they were always missing.

Searched `supabase/migrations/*` for `cron.schedule` referencing any of these 8 names: **0 hits**.

## Fix (proposed)

A single migration registering all 8 jobs against the canonical net.http_post pattern. Cadence based on each function's expected_interval comment + business need:

```sql
-- Pattern: WITH req AS (SELECT net.http_post(...)) SELECT request_id::text FROM req;
-- (return_message will be "1 row" — see 2026-05-08-cron-class-b-detection-no-op.md
--  for the limitation, but the http_post still fires)

SELECT cron.schedule('trial-reminder-7day-daily', '0 8 * * *', $$
  SELECT net.http_post(
    url := 'https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/trial-reminder-7day',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);
-- repeat for: trial-reminder-3day-daily (0 8), trial-reminder-1day-daily (0 8),
-- trial-expired-daily (0 9), trial-winback-weekly (0 10 * * 1),
-- ical-expiry-reminder-daily (0 7), waitlist-expiry-daily (0 4),
-- enrolment-offer-expiry-hourly (0 * * * *)
```

Recommended hours-of-day chosen to avoid the existing 09:00 cluster (which already has 4 jobs and produced 5s timeouts — see `2026-05-08-cron-net-http-post-5s-timeout.md`).

## Pre-launch action item

This is a launch-week task. Without it:
- `trial-expired` not running = revenue leak (silent)
- `enrolment-offer-expiry` not running = parents could accept very-stale offers (data integrity)
- `waitlist-expiry` not running = make-up offers stay "offered" forever (UX confusion)

Trial reminders (3) are nice-to-have. The expirations (3) are operational must-haves.

## Verification

After registration:
- Confirm `cron.job` has 8 new rows with `active=true`
- Wait one cron tick (depends on schedule; `enrolment-offer-expiry` is hourly = within 60min)
- Verify `cron.job_run_details` shows new run rows with `status='succeeded'`
- Verify `net._http_response` shows `status_code=200` for the resulting HTTP calls (function-side success)

## Lessons / follow-ups

- Migration discipline: every edge fn that has `validateCronAuth` should have a paired `cron.schedule` migration with the same `2026XXXXXXX_schedule_<name>.sql` filename pattern.
- Pre-launch acceptance test: list all `validateCronAuth` users in `supabase/functions/*/index.ts` and assert each has a matching pg_cron entry. Could be automated as a CI step.
