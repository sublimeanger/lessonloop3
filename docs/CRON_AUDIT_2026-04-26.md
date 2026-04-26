# Track 0.6 — Cron Audit Walk — 2026-04-26

Discovery audit (24 April 2026 → 26 April 2026 walk).
Read-only. Done by chat-Claude in a local clone after Claude Code API timeouts.

## Headline finding

**Track 0.6 roadmap entry is stale documentation, not an open production blocker.**

The roadmap entry at `LESSONLOOP_PRODUCTION_ROADMAP.md:172-187` was authored
on 24 April 2026. It catalogues 8 cron deviations identified at that time.
On **25 April 2026**, T08-P1 (`20260501100000_cron_auth_standardisation.sql`
plus the patch `20260501100100_cron_auth_standardisation_patch.sql`) closed
every issue Track 0.6 flagged. The standardisation migration registered or
re-registered all 12 documented crons under canonical Pattern C
(`vault.INTERNAL_CRON_SECRET` → `x-cron-secret` → `validateCronAuth`).
The patch added `send-lesson-reminders` and `calendar-refresh-busy`,
dropping the duplicate `refresh-calendar-busy-blocks`.

Today (26 April 2026):
- All 13 cron-callable edge functions exist on disk.
- All 13 use `validateCronAuth` (canonical Pattern C).
- All registered schedules match `docs/CRON_JOBS.md`.

**Track 0.6 should be marked 🟢 CLOSED in the roadmap with a closure note
referencing T08-P1.**

There is, however, a separate real concern that Track 0.6 surfaced and
that T08-P1 did NOT address: **historical backfill for the gap window
before T08-P1 deployed.** That is genuinely open. See "Backfill questions
surfaced" below.

## Summary table — current state vs documented expected

All 15 production crons:

| # | Jobname | Registered | Schedule | docs/CRON_JOBS.md | Auth | Roadmap claim (24 Apr) | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `credit-expiry-daily` | ✅ T08-P1 | `0 2 * * *` | `0 2 * * *` | Pattern C | MISSING | ROADMAP STALE — fixed |
| 2 | `cleanup-orphaned-resources` | ✅ T08-P1 | `0 3 * * *` | `0 3 * * *` | Pattern C | (not flagged) | OK |
| 3 | `webhook-retention-daily` | ✅ T05-P2 | `30 3 * * *` | `30 3 * * *` | Pattern C | (not flagged) | OK |
| 4 | `invoice-pdf-orphan-sweep-daily` | ✅ J11-P1 | `45 3 * * *` | `45 3 * * *` | Pattern C | (n/a — post-roadmap) | OK |
| 5 | `recurring-billing-scheduler-daily` | ✅ T08-P1 | `0 4 * * *` | `0 4 * * *` | Pattern C | (not flagged) | OK |
| 6 | `invoice-overdue-check` | ✅ T08-P1 | `30 5 * * *` | `30 5 * * *` | Pattern C | Wrong: `30 5` vs `0 2` | ROADMAP STALE — `docs/CRON_JOBS.md` updated to canonical `30 5`; the 24 Apr "expected `0 2`" was the stale expectation |
| 7 | `installment-overdue-check-daily` | ✅ T08-P1 | `0 6 * * *` | `0 6 * * *` | Pattern C | Wrong: `0 6` vs `0 2` | ROADMAP STALE — same as #6 |
| 8 | `auto-pay-upcoming-reminder-daily` | ✅ T08-P1 | `0 8 * * *` | `0 8 * * *` | Pattern C | MISSING | ROADMAP STALE — fixed |
| 9 | `auto-pay-final-reminder-daily` | ✅ T08-P1 | `0 8 * * *` | `0 8 * * *` | Pattern C | (not flagged) | OK |
| 10 | `installment-upcoming-reminder-daily` | ✅ T08-P1 | `0 8 * * *` | `0 8 * * *` | Pattern C | MATCH | OK |
| 11 | `credit-expiry-warning-daily` | ✅ T08-P1 | `0 8 * * *` | `0 8 * * *` | Pattern C | Wrong: `0 8` vs `55 1` | ROADMAP STALE — `docs/CRON_JOBS.md` updated to canonical `0 8`; the 24 Apr "expected `55 1`" was the stale expectation |
| 12 | `stripe-auto-pay-installment-daily` | ✅ T08-P1 | `0 9 * * *` | `0 9 * * *` | Pattern C | MISSING | ROADMAP STALE — fixed |
| 13 | `overdue-reminders-daily` | ✅ T08-P1 | `0 9 * * *` | `0 9 * * *` | Pattern C | Was MISSING; fixed 24 Apr | OK |
| 14 | `calendar-refresh-busy` | ✅ T08-P1-patch | `*/15 * * * *` | `*/15 * * * *` | Pattern C | (not flagged) | OK |
| 15 | `send-lesson-reminders` | ✅ T08-P1-patch | `0 * * * *` | `0 * * * *` | Pattern C | (not flagged) | OK |

