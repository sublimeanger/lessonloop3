# Deep Audit — Part 1: Payment Systems, Invoice Lifecycle, Recurring Lessons

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Stripe payment integrity, invoice state machine, recurring lesson management
**Status:** Audit only — NO fixes applied

---

## SECTION 1: STRIPE PAYMENT INTEGRITY

### Files Audited
- `src/hooks/useStripePayment.ts`
- `supabase/functions/stripe-create-checkout/index.ts`
- `supabase/functions/stripe-create-payment-intent/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/stripe-process-refund/index.ts`
- `src/components/invoices/RefundDialog.tsx`
- `supabase/functions/create-billing-run/index.ts`
- `supabase/functions/_shared/plan-config.ts`
- `src/hooks/useSubscription.ts`

---

### Payment Flow Trace: Parent clicks "Pay £25"

**Amount source:** Server-side. Both `stripe-create-checkout` and `stripe-create-payment-intent` fetch `invoice.total_minor` from the database and calculate `amountDue = total_minor - totalPaid` by summing all existing `payments` rows. The client sends only `invoiceId` — no amount. **Verdict: GOOD — not client-manipulable.**

**Already-paid invoice:** Both functions check `if (!["sent", "overdue"].includes(invoice.status))` and throw. They also check `if (amountDue <= 0)` and throw "already fully paid". **Verdict: GOOD.**

**Overpayment prevention:** Payment amount is capped: `if (paymentAmount > amountDue) { paymentAmount = amountDue; }`. **Verdict: GOOD.**

---

### [1.1] LOW — Duplicate Checkout Session Idempotency Key Reuse After Expiry

**File:** `supabase/functions/stripe-create-checkout/index.ts:271`
**Issue:** The idempotency key is `checkout_${invoiceId}_${installmentId}_${amount}`. Stripe expires idempotency keys after 24 hours. If a parent creates a checkout, abandons it, waits >24h, and creates another for the same amount, Stripe will create a fresh session — but the old pending session record in `stripe_checkout_sessions` is only expired when a _new_ checkout is initiated (lines 155-168). If no new checkout is created, the old record stays "pending" forever.
**Impact:** Stale `stripe_checkout_sessions` rows with status "pending" accumulate. Cosmetic/reporting issue only — no financial risk since the Stripe sessions themselves expire after 30 minutes.
**Fix:** Add a scheduled cleanup job to expire `stripe_checkout_sessions` where `expires_at < NOW()` and `status = 'pending'`.

---

### [1.2] LOW — Payment Intent Function Has No Rate Limiting

