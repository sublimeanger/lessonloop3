# Track 0.8 P2 — Cron Health Watchdog Scoping Walk — 2026-04-26

Read-only scoping walk against main tip `7b6608bd` ("Applied T01-P3 migration").
Done in chat-Claude's local clone, post-T01-P3 close. Goal: surface design
options for T08-F5 (cron-health watchdog) so chat-Claude can author a P2
brief without further design exploration.

## Headline recommendation

**Build a single SECURITY DEFINER RPC + a daily watchdog edge function +
operator-email alert. Skip the in-app surface for now.**

The in-app surface (CalendarSyncHealth-style component) is the natural
long-term home, but it requires a platform-admin auth surface that doesn't
exist today (verified: no `is_platform_admin` helper, no super-admin pages,
no platform-only routes). Building that surface to host one health card is
disproportionate.

Email-only watchdog ships in P2; in-app surface waits for a future "platform
admin" track that bundles cron health, webhook health, retention sweep
status, and other infrastructure observability in one place.

---

## What today's T08-P1 verification proved

Two empirical findings from the 24h verification run, both inputs to P2 design:

**Finding 1: `cron.job_run_details` and `net._http_response` can disagree.**
The hourly `send-lesson-reminders` cron showed 22 successes in
`cron.job_run_details` for the 24h window AND 4 NULL-status-code rows in
`net._http_response` for the same window — meaning the SQL `SELECT
net.http_post(...)` queue insert succeeded (so `cron.job_run_details` is happy)
while the actual HTTP call timed out at 5s (so `net._http_response` recorded a
timeout with NULL status).

A watchdog that only polls `cron.job_run_details` would miss this entirely —
which is exactly the failure mode T08 was created to prevent (silent failure).
**The watchdog must poll both tables.**

**Finding 2: Registration-timing gaps look identical to silent failures.**
The orphan-sweep cron registered at 07:51 UTC on 26 April but its scheduled
slot is 03:45 UTC. `cron.job_run_details` had zero rows for it at verification
time. This is harmless and self-resolving (next slot is 03:45 the following
day) but pattern-matches with "cron stopped firing days ago" if only a
freshness check is used.

The watchdog must distinguish "never ran" (registration timing) from
"hasn't run since X" (silent failure). The cleanest signal is comparing
`cron.job.active = true` AND `cron.job_run_details.last_run` against the
expected-interval-from-`schedule`. If `last_run IS NULL` AND `cron.job.created_at`
is younger than two scheduled intervals, suppress the alert. Otherwise alert.

---

## What the watchdog must detect

Three failure classes, each with a distinct signal:

### Class A — Cron stopped firing (the original T08 problem)

**Signal:** `max(cron.job_run_details.start_time)` for a given jobid is older
than `1.5×` its scheduled interval, AND `cron.job.active = true`, AND
`cron.job.created_at` is older than two scheduled intervals (filters out
registration-timing).

**Severity:** CRITICAL. This is the case that motivated Track 0.8.

**Example:** All 12 crons silently 401-failing pre-T08-P1 — `last_run` would
be days old.

### Class B — Cron firing but HTTP call failing

**Signal:** Recent rows in `net._http_response` from cron-triggered calls
where `status_code >= 400` OR `status_code IS NULL` (timeout) OR `error_msg
IS NOT NULL`.

**Severity:** WARNING for occasional failures (1-2 per day), CRITICAL for
sustained failures (5+ in last 24h, or >50% failure rate over last 12 firings).

**Example:** Today's 4 timeouts on `send-lesson-reminders`. Today these
weren't surfaced anywhere; the watchdog should make them visible without
spamming the operator on every transient blip.

### Class C — Cron firing, HTTP returning 200, but the work isn't completing

**Out of scope for P2.** This requires per-edge-fn application-level health
signals (e.g., "did the credit-expiry sweep actually mark any credits?")
which is a much bigger architecture surface. Each edge fn would need a
self-audit row written to a known table or its own log. That's T08-F7+
territory, not T08-P2.

P2 explicitly only watches the cron→HTTP→200/error layer, not the
application-level outcome layer.

---

## Linking `cron.job_run_details` and `net._http_response`

The two tables don't share a foreign key. The link is:
1. `cron.job_run_details.command` contains the literal SQL of the cron's
   `SELECT net.http_post(...)`.
