# Auto-pay failure handling

Reference for what happens when `stripe-auto-pay-installment` can't
charge a parent. Introduced J10 Phase 2 (25 April 2026).

## Pause threshold

Auto-pay pauses for a guardian after **3 consecutive failures**
(`PAUSE_THRESHOLD = 3` in `stripe-auto-pay-installment/index.ts`).
A failure is any `failed` or `requires_action` outcome. Successes
reset the counter to 0.

## Pause scope

Per-guardian-per-org. `guardian_payment_preferences` is keyed by
UNIQUE `(guardian_id, org_id)`, so a parent paused at academy A can
still be active-auto-pay at academy B. The pause flag lives on the
per-org row.

## Failure email cadence

Each failure invokes `send-auto-pay-failure-notification`. Dedup uses
the `auto_pay_attempts` table:

- Same installment + same `stripe_error_code` within the last 20h
  → suppressed (parent already got that email today).
- Same installment, **different** `stripe_error_code`
  → sent (the change is informative — yesterday `card_declined`,
  today `expired_card`).
- The 20h window combined with the cron's 24h cadence means same-day
  re-triggers are quiet, and the next day gets a fresh email if the
  problem persists and the pause hasn't kicked in.

Subject and body are tailored to the Stripe error code:
`expired_card`, `insufficient_funds`, `requires_action` /
`authentication_*`, `card_not_supported`, `card_declined`, fallback.
On the failure that triggers the pause, the email appends a "your
auto-pay has been paused" notice.

## Operator alert

`send-auto-pay-alert` fires once per affected org at the end of
each cron run, when that org has any `failed`, `requires_action`,
or `paused-today`. Recipients: org owners + admins + finance team
members (mirrors J9 P3 `send-recurring-billing-alert`). 6h dedup
keyed on `(message_type='auto_pay_run_alert', related_id=org_id)`.

## Manual recovery

Parent re-enables auto-pay from the parent portal. Re-enabling sets
`auto_pay_paused_at = NULL` and resumes the cron's eligibility for
that guardian. A successful charge alone does **not** clear the
pause — pause survives a manual portal payment intentionally. The
parent fixes the card once and re-enables once.

## Coordination with overdue-reminders

`overdue-reminders` batches a single `guardian_payment_preferences`
lookup at the top of each loop and skips guardians with active
auto-pay (`auto_pay_enabled=true` AND `default_payment_method_id IS
NOT NULL` AND `auto_pay_paused_at IS NULL`). Paused guardians and
guardians without a default PM are NOT skipped — they need the
standard reminder channel.
