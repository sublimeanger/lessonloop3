# Cron Class B (HTTP-failing) detection is currently a no-op

**Severity:** medium
**Status:** DOWNGRADED to v1.1+ 2026-05-10 s29 — Sentry edge wrap (s28 +16 high-impact cron fns) provides equivalent monitoring; Option A rewrite of 16 cron registrations deferred.
**Area:** crons / observability
**Discovered:** 2026-05-08
**Fixed:** — (Option A rewrite deferred to v1.1+; Sentry provides the alerting now)
**Fixed in:** — (workaround via s28 Sentry cron wrap)
**Affected components:** `public.check_cron_health()`, all 16 `net.http_post`-style cron commands, `cron-health-watchdog`

## s29 closure rationale

The original finding's "Workaround (in place)" section already correctly identified Sentry edge-fn 5xx alerting as the partial mitigation. s28 expanded Sentry coverage to 83/103 edge fns (~81%), specifically wrapping 16 high-impact cron-fired fns (trial × 5, auto-pay × 2, credit-expiry × 2, overdue × 4, lifecycle × 2, streak × 1). Every cron-target fn that LessonLoop business logic cares about now captures 5xx events.

Class A (stopped-firing) detection still works via the existing `cron-health-watchdog` + `check_cron_health()` chain.

Combined coverage:
- Class A: cron-health-watchdog detects jobs that stopped firing entirely
- Class B (NEW via Sentry): cron-target fns that fire reliably into a 500 wall surface as Sentry events with `runtime:deno-edge fn_name:<cron-fn>`
- Jamie should configure a Sentry alert rule for shadow term: `runtime:deno-edge level:error firstSeen:-24h` → email Jamie. Documented in HANDOVER §29 Jamie actions.

Option A (rewrite cron registrations to surface request_id) remains the proper long-term fix but is now correctly scoped as v1.1+ migration work, not v1 launch-blocker.

## Symptom

After fixing the three-bug chain in `2026-05-08-check-cron-health-rpc-broken-since-deploy.md`, `check_cron_health()` returns successfully but **never reports `B_http_failing`** — no matter how many cron-target edge functions return 500. Only Class A (stopped firing entirely) is detected.

## Root cause

`pg_cron`'s `cron.job_run_details.return_message` is populated by the SQL row-count message of the cron's COMMAND statement. For the canonical pattern used by 16 of 18 LessonLoop jobs:

```sql
WITH req AS (SELECT net.http_post(url := '...', ...))
SELECT 1;
```

`return_message` is literally `'1 row'`. The actual `net.http_post` request_id (a bigint primary key into `net._http_response`) is captured into the `req` CTE but **discarded** — never returned, never surfaced.

The watchdog's `http_24h` CTE attempts `nhr.id = jrd.return_message::bigint` to correlate cron firings with their HTTP responses. With `return_message='1 row'`, this join can never match. Class B detection is therefore impossible with the current schema.

## Fix (proposed, deferred)

Rewrite the cron command pattern to surface the request_id. Two viable approaches:

### Option A — capture request_id into return_message via SELECT

```sql
SELECT net.http_post(
  url := '...',
  headers := jsonb_build_object('x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'))
)::text;
```

Bare `SELECT` of `net.http_post()` returns the request_id (bigint) as the row value. pg_cron's `return_message` will contain the integer string. The watchdog's existing regex + cast logic handles it. **One-line change per cron registration; no edge fn changes.**

### Option B — log to a side table

Maintain a `cron_http_dispatch_log(jobid, request_id, fired_at)` table. Cron commands INSERT a row alongside the http_post. Watchdog joins that side-table to `_http_response`. More invasive but more flexible.

**Recommend Option A.** Lower complexity, surfaces request_id in pg_cron's existing observability without new tables. Cost: rewrite 16 cron `cron.schedule()` registrations in a single migration.

## Workaround (in place)

Until rewrite: Class A (stopped-firing) detection works correctly. Operators get alerts if a cron stops firing entirely (e.g. pg_cron broken at system level, or cron disabled). They do **NOT** get alerts if a cron fires reliably into a 500 wall.

External monitoring of edge function 5xx rates via Sentry is the partial mitigation here — every cron-targeted edge function should have an alert rule that triggers on >0 errors/24h. Sentry already captures this.

## Verification

After rewrite + redeploy:
- Trigger a deliberate 500 in (say) `cleanup-orphaned-resources` for one daily run
- Confirm `check_cron_health()` returns `severity='warning'` for that job 24h later
- Confirm next 09:30 watchdog run sends an alert email

## Lessons / follow-ups

- Pre-launch acceptance: this is a launch-blocker only if Sentry alerting on edge fn 5xx is not also configured. If Sentry covers it, defer to post-launch.
- Track in `audit/00-launch-readiness.md` as P2 ops debt.
- Consider whether the watchdog should also consult `platform_audit_log` and Sentry directly for a fuller picture, rather than relying solely on cron + http_response correlation.