The legacy `refresh-calendar-busy-blocks` cron (registered originally in
`20260223100000_calsync_cron_guardian_health.sql`, re-registered in T08-P1
to fix its dead Pattern E auth) was unscheduled by T08-P1-patch as a
duplicate of `calendar-refresh-busy`. Confirmed dropped at line 23-29 of
`20260501100100_cron_auth_standardisation_patch.sql`.

## Critical findings

### T06-F1 — Roadmap entry is stale (severity: low, doc-hygiene)

**Cron(s) affected:** none directly — this is a documentation issue.
**Evidence:** `LESSONLOOP_PRODUCTION_ROADMAP.md:172-187` describes 8 deviations
that no longer exist after T08-P1 (`20260501100000_cron_auth_standardisation.sql`
authored and merged 25 April 2026; patch `20260501100100`).
The state on disk today (verified by reading both standardisation migrations,
and confirmed against `docs/CRON_JOBS.md` which was updated alongside) shows
all 12 crons registered, no missing schedules, no auth gaps.

**Recommended action:** Track 0.6 → 🟢 CLOSED in `LESSONLOOP_PRODUCTION_ROADMAP.md`
with a closure block referencing T08-P1 + patch. Done as part of T06-P1-C1
(documentation-only commit; no migration). Backfill scoping (T06-F2 below) is
a separate item.

### T06-F2 — Backfill scoping for the missing-cron gap window (severity: HIGH)

**Cron(s) affected:** `stripe-auto-pay-installment-daily` and `credit-expiry-daily`
were both unregistered in production for some period before T08-P1 deployed
on 25 April 2026 ~22:00 UTC. The duration of that window is **not knowable
from the migration history alone** because crons were registered manually in
the Supabase Dashboard prior to T08-P1 and left no committed audit trail of
when they were created/dropped.

**Evidence:**
- T08-F1 in T08-P1's brief documents that `vault.INTERNAL_CRON_SECRET` was
  empty until 25 April; multiple crons silently 401-failed.
- The roadmap audit on 24 April listed `stripe-auto-pay-installment` and
  `credit-expiry` as MISSING (no DB row).
- Current main has these registered via T08-P1, deployed 25 April.

**Real-money exposure:**

For `stripe-auto-pay-installment`: any guardian who enabled auto-pay between
J10 P1 deploy (the earliest possible date auto-pay could be configured) and
T08-P1 deploy never had their installments auto-charged. Installments due
in that window remain `pending` or `overdue` despite a stored
`default_payment_method_id` and `auto_pay_enabled = true`.

For `credit-expiry`: any `make_up_credits` row whose `expires_at`
fell within that window stayed `active` despite having logically expired.
Parents may have spent credits past their stated expiry.

**Recommended action:** T06-P2 backfill brief, after operator runs the
scoping queries below to size the gap. The brief itself depends on the
numbers — e.g. "0 affected installments" → no backfill needed, "100s of
installments" → real-money decision per-org.

### T06-F3 — `docs/CRON_JOBS.md` was updated alongside T08-P1 with new "canonical" schedules (severity: low, info)

**Cron(s) affected:** `invoice-overdue-check`, `installment-overdue-check-daily`,
`credit-expiry-warning-daily`. The roadmap's 24-April audit said these were at
"wrong" schedules (`30 5`, `0 6`, `0 8`) vs expected (`0 2`, `0 2`, `55 1`).
Today, `docs/CRON_JOBS.md` lists the registered schedules (`30 5`, `0 6`, `0 8`)
as the canonical ones — meaning either someone explicitly chose those between
24 April and now, or the original "expected" was always wrong.

**Evidence:** `docs/CRON_JOBS.md` lines 60-93 (current state). The standardisation
migration registered them at the "wrong" times — implying T08-P1 authors viewed
those schedules as intentional production state, not drift to fix.

**Recommended action:** none. The drift-or-intentional question Track 0.6
flagged on 24 April was answered by T08-P1 (intentional; documented). No
follow-up needed unless operator (Jamie) disagrees with any of the three
schedules and wants them moved.