2. `net.http_post()` returns a `request_id` which becomes
   `net._http_response.id`.
3. There is no direct join. The pattern in PostgreSQL is: in the cron's
   SQL command body, capture the request_id and write it to `cron.job_run_details.return_message`,
   then later `JOIN cron.job_run_details jrd ON jrd.return_message::bigint = nhr.id`.

**Today's cron registrations don't capture `request_id` to `return_message`.**
Verified by reading `20260501100000_cron_auth_standardisation.sql` — every
registered command is a bare `SELECT net.http_post(...) AS request_id;` without
any post-hoc capture. This means historical correlation of a specific
`cron.job_run_details` row to a specific `net._http_response` row is impossible
today.

**Two options to fix:**

(a) **Re-register all 17 crons with capturing wrappers.** Wrap each
   `net.http_post()` in a CTE or DO block that captures the returned
   `request_id` and writes it back into the cron's return value:

   ```sql
   WITH req AS (
     SELECT net.http_post(...) AS request_id
   )
   SELECT request_id::text FROM req;
   ```

   pg_cron will surface that as the `command` row's logical output, which
   shows up in `cron.job_run_details.return_message`. This is the cleanest
   approach but requires re-registering all 17 crons in a P2 migration.

(b) **Time-window approximate join.** For a given cron, find the
   `net._http_response` row whose `created` timestamp is within ±5 seconds of
   the `cron.job_run_details.start_time` AND whose `url_pattern` (or whatever
   net.http_post stores) matches the target edge fn URL.

   Time-window joins are imprecise — two crons that happen to fire at the same
   second would collide. Most LessonLoop crons have unique slots, but
   `auto-pay-upcoming-reminder-daily`, `auto-pay-final-reminder-daily`,
   `installment-upcoming-reminder-daily`, and `credit-expiry-warning-daily`
   all fire at `0 8 * * *`. They'd be indistinguishable by time alone, but
   distinguishable by URL.

**Recommendation: (a).** Re-register all 17 crons with the request_id capture
pattern. P2 migration is then larger (touches all crons) but the watchdog
becomes vastly simpler and accurate. Alternative is to start with (b) for the
walk-then-deploy cycle and refactor to (a) later — but the cost of (a) is
~17 SELECT lines in one migration, not large.

This is **the single biggest design call for the brief.** Mark as OQ1.

---

## Watchdog implementation surface

### Option 1 — Daily edge fn + operator email (recommended for P2)

```
cron-health-check-daily (registered cron, fires once at e.g. 09:30 UTC)
  → SELECT * FROM check_cron_health() (SECURITY DEFINER RPC)
  → If any failures detected:
    POST to send-cron-health-alert (new edge fn)
      → Resend email to OPERATOR_ALERT_EMAIL env var
```

Components:
- One new SECURITY DEFINER RPC `check_cron_health()` returning a table of
  detected failures (cron name, severity, classification, last-run window,
  HTTP failure count).
- One new edge fn `cron-health-watchdog` that calls the RPC daily, formats
  any results as an HTML email, sends via Resend, audits to
  `platform_audit_log`.
- One new cron registration (Pattern C) for the watchdog itself.
- One new env var `OPERATOR_ALERT_EMAIL`.
- 17 cron command body re-registrations to capture `request_id` (per OQ1).

Watchdog runs 09:30 UTC — after the busiest cron slots (08:00 reminders, 09:00
overdue-reminders, 09:00 stripe-auto-pay) settle and any failures from the
night's runs are visible.

The watchdog cron itself becomes one of the things the watchdog watches —
so we need a "deadman" check. Simplest version: if the watchdog hasn't run
in 36+ hours, the operator notices the absence of email rather than
presence — but that's brittle. Cleaner: a second tiny external monitor.
**Out of P2 scope.** Document as known gap; a "watchdog watcher" is itself
the start of an unbounded recursion.

### Option 2 — In-app component for org admins

Skip. Wrong audience — org admins can't fix cron failures. This is platform
concern, surfaced to the operator (Jamie). No org admin has agency over
LessonLoop's pg_cron infrastructure.

### Option 3 — In-app component for platform admin

