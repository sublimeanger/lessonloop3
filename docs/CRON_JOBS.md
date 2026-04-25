# LessonLoop — Required Cron Jobs

All cron jobs are registered via committed migrations and run on
pg_cron in the production Supabase project. Every cron-callable edge
function authenticates the caller via `validateCronAuth` against
`INTERNAL_CRON_SECRET` (Pattern C).

## Canonical pattern

See `docs/CRON_AUTH.md` for the canonical Pattern C template (vault
→ `x-cron-secret` → `validateCronAuth`). Every cron below uses it.

## Scheduled jobs

The schedules below reflect what's registered in the standardisation
migration `20260501100000_cron_auth_standardisation.sql` plus the
`webhook-retention-daily` registration in
`20260503100100_webhook_retention_cron.sql`. All use
`auth: vault.INTERNAL_CRON_SECRET → x-cron-secret`.

### 1. credit-expiry-daily
- **Schedule:** `0 2 * * *` (2:00 AM UTC)
- **Function:** credit-expiry
- **Purpose:** Marks expired make-up credits. Protects credits linked to active waitlist entries.
- **If missing:** Credits never expire. Students accumulate unlimited make-up credits.

### 2. cleanup-orphaned-resources
- **Schedule:** `0 3 * * *` (3:00 AM UTC)
- **Function:** cleanup-orphaned-resources
- **Purpose:** Deletes storage files in `teaching-resources` with no matching `resources` row.
- **If missing:** Orphaned files accumulate in storage indefinitely.