**File:** `supabase/functions/stripe-create-payment-intent/index.ts`
**Issue:** The `stripe-create-checkout` function has rate limiting (`checkRateLimit` at line 31-34 of the payment-intent function — wait, it's actually the _payment-intent_ function that has rate limiting). Let me re-check: actually, the `stripe-create-payment-intent/index.ts` imports and uses `checkRateLimit` at line 31. The `stripe-create-checkout/index.ts` does NOT import or use rate limiting.
**Impact:** A malicious user could spam checkout session creation, each of which creates a Stripe API call (customer lookup/create + checkout session create). Could cause Stripe rate limit hits or inflated API costs.
**Fix:** Add `checkRateLimit` to `stripe-create-checkout/index.ts` matching the pattern in `stripe-create-payment-intent`.

---

### [1.3] MEDIUM — Webhook: Invoice Status Not Checked Before Recording Payment

**File:** `supabase/functions/stripe-webhook/index.ts:227-300` (handleInvoiceCheckoutCompleted)
**Issue:** When a `checkout.session.completed` webhook fires, the handler records a payment and updates invoice status without checking whether the invoice is still in a payable state (`sent`/`overdue`). If the invoice was voided between checkout creation and webhook arrival, the payment is still recorded and the invoice's `paid_minor` is updated. The invoice status won't flip to "paid" (since `totalPaid >= total_minor` would need to be checked against the voided invoice), but the `paid_minor` field gets updated on a voided invoice, and a `payments` row exists for it.
**Impact:** Orphaned payment records on voided invoices. The `charge.refunded` handler would later try to recalculate `paid_minor` on a voided invoice. Revenue reports could be inaccurate.
**Fix:** In both `handleInvoiceCheckoutCompleted` and `handlePaymentIntentSucceeded`, fetch the invoice status and reject if `status NOT IN ('sent', 'overdue')`. Return the Stripe funds via automatic refund or flag for manual review.

---

### [1.4] MEDIUM — Webhook: paid_minor + Status Update Is Not Atomic

**File:** `supabase/functions/stripe-webhook/index.ts:332-361`
**Issue:** The webhook reads all payments, sums them, fetches the invoice total, and then does a separate update. This is a read-then-write pattern without row locking. If two webhooks fire simultaneously (e.g., `checkout.session.completed` and `payment_intent.succeeded` for the same payment — which IS possible since both are handled), they could both read the same `paid_minor`, both compute the same total, and both write — resulting in correct data by coincidence. However, there's a subtle risk: the `payments` insert could succeed for `checkout.session.completed` while `payment_intent.succeeded` also tries to insert the same payment (both check `provider_reference` but there's a window).
**Impact:** The double-payment guard (checking `provider_reference` + DB unique constraint `23505`) mitigates this. The risk is low due to defense-in-depth, but the non-atomic read-write on `paid_minor` could theoretically produce an inconsistent value if two _different_ payments for the same invoice complete simultaneously.
**Fix:** Use the existing `record_payment_and_update_status()` RPC (which uses `FOR UPDATE` row locking) instead of the manual insert + recalculate pattern in the webhook handler.

---

### [1.5] INFO — Duplicate Handler Code Between checkout.session.completed and payment_intent.succeeded

**File:** `supabase/functions/stripe-webhook/index.ts:227-415` and `636-815`
**Issue:** `handleInvoiceCheckoutCompleted` and `handlePaymentIntentSucceeded` contain nearly identical logic (~180 lines duplicated): payment recording, installment reconciliation, paid_minor recalculation, notification creation, and receipt email triggering. Any bug fix to one must be manually replicated in the other.
**Impact:** Maintenance burden. If a fix is applied to one handler but not the other, behavior diverges.
**Fix:** Extract shared logic into a `processInvoicePayment()` helper function.

---

### [1.6] LOW — payRemaining Uses paid_minor From Invoice Row, Not Summed Payments

**File:** `supabase/functions/stripe-create-checkout/index.ts:114-117` and `stripe-create-payment-intent/index.ts:108-109`
**Issue:** When `payRemaining` is true, the amount is calculated as `invoice.total_minor - (invoice.paid_minor || 0)`. But `paid_minor` is a denormalized field updated asynchronously by webhook handlers. If a recent payment's webhook hasn't processed yet, `paid_minor` may be stale, leading to an overpayment attempt. The checkout function already computes `amountDue` from summed payments (line 84-85) and caps at that, so the cap at line 149 would catch this. However, the _description_ would say "Remaining balance" when the actual amount was silently capped.
**Impact:** Confusing description on Stripe checkout for edge case. No financial risk due to the cap.
**Fix:** Use the already-computed `amountDue` instead of `invoice.paid_minor` for `payRemaining` calculation.

---

### Refund Flow

### [1.7] MEDIUM — Refund Records Not Atomic With Stripe API Call

**File:** `supabase/functions/stripe-process-refund/index.ts:129-147`
**Issue:** The Stripe refund API call succeeds at line 123, then the DB insert of the refund record happens at line 129. If the DB insert fails (line 144-147), the refund has occurred on Stripe but is not recorded in LessonLoop. The code logs the error but does not throw — so the function returns `success: true` to the client even if the DB record wasn't created. The `charge.refunded` webhook handler would eventually record it, but there's a window where the refund exists on Stripe but not in the DB.
**Impact:** Temporary inconsistency between Stripe and LessonLoop. The webhook handler (`handleChargeRefunded`) has idempotent recording that will eventually sync, but revenue reports may be temporarily wrong.
**Fix:** Wrap the Stripe API call and DB insert in a try-catch that flags the discrepancy. Consider recording a "pending" refund row BEFORE calling Stripe, then updating to "succeeded"/"failed" after.

