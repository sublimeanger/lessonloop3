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
