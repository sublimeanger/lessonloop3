# Deep Audit: Term Continuation & Make-Up Credits

**Date:** 2026-03-15
**Auditor:** Claude Opus 4.6
**Branch:** claude/audit-term-continuation-credits-KiTHT
**Scope:** Full code-path analysis of Term Continuation and Make-Up Credit systems

---

## SYSTEM UNDERSTANDING

### How Term Continuation Works End-to-End

Term Continuation is a workflow that manages student re-enrollment between academic terms. The system allows academy owners/admins to send bulk notifications to parents asking whether their child will continue lessons into the next term.

**Flow:**
1. **Admin creates a continuation run** via `ContinuationRunWizard.tsx` → calls `create-continuation-run` edge function with action `"create"`.
2. The edge function queries all students with recurring lessons in the current term, finds their primary-payer guardian, calculates next-term fees based on rate cards and lesson counts (minus closure dates), and bulk-inserts `term_continuation_responses` rows (one per student) in `"pending"` status. The run is created in `"draft"` status.
3. **Admin sends notifications** — the wizard calls the same edge function with action `"send"`. This groups responses by guardian (so multi-child families get one email), constructs HTML emails with per-child "Confirm Continuing" / "Withdraw" buttons containing unique `response_token` URLs, and sends via Resend API. Run status moves to `"sent"`.
4. **Parent responds** via one of two paths:
   - **Email link** (unauthenticated): Hits `continuation-respond` edge function with the token. Token is looked up in `term_continuation_responses`, status is verified as `"pending"`, and updated to `"continuing"` or `"withdrawing"`.
   - **Portal** (authenticated): Parent sees pending responses in `PortalContinuation.tsx`, responds via `useParentRespondToContinuation()` which calls the same edge function with run_id + student_id.
5. **Reminders** can be sent to non-responders via action `"send_reminders"`. Tracks reminder_count per response (up to 2 tracked).
6. **Deadline processing**: Admin triggers `"process_deadline"` action. All remaining `"pending"` responses are bulk-updated to either `"assumed_continuing"` (if the run has `assumed_continuing=true`) or `"no_response"`. Run status moves to `"deadline_passed"`.
7. **Bulk processing**: Via `useBulkProcessContinuation()` in the client hook:
   - **Confirmed students**: Recurrence rules are extended by updating `end_date` to the next term's end date.
   - **Withdrawing students**: For each lesson, the system calls `process-term-adjustment` edge function to cancel future lessons and optionally generate credit notes.
   - Responses are marked `is_processed=true`. When all are processed, run status becomes `"completed"`.

### How Make-Up Credits Work End-to-End

Make-Up Credits compensate students for missed lessons and optionally allow them to attend a replacement lesson.

**Flow:**
1. **Credit issuance** happens two ways:
   - **Automatic**: Database trigger `auto_issue_credit_on_absence()` fires when an attendance record is marked absent/cancelled. It checks the org's `make_up_policies` table for the absence reason. If eligibility is `"automatic"`, a credit is inserted into `make_up_credits` with value pulled from `invoice_items` for that lesson. Respects `max_credits_per_term` cap and `credit_expiry_days` (default 90).
   - **Manual**: Admin uses `IssueCreditModal.tsx` to issue ad-hoc credits with custom amount and expiry.
2. **Credit visibility**: Parents see credits via `useParentCredits()` hook querying the `available_credits` database view. Admins see them in `MakeUpCreditsPanel.tsx` per student.
3. **Waitlist**: When policy eligibility is `"waitlist"`, trigger `auto_add_to_waitlist()` creates a `make_up_waitlist` entry with preferred days/times. Admin can also manually add via `AddToWaitlistDialog.tsx`.
4. **Matching**: When a slot opens (student absence with `releases_slot=true` policy), trigger `on_slot_released()` calls `find_waitlist_matches()` RPC which scores matches by teacher/duration/location/schedule compatibility. Matched entries get status `"matched"` and `notify-makeup-match` edge function sends internal messages to admins.
5. **Offering**: Admin reviews matches on `MakeUpDashboard.tsx`, clicks "Offer" which updates status to `"offered"` and invokes `notify-makeup-offer` edge function to email the parent with Accept/Decline links (48h response window).
6. **Booking**: Parent accepts → admin confirms via `confirm_makeup_booking()` RPC which atomically: locks the waitlist row, validates capacity/schedule conflicts, inserts a `lesson_participant`, and sets status to `"booked"`.
7. **Expiry**: Cron job `credit-expiry` marks unredeemed credits as expired when `expires_at` passes. Also cascades to linked waitlist entries. Warning emails sent 3 days before via `credit-expiry-warning`.
8. **Invoice integration**: Credits can be applied to invoices via `create_invoice_with_items()` RPC which atomically locks credits, calculates offset, and marks them as applied.

### How the Two Systems Interact

- **Continuation withdrawals generate term adjustments** which can create credit note invoices (not make-up credits).
- **When a parent declines continuation**, their unused make-up credits are NOT automatically voided or addressed — they remain active until natural expiry.
- **Credits are NOT carried forward** explicitly during continuation; they persist independently based on their own expiry dates.
- **The billing system** is affected by both: continuation processing can generate credit note invoices, while make-up credits can offset regular invoices.

### Where Each System Is Complete vs Incomplete vs Broken

**Term Continuation**: Functionally complete end-to-end. The draft→send→remind→deadline→process→complete lifecycle works. Main gaps: no automatic deadline processing (requires manual trigger), no automatic reminder scheduling (manual), client-side bulk processing is slow and non-atomic.