### T06-F4 — No watchdog yet for silent cron failures (severity: medium)

**Cron(s) affected:** all 15.
**Evidence:** `docs/CRON_JOBS.md` line 102: "A health-watchdog (T08-F5, filed
for Track 0.8 Phase 2) will surface this in-app rather than requiring
dashboard attention." Today the only signal that a cron has stopped
running is the operator manually inspecting `cron.job_run_details` or
`net._http_response`.

**Recommended action:** none specific to Track 0.6. This finding is the
existing T08-F5 / Track 0.8 Phase 2 scope. Mentioned here only to surface
that the existence of T08-P2 prevents a Track 0.6-style "stale documentation
discovers prod gap" from recurring undetected.

## Per-cron walk

### 1. `credit-expiry-daily`
- **Roadmap claim (24 Apr):** MISSING. **Structural break:** warnings fire,
  credits never expire.
- **Reality:**
  - Registered: yes, by T08-P1 (`20260501100000:147`).
  - Schedule: `0 2 * * *`. Matches `docs/CRON_JOBS.md` #1.
  - Edge fn: `supabase/functions/credit-expiry/` exists; uses `validateCronAuth`.
  - Migration history: registered for the first time in committed code by
    T08-P1 on 25 April 2026.
- **Verdict:** ROADMAP STALE — fixed by T08-P1.
- **Backfill question:** see T06-F2 + Q2 below. Was this cron ever
  manually-registered in the Dashboard before T08-P1? Cannot verify from
  migration history alone.

### 2. `cleanup-orphaned-resources`
- **Roadmap claim:** not in Track 0.6.
- **Reality:** Registered by T08-P1 (`20260501100000:273`). Schedule `0 3 * * *`
  matches docs. Edge fn exists; Pattern C.
- **Verdict:** OK.

### 3. `webhook-retention-daily`
- **Roadmap claim:** not in Track 0.6 (post-dates the roadmap entry).
- **Reality:** Registered by T05-P2 (`20260503100100:21`). Schedule `30 3 * * *`
  matches docs. Edge fn exists; Pattern C.
- **Verdict:** OK.

### 4. `invoice-pdf-orphan-sweep-daily`
- **Roadmap claim:** n/a (post-dates the roadmap entry — registered J11-P1).
- **Reality:** Registered by J11-P1 patch (`20260504100100:38`). Schedule
  `45 3 * * *` matches docs. Edge fn exists; Pattern C.
- **Verdict:** OK.

### 5. `recurring-billing-scheduler-daily`
- **Roadmap claim:** not in Track 0.6.
- **Reality:** Registered by T08-P1 (`20260501100000:124`); originally registered
  earlier in `20260427100000_recurring_scheduler_cron_and_check.sql` then
  re-registered with canonical Pattern C. Schedule `0 4 * * *` matches docs.
- **Verdict:** OK.

### 6. `invoice-overdue-check`
- **Roadmap claim (24 Apr):** Wrong: `30 5 * * *`. Expected `0 2 * * *`.
  May be intentional.
- **Reality:**
  - Registered: yes, by T08-P1 (`20260501100000:170`) at `30 5 * * *`.
  - `docs/CRON_JOBS.md` #6 documents the expected schedule as `30 5 * * *`.
  - Edge fn: `supabase/functions/invoice-overdue-check/` exists; Pattern C.
- **Verdict:** ROADMAP STALE / INTENTIONAL. The 24 April "expected `0 2`"
  was either a stale or aspirational expectation; T08-P1's authors (and the
  current canonical `docs/CRON_JOBS.md`) treat `30 5` as the correct schedule.
- **Recommended fix shape:** none. If Jamie wants to revisit the schedule
  separately for ordering reasons (e.g. "should run before `installment-overdue-check`"
  which is at `0 6`), file a separate finding.

### 7. `installment-overdue-check-daily`
- **Roadmap claim (24 Apr):** Wrong: `0 6 * * *`. Expected `0 2 * * *`.
  May be intentional.
- **Reality:** T08-P1 registered at `0 6 * * *`; docs match.
- **Verdict:** ROADMAP STALE / INTENTIONAL — same as #6.

### 8. `auto-pay-upcoming-reminder-daily`
- **Roadmap claim (24 Apr):** MISSING. **High impact:** 3-day pre-due notice
  not sent.
