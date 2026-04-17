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
- Bucket A: 0 open / 2 resolved
- Bucket B: 7
- Bucket C: 13
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
_None._

### Bucket C (design decision — post-audit SPEC)

- **C11 — UK bank holiday awareness (HIGH priority SPEC).** No automatic bank holiday data in LessonLoop. Spec needs: (a) data source decision (seed from gov.uk/bank-holidays.json once per year / runtime fetch / npm date-holidays library); (b) four-nation distinction — England+Wales, Scotland, Northern Ireland have different holiday sets; (c) billing-run integration (bank holidays should feed the same closure_dates exclusion already implemented in commit `9f60d71`, or a parallel `bank_holidays` table with the same filter treatment); (d) UX for operators to preview which holidays apply and opt-out per-holiday (some music schools teach on bank holidays by prior agreement); (e) existing-org migration — what happens to orgs that manually entered "Christmas Day" already? Prerequisite: C12 (four-nation field). Blocker today for the UK-native positioning; current marketing page on `marketing-html/features/scheduling/index.html:323` implies this exists.

- **C12 — Four-nation field on `organisations` (SPEC prerequisite to C11).** `organisations.country_code` is `'GB'` — need a refinement (e.g. `organisations.uk_nation` enum: `'england'` / `'wales'` / `'scotland'` / `'northern_ireland'`). Decisions needed: (a) required or optional at signup? (b) default when unknown (England/Wales is most common; auto-detect from billing postcode?); (c) what if an org's teachers span nations — does nation apply to the org as a whole or per-location? Recommendation: per-org default with per-location override, matching the `closure_dates.applies_to_all_locations` pattern already in the schema.

- **C13 — `closure_dates` schema extension: date-range support.** Current schema is single `date` only — an operator closing Mon-Fri needs 5 rows. Low-risk DDL change (add `end_date` nullable column, update filter to handle range overlap). Not a fix today — queue until C11 work as part of the same data-model pass.

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

### Bucket C items surfaced during fix (not yet actioned)
- **C8.** `rate_cards` audit trigger not implemented despite `docs/AUDIT_LOGGING.md` claim (now corrected to ❌). Need a proper `trg_audit_rate_cards` that captures before-value changes to `rate_amount` so historical rates can be reconstructed — prerequisite for ever completing Option B backfill of NULL `rate_minor` rows, or for any Option C review flow to show the operator the correct historical rate.
- **C9.** `supabase/functions/csv-import-execute/index.ts:736-739` queries non-existent `rate_cards` columns (`duration_minutes`, `amount_per_lesson_minor`) — actual DDL is `duration_mins` / `rate_amount`. Either dead code or silently failing (no error handling on the query). Triage at fix-pass time: delete the block, or repair the column names and wire the result into whatever logic was meant to consume it.
- **C10.** `confirm_makeup_booking` has six superseded migration versions (`20260222233359`, `20260222234306`, `20260223004403`, `20260315200100`, `20260315200300`, `20260316260000`) before the current live body at `20260316270000`, plus the new `20260417120000` from this fix. Consolidate migration debt at a future schema-squash pass.