**Make-Up Credits**: Core credit lifecycle is solid with database-level atomicity (FOR UPDATE locks, RPC functions). Main gaps: timezone handling is inconsistent, credit-to-invoice integration works but partial credits aren't supported, and the matching algorithm doesn't consider all edge cases.

**Enrolment Waitlist** (separate system): Has a critical gap — offer expiry cron job doesn't exist for this table (only covers make_up_waitlist).

---

## FINDINGS

---

### [2A.1] HIGH — Bulk Processing Runs Client-Side Without Transaction Safety

**File:** src/hooks/useTermContinuation.ts:536-624
**Issue:** `useBulkProcessContinuation()` processes responses one-by-one in a `for` loop on the client. Each response involves multiple sequential Supabase calls (query recurrence, update recurrence, invoke term-adjustment preview, invoke term-adjustment confirm, update response). If the browser tab closes, network drops, or the edge function times out mid-loop, some responses will be processed and others won't, with no rollback mechanism.

```typescript
for (const resp of responses || []) {
  if (['continuing', 'assumed_continuing'].includes(resp.response)) {
    const lessons = resp.lesson_summary || [];
    for (const lesson of lessons) {
      // Multiple sequential DB calls per lesson...
    }
  }
}
```

**Trace:** Read the full `useBulkProcessContinuation` mutation. It iterates responses, then iterates lessons within each response, making 2-4 API calls per lesson. No transaction wrapper. No idempotency guard — re-running could extend already-extended recurrences.
**Impact:** Partial processing leaves the academy in an inconsistent state: some students extended into next term, others not, with no way to identify which were processed except by checking `is_processed` flags.
**Fix:** Move bulk processing to a server-side edge function that processes all responses in a single database transaction, or at minimum add idempotency checks (skip recurrences already extended past next_term_end_date).

---

### [2D.1] MEDIUM — Edge Function Timeout Risk for Large Academies

**File:** supabase/functions/create-continuation-run/index.ts:862-1106
**Issue:** The `handleSend` action sends emails sequentially in a `for` loop over guardians. Each iteration makes 3-4 database calls plus an HTTP call to Resend API. For an academy with 100+ families, this could exceed Deno's 60-second function timeout.

```typescript
for (const [guardianId, guardianResponses] of byGuardian) {
  // ... build HTML ...
  await client.from("message_log").insert({...});
  if (resendApiKey) {
    const emailResponse = await fetch("https://api.resend.com/emails", {...});
    // ... update responses ...
  }
}
```

**Trace:** Counted operations per guardian: 1 message_log insert + 1 Resend API call + 1 response update + 1 message_log update = 4 async operations. At ~200ms each, 100 guardians = ~80 seconds, exceeding the 60s limit.
**Impact:** Large academies may have their send operation timeout, leaving some families notified and others not. The run status is updated to "sent" AFTER the loop, so a timeout means the run stays in "draft" despite some emails being sent.
**Fix:** Use a queue-based approach: insert all message_log entries first, then process sends in batches with a separate worker, or use Resend's batch API endpoint.

---

### [3A.1] CRITICAL — Token-Based Response Has No Expiry Enforcement

**File:** supabase/functions/continuation-respond/index.ts:151-247
**Issue:** The `handleTokenResponse` function looks up a response by `response_token` and checks only that the response is `"pending"` and the run is in `"sent"` or `"reminding"` status. There is no check against the run's `notice_deadline`. A parent could respond months after the deadline if the admin hasn't processed it yet.

```typescript
// Line 192-204: Only checks run status, not deadline
const { data: run } = await client
  .from("term_continuation_runs")
  .select("id, status, assumed_continuing")
  .eq("id", response.run_id)
  .single();

if (!["sent", "reminding"].includes(run.status)) {
  return jsonResponse({ error: "This run is no longer accepting responses" }, cors, 400);
}
// No deadline check!
```

**Trace:** Read the entire `handleTokenResponse` function. The `notice_deadline` field exists on the run but is never compared against the current date in either the token or portal response paths.
**Impact:** Parents can respond after the business deadline, potentially after the admin has already processed the run. Late responses could be accepted and confuse the admin's view of confirmed vs. withdrawing students.
**Fix:** Add a deadline check: `if (new Date() > new Date(run.notice_deadline + 'T23:59:59Z'))` return an appropriate message. Consider a grace period.

---

### [3A.2] HIGH — Response Token Never Expires and Is Reusable

**File:** supabase/functions/continuation-respond/index.ts:159-177
**Issue:** The `response_token` is a 32-byte hex string stored in the database. It has no expiry mechanism — it's valid forever as long as the response is pending and the run is active. The token is sent in email URLs in plaintext. Anyone with the URL can respond.

```typescript
// Token lookup - no expiry check
const { data: response } = await client
  .from("term_continuation_responses")
  .select("*")
  .eq("response_token", token)
  .single();
```

**Trace:** Checked the migration: `response_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')`. The token is 64 hex characters (256 bits of entropy), which is strong against brute force. However, it's embedded in email URLs which can be intercepted, cached by email providers, or logged by proxy servers.
**Impact:** If an email is forwarded, the recipient can respond on behalf of the parent. The token persists in email systems indefinitely. A leaked token allows anyone to withdraw a student.
**Fix:** Add a `token_expires_at` column, set it to deadline + grace period. Check expiry in the response handler. Consider using short-lived JWTs instead (like the enrolment waitlist does).

---

### [3B.1] HIGH — Admin Override Has No Status Transition Guard