---

### [1.8] LOW — Refund Permission: Finance Role Cannot Process Refunds

**File:** `supabase/functions/stripe-process-refund/index.ts:71-76`
**Issue:** Refund permissions allow `owner`, `admin`, or any role in `solo_teacher` orgs. The `finance` role — which has access to invoices and financial reports — cannot process refunds in academy/agency orgs. This may be intentional, but it's inconsistent with the billing run function which does allow `finance` role (line 91 of `create-billing-run`).
**Impact:** Finance staff must escalate refund requests to owner/admin even though they manage all other billing.
**Fix:** Either add `finance` to allowed roles, or document this as intentional.

---

### Billing Run

### [1.9] MEDIUM — Billing Run Has No Duplicate Period Guard (Relies on DB Constraint)

**File:** `supabase/functions/create-billing-run/index.ts:149-178`
**Issue:** Duplicate prevention for billing runs relies on a DB unique constraint (caught as error code `23505` at line 166). However, the exact constraint definition was not auditable from the code — if the constraint is on `(org_id, start_date, end_date)`, it works. But if it's only on `(org_id, run_type, start_date)` or similar, overlapping-but-not-identical date ranges could create duplicate invoices for the same lessons. The `billedLessonIds` check (line 386-397) provides a second guard by checking `invoice_items.linked_lesson_id`, ensuring lessons aren't double-billed even if the run-level dedup fails.
**Impact:** Low due to lesson-level dedup. But if the constraint doesn't exist or is too narrow, the function returns a misleading "already exists" error or allows duplicate runs.
**Fix:** Verify the unique constraint on `billing_runs` covers `(org_id, start_date, end_date)`. Add an explicit check before insert if unsure.

---

### [1.10] HIGH — Billing Run: Partial Failure Leaves Invoices Without Items

**File:** `supabase/functions/create-billing-run/index.ts:552-601`
**Issue:** Invoices are batch-inserted first (line 554), then invoice items are batch-inserted separately (line 593). If the items insert fails (line 597-599), the invoices exist in the database with `status: 'draft'` but have NO line items. The error is logged but not propagated — the function returns the invoice IDs as if successful. The billing run status is set to "completed" or "partial" based on payer failures, not item failures.
**Impact:** Empty draft invoices could be sent to parents if a teacher doesn't notice they're empty. The `totalAmount` in the summary would be correct (calculated before insert), but the actual invoices would show no items.
**Fix:** Either (a) use a transaction/RPC to insert invoices and items atomically, or (b) if items insert fails, delete the orphaned invoices and mark the run as "failed", or (c) at minimum, propagate the error to `failedPayers` and set run status to "partial"/"failed".

---

### [1.11] MEDIUM — Billing Run: Students Without Guardian Silently Skipped

**File:** `supabase/functions/create-billing-run/index.ts:457-469`
**Issue:** If a student has no `primary_payer` guardian AND no email address, the student's lessons are silently skipped (line 468: `return;`). The `skippedLessons` counter only counts lessons that weren't matched to ANY payer group — it doesn't specifically track "skipped because no payer". A student with a non-primary guardian would also be skipped.
**Impact:** Lessons are delivered but never invoiced. The billing run summary shows the skipped count, but doesn't explain WHY or WHICH students were skipped, making it hard for the finance team to follow up.
**Fix:** Track skipped students with reasons: `{ studentId, studentName, reason: "no_primary_payer" }` and include in the billing run summary.

---

### [1.12] LOW — Billing Run: Fallback Rate Comes From Client

**File:** `supabase/functions/create-billing-run/index.ts:130`
**Issue:** `fallback_rate_minor` is accepted from the client request body (`body.fallback_rate_minor ?? 3000`). While this is a reasonable default, a malicious admin could set `fallback_rate_minor: 0` to generate zero-value invoices, or set it very high. Rate cards from the DB are used first, so this only applies when no matching rate card exists.
**Impact:** Low — only org admins/owners/finance can trigger billing runs, and the fallback only applies when rate cards aren't configured. But it's a server-side function accepting a pricing input from the client.
**Fix:** Validate `fallback_rate_minor > 0` and optionally cap at a reasonable maximum, or always require rate cards to be configured.