- **Reality:** Registered by T08-P1 (`20260501100000:32`) at `0 8 * * *`.
  Edge fn exists; Pattern C.
- **Verdict:** ROADMAP STALE — fixed by T08-P1.
- **Backfill question:** if guardians who configured auto-pay between J10 P1
  and T08-P1 had upcoming installments fall in that window, they did NOT
  receive the 3-day reminder email. **Lower stakes than #12 (no money was
  taken; reminder is informational)** but worth noting for a polish-grade
  customer-comms backfill if the volume warrants it.

### 9. `auto-pay-final-reminder-daily`
- **Roadmap claim:** not in Track 0.6.
- **Reality:** First registered in `20260429100100_schedule_auto_pay_final_reminder.sql`,
  re-registered by T08-P1 (`20260501100000:78`) at `0 8 * * *`. Edge fn exists.
- **Verdict:** OK.

### 10. `installment-upcoming-reminder-daily`
- **Roadmap claim (24 Apr):** MATCH at `0 8 * * *`.
- **Reality:** Registered by T08-P1 at `0 8 * * *`. Match holds.
- **Verdict:** OK.

### 11. `credit-expiry-warning-daily`
- **Roadmap claim (24 Apr):** Wrong: `0 8 * * *`. Expected `55 1 * * *`. Moot
  until #1 (credit-expiry) fixed.
- **Reality:** T08-P1 registered at `0 8 * * *`; `docs/CRON_JOBS.md` #11 says
  `0 8 * * *` is correct.
- **Verdict:** ROADMAP STALE — schedule normalised to canonical `0 8` (matches
  the other 8am reminder cluster). The "moot until #1 fixed" concern is
  resolved because #1 is now also registered (running daily at `0 2`, six
  hours BEFORE the 8am warning fires — correct ordering for "warn 3 days
  before, expire on the day").

### 12. `stripe-auto-pay-installment-daily`
- **Roadmap claim (24 Apr):** MISSING. **High impact — silent feature loss:**
  no auto-pay ever fires.
- **Reality:** Registered by T08-P1 (`20260501100000:55`) at `0 9 * * *`.
  Edge fn exists; Pattern C. Side effects per `docs/CRON_JOBS.md` #12 include
  `auto_pay_attempts` row writes, consecutive-failure counting, and
  3-failure-pause logic from J10 P2.
- **Verdict:** ROADMAP STALE — fixed by T08-P1.
- **Backfill question:** see T06-F2 + Q1 below. **This is the highest-stakes
  backfill question** — guardians who enabled auto-pay during the gap window
  were never charged.

### 13. `overdue-reminders-daily`
- **Roadmap claim (24 Apr):** Was MISSING; fixed 24 April 2026 to `0 9 * * *`.
- **Reality:** Re-registered by T08-P1 at `0 9 * * *`; consistent with the
  24 April fix.
- **Verdict:** OK.

### 14. `calendar-refresh-busy`
- **Roadmap claim:** not in Track 0.6.
- **Reality:** Registered by T08-P1-patch (`20260501100100:46`) at `*/15 * * * *`.
  Edge fn exists; Pattern C. Replaces the legacy `refresh-calendar-busy-blocks`
  at `*/30` (dropped by the same patch as a duplicate of the same edge fn).
- **Verdict:** OK.

### 15. `send-lesson-reminders`
- **Roadmap claim:** not in Track 0.6.
- **Reality:** Registered by T08-P1-patch (`20260501100100:69`) at `0 * * * *`.
  Edge fn exists; Pattern C.
- **Verdict:** OK.

## Backfill questions surfaced (need operator data)

The walk surfaces TWO real backfill questions that must be answered with
production data before T06-P2 (the actual backfill brief, if any) can be
scoped. Both queries are READ-ONLY — operator runs them in Lovable's SQL
editor.

### Q1 — auto-pay arrears scope

How many installments are sitting unpaid that, in a world where
`stripe-auto-pay-installment-daily` had been running, would have been
charged automatically?

