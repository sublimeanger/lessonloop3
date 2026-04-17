# LessonLoop Billing — Fixes Queue

Tracks every actionable fix surfaced by the Phase 2 billing forensics audit. Resolved in a dedicated fix session after Section 11 wrap.

**Buckets:**
- **A — STOP THE BLEEDING**: Live production bugs causing wrong money / data loss / parent-facing errors right now. Fix immediately.
- **B — END-OF-AUDIT FIX**: Real defects but no live harm (low-frequency, orphaned, or isolated). Fix after Section 11.
- **C — DESIGN DECISION**: Cross-cutting, architectural, or SPEC. Needs full audit picture before deciding.

---

## From Section 1 — Three-path paid_minor consistency

### Bucket A (fix now)
_None._

### Bucket B (fix at end)
- **B1.** `record_installment_payment` (P3) updates `paid_minor` via `SUM(payments)` but never INSERTs a payment row. Orphaned today — zero callers outside definition/REVOKE/generated types. Latent: if invoked, silent `paid_minor` under-count by exactly the installment amount while installment flips to 'paid'. Fix options: (a) delete the RPC, or (b) add payment INSERT + over-application guard + audit_log entry. Decide at fix pass.
- **B2.** No over-application guard on P2 (`record_stripe_payment_paid_guard`) or P3 — a payment exceeding remaining balance would set `paid_minor` > `total_minor`.
- **B3.** No `audit_log` entry on P2 or P3 — P1 logs, P2/P3 don't. Teacher-facing evidence gap.
- **B4.** Direct UPDATE bypass at `stripe-webhook/index.ts:973` mutates `paid_minor` without going through any RPC. Undermines the entire three-path model.

### Bucket C (design decision)
- **C1.** Three RPCs + one direct UPDATE all writing `paid_minor` is itself an architectural smell. Post-audit question: do we consolidate to one canonical path?
- **C2.** Status-reopen (paid → sent on refund) only fires on P2. Should be model-wide; depends on Section 2 findings.
- **C3.** Divergent installment reconciliation (only P1 sets `installments.payment_id`) — depends on Section 4 findings.

### Tracked but not actioned
- Return shape divergence (LOW) — cosmetic
- No amount-sign check in any RPC (LOW) — cosmetic unless combined with B2

---

## Running index
- Bucket A: 1 open / 2 resolved
- Bucket B: 17
- Bucket C: 22
- Tracked (low): 3

---

## From Section 2 — Refund + void semantics

### Bucket A (fix now)
_None._

### Bucket B (fix at end)
- **B5.** Stripe webhook `handleChargeRefunded` does no cumulative refund check against the payment amount (`supabase/functions/stripe-webhook/index.ts:856-988`). The `validate_refund_amount` trigger at `supabase/migrations/20260316240000_fix_refund_audit_findings.sql:223-249` checks only `NEW.amount_minor <= payments.amount_minor` per row; two Stripe Dashboard refunds each `<=` payment amount but cumulatively `>` would both pass. Stripe's own server-side cap prevents this in practice today (live impact near-zero), but defence-in-depth at the LessonLoop layer is missing.
- **B6.** Webhook orphan-reconciliation branch (`supabase/functions/stripe-webhook/index.ts:903-912`) `continue`s at line 911 before the audit-log INSERT at line 938-952, so no webhook-side audit entry is written when reconciling a pending row left by `stripe-process-refund`. The admin-initiated audit entry written at `supabase/functions/stripe-process-refund/index.ts:196-211` still exists, so evidence is not fully lost, but the reconciliation event itself is invisible in audit_log.
- **B7.** Webhook `recalculate_invoice_paid` failure is logged but not thrown (`supabase/functions/stripe-webhook/index.ts:983-985`). Webhook returns 200 to Stripe with a recorded refund but an un-recalculated `paid_minor`. No retry is triggered by the Stripe infrastructure because 200 signals success.

### Bucket C (design decision)
- **C4.** Partial refund reopens `'paid'` → `'sent'` via the shared recalc (scenario 1 in Section 2c). No intermediate `'partially_paid'` / `'refunded'` status exists. Revisit after Section 6 (invoice lifecycle state machine) — this is a model-shape decision, not a line-level fix.
- **C5.** VAT not prorated on refund (`invoices.tax_minor` not decremented; no per-item/per-refund allocation). Blocks correct HMRC-style credit-note generation. Cross-cuts with C6 and with Xero integration.
- **C6.** Credit-note concept exists in the schema (`invoices.is_credit_note`) and is used by the term-adjustment pipeline, but is not reachable from any refund path. For UK VAT + Xero compliance, refunds should emit a credit-note document with VAT reversal. SPEC.
- **C7.** `claude.md:69` documents `refunds.voided_at` / `voided_by` as present; the DDL (`supabase/migrations/20260224120000_refunds_and_org_settings.sql:6-17`) and generated types (`src/integrations/supabase/types.ts:4350-4380`) disagree. Documentation drift. Decide at fix pass whether to add the columns (for a "refund cancelled before settlement" state) or strike the line from `claude.md`.