---

### [1.13] LOW — Billing Run: Due Date Uses Server Timezone, Not Org Timezone

**File:** `supabase/functions/create-billing-run/index.ts:514-516`
**Issue:** `const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);` uses the edge function runtime's timezone (UTC on Deno Deploy). For UK orgs during BST (UTC+1), a billing run at 11:30 PM BST (10:30 PM UTC) would still use the UTC date. The difference is at most 1 day, but could cause the due date to be the "wrong" day for the org.
**Impact:** Due date off by 1 day in edge cases during BST. Minor for a 14-day payment window.
**Fix:** Use the org's timezone when computing the due date.

---

### Subscription Upgrade/Downgrade

### [1.14] HIGH — Downgrade Does Not Enforce Teacher Limit on Existing Members

**File:** `supabase/functions/stripe-webhook/index.ts:458-559` (handleSubscriptionUpdated) and `supabase/migrations/20260222220553_...sql`
**Issue:** When an org downgrades from Agency (unlimited teachers) to Teacher plan (1 teacher), `handleSubscriptionUpdated` sets `max_teachers: 1` on the `organisations` table. The `check_teacher_limit` trigger only fires on INSERT to `org_memberships` — it does NOT check on UPDATE. So existing excess teachers remain active and functional. A Studio org with 5 teachers downgrading to Teacher plan keeps all 5 teachers working indefinitely.
**Impact:** Plan limit violation. Org pays for Teacher plan (£12/mo) but effectively uses Studio/Agency features. Teachers can continue teaching, creating lessons, recording attendance — the only thing blocked is adding _new_ teachers.
**Fix:** Either (a) add a post-downgrade sweep that deactivates excess teachers, or (b) add enforcement checks at lesson creation / attendance recording that verify `active teacher count <= max_teachers`, or (c) prevent downgrade while excess teachers exist (business logic in checkout/portal).

---

### [1.15] MEDIUM — Past-Due Grace Period: No Notification to Org Owner

**File:** `supabase/functions/stripe-webhook/index.ts:817-844` and `supabase/migrations/20260303120000_...sql`
**Issue:** When `invoice.payment_failed` fires, the org is marked `past_due` with `past_due_since: NOW()`. After 7 days, `is_org_write_allowed()` blocks all writes. But there is no email or in-app notification sent to the org owner when the payment fails or when the 7-day grace period is about to expire. The owner discovers the block only when they try to create a lesson/student and get an error.
**Impact:** Surprise write-blocking for the org. Could cause data loss if a teacher can't save attendance mid-lesson.
**Fix:** Send notification emails at payment failure, at day 3, and at day 6 warning of imminent blocking.

---

## SECTION 2: INVOICE LIFECYCLE

### Invoice State Machine

**Statuses:** `draft`, `sent`, `paid`, `overdue`, `void`

**Allowed Transitions:**
| From | To |
|------|-----|
| draft | sent, void |
| sent | paid, overdue, void |
| overdue | paid, sent, void |
| paid | (terminal) |
| void | (terminal) |

**Enforcement:**
- **Client-side:** `ALLOWED_TRANSITIONS` in `src/hooks/useInvoices.ts:256-266`
- **Server-side:** `enforce_invoice_status_transition()` BEFORE UPDATE trigger in migration `20260222211425_...sql`
- **Verdict: GOOD — dual enforcement, server is authoritative**

---

### [2.1] MEDIUM — Webhook Can Reopen Voided Invoice After Refund