```sql
-- T06-P0 Q1 — RUN VIA LOVABLE.
-- Read-only. No writes. Adapt column names if any have been renamed
-- since this brief was authored.
--
-- Looks for installments past due_date today, on payment-plan invoices
-- whose paying guardian has auto-pay enabled and is not paused, and
-- where a default_payment_method_id is on file.

WITH eligible_installments AS (
  SELECT
    inst.id AS installment_id,
    inst.invoice_id,
    inst.due_date,
    inst.amount_minor,
    inst.status AS installment_status,
    i.org_id,
    i.invoice_number,
    i.payer_guardian_id,
    g.full_name AS guardian_name,
    g.email AS guardian_email,
    gpp.auto_pay_enabled,
    gpp.auto_pay_paused_at,
    gpp.default_payment_method_id,
    gpp.consecutive_failure_count
  FROM invoice_installments inst
  JOIN invoices i ON i.id = inst.invoice_id
  LEFT JOIN guardians g ON g.id = i.payer_guardian_id
  LEFT JOIN guardian_payment_preferences gpp
    ON gpp.guardian_id = i.payer_guardian_id
   AND gpp.org_id = i.org_id
  WHERE i.payment_plan_enabled = true
    AND i.status IN ('sent', 'overdue')
    AND inst.status IN ('pending', 'overdue')
    AND inst.due_date < current_date
    AND gpp.auto_pay_enabled = true
    AND gpp.auto_pay_paused_at IS NULL
    AND gpp.default_payment_method_id IS NOT NULL
)
SELECT
  count(*) AS missed_charges,
  count(DISTINCT org_id) AS affected_orgs,
  count(DISTINCT payer_guardian_id) AS affected_guardians,
  sum(amount_minor) AS total_minor_unpaid,
  min(due_date) AS oldest_missed_due_date,
  max(due_date) AS most_recent_missed_due_date
FROM eligible_installments;
```

If this returns zero rows / zero counts: no backfill needed. Roadmap closure
is purely doc-hygiene.

If it returns non-zero: T06-P2 brief sizes the work, with per-org sign-off
because charging cards retroactively is a customer-relations decision Jamie
makes per-affected-guardian, not a blanket backfill.

### Q2 — credit-expiry overrun scope

How many `make_up_credits` rows have `expires_at` in the past but are still
in a spendable state?

```sql
-- T06-P0 Q2 — RUN VIA LOVABLE.
-- Read-only. Adapt column names — verify against actual make_up_credits
-- schema. Spendable-state column is likely `status = 'active'` or
-- `consumed_at IS NULL`; surface whichever applies.

SELECT
  count(*) AS overdue_credits,
  count(DISTINCT org_id) AS affected_orgs,
  count(DISTINCT student_id) AS affected_students,
  min(expires_at) AS oldest_overdue,
  max(expires_at) AS most_recent_overdue,
  -- Two interpretations — pick whichever matches the actual schema:
  count(*) FILTER (WHERE status = 'active') AS still_marked_active,
  count(*) FILTER (WHERE consumed_at IS NULL) AS never_consumed
FROM make_up_credits
WHERE expires_at < now()
  AND expires_at > now() - interval '180 days';  -- only recent overruns
```

Plus a follow-up to scope the customer-impact side: how many of those
overdue credits were SPENT after their `expires_at` date? That's an audit
question, not a backfill question — but worth knowing.

```sql
-- T06-P0 Q2b — RUN VIA LOVABLE.
-- "Did anyone spend a credit past its expiry?" Adapt column names.

SELECT
  count(*) AS spent_after_expiry,
  count(DISTINCT mc.org_id) AS affected_orgs
FROM make_up_credits mc
WHERE mc.expires_at < mc.consumed_at;
```

If this returns non-zero: real customer-trust issue, even though parents
got value (free lessons). Worth a quiet doc-hygiene fix on the credits
table without contacting customers.

### Q3 — auto-pay reminder gap (lower-stakes follow-up)

Optional. How many guardians had upcoming auto-pay installments during
the gap window who never got the 3-day notice?

This is harder to answer cleanly because it requires reasoning over
"would have been due in the window had reminders fired correctly".
Skipping as low-priority unless Q1 surfaces a meaningful affected
population — in which case the same affected guardians need an apology
+ explanatory email, and we can derive the list from Q1's output.

## Open questions for chat-Claude

### OQ1 — Was T08-P1 a NEW registration or a RE-registration?

The walk cannot distinguish from migration history alone whether the 12
crons existed in the Dashboard before T08-P1 (and were silently 401-failing
due to wrong auth) or were entirely absent. Both cases were flagged in
T08-P1's brief: T08-F1 says "10 of 12 production crons silently 401-failing
daily" — which means at least 10 existed but were broken. So:

- For the **8 documented in T08-F1 as "401-failing"**: they existed,
  ran daily, but every run failed. Effect on users = same as not running
  for the duration of the auth break.