### Tracked but not actioned
- Scenario 4 (multi-invoice payment) — model-prohibited; no defect at the refund layer. Modelling question deferred to Section 7.

---

## From Section 3 — Billing run correctness forensics

### Bucket A (fix now)
- ✅ **RESOLVED:** billing run ignored `closure_dates` (commit `9f60d71`).

### Bucket B (fix at end)

#### From Section 3e
- **B10 — No `invoices.created_by` column for manually-created invoices.** Teacher can't attribute who created a manual invoice. (For billing-run invoices, `billing_runs.created_by` is available via FK but isn't surfaced.)
- **B11 — No reminder log table.** Dunning history invisible to the teacher — no record of whether, when, or to whom reminders were sent.
- **B12 — `invoice_items` has no audit trigger.** Line-item edits (description, quantity, unit price, amount) leave no trace in `audit_log` — money changes silently.
- **B13 — `invoices.billing_run_id` FK uses `ON DELETE SET NULL`** (`20260316210000_fix_billing_audit_findings.sql:59-61`), so deleting a billing_run orphans every invoice's provenance forever. Consider changing to RESTRICT, or capture the billing_run metadata inline on the invoice before the delete.

### Bucket C (design decision — post-audit SPEC)

- **C11 — UK bank holiday awareness (HIGH priority SPEC).** No automatic bank holiday data in LessonLoop. Spec needs: (a) data source decision (seed from gov.uk/bank-holidays.json once per year / runtime fetch / npm date-holidays library); (b) four-nation distinction — England+Wales, Scotland, Northern Ireland have different holiday sets; (c) billing-run integration (bank holidays should feed the same closure_dates exclusion already implemented in commit `9f60d71`, or a parallel `bank_holidays` table with the same filter treatment); (d) UX for operators to preview which holidays apply and opt-out per-holiday (some music schools teach on bank holidays by prior agreement); (e) existing-org migration — what happens to orgs that manually entered "Christmas Day" already? Prerequisite: C12 (four-nation field). Blocker today for the UK-native positioning; current marketing page on `marketing-html/features/scheduling/index.html:323` implies this exists.

- **C12 — Four-nation field on `organisations` (SPEC prerequisite to C11).** `organisations.country_code` is `'GB'` — need a refinement (e.g. `organisations.uk_nation` enum: `'england'` / `'wales'` / `'scotland'` / `'northern_ireland'`). Decisions needed: (a) required or optional at signup? (b) default when unknown (England/Wales is most common; auto-detect from billing postcode?); (c) what if an org's teachers span nations — does nation apply to the org as a whole or per-location? Recommendation: per-org default with per-location override, matching the `closure_dates.applies_to_all_locations` pattern already in the schema.

- **C13 — `closure_dates` schema extension: date-range support.** Current schema is single `date` only — an operator closing Mon-Fri needs 5 rows. Low-risk DDL change (add `end_date` nullable column, update filter to handle range overlap). Not a fix today — queue until C11 work as part of the same data-model pass.

#### From Section 3e
- **C17 — SPEC-TRACE-1: Invoice activity timeline UI.** `audit_invoices` trigger captures events but `InvoiceDetail` doesn't render them. Build a timeline component that reads `audit_log` and renders status transitions, edits, reminder sends, payment receipts chronologically. Single biggest differentiator vs MMS — teachers need to show parents "created on X, sent on Y, partially paid on Z" without leaving the app. Pairs with Section 9 (teacher-facing evidence).
- **C18 — SPEC-TRACE-2: Rate provenance on `invoice_items`.** Add a column like `rate_source` enum(`'snapshot'`, `'rate_card_fallback'`, `'manual_override'`) to `invoice_items` or a sibling provenance table. When billing run creates an item, capture which path produced the number. InvoiceDetail renders this on hover/tooltip — "£25 (from rate snapshot captured 14 March)". Closes the loop between the rate-snapshot fix and teacher-facing visibility.
- **C19 — SPEC-TRACE-3: Closure-skip persistence.** Currently `skippedForClosure` is a count in `billing_runs.summary`. Build a `billing_run_skips` table capturing `(billing_run_id, lesson_id, student_id, reason, closure_id)`. InvoiceDetail / run detail shows which specific lessons were skipped and why. Answers "why wasn't 14 Feb billed?" in one click. Becomes load-bearing once C11 (UK bank holidays) multiplies skip volume.
- **C20 — Credit application breakdown on invoice.** `credit_applied_minor` shows a single total. Model + UI need per-credit breakdown (which credit rows applied, dates, amounts, source — refund / make-up / goodwill). Pairs with Section 7 (Family Account / balance brought forward).

