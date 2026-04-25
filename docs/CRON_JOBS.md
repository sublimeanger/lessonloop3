# LessonLoop — Required Cron Jobs

All cron jobs must be configured in Supabase Dashboard → Edge Functions → Schedules.
Each uses the SUPABASE_SERVICE_ROLE_KEY as Bearer token auth.

## Daily Jobs (run in this order)

### 1. credit-expiry-warning
- **Schedule:** `55 1 * * *` (1:55 AM UTC)
- **Function:** credit-expiry-warning
- **Body:** `{}`
- **Purpose:** Emails guardians about credits expiring in the next 3 days.
- **Must run BEFORE credit-expiry** so warnings go out before credits are marked expired.
- **If missing:** Parents aren't warned about expiring credits.

### 2. credit-expiry
- **Schedule:** `0 2 * * *` (2:00 AM UTC)
- **Function:** credit-expiry
- **Body:** `{}`
- **Purpose:** Marks expired make-up credits. Protects credits linked to active waitlist entries.
- **If missing:** Credits never expire. Students accumulate unlimited make-up credits.

### 3. waitlist-expiry
- **Schedule:** `5 2 * * *` (2:05 AM UTC)
- **Function:** waitlist-expiry
- **Body:** `{}`
- **Purpose:** Expires stale waitlist entries. Returns unanswered "offered" entries to "waiting".
- **If missing:** Waitlist entries never expire. Offered slots stay blocked forever.

### 4. invoice-overdue-check
- **Schedule:** `0 3 * * *` (3:00 AM UTC)
- **Function:** invoice-overdue-check
- **Body:** `{}`
- **Purpose:** Transitions invoices from 'sent' → 'overdue' when past due. Marks overdue installments.
- **If missing:** Invoices never transition to overdue. Dashboard counts inaccurate.

### 5. installment-overdue-check
- **Schedule:** `5 3 * * *` (3:05 AM UTC)
- **Function:** installment-overdue-check
- **Body:** `{}`
- **Purpose:** Marks payment plan installments as overdue.
- **If missing:** Installments never show as overdue.

### 6. continuation process_deadline
- **Schedule:** `0 8 * * *` (8:00 AM UTC)
- **Function:** create-continuation-run
- **Body:** `{ "action": "process_deadline" }`
- **Purpose:** Auto-processes continuation runs past their notice deadline. Converts pending responses to no_response or assumed_continuing.
- **If missing:** Continuation deadlines never auto-process. Runs stay in 'sent' status forever.

### 7. stripe-auto-pay-installment
- **Schedule:** `0 6 * * *` (6:00 AM UTC daily)
- **Function:** stripe-auto-pay-installment
- **Body:** `{}`
- **Purpose:** Charges default payment method for installments due today or overdue,
  where the guardian has auto-pay enabled.
- **If missing:** Auto-pay never fires. Parents opted into auto-pay still
  have to pay manually. Installments go overdue unnecessarily.

### 8. auto-pay-upcoming-reminder
- **Schedule:** `0 8 * * *` (8:00 AM UTC daily)
- **Function:** auto-pay-upcoming-reminder
- **Body:** `{}`
- **Purpose:** Sends 3-day heads-up email to guardians with auto-pay enabled
  about upcoming installments. Email shows the saved card brand/last4/
  expiry and warns when the card expires before the charge date (J10 P1).
- **If missing:** Parents aren't warned before auto-charges.

### 8a. auto-pay-final-reminder
- **Schedule:** `0 8 * * *` (8:00 AM UTC daily)
- **Function:** auto-pay-final-reminder
- **Body:** `{}`
- **Purpose:** 24-hour final reminder for tomorrow's auto-pay installments.
  Independent dedup key (`auto_pay_final_reminder` vs `auto_pay_reminder`)
  so it never conflates with the 3-day notice. Same card-detail and
  expiry-warning copy via `_shared/auto-pay-reminder-core.ts`.
- **If missing:** Parents only get the 3-day notice — no last-chance
  reminder if the card has expired or the parent missed the first email.

### 9. installment-upcoming-reminder
- **Schedule:** `0 9 * * *` (9:00 AM UTC daily)
- **Function:** installment-upcoming-reminder
- **Body:** `{}`
- **Purpose:** Sends email reminders about installments due in **3 days**.
- **If missing:** Parents aren't reminded about upcoming installments.

### 9a. overdue-reminders
- **Schedule:** `0 9 * * *` (9:00 AM UTC daily)
- **Function:** overdue-reminders
- **Body:** `{}`
- **Purpose:** Sends escalating overdue reminder emails to guardians or
  student payers for invoices and plan installments past their due_date.
  Tier cadence is per-org-configurable via `organisations.overdue_reminder_days`
  (default `[7, 14, 30]`). Post-J7, gate fires the highest missing tier
  for each entity — catches up on missed cron days rather than exact-day
  matching. message_type taxonomy: `overdue_reminder_d{N}` /
  `installment_reminder_d{N}` where N is the firing tier.
- **If missing:** No overdue reminder emails sent. Parents aren't chased
  on overdue invoices or overdue installments.

### 10. enrolment-offer-expiry
- **Schedule:** `0 3 * * *` (3:00 AM UTC daily)
- **Function:** enrolment-offer-expiry
- **Body:** `{}`
- **Purpose:** Expires enrolment waitlist offers that haven't been
  responded to within the org's configured expiry period (default 48h).
- **If missing:** Offers never expire. Families who ignore offers
  block their waitlist position indefinitely.

## Verification

Check Supabase Dashboard → Edge Functions → Invocations to confirm each job runs daily.
If any job hasn't run in 48+ hours, it needs reconfiguring.

## Auth

All cron jobs authenticate via:
- **Header:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- **Or:** Supabase cron secret header (for functions using `validateCronAuth`)

The credit-expiry, credit-expiry-warning, and waitlist-expiry functions use `validateCronAuth`.
The invoice and installment checks use their own auth.
The continuation process_deadline checks for the service role key directly.