**File:** `supabase/functions/stripe-webhook/index.ts:962-971` (handleChargeRefunded)
**Issue:** When a `charge.refunded` webhook fires, the handler recalculates `netPaid` and if `netPaid < total_minor`, it sets `status = "sent"` (line 966). This does NOT check whether the invoice is currently `void`. If an invoice was voided (terminal state) and then a refund occurs on the original Stripe charge, the webhook tries to set status to `sent`. The DB trigger `enforce_invoice_status_transition()` would reject this transition (void is terminal), causing a silent error that is not checked.
**Impact:** The `paid_minor` update succeeds but the status update silently fails (or the entire update fails if the trigger raises an exception). The refund is recorded in the `refunds` table, but the invoice `paid_minor` may not be updated correctly depending on whether the trigger aborts the whole update or just the status column.
**Fix:** Check current invoice status before attempting status change. If voided, only update `paid_minor` without changing status.

---

### [2.2] LOW — Voided Invoice: Payment Plan Installments Voided But No Guard on Re-send

**File:** Migration `20260222212357_...sql` (void_invoice RPC)
**Issue:** The `void_invoice()` function sets installment status to `void` and restores credits. However, there's no guard preventing a voided invoice from being "un-voided". While the `enforce_invoice_status_transition` trigger makes void a terminal state, the installments and credits are in a restored state. If someone manually updates the invoice status in the DB (bypassing the trigger via service role), the installments would be void while the invoice is not.
**Impact:** Very low — requires manual DB manipulation. But the credits were already restored, so un-voiding would mean credits are double-counted.
**Fix:** Add a comment documenting that void is irreversible, and add a guard in `void_invoice()` to check invoice isn't already void.

---

### Invoice Amount Calculations

### [2.3] MEDIUM — Billing Run VAT Rounding: Cumulative Error on Multi-Item Invoices

**File:** `supabase/functions/create-billing-run/index.ts:531-533`
**Issue:** VAT is calculated on the subtotal (sum of all line items): `taxMinor = Math.round(subtotal * (vatRate / 100))`. This is correct for the invoice total, BUT individual line items have no VAT breakdown stored. The `create_invoice_with_items` RPC (migration `20260222211008_...sql`) also calculates VAT on the sum, so the approach is consistent. However, if line items are displayed with individual VAT amounts in the UI (e.g., item price + VAT), the per-item VAT would need rounding that may not sum to the invoice-level VAT.
**Impact:** Display inconsistency if per-item VAT is shown. No financial error since invoice-level totals are correct.
**Fix:** Store per-item VAT or document that VAT is invoice-level only.

---

### [2.4] INFO — Invoice Line Items: No Negative Amount Validation

**File:** `supabase/functions/create-billing-run/index.ts:578-589`
**Issue:** Invoice items use `unit_price_minor` from rate cards. If a rate card has `rate_amount: 0` (misconfigured), zero-value line items are created. Negative amounts are prevented by the rate card being a positive value, but there's no explicit `CHECK (amount_minor >= 0)` constraint on `invoice_items`. Credit notes intentionally use negative amounts (`is_credit_note: true` with negative `total_minor`), so a blanket constraint would break that flow.
**Impact:** Misconfigured rate cards create zero-value invoices. No mechanism for negative-value abuse since billing run calculates from rate cards.
**Fix:** Add a CHECK constraint: `CHECK (amount_minor >= 0 OR (SELECT is_credit_note FROM invoices WHERE id = invoice_id))` — or validate at the application level.

---

### [2.5] INFO — Rounding: £100 Split 3 Ways

**Issue:** The `create_invoice_with_items` RPC and billing run both use `Math.round()` for VAT. For the specific case of "1/3 of £100": this isn't a scenario that occurs naturally because each lesson is individually priced from rate cards. An invoice with 3 lessons at £33.33 each would total £99.99, not £100.00. The rate cards store amounts in minor units (pence), so the rate would be 3333 pence = £33.33 per lesson. This is a business decision, not a bug.
**Impact:** None for current architecture. Rate cards prevent fractional pricing.
**Fix:** No fix needed. Document that rate cards should be set in whole pence.

---

### Overdue Detection

### [2.6] LOW — Overdue Check Uses Server Date, Not Org Timezone

