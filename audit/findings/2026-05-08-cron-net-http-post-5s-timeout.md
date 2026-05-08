# Several cron jobs exceed `net.http_post` 5s timeout (fire-and-forget but obscures observability)

**Severity:** low
**Status:** open (informational)
**Area:** crons
**Discovered:** 2026-05-08
**Fixed:** —
**Fixed in:** —
**Affected components:** `calendar-refresh-busy` (most), `send-lesson-reminders` (some), `cron-health-watchdog` (one)

## Symptom

Querying `net._http_response` for cron-fired requests shows 7 NULL `status_code` rows in the last 7 days, all with `error_msg = 'Timeout of 5000 ms reached. Total time: ~5000ms ...'`. The bulk are `calendar-refresh-busy` (runs every 15 min, called at :45 most often) and `send-lesson-reminders` (runs hourly).

The cron `start_time` records still show `status='succeeded'` because pg_cron only tracks whether the COMMAND ran successfully — `net.http_post` returns its request_id immediately, so the cron run "succeeds" before the HTTP timeout actually fires.

## Root cause

`calendar-refresh-busy` walks every active Google Calendar connection sequentially:

```ts
for (const connection of connections) {
  // 1. Maybe refresh OAuth token (HTTP)
  // 2. Fetch up to 250 events from Google Calendar API (HTTP)
  // 3. Delete old busy blocks (DB)
  // 4. Insert new busy blocks (DB)
  // 5. Update last_sync_at (DB)
  // 6. await new Promise(resolve => setTimeout(resolve, 200));  // rate-limit
}
```

A single connection takes ~600-1500ms (token refresh round-trip + Google list + 3 DB ops + 200ms sleep). 5-10 connections easily exceeds the cron's `net.http_post` default timeout of 5000ms.

`send-lesson-reminders` similarly walks all upcoming lessons in the next 24h and emails each one — natural variance brings it past 5s on busy hours.

## What this actually means

**The functions still complete successfully.** Edge function execution is not bound by the cron caller's timeout — it runs to completion in the background. Verified by spot-checking `external_busy_blocks` rows have `fetched_at` updates after timeouts.

Real consequences:
- `net._http_response.status_code` is NULL for those firings, so any monitoring that joins on it sees "no response" (which the watchdog conservatively treats as not-counted; see `2026-05-08-check-cron-health-rpc-broken-since-deploy.md`).
- We have no observability on whether the function eventually returned 200, 5xx, or hung indefinitely.
- If the function genuinely fails post-timeout, we won't notice via this signal.

## Fix (proposed, deferred)

Two viable approaches:

### Option A — extend cron timeout

```sql
SELECT net.http_post(
  url := '...',
  headers := ...,
  timeout_milliseconds := 30000  -- 30s
);
```

Trade-off: blocks the cron worker longer. Single edge function takes 5-30s; pg_cron has multiple workers, so this is fine for daily / 15-min jobs. Don't apply to per-minute jobs.

### Option B — fire-and-forget with explicit acknowledgement

Edge function records its run-start + run-end into a side table at the very start and end of execution. Watchdog correlates via that side table instead of `_http_response`. Decouples cron observability from HTTP timeout entirely. More invasive.

**Recommend Option A** for `calendar-refresh-busy` (raise to 30s) and `send-lesson-reminders` (raise to 60s). One-line change per cron registration.

## Workaround (in place)

None needed — functions still work. Sentry catches genuine failures via JS-side error capture in the edge function. No data loss observed.

## Lessons / follow-ups

- pg_cron's `net.http_post` default 5s timeout is too tight for any function that walks per-org collections.
- Decision: defer Option A until after launch. Sentry coverage is sufficient.
- Add to `audit/00-launch-readiness.md` as P3 ops debt.