**File:** src/hooks/useTermContinuation.ts:458-495
**Issue:** `useRespondToContinuation()` allows admins to update any response to any status via a direct database UPDATE. There's no check that the response is still `"pending"` — an admin could change a `"continuing"` response to `"withdrawing"` or vice versa, overriding the parent's explicit choice.

```typescript
const { error } = await (supabase as any)
  .from('term_continuation_responses')
  .update({
    response: data.response,
    response_at: new Date().toISOString(),
    response_method: 'admin_manual',
    // ...
  })
  .eq('id', data.response_id)
  .eq('org_id', currentOrg.id);
```

**Trace:** The UI (ContinuationResponseDetail.tsx:217) only shows the override control when status is `"pending"`, but the mutation itself has no server-side guard. A crafted API call could override any status.
**Impact:** Accidental or malicious override of parent responses. No audit trail of the override (the original response is overwritten, not preserved).
**Fix:** Add server-side check (RLS policy or edge function) that validates status transitions. Log the previous response value in the audit log.

---

### [3C.1] MEDIUM — No Automatic Deadline Processing

**File:** supabase/functions/create-continuation-run/index.ts:1291-1366
**Issue:** The `process_deadline` action must be manually triggered by the admin. There is no cron job or scheduled function that automatically processes deadlines when they pass. If the admin forgets, the run stays in "sent"/"reminding" status indefinitely, and parents can continue to respond.
**Trace:** Searched for cron-related configuration files and the `process_deadline` action. It's only triggered from the client via `useProcessDeadline()` mutation. No database trigger or scheduled function references this action.
**Impact:** Non-responding parents are never auto-resolved. The continuation run hangs in limbo. Business process depends entirely on admin remembering to click a button.
**Fix:** Add a cron job that runs daily, finds runs where `notice_deadline < today` and status IN ('sent', 'reminding'), and calls `handleProcessDeadline`.

---

### [1E.1] MEDIUM — Teachers Can See All Continuation Data