---

## From Section 4 — Payment plans + installments

### Bucket A (fix now)
- **A3 — Partial payment against an installment leaves installment-level reminders showing the full amount as owed.** Parent pays £30 of a £50 installment manually. `record_payment_and_update_status` greedy cascade at `supabase/migrations/20260401000000_auth_rls_hardening.sql:79-89` requires `remaining >= inst.amount_minor`; partial amount exits without marking. `paid_minor` is correct (+£30), but the installment stays `'pending'` → `'overdue'` and `overdue-reminders` (`supabase/functions/overdue-reminders/index.ts:59-85`) emails the parent saying "£50 overdue". Parent-facing contradiction: they paid £30 and the product says they owe £50. Fix options: (a) add `invoice_installments.paid_minor` column and compute remaining per-installment; (b) keep full-or-nothing at installment level but change reminder template to show invoice-level outstanding rather than installment amount; (c) auto-resize the next pending installment when a partial lands against it. Decide at fix pass.

### Bucket B (fix at end)
- **B14 — Failed installment infinite retry.** `stripe-auto-pay-installment/index.ts:147-192` logs + emails on card decline but writes no state. No attempt counter, no pause, no plan-halt. Next cron run re-attempts the same installment. A card declined 30 days running sends 30 decline emails and risks Stripe fraud-flagging. Fix: add `invoice_installments.auto_pay_attempts` + `last_auto_pay_attempted_at` + `auto_pay_halted` columns; after N attempts halt the installment auto-pay and surface a badge on the invoice/plan page; single decline email instead of daily.
- **B15 — Auto-pay PaymentIntent creation has no Stripe idempotency key.** `stripe-auto-pay-installment/index.ts:132` creates PIs without `idempotencyKey`. Race window between PI creation and `payments` row insert via webhook allows a second cron run to create a second PI for the same installment. Live-impact likelihood low under normal conditions but magnitude high (duplicate charge). One-line fix: `idempotencyKey: 'auto-pay-' + inst.id` wrapped into `stripeOpts`.
- **B16 — Overdue-reminder cadence is exact-match day number.** `supabase/functions/overdue-reminders/index.ts:241, :337` uses `reminderDays.includes(daysOverdue)`. A missed cron day (outage, weekend scheduling) permanently loses that reminder. A double-fired cron sends duplicate emails (no `last_reminder_sent_at`). Fix: switch to "send if daysOverdue >= threshold AND no reminder sent for this threshold yet", backed by a reminder log (also closes B11 from Section 3e).
- **B17 — `cancel_payment_plan` writes no `audit_log` entry** (`supabase/migrations/20260316350000_payment_plans_phase1.sql:151-207`). DELETE of installment rows + UPDATE of invoice silently. Contrast with `generate_installments` which does log at `20260401000000_auth_rls_hardening.sql:214-217`. Fix: add symmetric `audit_log` INSERT inside `cancel_payment_plan`.

### Bucket C (design decision)
- **C21 — No write-off / forgive-remaining-balance RPC.** Operator's only routes for a partially-paid plan they want to stop are (a) leave as-is, (b) void the entire invoice (losing the "paid 2 installments" narrative from the parent's perspective). Real fee-dispute flows need a third option: mark remaining installments written off, keep paid installments credited, invoice stays open with a visible "£200 written off, £200 outstanding" state. Pairs with Section 6 (invoice lifecycle) and Section 7 (family account).
- **C22 — No invariant check between `SUM(invoice_installments.amount_minor WHERE status != 'void')` and `invoice.total_minor − invoice.paid_minor`.** After any void, manual adjustment, or edit, these can diverge silently. Decide at fix pass whether to add a DB-level CHECK constraint (probably impractical — would RAISE on legitimate void flows), a nightly reconciliation cron, or a one-shot report on the billing-run summary page.
- **C23 — Stripe-paid installments leave `invoice_installments.payment_id` NULL.** `record_stripe_payment` (P2 from Section 1) does not set the `payment_id` FK on the installment row — only `stripe_payment_intent_id`. Teacher asking "which payment covered installment 3" has to join via `payments.installment_id` + `payments.provider_reference`. Fix: P2 should set both, mirroring P1's behaviour. Cross-ref Section 1 C3.

---

## Out-of-audit fixes applied