Right audience, wrong time. There is no platform-admin surface today. Building
one for one health card is disproportionate. Defer to a future "platform
admin" track that bundles multiple concerns.

### Option 4 — Real-time alert via webhook (e.g., Slack)

Deferred. Resend email is sufficient for P2; a Slack webhook is a small future
add (one extra POST in the watchdog edge fn).

---

## Severity policy

The watchdog must avoid alert fatigue. Pre-defined thresholds:

| Class | Condition | Severity | Email? |
|---|---|---|---|
| A — stopped firing | last_run > 1.5× interval AND created > 2× interval old | CRITICAL | YES, every day until resolved |
| A — pre-fire window | last_run NULL AND created < 2× interval old | INFO | NO (suppress; self-resolves) |
| B — HTTP failures | >50% of last 12 firings failed OR ≥5 failures in 24h | CRITICAL | YES, every day until <50%/<5 |
| B — HTTP failures | 1-4 transient failures in 24h | WARNING | YES, summary only (one weekly digest) |
| B — single transient | 1 timeout, all surrounding runs OK | INFO | NO (logged but not emailed) |

The CRITICAL email is daily-while-active. The WARNING summary is weekly
(say, every Monday). Both go to the same `OPERATOR_ALERT_EMAIL`.

This means if Jamie's `send-lesson-reminders` continues having 1-4 timeouts/day
(today's pattern), he gets one weekly summary noting "send-lesson-reminders
has had X timeouts this week". Not a daily nag.

---

## platform_audit_log integration

Every watchdog run writes one row to `platform_audit_log`:

| field | value |
|---|---|
| action | `cron_health_check_run` |
| severity | `info` if no failures detected; `warning` or `error` matching the highest detected class |
| metadata jsonb | `{checked_at, total_crons, failures: [{cron_name, class, severity, evidence}]}` |
| dedup_key | `cron_health_check:<YYYY-MM-DD>` (one row per day) |

This:
- Gives operators a query path to see the cron health history without email
  scrubbing.
- Lets future tooling consume `platform_audit_log` for trends.
- Provides a "watchdog ran today" pulse independent of email send success.

---

## Migration scope estimate

| Surface | Files / lines | Risk |
|---|---|---|
| 17 cron command body re-registrations (OQ1 = a) | One migration, ~250 lines | LOW — pattern is mechanical, identical to existing T08-P1 registrations |
| `check_cron_health()` SECURITY DEFINER RPC | ~80 lines in same migration | LOW |
| `cron-health-watchdog` new edge fn | New folder under supabase/functions/, ~150 lines | LOW |
| `send-cron-health-alert` (or fold into the watchdog fn) | Recommendation: fold. No separate fn. | — |
| 1 new cron registration for the watchdog | ~10 lines in same migration | LOW |
| `OPERATOR_ALERT_EMAIL` env var | One Lovable secrets entry | LOW |
| Frontend / UI | ZERO. P2 is platform-admin email only. | — |
| Tests | Vitest test for the email body formatter; deno test for the RPC fixture | MEDIUM (deno tests against pg_cron schema are tricky) |

**Total P2 size: one migration, one edge fn, one env var, one test file.**
Comparable in scope to T01-P2 (one phase, ~3-4 commits).

---

## Commit structure (recommended)

| Commit | Subject | Files |
|---|---|---|
| T08-P2-C1 | `feat(cron): capture request_id in all cron commands for watchdog correlation (T08-P2-C1)` | One migration: re-registers 17 crons with `WITH req AS ...` wrapper |
| T08-P2-C2 | `feat(cron): cron-health-watchdog edge fn + check_cron_health RPC + daily cron (T08-P2-C2)` | New edge fn folder, new migration with RPC + watchdog cron registration |
| T08-P2-C3 | `chore(docs): T08-P2 close — Track 0.8 closure + cron health docs (T08-P2-C3)` | Walk doc, roadmap close, CRON_JOBS.md update, new CRON_HEALTH.md, POLISH_NOTES |

C1 lands first because the watchdog in C2 depends on the request_id capture
from C1. Lovable applies C1 → C2 in order. Email send is verified after C2.

---

## Open design questions for Jamie

### OQ1 — request_id capture: re-register all 17 crons (a) or use time-window join (b)?

**My recommendation: (a).** ~250 lines of mechanical SQL in one migration is
cheap; permanently-correct correlation is valuable forever. The 4-cron 08:00
slot collision in approach (b) would force per-URL filtering anyway, and any
future cron added to the 08:00 slot rederails. (a) is the proper solution.

### OQ2 — Watchdog cron schedule

09:30 UTC daily? 10:00 UTC? Choose to minimise overlap with existing slots
(02, 03, 03:30, 03:45, 04, 05:30, 06, 08, 09 are all taken). 09:30 is free.
**Recommendation: 09:30 UTC daily.** Catches everything from the previous
24h window before the 10am UK / 11am Europe operator workday begins.

### OQ3 — Severity policy thresholds

The 50%-of-12 / 5-in-24h CRITICAL trigger and 1-4 transient WARNING bucket
are starting points. Both should be reviewable after a month of operation.
**Recommendation: ship with these defaults; revisit T08-P2.5 after one
month.**

### OQ4 — Weekly WARNING digest cron

Add a second cron (`cron-health-weekly-digest`) for Monday-morning warning
summaries? Or fold it into the daily watchdog with day-of-week-aware logic?
**Recommendation: fold into daily watchdog.** One fn, one cron, day-of-week
gating inside the fn. Less infrastructure.

### OQ5 — Deadman pattern (watchdog watching itself)

P2 doesn't include a deadman. If the watchdog itself silently fails, the
absence of daily email is the only signal. Acceptable for P2 because Jamie
checks email regularly and the absence of "no failures detected" daily would
be noticed within days.

**Recommendation: out of scope for P2. Document the gap. Consider for P3 or
defer indefinitely.**

### OQ6 — Email infrastructure

Reuse Resend (existing infrastructure). New env var `OPERATOR_ALERT_EMAIL`.
Same `RESEND_API_KEY` already configured. No changes to send-side
infrastructure.

**Recommendation: confirm.** Trivial.

### OQ7 — What to email when nothing is wrong

Two options:
- **Silent success:** No email when check passes. Operator notices absence
  if it goes silent for 36+ hours.
- **Daily heartbeat:** "All 17 crons healthy" email every day.

**Recommendation: silent success.** Daily-OK emails turn into noise that
gets filtered. Absence of "watchdog detected failures" emails is itself the
signal that all is well, and the `platform_audit_log` row provides the audit
trail. If a stronger pulse is wanted, the deadman in OQ5 covers it.

---

## What this walk does NOT do

- Does not propose migration content (briefs follow walk approval).
- Does not benchmark `cron.job_run_details` query performance under load
  (table is small in production; non-issue).
- Does not address Class C (work not completing despite 200 response) — that's
  a future track.
- Does not propose a platform-admin UI surface.
- Does not address watchdog deadman recursion.
- Does not propose Slack/PagerDuty integration (deferrable).

## Walk methodology

1. Re-read `LESSONLOOP_PRODUCTION_ROADMAP.md:229-260` (Track 0.8 entry) and
   `docs/CRON_JOBS.md` in full to confirm scope.
2. Re-read T08-P1 verification results from earlier today (chat history) —
   the 16/17 OK + 1 pending + 4 timeouts pattern.
3. Verified zero existing code accesses `cron.job_run_details` or
   `net._http_response` via grep across `supabase/migrations/`,
   `supabase/functions/`, `src/`.
4. Read `src/components/settings/CalendarSyncHealth.tsx` as the existing
   "health surface" precedent in the codebase.
5. Inventoried existing email/alert infrastructure (`send-auto-pay-alert`,
   `_shared/auto-pay-reminder-core.ts`, `RESEND_API_KEY` usage).
6. Confirmed no platform-admin auth surface exists (no `is_platform_admin`,
   no super-admin pages or routes).
7. Confirmed no operator email env var exists today.
8. Read T08-P1's cron registration SQL pattern in
   `20260501100000_cron_auth_standardisation.sql` to know what request_id
   capture would look like.

Confidence: **high** for the scope/sizing. **High** for the recommendation
to skip in-app surface for now. **Medium-high** for the (a) vs (b) request_id
correlation call (Jamie may prefer the smaller initial migration if pragmatic).
**Medium** for severity-policy thresholds (numbers chosen by feel; will
inevitably need tuning after operational experience).