**File:** supabase/migrations/20260228100000_term_continuation.sql:33-36
**Issue:** The SELECT policy on `term_continuation_runs` uses `is_org_member(auth.uid(), org_id)` which includes teachers. Teachers can see all continuation runs and all responses (including other teachers' students, withdrawal reasons, fee amounts).

```sql
CREATE POLICY "Org members can view continuation runs"
  ON public.term_continuation_runs FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can view continuation responses"
  ON public.term_continuation_responses FOR SELECT
  USING (is_org_member(auth.uid(), org_id));
```

**Trace:** `is_org_member` returns true for any active org membership including teacher and finance roles. This exposes student withdrawal reasons, guardian emails, and fee calculations to all staff.
**Impact:** Privacy concern — teachers see which students are withdrawing (and why) before parents may have told them. Could affect teacher-student relationships.
**Fix:** Restrict SELECT policies to `is_org_admin()` for runs table. For responses, consider allowing teachers to see only their own students' responses.

---

### [1F.1] MEDIUM — Deleting a Term Cascades to Delete Continuation Runs and All Responses

**File:** supabase/migrations/20260303182000_term_continuation_fk_cascade.sql:4-12
**Issue:** Both `current_term_id` and `next_term_id` FKs have `ON DELETE CASCADE`. If either the current or next term is deleted after a continuation run has been created (with responses, sent emails, processed data), all runs and their responses are silently deleted.

```sql
ADD CONSTRAINT term_continuation_runs_current_term_id_fkey
  FOREIGN KEY (current_term_id) REFERENCES public.terms(id) ON DELETE CASCADE;

ADD CONSTRAINT term_continuation_runs_next_term_id_fkey
  FOREIGN KEY (next_term_id) REFERENCES public.terms(id) ON DELETE CASCADE;
```

**Trace:** The original migration (20260228100000) had no CASCADE on term FKs. The follow-up migration (20260303182000) added CASCADE, commenting "Without CASCADE, deleting a term would fail with a FK violation." This is correct but dangerous — the fix should be to prevent term deletion when continuation runs exist, not to silently cascade.
**Impact:** Admin deletes a term (perhaps to recreate it with corrected dates) → all continuation runs, responses, and processing history for that term transition are permanently destroyed with no recovery.
**Fix:** Change to `ON DELETE RESTRICT` and add a UI warning when attempting to delete a term that has continuation runs.

---

### [5A.1] LOW — make_up_waitlist.credit_id FK Has No Explicit CASCADE Behavior

**File:** supabase/migrations/20260222164345_e13bad2c-02c3-417f-b7bb-3e6027496946.sql:27
**Issue:** The `credit_id` column references `make_up_credits.id` but has no explicit ON DELETE behavior specified. PostgreSQL defaults to `NO ACTION` (equivalent to RESTRICT), meaning deleting a credit that's linked to a waitlist entry will fail.
**Trace:** Reviewed the migration. All other FK columns have explicit CASCADE or SET NULL. `credit_id` is the exception.
**Impact:** Admin attempting to delete a credit that's linked to a waitlist entry gets a cryptic FK violation error. Minor usability issue.
**Fix:** Add `ON DELETE SET NULL` to match the pattern of other optional FK columns.

---

### [6A.1] HIGH — Client-Side Expiry Check Creates Race Condition

**File:** src/hooks/useMakeUpCredits.ts:86-91
**Issue:** Available credits are filtered client-side by checking `expires_at > new Date()`. The `available_credits` database view also checks expiry, but the client-side filter runs against cached data. A credit could appear available in the UI while actually being expired server-side.

```typescript
const availableCredits = (credits || []).filter(
  c => !c.redeemed_at && !c.expired_at && !c.applied_to_invoice_id
    && (!c.expires_at || new Date(c.expires_at) > new Date())
);
```

**Trace:** The `available_credits` view (migration 20260223005049) uses `expires_at < NOW()` for server-side check. But TanStack Query caches results with `STALE_SEMI_STABLE` stale time. If a credit expires while the cache is fresh, the UI shows it as available until the next refetch.
**Impact:** Parent or admin attempts to use an expired credit. The RPC `redeem_make_up_credit` has server-side expiry validation, so it would fail — but the UX is confusing. More critically, `confirm_makeup_booking` doesn't check credit expiry.
**Fix:** Reduce stale time for credit queries, or add server-side expiry validation in `confirm_makeup_booking`.

---

### [6B.1] CRITICAL — No Server-Side Lock on Credit Balance During Booking

**File:** supabase/functions/create-continuation-run/index.ts (N/A — issue is in confirm_makeup_booking RPC)
**Issue:** The `confirm_makeup_booking()` RPC (migration 20260223004403) locks the waitlist row `FOR UPDATE` and validates capacity/conflicts, but does NOT lock or validate the linked credit. Two concurrent bookings could theoretically use the same credit if they reference different waitlist entries linked to the same credit_id.

**Trace:** Read the full `confirm_makeup_booking` function. It locks `make_up_waitlist` row FOR UPDATE, checks lesson capacity, checks schedule conflicts, inserts participant, updates waitlist status. But it never touches `make_up_credits` — no lock, no redemption, no validation that the credit is still available. Credit redemption appears to be a separate step.
**Impact:** A credit could be used for multiple bookings if the redemption step is skipped or delayed. The booking flow (waitlist → booked) and credit flow (active → redeemed) are not atomically linked.
**Fix:** `confirm_makeup_booking` should atomically lock and redeem the linked credit in the same transaction.

---

### [6D.1] MEDIUM — Credit Expiry Uses UTC, Not Org Timezone

**File:** supabase/functions/credit-expiry/index.ts:14-23
**Issue:** The credit expiry cron job compares `expires_at` against `new Date().toISOString()` which is UTC. But the `auto_issue_credit_on_absence` trigger calculates `expires_at` using the org's timezone: `(NOW() AT TIME ZONE academy_tz)::date + credit_expiry_days`.

```typescript
const now = new Date().toISOString();
const { data: expired } = await client
  .from("make_up_credits")
  .update({ expired_at: now, updated_at: now })
  .is("redeemed_at", null)
  .is("expired_at", null)
  .not("expires_at", "is", null)
  .lt("expires_at", now);
```

**Trace:** The trigger sets expiry at end-of-day in org timezone (e.g., `2026-06-15 23:59:59+01:00` for BST). The cron job checks against UTC. During BST (UTC+1), a credit set to expire at end of June 15 BST (22:59:59 UTC) would be expired by the cron at 23:00 UTC on June 15, which is correct. However, during GMT (UTC+0), there's no offset issue. The real concern is that `expires_at` is stored as TIMESTAMPTZ which normalizes to UTC, so the comparison is actually fine. However, the trigger's timezone calculation (migration 20260223004626, Line 52-55) uses `::date + interval` which may lose the timezone offset.
**Impact:** Credits may expire up to ~23 hours early or late depending on how the trigger calculates `expires_at` and whether the timezone conversion is correct. In practice, the impact is likely a few hours' discrepancy.
**Fix:** Standardize: either always use UTC midnight or always use org-timezone midnight. Document the chosen approach.

---

### [6D.2] MEDIUM — Credit Expiry and Waitlist Expiry Are Not Atomic

**File:** supabase/functions/credit-expiry/index.ts:17-54
**Issue:** Credit expiry is a two-step process: (1) mark credits as expired, (2) cascade to waitlist entries. These are separate UPDATE operations. If the function crashes between steps, credits are expired but waitlist entries remain in "waiting" status with an expired credit.

```typescript
// Step 1: Expire credits
const { data: expired } = await client
  .from("make_up_credits")
  .update({ expired_at: now, updated_at: now })
  // ...

// Step 2: Cascade to waitlist (only if step 1 succeeded)
if (expired && expired.length > 0) {
  const creditIds = expired.map((e: any) => e.id);
  await client
    .from("make_up_waitlist")
    .update({ status: "expired" })
    .in("credit_id", creditIds)
    .eq("status", "waiting");
}
```

**Trace:** Two separate Supabase client calls. No transaction wrapper. Error in step 2 is caught and logged but doesn't roll back step 1.
**Impact:** Orphaned waitlist entries with expired credits. Students appear to be waiting for a match but their credit is gone. The matching function would attempt to match them but the credit can't be redeemed.
**Fix:** Use a database function (RPC) that handles both updates in a single transaction.

---

### [7B.1] HIGH — Make-Up Policy Enforcement Is Entirely in Database Triggers

**File:** Multiple migrations (20260222164414, 20260222164435, 20260222164503)
**Issue:** Policy checks (notice period, eligibility, credit cap) are enforced by database triggers (`auto_issue_credit_on_absence`, `auto_add_to_waitlist`). However, the manual `IssueCreditModal.tsx` completely bypasses all policy checks — an admin can issue credits for any reason, any amount, with no notice period check and no cap enforcement.

**Trace:** Read `IssueCreditModal.tsx` (lines 57-74): it calls `createCredit` mutation which does a direct INSERT into `make_up_credits`. No policy lookup, no cap check, no notice period validation. The `checkCreditEligibility` function exists in `useMakeUpCredits.ts` (line 171) but is never called by the modal.
**Impact:** Admin bypass is intentional (manual override capability), but there's no warning when exceeding the term credit cap. This could lead to over-issuance of credits without the admin realizing they're exceeding policy limits.
**Fix:** Show a warning (not a block) in IssueCreditModal when the manual credit would exceed `max_credits_per_term`. Log manual overrides to audit trail.

---

### [8B.1] MEDIUM — Waitlist Matching Doesn't Check Credit Validity

**File:** Migration 20260222233741 (find_waitlist_matches function), lines 6-73
**Issue:** The `find_waitlist_matches()` RPC checks duration, capacity, schedule conflicts, and preferences, but does NOT check whether the waitlist entry's linked credit is still valid (not expired, not redeemed).

**Trace:** Read the full function. It filters by `status = 'waiting'` and `expires_at > NOW()` on the waitlist entry itself, but never joins to `make_up_credits` to validate the credit. A waitlist entry could have `credit_id` pointing to an already-expired or already-redeemed credit.
**Impact:** Admin sees a match, offers it to the parent, parent accepts, booking is confirmed — but the credit backing it is invalid. The student gets a free makeup lesson.
**Fix:** Add a JOIN to `make_up_credits` in the match query to filter out entries with expired/redeemed credits.

---

### [8C.1] MEDIUM — Offer Notification Is Fire-and-Forget

**File:** src/hooks/useMakeUpWaitlist.ts:134-161
**Issue:** `useOfferMakeUp()` updates the waitlist status to `"offered"` FIRST, then invokes the `notify-makeup-offer` edge function. If the edge function fails (network error, timeout), the entry is marked as offered but the parent never receives the notification.

```typescript
// Update status first
await (supabase as any).from('make_up_waitlist')
  .update({ status: 'offered', offered_at: new Date().toISOString() })
  .eq('id', id).eq('org_id', currentOrg.id);

// Then notify (fire-and-forget)
await supabase.functions.invoke('notify-makeup-offer', {
  body: { waitlist_id: id },
});
```

**Trace:** The mutation updates DB first, then calls the edge function. The edge function call has no error handling specific to notification failure — the whole mutation succeeds from the UI's perspective.
**Impact:** Parent never knows about the offer. The 48-hour response window passes. Admin thinks the parent ignored the offer when they never received it.
**Fix:** Log notification status. Add a "Resend Offer" button (partially exists for "offered" status). Consider reversing the order: send notification first, update status only on success.

---

### [9A.1] LOW — Parent Cannot See Credit History (Expired/Voided)

**File:** src/hooks/useParentCredits.ts:54-64
**Issue:** The parent credit query filters by `credit_status = 'available'`, meaning parents can only see active credits. They cannot see expired, redeemed, or voided credits — no historical view.

```typescript
.eq('credit_status', 'available')
```

**Trace:** Confirmed in the `available_credits` view definition — it adds a `credit_status` computed column. The parent hook filters to only `'available'`. No separate query for historical credits exists in any parent-facing hook.
**Impact:** Parents can't verify that credits were properly issued for past absences. They can't see when credits expired. This could lead to support inquiries.
**Fix:** Add an optional `includeHistory` parameter to the hook, or a separate `useParentCreditHistory()` hook.

---

### [10A.1] MEDIUM — Continuation Withdrawal Doesn't Void Make-Up Credits

**File:** src/hooks/useTermContinuation.ts:558-611
**Issue:** When a parent declines continuation (withdrawal), the system creates term adjustments to cancel future lessons. But it does NOT check for or void any active make-up credits the student may have. Credits remain valid and could be used after the student has officially left.

**Trace:** Read the entire withdrawal processing block in `useBulkProcessContinuation`. It calls `process-term-adjustment` for each recurrence but never touches `make_up_credits`. The edge function `process-term-adjustment` also doesn't handle credits.
**Impact:** A withdrawing student keeps active make-up credits. In theory, they could still join the waitlist and book a makeup lesson after their withdrawal is processed but before their credits expire.
**Fix:** When processing withdrawals, automatically void active credits for the withdrawing student, or at minimum set their `expires_at` to the withdrawal effective date.

---

### [10E.1] HIGH — Double Credit for Make-Up Lesson Cancellation

**File:** Migration 20260222164435 (auto_issue_credit_on_absence trigger)
**Issue:** The `auto_issue_credit_on_absence()` trigger fires on ANY attendance record marked absent/cancelled, regardless of whether the lesson was a regular lesson or a make-up lesson. If a student books a make-up lesson and then cancels THAT lesson too, a second credit could be issued.

**Trace:** The trigger checks: (1) attendance_status IN ('absent','cancelled_by_student','cancelled_by_teacher'), (2) absence_reason_category IS NOT NULL, (3) policy eligibility = 'automatic', (4) no duplicate credit for this student+lesson. The duplicate check uses `issued_for_lesson_id` — since the make-up lesson has a different lesson_id than the original, it passes the check and a new credit is issued.
**Impact:** Infinite credit loop: cancel original → get credit → book makeup → cancel makeup → get another credit → repeat. Each credit represents real monetary value.
**Fix:** Add a check in the trigger: if the lesson being cancelled was itself a make-up booking (check if the lesson_id appears in `make_up_waitlist.booked_lesson_id`), skip credit issuance. Or add a `is_makeup_lesson` flag to lessons.

---

### [10E.2] MEDIUM — Duplicate Continuation Runs Not Fully Prevented

**File:** supabase/functions/create-continuation-run/index.ts:274-288
**Issue:** The duplicate check queries for existing runs with `neq("status", "completed")`. But the unique index `idx_tcr_unique_term_pair` covers ALL runs (including completed ones). So if a completed run exists for the same term pair, the application-level check passes but the database INSERT would fail with a unique constraint violation.

```typescript
// App check: excludes completed runs
const { data: existingRuns } = await client
  .from("term_continuation_runs")
  .select("id, status")
  .eq("org_id", orgId)
  .eq("current_term_id", current_term_id)
  .eq("next_term_id", next_term_id)
  .neq("status", "completed");

// But the unique index covers ALL statuses:
// CREATE UNIQUE INDEX idx_tcr_unique_term_pair
//   ON public.term_continuation_runs(org_id, current_term_id, next_term_id);
```

**Trace:** The unique index unconditionally prevents duplicate (org_id, current_term_id, next_term_id) combinations. If run 1 was completed and admin tries to create run 2 for the same pair (e.g., to re-run with different settings), the DB will reject it.
**Impact:** Admin cannot create a new continuation run for a term pair that already had a completed run. The error message would be a raw constraint violation, not a user-friendly message.
**Fix:** Either make the unique index partial (`WHERE status != 'completed'`) or add a completed-run check with a clear error message.

---

### [10E.3] MEDIUM — Credit Expires Mid-Offer: No Server-Side Guard

**File:** supabase/functions/notify-makeup-offer/index.ts + confirm_makeup_booking RPC
**Issue:** When a parent is viewing an offer (status = "offered"), the linked credit could expire via the cron job. The credit-expiry function cascades to waitlist entries in "waiting" status but NOT "offered" status. However, when the parent clicks Accept, `confirm_makeup_booking` doesn't validate the credit either.

**Trace:** credit-expiry/index.ts line 44-45: `eq("status", "waiting")` — only expires waitlist entries in "waiting" status. Entries in "offered" status are skipped. But the credit itself IS expired. When the parent then accepts and `confirm_makeup_booking` runs, it doesn't check the credit. The booking succeeds with an expired credit.
**Impact:** Student gets a free makeup lesson backed by an expired credit. Credit accounting becomes inconsistent.
**Fix:** Either (a) cascade expiry to "offered" entries too (notifying the parent), or (b) validate credit status in `confirm_makeup_booking`.

---

### [4D.1] MEDIUM — No Conflict Detection When Extending Recurrences

**File:** src/hooks/useTermContinuation.ts:536-556
**Issue:** When processing confirmed continuations, the code extends recurrence rules by updating `end_date`. It does NOT check for teacher availability, location availability, or scheduling conflicts in the new term.

```typescript
if (rec && rec.end_date && rec.end_date < data.next_term_end_date) {
  await (supabase as any)
    .from('recurrence_rules')
    .update({ end_date: data.next_term_end_date })
    .eq('id', lesson.recurrence_id);
}
```

**Trace:** The bulk processor simply extends the end_date of existing recurrence rules. The lesson generation system (not audited) would then create lessons based on these rules. If the teacher is unavailable on those days in the new term, or the room is booked, the system won't detect it.
**Impact:** Double-booked teachers or rooms in the new term. Requires manual checking after processing.
**Fix:** Add a preview/validation step that checks for conflicts before extending recurrences.

---

### [12A.1] CRITICAL — Enrolment Waitlist Offers Never Auto-Expire

**File:** supabase/functions/waitlist-expiry/index.ts:18-39
**Issue:** The `waitlist-expiry` cron function ONLY operates on `make_up_waitlist`. The `enrolment_waitlist` table has `offer_expires_at` and `enrolment_offer_expiry_hours` (default 48h) configured, but no cron job processes these expirations.

```typescript
// Line 18-23: Only targets make_up_waitlist
const { data, error } = await client
  .from('make_up_waitlist')
  .update({ status: 'expired' })
  .in('status', ['waiting', 'matched'])
  // ...
```

**Trace:** Searched all edge functions for `enrolment_waitlist` references. Only `waitlist-respond` handles it. No cron or scheduled function ever checks `offer_expires_at`.
**Impact:** Enrolment offers persist indefinitely. Slots intended for offered families can never be re-offered to the next person in the queue. The position-based queue system breaks down because families never expire out of "offered" status.
**Fix:** Extend `waitlist-expiry` to also process `enrolment_waitlist` where `status = 'offered'` AND `offer_expires_at < NOW()`, resetting them to "waiting".

---

### [12B.1] HIGH — Enrolment Waitlist Conversion Is Not Atomic

**File:** src/hooks/useEnrolmentWaitlist.ts (useConvertWaitlistToStudent, lines 629-735)
**Issue:** Converting a waitlist entry to a student involves 5 sequential database operations: create guardian → create student → link student-guardian → update waitlist entry → log activity. These are NOT in a transaction. Partial failure creates orphaned records.

**Trace:** Each step is a separate Supabase client call. If step 3 (link) fails, a guardian and student exist but are unlinked. If step 4 (waitlist update) fails, the student/guardian exist but the waitlist entry still shows "accepted". No cleanup or rollback.
**Impact:** Orphaned guardian/student records requiring manual database cleanup. Waitlist entry stuck in "accepted" forever.
**Fix:** Create a `convert_waitlist_to_student()` RPC that performs all steps in a single database transaction.

---

### [1D.1] LOW — Missing Index on term_continuation_responses.org_id

**File:** supabase/migrations/20260228100000_term_continuation.sql:82-94
**Issue:** The `term_continuation_responses` table has indexes on `(run_id, student_id)`, `(run_id, response)`, `(guardian_id, response)`, and `(student_id)`, but no index on `org_id` alone. RLS policies filter by `org_id` via `is_org_member()`, which would benefit from an index.
**Trace:** Checked all index definitions. The `org_id` column is used in every RLS policy but only appears in composite indexes where it's not the leading column.
**Impact:** Minor query performance degradation on large multi-tenant deployments.
**Fix:** Add `CREATE INDEX idx_tcr_response_org ON term_continuation_responses(org_id);`

---

### [4B.1] LOW — No Export Capability for Continuation Run Data

**File:** src/pages/Continuation.tsx
**Issue:** The admin continuation page allows filtering and searching responses but has no export button (CSV, PDF). For end-of-term reporting, admins must manually review the page.
**Trace:** Read the entire Continuation.tsx component. No export function or download button exists.
**Impact:** Administrative burden. Admins may resort to screenshots or manual data entry for their records.
**Fix:** Add CSV export button that downloads filtered responses.

---

### [4C.1] LOW — Continuation Settings Save Pattern Is Inconsistent

**File:** src/components/settings/ContinuationSettingsTab.tsx
**Issue:** The "Assumed Continuing" toggle saves immediately on change, while "Notice Weeks" and "Reminder Schedule" require clicking a separate "Save Changes" button. This inconsistent UX pattern could confuse admins.
**Trace:** Read the component. `handleAssumedContinuingChange()` calls the Supabase update directly on toggle. The other two fields track `hasChanges` state and require an explicit save.
**Impact:** Minor UX confusion. Admin might change notice weeks and leave the page thinking it auto-saved like the toggle.
**Fix:** Either make all fields auto-save or all require explicit save.

---

### [11A.1] LOW — MakeUpStatsCards Shows "Booked This Month" but Query May Include All Time

**File:** src/components/makeups/MakeUpStatsCards.tsx:38
**Issue:** The stat card labeled "Booked This Month" receives its `booked` count from `useWaitlistStats()`, but the hook (useMakeUpWaitlist.ts:277-281) filters by status IN ('waiting','matched','offered','accepted','booked') without any date filter.

**Trace:** The hook queries all entries with status = 'booked' regardless of when they were booked. The stats card displays this as "Booked This Month" which is misleading.
**Impact:** The "Booked This Month" count is actually "Booked All Time", giving admins a false impression of monthly activity.
**Fix:** Add a date filter (`booked_at >= first day of current month`) or rename the card to "Total Booked".

---

### [2B.1] MEDIUM — Students Without Primary Payer Guardian Are Silently Excluded

**File:** supabase/functions/create-continuation-run/index.ts:368-381
**Issue:** The run creation queries `student_guardians` filtered to `is_primary_payer = true`. Students without a primary payer guardian are silently excluded from the continuation run — no response row is created, no warning is shown.

```typescript
const { data: guardianLinks } = await client
  .from("student_guardians")
  .select("student_id, guardian_id, is_primary_payer, guardians!inner(id, full_name, email)")
  .in("student_id", studentIds)
  .eq("org_id", orgId)
  .eq("is_primary_payer", true);
```

**Trace:** Line 457: `if (!student || !guardian) continue;` — students without a guardian match are skipped. The preview shows all students WITH guardians, but there's no count of skipped students shown to the admin.
**Impact:** Students without a primary payer (perhaps because guardians were added without the flag) are silently missed. The admin may not realize some active students are not in the continuation run.
**Fix:** Add a `skipped_students` array to the response showing students excluded and why (no guardian, no primary payer, no email).

---

### [5E.1] LOW — Credit Status Is Computed, Not Stored

**File:** Migration 20260223005049 (available_credits view)
**Issue:** Credit status is computed by the `available_credits` view using a CASE statement, not stored as a column. This means there's no CHECK constraint on status, and the status logic is duplicated between the view, the expiry cron job, and the client-side filter.

```sql
CASE
  WHEN redeemed_at IS NOT NULL THEN 'redeemed'
  WHEN expired_at IS NOT NULL THEN 'expired'
  WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
  ELSE 'available'
END AS credit_status
```

**Trace:** Three places compute "is this credit available": (1) the view, (2) the cron job, (3) `useMakeUpCredits.ts:86-91`. They use slightly different logic (view checks `expired_at` OR `expires_at < NOW()`, client checks both plus `applied_to_invoice_id`).
**Impact:** Inconsistent status evaluation across code paths. A credit could be "available" according to one check and "expired" according to another.
**Fix:** Add a `status` column to `make_up_credits` with CHECK constraint and a trigger that updates it. Or centralize the logic in the view and ensure all consumers use it.

---

### [7C.1] LOW — One Policy Per Absence Reason Per Org (No Granularity)

**File:** Migration 20260222163838 (make_up_policies table), line 29
**Issue:** The unique constraint is `(org_id, absence_reason)` — one policy per absence reason per org. There's no way to have different policies for different instruments, age groups, or lesson types.

**Trace:** Confirmed by the `seed_make_up_policies` function which creates exactly 8 rows (one per absence_reason) per org.
**Impact:** An academy that wants to treat piano absence differently from violin absence cannot do so. All instruments share the same policy.
**Fix:** Future enhancement: add `instrument_id` or `lesson_type` columns to `make_up_policies` for granular policy control.

---

### [10B.1] MEDIUM — Make-Up Credits Don't Automatically Reduce Invoices

**File:** Migration 20260222211008 (create_invoice_with_items RPC)
**Issue:** Make-up credits are only applied to invoices when explicitly passed as `_credit_ids` parameter to the `create_invoice_with_items()` RPC. There is no automatic check during billing runs for available credits. An admin must manually select which credits to apply.

**Trace:** The RPC accepts `_credit_ids UUID[] DEFAULT '{}'`. If not provided, no credits are applied. The billing run system (not fully audited here) would need to query available credits and pass them in. No evidence of this happening automatically.
**Impact:** Credits accumulate but don't automatically reduce bills. Parents may not realize they have credits. Admins must manually apply credits during invoice creation.
**Fix:** During billing run invoice generation, automatically query available credits for each student and apply them.

---

### [3D.1] LOW — Parent Can See Only Pending Responses in Portal

**File:** src/hooks/useTermContinuation.ts:228-271
**Issue:** `useParentContinuationPending()` filters to `response = 'pending'` and active runs only. Parents cannot see their past responses (confirmed or withdrawn) or responses from previous terms.

```typescript
.eq('response', 'pending');
// ...
return ((data || []) as any[]).filter(
  (r: any) => r.run && ['sent', 'reminding'].includes(r.run.status)
);
```

**Trace:** No other parent-facing query exists for continuation responses. The portal only shows actionable items.
**Impact:** After responding, the parent has no confirmation page showing what they chose. They can't verify their response or see a history.
**Fix:** Add a `useParentContinuationHistory()` hook that shows all responses regardless of status.

---

## SUMMARY TABLE

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 6 |
| MEDIUM | 11 |
| LOW | 8 |
| **Total** | **28** |

---

## TOP 5 MOST DANGEROUS FINDINGS

### 1. Double Credit for Make-Up Lesson Cancellation [10E.1] — HIGH

A student cancels a lesson, gets a credit, books a makeup, cancels the makeup, and gets ANOTHER credit. This loop can repeat indefinitely. Each credit represents real monetary value (based on lesson rate). The trigger `auto_issue_credit_on_absence` has no mechanism to distinguish original lessons from makeup lessons, and the unique constraint only prevents duplicate credits for the SAME lesson_id.

**Business impact:** Unbounded financial liability. A single student could generate unlimited credits by repeatedly booking and cancelling makeup lessons.

### 2. Enrolment Waitlist Offers Never Auto-Expire [12A.1] — CRITICAL

The `waitlist-expiry` cron function only processes `make_up_waitlist`. The `enrolment_waitlist` has offer expiry fields configured (48-hour default) but no cron job processes them. Offered slots are permanently locked, preventing them from being offered to the next person in queue.

**Business impact:** The entire position-based queuing system breaks down. Families who don't respond to offers permanently block the queue.

### 3. Token-Based Response Has No Expiry [3A.1 + 3A.2] — CRITICAL

Continuation response tokens are 64-character hex strings with no expiry. They remain valid as long as the response is pending and the run hasn't been processed. The deadline is not enforced. A parent could respond weeks after the deadline. The token is embedded in email URLs which persist in email systems indefinitely.

**Business impact:** Late responses after admin has already processed withdrawals could create confusion. Leaked tokens allow unauthorized withdrawal of students.

### 4. Bulk Processing Is Client-Side and Non-Atomic [2A.1] — HIGH

Processing confirmed/withdrawn students happens in a JavaScript for-loop on the client, making multiple API calls per student per lesson. Browser close, network failure, or timeout creates partial processing with no rollback. Re-running could double-extend recurrences.

**Business impact:** Inconsistent term transitions. Some students extended, others not. Manual database intervention required to fix. Potential for recurrence rules to be extended twice, generating duplicate lessons.

### 5. No Server-Side Lock on Credit During Booking [6B.1] — CRITICAL

The `confirm_makeup_booking` RPC locks the waitlist entry but never validates or redeems the linked credit. Credit redemption is a separate step that may not happen, or could race with credit expiry or another booking. A credit could back multiple bookings.

**Business impact:** Students receive free makeup lessons. Credit accounting becomes unreliable. Financial records don't match actual credit usage.

---

## FEATURE COMPLETENESS ASSESSMENT

### Term Continuation: NEEDS-WORK

The core workflow is complete: create run → send notifications → collect responses → process deadline → bulk process. The data model is solid with proper indexes, unique constraints, and status enums. However, the system has significant operational gaps:
- No automatic deadline processing (manual only)
- No automatic reminder scheduling (manual only)
- Bulk processing is client-side and non-atomic
- No conflict detection when extending recurrences
- Token-based responses have no expiry
- Teachers can see all continuation data (privacy concern)
- Term deletion cascades to destroy runs
- No export capability

**Verdict:** Functional for small academies with attentive admins. Risky for larger deployments or less technical users.

### Make-Up Credits: NEEDS-WORK

The credit lifecycle has strong database-level design: triggers for auto-issuance, FOR UPDATE locks in RPCs, a computed view for availability, and cron-based expiry. The waitlist matching system is sophisticated. However:
- Double-credit vulnerability for makeup lesson cancellations
- Credit not atomically linked to booking confirmation
- Credit expiry doesn't cascade to "offered" waitlist entries
- Credits don't auto-reduce invoices
- Timezone handling is inconsistent
- No partial credit usage
- Client-side expiry checks can be stale

**Verdict:** Core mechanics work. The double-credit vulnerability and booking-credit disconnect are the most urgent issues to fix before relying on financial accuracy.

### Enrolment Waitlist: NEEDS-WORK

A well-designed system with position-based queuing, multiple sources, activity audit trail, and email-based responses. The data model is comprehensive. However:
- Offer expiry is completely unimplemented (critical gap)
- Student conversion is not atomic (5 sequential DB calls)
- send-enrolment-offer edge function not located in codebase
- Location selection is a v1 workaround (manual ID entry)
- Priority field exists but isn't acted upon

**Verdict:** The missing expiry job makes this system unreliable for production queuing. Once that's fixed and conversion is made atomic, it would be production-ready.