### Rate snapshot fix (April 17 2026)
- 4 commits on branch `audit/phase-2-billing-forensics`: `c3c0b2d` (trivial paths), `d42b3f4` (term-adjustment), `40137f3` (confirm_makeup_booking migration — NOT YET APPLIED), `2abf1e2` (useLessonForm logging).
- Migration `20260417120000_rate_snapshot_on_confirm_makeup_booking.sql` requires manual Supabase SQL Editor application + `NOTIFY pgrst, 'reload schema';` before the related code paths are deployed.
- Deploy note: treat the four commits as one release — apply SQL first, then deploy frontend together.

### closure_dates billing-run exclusion fix (April 17 2026)
- 1 commit on branch `audit/phase-2-billing-forensics`: `9f60d71`.
- Pure edge-function change, no DDL, no migration required.
- Contradiction handling: closure wins over attendance, warn logged. `skippedForClosure` counter added to run summary for operator visibility.
- Marketing claim at `marketing-html/features/scheduling/index.html:323` still mentions bank holidays — not addressed in this fix (separate decision; see C11).

### Xero OAuth unblock (April 17 2026)
- Issue discovered during Section 3d empirical test: Xero Connect was silently failing after "Allow Access" with PGRST204 `"connected_by" column not found` errors followed by `user_id NOT NULL` violation errors. No UI surface alerted operators. Root cause: `xero_connections` table created outside of version control with schema drift vs code.
- Commits: `5d89594` (accounting.payments scope re-added — empirically confirmed accepted on Xero's side today); [this commit]: migration sync file documenting live DDL.
- Live DDL changes applied via Lovable SQL editor (not in commit because they were hotfixes against live DB first):
  - `ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS connected_by uuid REFERENCES auth.users(id);`
  - `ALTER TABLE xero_connections ALTER COLUMN user_id DROP NOT NULL;`
  - `NOTIFY pgrst, 'reload schema';`
- Empirical result: Connect Xero OAuth round-trip now succeeds. Connection lands in `xero_connections`.
- KNOWN UX ISSUES post-fix (tracked as B8, B9 below):
  - No success toast on Xero connect completion.
  - Redirect post-connect goes to `/settings` (root) instead of preserving `?tab=accounting`, and the URL has a double `?` bug.

### Out-of-audit Bucket B items
- **B8 — Xero connect success toast missing.** After successful OAuth callback, user returns to `/settings?tab=accounting?xero_error=...` but no success toast or visible confirmation that Xero is connected. Surface state is ambiguous. Fix: handle the `xero_success=true` query param in `AccountingTab` or the settings page and show a toast.
- **B9 — Xero connect redirect loses tab state.** Redirect URL after OAuth completion is `/settings?tab=accounting?xero_error=save_failed` — note the double-query-string bug (second `?` instead of `&`). Even when successful, the tab state isn't preserved cleanly. Fix: correct query string construction in `xero-oauth-callback` redirect logic.

### Bucket C items surfaced during fix (not yet actioned)
- **C8.** `rate_cards` audit trigger not implemented despite `docs/AUDIT_LOGGING.md` claim (now corrected to ❌). Need a proper `trg_audit_rate_cards` that captures before-value changes to `rate_amount` so historical rates can be reconstructed — prerequisite for ever completing Option B backfill of NULL `rate_minor` rows, or for any Option C review flow to show the operator the correct historical rate.
- **C9.** `supabase/functions/csv-import-execute/index.ts:736-739` queries non-existent `rate_cards` columns (`duration_minutes`, `amount_per_lesson_minor`) — actual DDL is `duration_mins` / `rate_amount`. Either dead code or silently failing (no error handling on the query). Triage at fix-pass time: delete the block, or repair the column names and wire the result into whatever logic was meant to consume it.
- **C10.** `confirm_makeup_booking` has six superseded migration versions (`20260222233359`, `20260222234306`, `20260223004403`, `20260315200100`, `20260315200300`, `20260316260000`) before the current live body at `20260316270000`, plus the new `20260417120000` from this fix. Consolidate migration debt at a future schema-squash pass.
- **C15 — `xero_connections` schema drift.** Table exists in live DB but has no canonical `CREATE TABLE` migration in `supabase/migrations/`. The sync migration `20260417180000_xero_connections_schema_sync.sql` added today is a snapshot, not the authoritative definition. Session 2 should either (a) write a full authoritative `CREATE TABLE` migration that matches current live state, or (b) audit what other tables/columns have drifted outside version control. Find the original creator and confirm whether Lovable auto-generates these or they were manual.
- **C16 — Silent failure of Xero connect flow was invisible to operators.** For an unknown period, every Xero connect attempt produced an `xero_error=save_failed` URL fragment with no user-visible message. Session 2 should add a comprehensive OAuth error surface (toast / banner / settings page indicator) that reads query params and shows meaningful errors.