### 3. webhook-retention-daily
- **Schedule:** `30 3 * * *` (3:30 AM UTC)
- **Function:** cleanup-webhook-retention
- **Purpose:** RPCs `cleanup_webhook_retention()` to delete completed `stripe_webhook_events` older than 90 days, plus `platform_audit_log` rows older than 90d (info/warning) or 365d (error/critical). Self-audits each sweep into `platform_audit_log` (`webhook_retention_sweep`). See [`docs/WEBHOOK_DEDUP.md`](WEBHOOK_DEDUP.md#retention) and [`docs/PLATFORM_AUDIT_LOG.md`](PLATFORM_AUDIT_LOG.md#retention).
- **If missing:** Both tables grow unbounded. No correctness impact, but operator queries on `platform_audit_log` slow over time.

### 4. recurring-billing-scheduler-daily
- **Schedule:** `0 4 * * *` (4:00 AM UTC)
- **Function:** recurring-billing-scheduler
- **Purpose:** Generates invoices from recurring templates whose `next_run_date` falls today.
- **If missing:** Recurring invoices never auto-generate. Operators have to fire each template manually.

### 5. invoice-overdue-check
- **Schedule:** `30 5 * * *` (5:30 AM UTC)
- **Function:** invoice-overdue-check
- **Purpose:** Transitions invoices from `sent` → `overdue` when past due. Marks overdue installments.
- **If missing:** Invoices never transition to overdue. Dashboard counts inaccurate.

### 6. installment-overdue-check-daily
- **Schedule:** `0 6 * * *` (6:00 AM UTC)
- **Function:** installment-overdue-check
- **Purpose:** Marks payment plan installments as overdue.
- **If missing:** Installments never show as overdue.

### 7. auto-pay-upcoming-reminder-daily
- **Schedule:** `0 8 * * *` (8:00 AM UTC)
- **Function:** auto-pay-upcoming-reminder
- **Purpose:** Sends 3-day heads-up email to guardians with auto-pay enabled
  about upcoming installments. Email shows the saved card brand/last4/
  expiry and warns when the card expires before the charge date (J10 P1).
- **If missing:** Parents aren't warned before auto-charges.

### 8. auto-pay-final-reminder-daily
- **Schedule:** `0 8 * * *` (8:00 AM UTC)
- **Function:** auto-pay-final-reminder
- **Purpose:** 24-hour final reminder for tomorrow's auto-pay installments.
  Independent dedup key (`auto_pay_final_reminder` vs `auto_pay_reminder`)
  so it never conflates with the 3-day notice. Same card-detail and
  expiry-warning copy via `_shared/auto-pay-reminder-core.ts`.
- **If missing:** Parents only get the 3-day notice — no last-chance
  reminder if the card has expired or the parent missed the first email.

### 9. installment-upcoming-reminder-daily
- **Schedule:** `0 8 * * *` (8:00 AM UTC)
- **Function:** installment-upcoming-reminder
- **Purpose:** Sends email reminders about installments due in 3 days.
- **If missing:** Parents aren't reminded about upcoming installments.

### 10. credit-expiry-warning-daily
- **Schedule:** `0 8 * * *` (8:00 AM UTC)
- **Function:** credit-expiry-warning
- **Purpose:** Emails guardians about credits expiring in the next 3 days.
- **If missing:** Parents aren't warned about expiring credits.

### 11. stripe-auto-pay-installment-daily
- **Schedule:** `0 9 * * *` (9:00 AM UTC)
- **Function:** stripe-auto-pay-installment
- **Purpose:** Charges default payment method for installments due today or overdue,
  where the guardian has auto-pay enabled and is not paused.
- **Side effects (J10 P2):** Writes one row per attempted charge to
  `auto_pay_attempts` regardless of outcome (`succeeded` / `failed` /
  `requires_action` / `skipped_paused`). Increments
  `guardian_payment_preferences.consecutive_failure_count` on every
  failure / requires_action; pauses the guardian after 3 consecutive
  failures (`auto_pay_paused_at` set). Resets the counter on success
  but does NOT clear the pause flag — parent must explicitly re-enable
  from the portal. Invokes `send-auto-pay-failure-notification` per
  failure (with same-error-within-20h dedup against the attempt log).
  At end of run, fires one `send-auto-pay-alert` per org with any
  failure / requires_action / paused-today.
- **If missing:** Auto-pay never fires. Parents opted into auto-pay still
  have to pay manually. Installments go overdue unnecessarily.

### 12. overdue-reminders-daily
- **Schedule:** `0 9 * * *` (9:00 AM UTC)
- **Function:** overdue-reminders
- **Purpose:** Sends escalating overdue reminder emails to guardians or
  student payers for invoices and plan installments past their due_date.
  Tier cadence is per-org-configurable via `organisations.overdue_reminder_days`
  (default `[7, 14, 30]`). Post-J7, gate fires the highest missing tier
  for each entity — catches up on missed cron days rather than exact-day
  matching. message_type taxonomy: `overdue_reminder_d{N}` /
  `installment_reminder_d{N}` where N is the firing tier.
- **If missing:** No overdue reminder emails sent. Parents aren't chased
  on overdue invoices or overdue installments.

### 13. calendar-refresh-busy
- **Schedule:** `*/15 * * * *` (every 15 minutes)
- **Function:** calendar-refresh-busy
- **Purpose:** Refreshes Google / Outlook busy-block caches for active
  calendar connections.
- **If missing:** Stale busy blocks; double-booking risk against external
  calendars.
- **Note:** The legacy `refresh-calendar-busy-blocks` cron at
  `*/30 * * * *` was a duplicate targeting the same edge fn. Dropped
  in `20260501100100_cron_auth_standardisation_patch.sql`.

### 14. send-lesson-reminders
- **Schedule:** `0 * * * *` (hourly on the hour)
- **Function:** send-lesson-reminders
- **Purpose:** Per-org reminder emails / push for lessons starting
  within each org's configured `reminder_lesson_hours` window.
- **If missing:** No lesson reminders fire. Parents miss lessons.

## Verification

Check Supabase Dashboard → Edge Functions → Invocations to confirm each
job runs on schedule. If any job hasn't run in 48+ hours (or 30 minutes
for `calendar-refresh-busy`, 90 minutes for `send-lesson-reminders`),
inspect `cron.job_run_details` and `net._http_response` for the failed
invocation.

A health-watchdog (T08-F5, filed for Track 0.8 Phase 2) will surface
this in-app rather than requiring dashboard attention.

## Auth

All cron jobs use Pattern C: `x-cron-secret` header populated from
`vault.decrypted_secrets` at call time, validated server-side via
`validateCronAuth` in `supabase/functions/_shared/cron-auth.ts`. See
`docs/CRON_AUTH.md` for the full canonical template and rationale.
