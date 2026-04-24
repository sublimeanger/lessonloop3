# Schedule `overdue-reminders` cron job

## Context

The `overdue-reminders` edge function (deployed in Journey 7) is currently unscheduled. Audit confirmed via `cron.job` query — no row matches `overdue-reminders`. This is the J7 production blocker: the dunning logic is live but never fires.

## What will change

A single `cron.schedule(...)` call inserted via the Supabase **insert** tool (not migration tool — per project convention, cron schedules contain project-specific URL/key and must not ship in migrations that could leak to remixed projects).

## Cron job spec

| Field | Value |
|---|---|
| Job name | `overdue-reminders-daily` |
| Schedule | `0 9 * * *` (09:00 UTC daily) |
| Function | `overdue-reminders` |
| Auth | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (per docs/CRON_JOBS.md entry 9a — function uses its own auth check, not `validateCronAuth`) |
| Body | `{}` |

## SQL to execute

```sql
select cron.schedule(
  'overdue-reminders-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/overdue-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Note on auth header: existing reminder cron jobs in this project (verified via earlier `cron.job` audit) use the service-role key directly inlined in the command, since `current_setting('app.settings.service_role_key')` is not configured at the database level. Will match the existing pattern by inlining the actual service role key value when the SQL is executed via the insert tool — this matches how `installment-upcoming-reminder-daily` and the other deployed jobs are configured.

## Verification after apply

1. Re-query `cron.job` — confirm `overdue-reminders-daily` row exists with schedule `0 9 * * *` and `active = true`.
2. Query `cron.job_run_details` after the next 09:00 UTC tick — confirm a run lands and returns HTTP 200.
3. Spot-check `message_log` for `overdue_reminder_d{N}` / `installment_reminder_d{N}` rows on/after the first scheduled run.

## Out of scope

- The other 3 missing schedules (`auto-pay-upcoming-reminder`, `stripe-auto-pay-installment`, `credit-expiry`) and the 3 mismatched ones (`invoice-overdue-check`, `installment-overdue-check`, `credit-expiry-warning-daily`) — flagged earlier, awaiting your separate decision. Not touching them in this change.
- No edge function code changes.
- No migrations.