**File:** `supabase/functions/invoice-overdue-check/index.ts:19`
**Issue:** `new Date().toISOString().split("T")[0]` produces a UTC date. For UK orgs during BST, an invoice due on March 15 would be marked overdue at midnight UTC (11 PM GMT / midnight BST) rather than midnight in the org's timezone. During BST, invoices could be marked overdue 1 hour early.
**Impact:** Invoice marked overdue up to 1 hour prematurely during BST. Parent receives overdue notification while still technically on the due date in their timezone.
**Fix:** Use `CURRENT_DATE AT TIME ZONE 'Europe/London'` in the query, or adjust the comparison to account for the org's timezone.

---

### [2.7] INFO — Overdue on Due Date: Strict Less-Than Comparison

**File:** `supabase/functions/invoice-overdue-check/index.ts:19`
**Issue:** The query uses `.lt("due_date", todayStr)` — strictly less than today's date. This means an invoice due on March 15 becomes overdue on March 16 (when `due_date < '2026-03-16'`). An invoice paid at 11:59 PM on the due date would NOT be marked overdue. **Verdict: CORRECT — paid on due date is not overdue.**
**Impact:** None. Correct behavior.
**Fix:** No fix needed.

---

### Credit Notes

### [2.8] LOW — Credit Note Amount Not Validated Against Original Invoice

**File:** `supabase/functions/process-term-adjustment/index.ts:760-830`
**Issue:** Credit notes are generated by the term adjustment system with amounts calculated from the cancelled lessons' rates. The credit note amount is based on `adjustment_amount_minor` which is computed from the actual lessons cancelled. It does NOT check whether the credit note total exceeds the original invoice total. In theory, if a term adjustment miscalculates (e.g., applies wrong rate), the credit note could exceed the original invoice amount.
**Impact:** Credit note exceeding original invoice is unlikely with current calculation logic, but there's no DB-level guard.
**Fix:** Add a validation: `credit_note.total_minor <= ABS(original_invoice.total_minor)`.

---

### [2.9] INFO — Credit Notes in Revenue Reports

**Issue:** Credit notes have `is_credit_note: true` and negative `total_minor`. Revenue reports using `SUM(total_minor)` on all non-void invoices would automatically subtract credit notes. The `get_invoice_stats()` RPC doesn't explicitly filter credit notes, but since they have negative totals, they naturally reduce the totals. This is correct accounting behavior.
**Impact:** None if reports include credit notes. Could be confusing if a user sees negative line items in a report without understanding they're credit notes.
**Fix:** Add `is_credit_note` filter option to reports UI for clarity.

---

## SECTION 3: RECURRING LESSONS

### Recurrence Creation

### [3.1] LOW — 200 Lesson Cap Applied Client-Side Only

**File:** `src/components/calendar/useLessonForm.ts:585-593`
**Issue:** The 200-lesson cap is enforced in the React hook, not in a server-side function or DB trigger. A crafted API request could bypass this and insert unlimited lessons.
**Impact:** Low — only authenticated org members can create lessons, and the `check_student_limit` / subscription triggers would still fire per-insert. But a malicious or buggy client could create thousands of lesson rows.
**Fix:** Add a server-side guard: either a DB trigger that limits lessons per recurrence_id, or move recurrence creation to an edge function with the cap.

---

### [3.2] LOW — No End Date Recurrence Defaults to 90 Days

**File:** `src/components/calendar/useLessonForm.ts` (inferred from agent research)
**Issue:** If no `recurrenceEndDate` is set, the system defaults to generating 90 days of lessons. This is a reasonable default, but the user isn't warned that the series will stop after ~13 weeks. They might expect infinite recurrence until manually stopped.
**Impact:** Lessons stop being scheduled after 90 days. Teachers may not notice until students show up for a lesson that doesn't exist.
**Fix:** Show a clear message: "Lessons will be created through [date]. You can extend the series later."

---

### [3.3] MEDIUM — Closure Date Added After Lessons Created: No Auto-Cancel