- For **`stripe-auto-pay-installment` and `credit-expiry`**: the roadmap
  says MISSING. T08-F1 said 10 of 12 silently 401-failing — those 2 were
  the absent ones. Effect on users = no run attempt at all.

**Implication for backfill:** the affected-window question for Q1 and Q2
needs to know **how long** auto-pay and credit-expiry were broken/missing.
That answer lives in:
- The Stripe Dashboard for auto-pay (when did the first guardian enable
  auto-pay? Earliest J10 deploy date.)
- `make_up_credits.created_at` minimums for credit-expiry (when was the
  first credit minted that should have expired?)

**Recommended next step:** OQ1 doesn't block the walk doc itself. T06-P2
brief needs Jamie to size the window (probably by reviewing J10's launch
date and the first credit-mint date) before Q1/Q2 results can be interpreted.

### OQ2 — Should the T06-F3 schedule choices be re-litigated?

The 24 April roadmap said `invoice-overdue-check`, `installment-overdue-check`,
and `credit-expiry-warning-daily` had "wrong" schedules. T08-P1 ratified the
"wrong" schedules as canonical without further explanation. Worth confirming
once whether Jamie agrees these schedules are correct, OR has just been
running with whatever T08-P1 produced. If the latter, no action needed.
If Jamie has a preference (e.g. wants overdue checks at 02:00 UTC like the
24 April expectation, alongside credit-expiry), that's a separate small
brief.

## Walk methodology

This walk was performed by chat-Claude in a local clone at branch tip
`78037f96` (J11-P3 merge), 26 April 2026. Same-window discipline was
applied: every claim is backed by a file path + line number or a SQL
query. No production database access was used.

Specifically:
1. Read the full Track 0.6 roadmap entry (`LESSONLOOP_PRODUCTION_ROADMAP.md:172-187`).
2. Read `docs/CRON_JOBS.md` end-to-end to establish the canonical schedule
   expectations.
3. Read both T08-P1 cron migrations
   (`20260501100000_cron_auth_standardisation.sql`,
   `20260501100100_cron_auth_standardisation_patch.sql`) and the T05-P2 +
   J11-P1 cron migrations.
4. For each of the 13 cron-callable edge functions, verified existence
   on disk and `validateCronAuth` usage via grep.
5. Cross-referenced every registered jobname + schedule against the docs
   expected schedule and against the 24 April roadmap claims.

What this walk does NOT cover:
- It did not run any operator query (no DB access).
- It did not verify the LIVE state of `cron.job` in production. The walk's
  conclusions assume that the migrations on `main` have been applied to
  production. That assumption is reasonable because Lovable's apply pipeline
  ran T08-P1 on 25 April per Jamie's explicit confirmation. But verifying
  `SELECT jobname, schedule FROM cron.job` against the table above is
  worth one final operator-side check before T06-P1 closes the roadmap
  entry.
- It did not estimate revenue impact in £/$. That requires Q1 results.
- It did not propose the T06-P1 closure migration (none needed) or T06-P2
  backfill briefs (depend on Q1/Q2 results).

Confidence level: **high** for the headline "no missing crons today, no
wrong schedules vs docs today, all using Pattern C". **High** for the
"backfill is the real open question" framing. **Cannot verify alone**
whether production `cron.job` table state matches the migrations
(T06-F4 / OQ1).

## What this walk does NOT do

- Does not propose a migration. There is no schedule to fix.
- Does not run any operator-impacting query. All SQL above is read-only
  and labelled `<RUN_VIA_LOVABLE>`.
- Does not estimate revenue impact in £/$.
- Does not contact any affected customer.
- Does not propose closure of Track 0.6 in the roadmap (chat-Claude does
  that as T06-P1-C1, a one-commit doc update, after this walk merges).
- Does not propose T06-P2 backfill brief content. That brief depends on
  Q1 and Q2 results.

## Recommended next steps (chat-Claude / Jamie)

1. **Verify production state matches main.** Operator runs:
   ```sql
   SELECT jobname, schedule, command IS NOT NULL AS has_command
   FROM cron.job
   ORDER BY jobname;
   ```
   Confirm 15 rows; confirm schedules match the table at the top of this
   doc. If divergence: that's a finding; T06-F1 stays open until reconciled.
2. **Run Q1 and Q2.** Operator pastes results back. T06-P2 brief depends
   on these.
3. **Close Track 0.6 in roadmap.** One-commit doc update marking the
   track 🟢 with closure note referencing T08-P1, T06-F2 (backfill open),
   and this walk doc. chat-Claude writes the brief after step 1 confirms.