**File:** `src/components/calendar/useLessonForm.ts:551-583` and closure date management
**Issue:** Closure dates are only checked at lesson creation time. If an admin adds a closure date AFTER recurring lessons have been created for that period, the existing lessons are NOT automatically cancelled. The `block_scheduling_on_closures` org setting only prevents NEW lessons from being scheduled on closure dates.
**Impact:** Lessons remain scheduled on newly-added closure dates. Teachers and students show up to find the venue closed. Attendance is recorded, billing occurs for a lesson that shouldn't have happened.
**Fix:** When a closure date is added, check for existing lessons on that date and either auto-cancel them or show a warning with an option to cancel.

---

### "Edit This and Future"

### [3.4] MEDIUM — Edit This and Future: Attendance Records Orphaned on Student Change

**File:** `src/components/calendar/useLessonForm.ts:446-464`
**Issue:** When editing "this and future", the code deletes ALL `lesson_participants` for all affected lessons (line 447-449) and re-inserts the new participant list. However, `attendance_records` reference `student_id` and `lesson_id`. If the student list changes (student removed), existing attendance records for that student on future lessons become orphaned — they reference a student who is no longer a participant.
**Impact:** Attendance records exist for students not in the lesson. Reports show attendance for students who were removed from the series. If the lesson is later billed, the student might be invoiced for lessons they no longer attend.
**Fix:** When removing a student from future lessons, also delete their `attendance_records` for those lessons (only for future, unattended lessons).

---

### [3.5] LOW — Edit This and Future: Partial Update Risk

**File:** `src/components/calendar/useLessonForm.ts:392-473`
**Issue:** The update is done in multiple sequential steps: (1) update current lesson, (2) update future lessons, (3) shift times via RPC, (4) delete participants, (5) insert new participants. If any step after the first fails, the system is in a partially updated state. The error toast warns "Partial updates may have occurred" (line 469), which is honest but not ideal.
**Impact:** Inconsistent series — some lessons updated, others not. No rollback mechanism.
**Fix:** Wrap in a server-side transaction (edge function or RPC) to ensure atomicity.

---

### [3.6] INFO — Edit This Only: Recurrence ID Cleared

**File:** `src/components/calendar/useLessonForm.ts:409`
**Issue:** When editing a single lesson in a series (`this_only`), the `recurrence_id` is set to `null` on that lesson. This effectively removes it from the series. Future "delete this and future" operations won't include this detached lesson. This is intentional behavior, but users may not realize that editing one lesson detaches it from the series.
**Impact:** User expectation mismatch. "Edit all future" later won't include the detached lesson.
**Fix:** Show a note: "This lesson will be detached from the recurring series."

---

### "Delete This and Future"

### [3.7] MEDIUM — Delete This and Future: Invoiced Lessons Deleted Without Invoice Adjustment

**File:** `src/components/calendar/LessonDetailPanel.tsx:413-449`
**Issue:** When deleting future lessons, the code checks for DRAFT invoice items referencing cancelled lessons (line 333-359) and shows a warning. However, for SENT or PAID invoices, no check is performed. If a future lesson has already been invoiced (via upfront billing) and the invoice is sent/paid, deleting the lesson does NOT create a credit note or adjust the invoice.
**Impact:** Parent has paid for lessons that no longer exist. The invoice remains "paid" with line items referencing deleted lessons. Manual credit note or refund required.
**Fix:** Check for non-draft invoice items. If found, either (a) prevent deletion until credit note is issued, (b) auto-generate a credit note, or (c) show a prominent warning with a link to the affected invoices.

---

### [3.8] LOW — Delete: Uses >= for Date Boundary (Includes Current Lesson)

**File:** `src/components/calendar/LessonDetailPanel.tsx:419` and `301`
**Issue:** Both cancel and delete use `.gte('start_at', lesson.start_at)` — this includes the current lesson. "This and future" correctly includes "this". **Verdict: CORRECT behavior.**
**Impact:** None. The naming "this and future" matches the `>=` boundary.
**Fix:** No fix needed.

---

### [3.9] LOW — Delete: Cascade to Attendance Is Fire-and-Forget

**File:** `src/components/calendar/LessonDetailPanel.tsx:312-319`
**Issue:** Attendance record deletion for cancelled lessons is fire-and-forget (`.then()` with error logging only). If this fails, attendance records remain for non-existent lessons.
**Impact:** Orphaned attendance records. Reports may count attendance for deleted lessons.
**Fix:** Make attendance cleanup synchronous or add a cleanup job. Alternatively, add FK cascade `ON DELETE CASCADE` from lessons to attendance_records.

---

### [3.10] LOW — Cancel vs Delete: Two Separate Code Paths

**File:** `src/components/calendar/LessonDetailPanel.tsx:260-389` (cancel) and `391-450` (delete)
**Issue:** "Cancel" marks lessons as `status: 'cancelled'` with cascade side effects (attendance deletion, notification, recurrence cap, invoice check, calendar sync, Zoom cleanup). "Delete" simply deletes the rows with minimal cascade (just calendar + Zoom sync, no attendance cleanup, no invoice check, no notification). A deleted lesson's attendance records and invoice items may be orphaned.
**Impact:** If a teacher deletes (instead of cancels) a lesson with attendance records or draft invoice items, those records become orphaned. The delete path is missing the invoice-item and attendance checks that the cancel path has.
**Fix:** Either (a) unify the cascade logic, (b) add the missing checks to the delete path, or (c) remove the delete option for lessons that have attendance records or invoice items.

---

### Term/Closure Date Handling

### [3.11] INFO — Closure Dates Are Location-Scoped

**File:** `supabase/migrations/20260119233724_...sql`
**Issue:** Closure dates can be org-wide (`applies_to_all_locations: true`) or location-specific (`location_id` set). The recurrence creation code queries all closure dates for the org but doesn't filter by location. This means a closure date for Location A would also block lessons at Location B.
**Impact:** Overly aggressive filtering — lessons at Location B are unnecessarily skipped if Location A has a closure date. However, `applies_to_all_locations` is the common case for holidays, and location-specific closures are rarer.
**Fix:** Filter closure dates by `location_id IS NULL OR location_id = lesson.location_id OR applies_to_all_locations = true` during recurrence generation.

---

## SUMMARY

| Severity | Count | Findings |
|----------|-------|----------|
| HIGH | 2 | 1.10 (billing run partial failure), 1.14 (downgrade doesn't enforce teacher limit) |
| MEDIUM | 7 | 1.3, 1.4, 1.9, 1.11, 1.15, 2.1, 3.3, 3.4, 3.5, 3.7 |
| LOW | 11 | 1.1, 1.2, 1.6, 1.8, 1.12, 1.13, 2.2, 2.6, 2.8, 3.1, 3.2, 3.8, 3.9, 3.10 |
| INFO | 5 | 1.5, 2.3, 2.4, 2.5, 2.7, 2.9, 3.6, 3.11 |

### Top Priority Fixes

1. **[1.14] HIGH — Downgrade teacher limit bypass:** Existing excess teachers remain active after downgrade. Needs post-downgrade enforcement.
2. **[1.10] HIGH — Billing run empty invoices:** If invoice items batch-insert fails, empty invoices are left in the database. Needs atomic insert or cleanup.
3. **[1.3] MEDIUM — Webhook pays voided invoice:** Payment recorded on voided invoice. Needs status check in webhook handler.
4. **[3.7] MEDIUM — Delete invoiced lessons:** Paid/sent invoice line items reference deleted lessons with no credit note. Needs invoice check before delete.
5. **[3.3] MEDIUM — Post-creation closure dates:** Adding closure dates doesn't cancel existing lessons. Needs auto-cancel or warning.

### What's Working Well

- Amount manipulation prevention: prices always from DB, never client
- Webhook idempotency: `stripe_webhook_events` dedup table + `provider_reference` unique constraint
- Invoice state machine: dual enforcement (client + DB trigger)
- Refund guards: max refundable calculation prevents over-refund
- Payment plan logic: installment reconciliation is thorough
- Credit application: atomic via `FOR UPDATE` locks
- Void cascade: credits restored, installments voided atomically
