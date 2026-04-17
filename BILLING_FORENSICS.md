LessonLoop Billing & Invoicing Accuracy Forensics
Branch: audit/phase-2-billing-forensics
Purpose: Prove or break LessonLoop's billing correctness forensically.
Benchmark: "Could a teacher show this invoice to a parent, have the parent challenge the maths, and win?"
Section 1 — Three-path paid_minor consistency audit

Scope: every RPC that mutates `invoices.paid_minor`. Sources read:
- `supabase/migrations/20260401000000_auth_rls_hardening.sql` (latest definition of `record_payment_and_update_status`, plus REVOKEs on the other two)
- `supabase/migrations/20260331160001_record_stripe_payment_paid_guard.sql` (latest definition of `record_stripe_payment`)
- `supabase/migrations/20260316350000_payment_plans_phase1.sql:211-291` (definition of `record_installment_payment`)
- `supabase/migrations/20260316240000_fix_refund_audit_findings.sql:159-216` (latest `recalculate_invoice_paid`, 4th path)
- `supabase/functions/stripe-webhook/index.ts:268, :677, :973` (callers + direct UPDATE path)
- `supabase/functions/stripe-auto-pay-installment/index.ts` (issues PI, does NOT call any RPC itself)
- `src/hooks/useInvoices.ts:335-391` (`useRecordPayment` → Path 1 caller)

Secondary write paths (mentioned for completeness, not scored as one of the 3 primary paths):
- `recalculate_invoice_paid` — called by the webhook post-refund (`stripe-webhook/index.ts:979`) and by `record_manual_refund` (`supabase/migrations/20260331160000_record_manual_refund_rpc.sql:74`). Writes `paid_minor` + status.
- Direct UPDATE in `stripe-webhook/index.ts:973` — on voided invoices during refund handling, bypasses all RPCs and writes `paid_minor` with no FOR UPDATE lock.

────────────────────────────────────────────────────────────

Path 1 — `record_payment_and_update_status` (manual admin payment)

- Definition: `supabase/migrations/20260401000000_auth_rls_hardening.sql:15-117`
- Caller: `src/hooks/useInvoices.ts:357` (`useRecordPayment` mutation, UI-driven)
- paid_minor mutation: line 96 — `UPDATE invoices SET paid_minor = _net_paid` where `_net_paid = SUM(payments.amount_minor) − SUM(refunds.amount_minor WHERE status='succeeded')`.
- Other fields mutated:
  - `invoices.status` → `'paid'` iff `_net_paid >= total_minor` (line 100). No other transitions.
  - INSERT into `payments` with `provider='manual'`, caller-supplied `method`, `currency_code`, `provider_reference` (line 67).
  - INSERT into `audit_log` (`action='payment_recorded'`, full context) (line 105).
  - Cascading greedy `invoice_installments` update: iterates installments by `installment_number ASC`, marks each `'paid'` while remaining payment ≥ installment amount (lines 71-89). Sets `paid_at`, `payment_id`, `updated_at`.
- Side-effects outside RPC: none from Postgres. Caller (`useInvoices.ts:372`) writes a client-side `audit_log` entry (DUPLICATE of the DB-side one) and invalidates React Query caches. No Xero sync, no email.
- Guards:
  - Auth: `is_org_finance_team(auth.uid(), _org_id)` required (line 42). Only path with an explicit in-body auth check.
  - Row lock: `FOR UPDATE` on the invoice (line 47).
  - Status gate: rejects `status IN ('paid','void')` with RAISE (line 50). NB: does NOT reject `'cancelled'`.
  - Over-application: RAISE if `_amount_minor > _outstanding` where `_outstanding = total − existing_paid + refunded` (lines 62-65). This is the ONLY path with an over-application guard.
  - Amount sign: neither positive-minimum nor non-negative check in RPC. Client hook enforces `> 0` and `<= 10_000_000` (`useInvoices.ts:348-352`).
  - Idempotency by provider_reference: NONE. A duplicate manual `provider_reference` is accepted and double-applied (subject to over-application guard).
- Error handling: any RAISE rolls back the full transaction including the payment INSERT and installment cascade.

────────────────────────────────────────────────────────────

Path 2 — `record_stripe_payment` (Stripe webhook: checkout.session.completed, payment_intent.succeeded)

- Definition: `supabase/migrations/20260331160001_record_stripe_payment_paid_guard.sql:7-134` (supersedes `20260316230000_atomic_record_stripe_payment.sql` by adding a `'paid'`-status skip).
- Callers: `supabase/functions/stripe-webhook/index.ts:268` (checkout.session.completed) and `:677` (payment_intent.succeeded).
- paid_minor mutation: two write sites:
  - Idempotent branch: line 78 — `UPDATE invoices SET paid_minor = _net_paid, status = _new_status` (for duplicate `provider_reference`, ensures recalc is fresh).
  - Normal branch: line 124 — same shape after INSERT.
- Other fields mutated:
  - `invoices.status`:
    - → `'paid'` when `_net_paid >= total_minor`.
    - → `'sent'` when previous status was `'paid'` and `_net_paid < total_minor` (refund-aware REOPEN) — unique to this path (lines 71-76, 117-122).
    - Never touches `'void'`/`'cancelled'`.
  - INSERT into `payments` with HARD-CODED `method='card'`, `provider='stripe'`, `installment_id=_installment_id`, `paid_at=NOW()` (line 84). No `currency_code` set (relies on column default/NULL).
  - `invoice_installments`:
    - If `_pay_remaining=true`: blanket UPDATE of every pending/overdue installment → `'paid'` (lines 90-93). Does NOT set `payment_id`.
    - If `_installment_id IS NOT NULL`: UPDATE that installment → `'paid'` + set `stripe_payment_intent_id = _provider_reference` (lines 96-103). Does NOT set `payment_id`.
  - audit_log: NONE. No entry is written by this RPC.
- Side-effects outside RPC: caller (`stripe-webhook/index.ts`) dispatches a `payment_notifications` insert, renders a Resend email, and optionally posts to Xero — none of those are transactional with the paid_minor write.
- Guards:
  - Auth: NONE in function body. Protected only by `REVOKE EXECUTE … FROM authenticated/public` in `20260401000000_auth_rls_hardening.sql:318-319` (service-role bypass only).
  - Row lock: `FOR UPDATE` on the invoice (line 31).
  - Status gate: skips `status IN ('void','cancelled')` by returning `{skipped}` JSON (not a RAISE — caller sees success) (line 38); skips `status='paid'` with `{skipped}` JSON (line 47). NB: this means a legitimate partial top-up on an already-paid invoice is silently dropped.
  - Over-application: NONE. Accepts ANY `_amount_minor` without bounds-checking against outstanding balance.
  - Idempotency: YES — by `provider_reference` uniqueness lookup (lines 51-86). Duplicate returns the existing payment_id and re-runs the recalc (which may silently reopen status).
  - Amount sign: no check.
- Error handling: `RAISE EXCEPTION` only if the invoice is not found (line 34). Everything else returns JSON. The caller (`stripe-webhook/index.ts:277-280`) throws on `rpcError` to force a Stripe retry.

────────────────────────────────────────────────────────────

Path 3 — `record_installment_payment` (defined, but effectively ORPHANED)

- Definition: `supabase/migrations/20260316350000_payment_plans_phase1.sql:211-291`
- Callers: NONE in the repo. Searched `record_installment_payment` across all files: only the definition, the REVOKE in `20260401000000_auth_rls_hardening.sql:307-308`, and the generated type in `src/integrations/supabase/types.ts:6509`. `supabase/functions/stripe-auto-pay-installment/index.ts` creates a PaymentIntent and relies on the `payment_intent.succeeded` webhook to settle it via Path 2 (`stripe-auto-pay-installment/index.ts:134-137` — comment confirms "the webhook will handle recording the payment").
- paid_minor mutation: two write sites:
  - Fully-paid branch: line 276 — `UPDATE invoices SET paid_minor = _net_paid, status = 'paid'`.
  - Partial branch: line 279 — `UPDATE invoices SET paid_minor = _net_paid` (no status change).
- Other fields mutated:
  - `invoice_installments`: single row → `status='paid'`, `paid_at=NOW()`, optional `stripe_payment_intent_id = COALESCE(arg, existing)` (lines 252-256). Does NOT set `payment_id` (schema has the column; see Path 1 line 81).
  - `invoices.status`: → `'paid'` only when BOTH all installments paid AND `_net_paid >= total_minor` (line 275). Never reopens, never touches void/cancelled.
  - INSERT into `payments`: **NONE.** This is the critical defect — the function updates `paid_minor` using `SUM(payments.amount_minor)` (line 259) but never inserts the payment row itself. If this function were ever invoked, `_net_paid` would not include the amount just paid, so the installment would be marked `'paid'` while `paid_minor` under-counts by exactly that installment's amount.
  - audit_log: NONE.
- Side-effects outside RPC: none (no caller to add any).
- Guards:
  - Auth: NONE in function body. Protected only by REVOKE (`20260401000000_auth_rls_hardening.sql:307-308`, service-role bypass only).
  - Row lock: `FOR UPDATE` on both installment (line 231) and invoice (line 242).
  - Status gate: returns `{skipped}` JSON if invoice is `void/cancelled` (line 247); RAISEs if installment status not in `('pending','overdue')` (line 236).
  - Over-application: NONE. Accepts any `p_amount_minor` (though it's never actually inserted).
  - Idempotency by provider_reference/PI id: NONE — relies only on the installment status check.
- Error handling: RAISE for missing installment / parent invoice / non-payable status. Otherwise returns JSON.

────────────────────────────────────────────────────────────

Comparison matrix

Columns: P1 = record_payment_and_update_status, P2 = record_stripe_payment, P3 = record_installment_payment.

| Field / behaviour                                   | P1                            | P2                                          | P3                                  |
|-----------------------------------------------------|-------------------------------|---------------------------------------------|-------------------------------------|
| Writes `invoices.paid_minor`                        | ✓ (line 96)                   | ✓ (lines 78, 124)                           | ✓ (lines 276, 279)                  |
| In-body auth check                                  | ✓ `is_org_finance_team`       | ✗ (REVOKE only)                             | ✗ (REVOKE only)                     |
| `FOR UPDATE` lock on invoice                        | ✓                             | ✓                                           | ✓                                   |
| `FOR UPDATE` lock on installment                    | ✗                             | ✗                                           | ✓                                   |
| Over-application guard                              | ✓ RAISE                       | ✗                                           | ✗                                   |
| Idempotency by `provider_reference`                 | ✗                             | ✓                                           | ✗ (no PI id lookup)                 |
| Skips on `status='void'`/`'cancelled'`              | RAISE on void (not cancelled) | JSON skip both                              | JSON skip both                      |
| Skips on `status='paid'`                            | RAISE                         | JSON skip                                   | No explicit check                   |
| Reopens `'paid'` → `'sent'` on net<total            | ✗                             | ✓                                           | ✗                                   |
| Transitions to `'paid'`                             | ✓                             | ✓                                           | ✓                                   |
| INSERT into `payments`                              | ✓ with caller-supplied method | ✓ hard-coded `card`/`stripe`                | **✗ (DEFECT)**                      |
| Sets `payments.currency_code`                       | ✓                             | ✗ (omitted from INSERT)                     | N/A (no INSERT)                     |
| Installment reconciliation                          | ✓ greedy cascade              | ✓ single id or blanket `_pay_remaining`     | ✓ single installment only           |
| Sets `invoice_installments.payment_id`              | ✓                             | ✗                                           | ✗                                   |
| Sets `invoice_installments.stripe_payment_intent_id`| ✗                             | ✓ (only if `_installment_id` passed)        | ✓ (via COALESCE on arg)             |
| `audit_log` entry written                           | ✓                             | ✗                                           | ✗                                   |
| Xero / accounting sync                              | ✗                             | ✗ (handled in webhook caller, non-atomic)   | ✗                                   |
| Email dispatch                                      | ✗                             | ✗ (handled in webhook caller, non-atomic)   | ✗                                   |
| Return shape includes `payment_id`                  | ✓                             | ✓                                           | ✗ (returns installment_id)          |
| Return shape includes `new_status`                  | ✓                             | ✓                                           | ✓                                   |
| Return shape includes `total_refunded`              | ✓                             | ✗                                           | ✗                                   |
| Reachable from app code                             | ✓ (`useInvoices.ts:357`)      | ✓ (webhook x2)                              | **✗ (orphan)**                      |

────────────────────────────────────────────────────────────

Inconsistency register — intentional vs defect, with severity

1. **Path 3 never inserts into `payments`** (no caller today, but if ever invoked, `paid_minor` under-counts by the installment amount while the installment flips to `'paid'`). Defect. **CRITICAL.** Defined and callable by service role.
2. **Orphaned Path 3** — defined, REVOKEd, typed into `src/integrations/supabase/types.ts`, but zero callers. Defect (dead code with a latent CRITICAL bug). **HIGH.**
3. **No over-application guard on P2 or P3** — a Stripe webhook replay with a tampered `amount` (or any service-role caller of P3) can push `paid_minor` above `total_minor`. Status flips to `'paid'` regardless. Defect. **HIGH.**
4. **No `audit_log` entry on P2 or P3** — parents challenging a Stripe-paid invoice have no DB-level trail (the UI hook writes one for P1 only). The webhook does write separate `refund_recorded` audit entries on refund (line 936ff) but NOT payment_recorded. Teacher-facing evidence gap. Defect. **HIGH.**
5. **Status-reopen only on P2** — P2 can transition `'paid'` → `'sent'` when a subsequent recalc shows net<total, but P1 RAISEs on `'paid'` and P3 never reopens. Creates divergent semantics for "same invoice, same net, different path". Intentional on P2 (baked into refund flow) but inconsistent. **MEDIUM.**
6. **Installment reconciliation strategies differ three ways** — P1 greedy-cascades by `installment_number`, P2 uses either `_installment_id` or a blanket flag, P3 updates one installment. An org that mixes manual + Stripe payments on a plan can end up with installments marked inconsistently vs. `paid_minor`. Intentional per-path, but no test covers the cross-path interaction. **MEDIUM.**
7. **Direct UPDATE path bypass** — `stripe-webhook/index.ts:973` writes `paid_minor` directly (void-invoice refund case) with no `FOR UPDATE` lock and no RPC. Race with concurrent refund/recalc possible. Defect. **MEDIUM.**
8. **`payments.currency_code` not set on P2 inserts** — P2's INSERT omits the column (line 84), so multi-currency orgs get `NULL` on Stripe payment rows while manual rows carry the code. Defect. **MEDIUM.**
9. **`invoice_installments.payment_id` only set by P1** — P2/P3 leave it NULL, so a teacher auditing "which payment settled which installment" has no link for Stripe-paid plans. Defect. **MEDIUM.**
10. **Cancelled-status handling differs** — P1 RAISEs on `'paid'` and `'void'` but silently accepts `'cancelled'` (line 50 only lists two states); P2 & P3 both skip void+cancelled. Defect on P1. **MEDIUM.**
11. **Return-shape divergence** — fields present differ across P1/P2/P3 (no `total_refunded` on P2/P3, no `payment_id` on P3). Intentional but makes a future unified caller fragile. **LOW.**
12. **Amount-sign check** — none of the three RPCs reject negative or zero amounts at the DB level; only P1's client hook enforces `>0`. A service-role caller could pass negative values. **LOW.**

Severity tally: 1 CRITICAL, 3 HIGH, 6 MEDIUM, 2 LOW.

## Clarification — finding #1 (P3 "never inserts into payments") live-impact vs latent-impact

The original CRITICAL rating and the HIGH "orphaned" rating do point in opposite directions on live impact. To resolve:

1. **Is P3 reachable in production today?** No. A repo-wide grep for `record_installment_payment` (case-insensitive) returns only: the function definition (`20260316350000_payment_plans_phase1.sql:211`), the two REVOKE statements (`20260401000000_auth_rls_hardening.sql:307-308`), and the generated TypeScript binding (`src/integrations/supabase/types.ts:6509`). No edge function, React hook, trigger body, `pg_cron` job, or serverless cron invokes it. `supabase/functions/stripe-auto-pay-installment/index.ts:135` explicitly comments "The webhook will handle recording the payment" and routes settlement through P2.
2. **What path would reach it?** None today. The only actor technically able to invoke it is the service role (REVOKE removed authenticated/public but service role bypasses REVOKE), and no service-role code does so.
3. **What would have to change for it to fire?** Any one of: (a) a developer adding `supabase.rpc('record_installment_payment', …)` — it surfaces in IDE autocomplete via the generated types; (b) the `stripe-auto-pay-installment` edge function being refactored to settle synchronously instead of awaiting the webhook (a natural optimisation); (c) a future migration un-revoking and exposing it to a UI-driven "mark installment paid manually" control.
4. **Correct rating.** Live production impact today: none. Latent impact if invoked: silent under-count of `paid_minor` by the full installment amount while the installment flips to `'paid'` — teacher- and parent-visible accounting error. This is exactly the "wired up and one line away" case. The CRITICAL tag is retained on that basis: the defect is loaded, the trigger is a single line of code anyone with DB autocomplete can write, and the generated-types file actively invites it. The HIGH "orphaned" finding is the *pre-condition that keeps the CRITICAL from firing* — they are not double-counted; they describe two ends of the same fuse.


## Section 2 — Refund + void semantics

### Manual refund path (`record_manual_refund` RPC)

- **Definition:** `supabase/migrations/20260331160000_record_manual_refund_rpc.sql:7-92`. `SECURITY DEFINER`, `GRANT EXECUTE … TO authenticated` at line 91.
- **Auth:** `is_org_finance_team(auth.uid(), _org_id)` required (line 28); RAISEs otherwise.
- **Row locks:** `FOR UPDATE` on the payment (line 37) and the invoice (line 45).
- **Status gates:** RAISE on invoice `status='void'` (line 48) and `status='draft'` (line 49). `'cancelled'`, `'paid'`, `'sent'`, `'overdue'`, `'partially_paid'` are NOT rejected by this RPC.
- **Refundable calculation:** `_max_refundable = payment.amount_minor − SUM(refunds WHERE payment_id=this AND status='succeeded')` (lines 52-56). Scoped to *this one payment*, not to invoice-wide refunds. RAISE if `_max_refundable <= 0` (line 58), if requested amount `<= 0` (line 63), or if requested amount > `_max_refundable` (line 64). Default behaviour when `_amount_minor IS NULL` is a full refund of `_max_refundable` (line 62).
- **Effect on `invoices.paid_minor`:** not mutated directly by this RPC. Mutation is delegated to `recalculate_invoice_paid(_invoice_id)` via `PERFORM` at line 74. That function (`supabase/migrations/20260316240000_fix_refund_audit_findings.sql:159-216`) recomputes `_net_paid = SUM(payments.amount_minor) − SUM(succeeded refunds.amount_minor)` (lines 189-195) and writes `UPDATE invoices SET paid_minor = _net_paid, status = _new_status` at line 208.
- **Effect on invoice status (paid → sent revert):** fires here indirectly, inherited from `recalculate_invoice_paid` lines 199-206. If previous status was `'paid'` and new `_net_paid < total_minor`, status transitions to `'sent'`. Never transitions `'void'`/`'cancelled'`. The manual-refund RPC itself has no status transition logic.
- **Rows written:**
  - `refunds` row: **yes** — INSERT at lines 69-71 with `status='succeeded'` (not `'pending'`; no external API call so it commits final), `stripe_refund_id` omitted (NULL), `refunded_by = auth.uid()`.
  - `payments` (negative): **no** — this path does not create a negative/reversal payment row; the refunds row is the only ledger artefact.
  - validator: the BEFORE-insert trigger `validate_refund_amount` (`20260316240000_fix_refund_audit_findings.sql:223-249`) fires here too; it only checks `NEW.amount_minor <= payments.amount_minor` for this single payment (cumulative refund total is not re-checked at the trigger level — that check lives in the RPC at line 64).
- **`refunds.voided_at` / `voided_by` lifecycle:** none. These columns **do not exist** on the `refunds` table per the DDL at `supabase/migrations/20260224120000_refunds_and_org_settings.sql:6-17`, and are absent from the generated types at `src/integrations/supabase/types.ts:4350-4380`. No migration adds them. `claude.md:69` documents their existence but this is incorrect — a documentation drift finding, not a runtime artefact of this path.
- **Audit log:** yes — INSERT at lines 77-80 with `action='manual_refund_recorded'`, entity_type `'invoice'`, `actor_user_id = auth.uid()`, and a JSONB payload containing `refund_id`, `payment_id`, `amount_minor`, `reason`.
- **Error handling / rollback:** every RAISE rolls back the full transaction (refunds INSERT + recalc UPDATE + audit INSERT). No partial commit possible.

### Stripe webhook refund path (`charge.refunded` branch)

- **Definition:** `supabase/functions/stripe-webhook/index.ts:856-988` — function `handleChargeRefunded`. Dispatched from the webhook event switch at line 156-158 (`case "charge.refunded"`). Runs under service role; the webhook itself is authenticated by Stripe signature verification upstream.
- **Auth:** no in-body auth check. Protection is the Stripe signature check at the webhook entry point (above line 856) and the service-role key that bypasses RLS. No `is_org_finance_team` call. No per-user identity — `auth.uid()` is NULL inside this handler.
- **Row locks:** none explicit. `FOR UPDATE` is only applied later if `recalculate_invoice_paid` is invoked (see below). The initial payment lookup uses `.maybeSingle()` (line 868) with no lock.
- **Status gates:** none blocking. The handler does NOT refuse to record a refund on any invoice status. Instead it branches *after* writing the refund rows:
  - Lookup at lines 957-958 reads `invoices.status`.
  - If status is `'void'`: direct `UPDATE invoices SET paid_minor = netPaid` at line 973 with no status change, and `recalculate_invoice_paid` is **skipped**. No FOR UPDATE lock on this path.
  - Otherwise: calls `recalculate_invoice_paid(_invoice_id)` via `rpc()` at line 979.
- **Refundable calculation:** **none performed in this handler.** No cumulative check against payment amount, no comparison to prior refunds on the same payment. Protection relies on two lower-level safeties: (a) the unique index on `refunds.stripe_refund_id` (DDL at `supabase/migrations/20260224120000_refunds_and_org_settings.sql:37`); (b) the BEFORE-insert trigger `validate_refund_amount` (`supabase/migrations/20260316240000_fix_refund_audit_findings.sql:223-249`) which checks `NEW.amount_minor <= payments.amount_minor` only — not cumulative.
- **Effect on `invoices.paid_minor`:** two write sites depending on invoice status. On non-void invoices: delegated to `recalculate_invoice_paid` (same RPC and same formula as the manual path — line 208 of `20260316240000_fix_refund_audit_findings.sql`). On void invoices: direct UPDATE at line 973 using `netPaid = SUM(payments.amount_minor) − SUM(refunds WHERE status='succeeded')` computed in TypeScript (lines 961-972), no RPC, no row lock. This is the same bypass flagged as finding B4 in Section 1.
- **Effect on invoice status (paid → sent revert):** fires via `recalculate_invoice_paid` on non-void invoices (same rule: was `'paid'` and net < total → `'sent'`). On void invoices: status is held at `'void'` — the bypass UPDATE explicitly omits the status column.
- **Rows written:**
  - `refunds` row: **yes**, one INSERT per element of `charge.refunds.data` (lines 916-927), preceded by two idempotency branches:
    - **Exact-replay idempotency (lines 879-888):** SELECT by `stripe_refund_id`; if found, `continue` without INSERT.
    - **Orphaned-pending reconciliation (lines 893-912, REF-M1):** SELECT for `payment_id + amount + status='pending' + stripe_refund_id IS NULL` (at most 1). If found, UPDATE that row with `stripe_refund_id` + mapped status instead of INSERTing — this reconciles rows left pending by `stripe-process-refund` when its post-Stripe DB update failed.
  - Column values on INSERT: `refunded_by = null` (line 926, explicit — REF-H4), `stripe_refund_id = refund.id` (line 925), `status` mapped from Stripe at line 915 (`"succeeded"` | `"failed"` | `"pending"`), `reason = refund.reason || "Refund via Stripe Dashboard"` (line 923).
  - Backstop: if INSERT raises `23505` (unique violation on `stripe_refund_id`), line 930-931 logs and continues silently. No partial rollback.
  - `payments` (negative): **no** — this path does not create a negative/reversal payment row.
- **`refunds.voided_at` / `voided_by` lifecycle:** same as the manual path — these columns do not exist on the `refunds` table per DDL at `supabase/migrations/20260224120000_refunds_and_org_settings.sql:6-17` and are absent from the generated types at `src/integrations/supabase/types.ts:4350-4380`. No lifecycle to describe. `claude.md:69` still misdocuments them as present.
- **Audit log:** yes, but **partial** — an audit_log INSERT fires per refund at lines 938-952 with `action='refund_recorded'`, `actor_user_id = null`, `entity_type='invoice'`. However the orphan-reconciliation branch (lines 903-912) `continue`s at line 911 *before* reaching the audit block, so when this handler reconciles a pending row written by `stripe-process-refund`, no webhook-side audit entry is created. (The original audit_log `'refund_processed'` entry written by `stripe-process-refund` at lines 196-211 of `supabase/functions/stripe-process-refund/index.ts` does still exist from the admin-initiated flow in that case.) For refunds initiated via Stripe Dashboard (no prior pending row) the audit entry IS written.
- **Error handling / rollback:** no transaction boundary — each DB call is a separate HTTP-RPC round-trip. A failure in `refunds` INSERT is caught and logged but the loop continues with the next refund. A failure in the audit INSERT (lines 938-952) is not inspected. A failure in `recalculate_invoice_paid` (line 983-985) is logged as `console.error` but not thrown, so the webhook returns 200 to Stripe with an un-recalculated invoice.

### Path comparison — manual RPC vs Stripe webhook

| Field / behaviour                                      | Manual RPC (`record_manual_refund`)                 | Stripe webhook (`handleChargeRefunded`)                 |
|--------------------------------------------------------|-----------------------------------------------------|---------------------------------------------------------|
| Location                                               | migration `20260331160000_record_manual_refund_rpc.sql:7-92` | edge fn `supabase/functions/stripe-webhook/index.ts:856-988` |
| Execution context                                      | SQL `SECURITY DEFINER` (single txn)                 | Deno edge function, multiple RPC round-trips (no txn)   |
| Auth model                                             | `is_org_finance_team(auth.uid())`                   | Stripe signature + service role; `auth.uid()` is NULL   |
| `FOR UPDATE` on payment/invoice                        | Yes (lines 37, 45)                                  | No (explicit lock only inside recalc RPC, if reached)   |
| Invoice status gate (pre-write)                        | RAISEs on `void`, `draft`                           | None — branches post-write based on status              |
| Refundable cumulative check                            | Yes, in RPC (line 52-66, per-payment)               | None in handler — relies on unique index + validator trigger |
| `refunds` row status on INSERT                         | Always `'succeeded'`                                | Mapped from Stripe (`succeeded`/`failed`/`pending`)     |
| `refunds.refunded_by`                                  | `auth.uid()` (line 70)                              | `null` (line 926, REF-H4)                               |
| `refunds.stripe_refund_id`                             | NULL                                                | Set from `refund.id` (line 925)                         |
| Idempotency on replay                                  | None                                                | Two-layer: `stripe_refund_id` SELECT + orphan reconcile |
| Creates negative `payments` row                        | No                                                  | No                                                      |
| `paid_minor` write mechanism                           | Always via `recalculate_invoice_paid` (line 74)     | Via RPC if non-void; direct `UPDATE` bypass if void (line 973) |
| Status revert `paid` → `sent`                          | Yes (via recalc)                                    | Yes on non-void; suppressed on void                     |
| `audit_log` entry                                      | Yes (`manual_refund_recorded`, actor=uid)           | Yes (`refund_recorded`, actor=null) — but skipped on orphan-reconciliation branch |
| `refunds.voided_at` / `voided_by` lifecycle            | N/A (columns absent)                                | N/A (columns absent)                                    |
| Rollback semantics                                     | Full txn rollback on any RAISE                      | Per-call; failures logged, loop continues               |

Fields that differ between paths: **13** of the 14 rows above (only "creates negative `payments` row" is identical).

### Walked scenarios

**1. Partial refund £30 on £100 paid invoice**
- Pre-state: `total_minor=10000`, `paid_minor=10000`, `status='paid'`.
- Write: refunds row `amount_minor=3000, status='succeeded'` via either path.
- Recalc (`supabase/migrations/20260316240000_fix_refund_audit_findings.sql:189-208`): `_total_paid=10000`, `_total_refunded=3000`, `_net_paid=7000`. Previous status `'paid'` and `_net_paid < total_minor` triggers the reopen branch at line 202-204 → `_new_status='sent'`. UPDATE at line 208 writes `paid_minor=7000, status='sent'`.
- **Outcome:** family balance displays as paid £70, outstanding £30; invoice status reopens to `'sent'`. The parent who was just refunded £30 becomes the recipient of a new £30 balance-due signal (and of any downstream dunning if the original due_date has passed — Section 5 will revisit).
- **Severity: MEDIUM.** The reopen is numerically correct (they do owe £30 again relative to the unchanged total), but no "partially_paid" / "refunded" intermediate state exists in the status machine, so every partial refund degrades the invoice back to the pre-payment state. The behaviour is consistent across both refund paths (inherited from the shared recalc).

**2. Refund-after-void (Stripe webhook arrives after invoice is already voided)**
- Pre-condition: to reach a paid-and-voided state the operator must refund first (which reopens `'paid'` → `'sent'` per scenario 1), then call `void_invoice`. `supabase/migrations/20260315220002_void_invoice_clear_billing_markers.sql:20-22` RAISEs if `status IN ('paid','void')`, so a direct void of a paid invoice is not possible through the RPC.
- Event: second `charge.refunded` webhook arrives (e.g. another refund from the Stripe Dashboard).
- Handler flow (`supabase/functions/stripe-webhook/index.ts:856-988`): stripe_refund_id idempotency (lines 879-887) doesn't match a new refund, so INSERT proceeds at lines 916-927 (the `validate_refund_amount` trigger at `20260316240000_fix_refund_audit_findings.sql:223-249` checks only against the single payment's amount, which still passes). Audit log written at lines 938-952.
- Post-process: invoice status read at line 958 → `'void'` → branch at lines 959-975 fires: `UPDATE invoices SET paid_minor = netPaid` with netPaid computed in TypeScript, **no row lock, no status change, `recalculate_invoice_paid` RPC skipped**.
- **Outcome:** the refunds row is recorded and `paid_minor` decreases on the voided invoice; status stays `'void'`. No corruption of the ledger, but the write takes the non-atomic bypass path.
- **Severity: MEDIUM.** Functionally correct but reuses the line-973 bypass already flagged as Section 1 finding B4. A concurrent refund+payment race (rare in practice on a voided invoice) would be unlocked.

**3. Double `charge.refunded` webhook delivery (Stripe retry)**
- First delivery: `handleChargeRefunded` iterates `charge.refunds.data`. Each refund SELECT by `stripe_refund_id` at lines 879-883 returns nothing; INSERT succeeds at lines 916-927.
- Second delivery (retry): same loop. SELECT at line 879-883 now finds the row; line 885-887 `continue`s without INSERT.
- Backstop if the SELECT races: unique index on `refunds.stripe_refund_id` at `supabase/migrations/20260224120000_refunds_and_org_settings.sql:37`. INSERT would fail with `23505` → caught at line 930-931 (`"Duplicate refund prevented"`) and the loop continues.
- After the loop: `recalculate_invoice_paid` runs again (line 979), but it recomputes from `SUM(payments)` and `SUM(refunds)`, so a duplicate call is mathematically idempotent.
- **Outcome:** one refunds row, one paid_minor update per Stripe refund, regardless of webhook retry count.
- **Severity: NONE.** Correctly guarded at two independent layers (SELECT-check + unique index).

**4. Refund of a payment covering multiple invoices**
- Model check: `supabase/migrations/20260224120000_refunds_and_org_settings.sql:8-9` declares `payment_id uuid NOT NULL` and `invoice_id uuid NOT NULL` on refunds — each refund is pinned to exactly one payment and one invoice. The payments table itself is written with a single `invoice_id` in every INSERT site (e.g. `20260401000000_auth_rls_hardening.sql:67`, `20260331160001_record_stripe_payment_paid_guard.sql:89`). There is no `payment_allocations` table and no join table linking payments to multiple invoices.
- **Outcome:** the scenario is structurally impossible in the current model. A single Stripe/manual payment always settles one invoice. Cross-invoice settlement would require issuing separate payments or using the Family Account balance-brought-forward mechanism (Section 7).
- **Severity: NONE** at the refund layer. Modelling limitation is a SPEC question for Section 7.

**5. VAT + discount + refund integer rounding drift**
- VAT applied at invoice creation: `_tax_minor := ROUND(_subtotal * _org.vat_rate / 100.0)` at `supabase/migrations/20260223004118_531ed3d7-2efc-46df-a553-6684491267e2.sql:85`. Total: `_total_minor := GREATEST(0, _subtotal + _tax_minor - _credit_offset)` at line 105. All integer minor units; the only floating operation is the division inside `ROUND`, and the result is immediately cast back to integer.
- Worked example: subtotal 8333, vat_rate 20 → `_tax_minor = ROUND(8333 * 0.2) = 1667`, `_total_minor = 8333 + 1667 − 0 = 10000`. Pay 10000 → `paid_minor=10000`.
- Partial refund 3000: refunds row `amount_minor=3000` integer. `_net_paid = 10000 − 3000 = 7000` integer. No float anywhere in the refund arithmetic path.
- VAT allocation on refund: **none.** The invoice's `tax_minor` is not decremented, and no per-line / per-refund VAT split is stored. A £30 refund against an invoice whose VAT component is £16.67 does not record "£5 VAT refunded, £25 net refunded"; it records one `amount_minor=3000` row against the parent payment only.
- **Outcome:** integer arithmetic is drift-free (no float carrying). The failure mode is semantic, not numerical: for VAT-registered orgs, HMRC expects a refund to be paired with a credit note that proportionally reverses output VAT — LessonLoop produces the cash movement but not the VAT adjustment.
- **Severity: MEDIUM (semantic / compliance).** No arithmetic drift; no NONE either — the missing VAT proration is a real gap for any org where VAT is enabled. This overlaps with the credit-note SPEC question deferred to 2d.

### Credit notes

**Partial — a narrow credit-note concept exists but is NOT integrated with the refund/void flow.** Evidence:
- `invoices.is_credit_note boolean` column is referenced by `supabase/migrations/20260315220007_fix_invoice_items_check_credit_notes.sql:1-30` and by the term-adjustment pipeline at `supabase/functions/process-term-adjustment/index.ts:379, 393`. Invoices flagged `is_credit_note=true` may carry negative `invoice_items.unit_price_minor` / `amount_minor` (enforced by the trigger `check_invoice_item_amounts` at lines 16-30 of that migration).
- **Scope:** only the term-adjustment flow creates these. No RPC or edge function converts a refund into a credit note; none of `record_manual_refund`, `stripe-process-refund`, or `handleChargeRefunded` references `is_credit_note`.
- **No linkage:** there is no foreign key from `refunds` to `invoices` where `is_credit_note=true`, no "credit_note_id" on refunds, no Xero export payload field mapping refunds to credit-note documents. The refund paths write a refunds row + recalc `paid_minor` and nothing else.

**Flag as SPEC.** For UK VAT-registered orgs and any org integrating with Xero/QuickBooks, HMRC and accounting convention expect a refund to be paired with a **credit note document** that (a) carries its own invoice-like identifier, (b) proportionally reverses output VAT on the original invoice, (c) appears in the sales ledger as a negative sales entry, and (d) is exportable as a distinct accounting artefact. LessonLoop today produces the cash movement (refunds row → `paid_minor` adjustment) but not the credit-note document, and the partial `is_credit_note` plumbing used for term adjustments is not reachable from the refund flow. The current shape forces teachers into ad-hoc void-and-reissue cycles (limited further by `void_invoice` refusing to act on paid invoices, per `20260315220002_void_invoice_clear_billing_markers.sql:20-22`), which breaks the audit trail a parent or HMRC inspector would expect to see. Cross-cutting; queued as a Bucket-C design decision.
## Section 3 — Billing run correctness forensics

### Dedup logic

- **Primary dedup: application-level overlap query** at `supabase/functions/create-billing-run/index.ts:234-242`: `SELECT FROM billing_runs WHERE org_id = :org AND status != 'failed' AND start_date <= :body.end_date AND end_date >= :body.start_date LIMIT 1`. On match → HTTP 409 at lines 244-255, error message exposes the existing run's `start_date` and `end_date`.
- **Fallback dedup: unique index** at `supabase/migrations/20260220012039_2c0d5fca-e98d-410a-a75a-289af080d587.sql:2-4`: `CREATE UNIQUE INDEX idx_billing_runs_no_duplicate ON billing_runs (org_id, start_date, end_date) WHERE status != 'failed'`. INSERT code catches Postgres `23505` at `create-billing-run/index.ts:274-286` and returns 409.
- **Overlap edge walk:** a user creates a March 1-31 run, then submits March 1-15. The overlap query at lines 234-242 matches because `Mar 1 <= Mar 15` AND `Mar 31 >= Mar 1`. The second request is BLOCKED with 409 and the existing range is echoed back in the error body.
- **Gap 1 (race condition, MEDIUM):** the overlap check is a SELECT followed by an unrelated INSERT — there is no `FOR UPDATE`, advisory lock, or serialisable isolation. The unique index that catches inserts (line 2-4 of the migration) is on **exact** `(org_id, start_date, end_date)`, not an `EXCLUDE USING GIST` range-overlap constraint. Two concurrent requests with overlapping-but-not-identical dates (e.g. Mar 1-31 and Mar 5-25) pass the SELECT at the same moment, both INSERTs succeed because the index tuples differ, and the org ends up with two overlapping runs — producing double-billing for lessons in the overlapping window. Requires concurrent operator clicks; rare but not impossible in agency orgs with multiple admins.
- **Gap 2 (`status != 'failed'` exclusion, informational only):** both the overlap query (line 239) and the unique index WHERE clause exclude `status='failed'`. A previously-failed run for the same window does not block a fresh submission. Intentional — it's how the main flow supports resubmission after a hard failure (distinct from `handleRetry` which targets specific payers inside an existing run). Not a defect.

### Per-student loop failure handling

- **Loop shape reality-check:** there is **no per-student loop** in the invoice-writing path. The code groups lessons by payer, computes all invoice rows in memory (`create-billing-run/index.ts:695-728`), then issues **one batch `INSERT ... SELECT`** to `invoices` (lines 732-735) followed by **one batch insert** to `invoice_items` (lines 772-774). Dedup at the lesson level (already-billed `linked_lesson_id` + `student_id` pairs) happens earlier at lines 539-547 — that is per-student, but the write is batch-all-or-batch-nothing.
- **Failure on batch invoice insert (lines 737-747):** any DB error (FK violation, NOT NULL miss, trigger rejection) aborts the whole `.insert(allInvoiceRows)` call. Every payer in `payerItemsMap` is pushed to `failedPayers` with the **same** error message (line 745: `error: invoiceError.message || "Invoice creation failed"`). No row-level isolation.
- **Failure on batch items insert (lines 775-791):** if the invoices INSERT succeeded but items INSERT fails, the code splices all `invoiceIds` out, hard-DELETEs every invoice just created (line 780), resets `totalAmount = 0` (line 782), and pushes every payer into `failedPayers` with error `"Failed to create invoice items"` (lines 783-791). All-or-nothing rollback within the batch.
- **Unexpected exception (lines 345-365):** outer try/catch deletes all invoices linked to the billing_run_id and marks the run `status='failed'`. Returns 500 with the billing_run_id.
- **Summary returned to caller:** `create-billing-run/index.ts:318-330` returns `{ invoiceCount, totalAmount, invoiceIds, skippedLessons, skippedForCancellation, skippedStudents?, failedPayers? }`. Status determined at lines 311-316: `completed` if failedCount=0, `partial` if `failedCount < totalPayers`, else `failed`.
- **Reachability of `partial` status via the batch path:** effectively unreachable. Because the two batch inserts are all-or-nothing, `failedCount` is either 0 (both batches succeed) or equal to `totalPayers` (one batch fails). The `partial` status is only reachable indirectly via `skippedStudents` — a distinct channel at line 631 for students who have no payer mapping — and those are tracked separately in the summary, not counted into `failedCount`. Severity **LOW (cosmetic)**: the three-state status enum implies mid-run partial success, but the code cannot actually produce that state from batch failures.
- **Retry in place:** yes — `handleRetry` at lines 368-462 re-invokes `executeBillingLogic` with a `retryPayerIds: Set<string>` filter applied at line 640 (`if (retryPayerIds && !retryPayerIds.has(payerId)) return;`). Summary is merged at lines 435-445 (invoice_ids appended, totals added, failedPayers overwritten with the still-failing subset). Retry subset is itself batch-all-or-nothing.
- **No recreate-required path observed.** A failed main run transitions to `status='failed'` (line 355) and is excluded from future overlap checks, so a fresh submission for the same window is allowed without deleting the failed record.
- **Defects:**
  - **BIL-per-student-1 (MEDIUM):** All-or-nothing batch semantics. One bad row (e.g. a guardian soft-deleted mid-run, a FK that resolves to a row now missing, a CHECK trigger violation on a single invoice) fails every payer in the run. For an agency with 200 payers the operator sees 200 entries in `failedPayers`, all with the identical DB error message. Root-cause diagnosis requires reading server logs; the UI surface is uninformative.
  - **BIL-per-student-2 (LOW):** `failedPayers` entries all receive the same `invoiceError.message` (line 745) regardless of which row triggered the failure. A parent asking a teacher "why wasn't my child billed?" gets a generic DB error unrelated to their student.
  - **BIL-per-student-3 (LOW):** `partial` status is cosmetically misleading — it is unreachable from batch failures and only fires from the orthogonal `skippedStudents` channel. The documented three-state enum implies more granularity than the code can deliver.

### Rate snapshot vs live rate

- **Column:** `lesson_participants.rate_minor integer` added as nullable (`supabase/migrations/20260315083032_b42e8c3a-ec2b-45e0-9bfb-54ef2be9c0f6.sql:1`, `DEFAULT NULL`). No backfill migration. `claude.md:59` documents it as "captured at lesson creation, preserved on edit".
- **Billing-run read path:** `supabase/functions/create-billing-run/index.ts:656` maps `snapshotRate: lp.rate_minor ?? null` per participant. Rate resolution at lines 696-704: `if (snapshotRate != null && snapshotRate > 0) return snapshotRate;` — otherwise falls through to `findRateForDuration(durationMins, rateCards, fallbackRate)` (`:50-61`), which uses the **live** `rate_cards` rows at that moment. So the snapshot is preferred **only when non-null and positive**.
- **Snapshot coverage — partial:** only two paths reliably persist `rate_minor`:
  - Primary lesson form (`src/components/calendar/useLessonForm.ts:535-567` for updates and `:740-759` for initial creation) reads `rate_cards` and includes `rate_minor` in the INSERT via `...(rate != null ? { rate_minor: rate } : {})`. If the rate_cards fetch throws (try/catch at line 550, 744), the spread silently omits the column — no snapshot written, no warning.
  - `materialise_continuation_lessons` (`supabase/migrations/20260316250000:133`) passes `rate_minor` explicitly from the caller.
- **Snapshot coverage — GAP:** every other INSERT into `lesson_participants` omits `rate_minor`, leaving it NULL:
  - Quick-create popover: `src/components/calendar/QuickCreatePopover.tsx:156-160` inserts `{org_id, lesson_id, student_id}` only.
  - Make-up booking confirmation: `supabase/migrations/20260315200100_fix_redeem_credit_on_makeup_booking.sql:78` — `INSERT INTO lesson_participants (lesson_id, student_id, org_id)` only.
  - Waitlist dismiss / matcher: `supabase/migrations/20260315200300_fix_dismiss_other_matched_waitlist.sql:80`, `20260316270000_fix_waitlist_audit_findings.sql:92`.
  - Credit-related triggers: `20260316260000_fix_voided_credits_audit.sql:110`, `20260223004403_db64b3c5-...sql:74`.
  - Earlier schema migrations: `20260222233359_...sql:65`, `20260222234306_...sql:253`.
  - Any lesson created or participant added via these paths has `rate_minor = NULL` → billing run falls back to **current** rate_cards at bill-time.
- **Mid-period rate-change walk (student rate changes from £20 to £25 mid-period, 2 lessons each side, 4 total):**
  - All four lessons created via `useLessonForm` *at the rate in force at creation time*: the first two carry `rate_minor=2000`, the second two carry `rate_minor=2500` → invoice sums to £90. **Correct**.
  - If any of the four lessons was created via `QuickCreatePopover`, added via a make-up booking, or inserted by a waitlist/credit trigger: its `rate_minor=NULL` → billing run uses the live rate card at bill-time. After the change, all four NULL-snapshot lessons bill at £25 → invoice shows £100 instead of £90. **Incorrect — retroactive repricing.**
  - If the `rate_cards` fetch in `useLessonForm` threw silently (line 550/744), `rate_minor` is also NULL with the same fallback outcome.
- **Severity: HIGH.** The snapshot is correct in theory (claude.md:59 description is aspirational), but in practice the coverage is partial — every org that uses make-up bookings, waitlist matching, or the calendar quick-create will have NULL snapshots on a non-trivial share of lessons. The fallback to live rate cards means **any mid-period rate change retroactively reprices every NULL-snapshot lesson**, with no warning to the teacher and no audit trail.

### Proration

- **Mid-period joiner:** billing is per-lesson-attended, not per-period-fraction. The billing run fetches lessons via `create-billing-run/index.ts:512-533` using `lesson.start_at >= startUTC AND start_at <= endUTC`. A student added mid-period only has participant rows for lessons scheduled after their add date, so they naturally only get billed for those. No proration calculation, no approximation. **NONE — not a defect; the model bills discrete lessons.**
- **Cancelled lesson:** single status filter at `create-billing-run/index.ts:606-609` — `if (attStatus === "cancelled_by_teacher") { skippedForCancellation++; return; }`. Every other attendance status (`cancelled_by_student`, `no_show`, `family_emergency`, `school_commitment`, `holiday`, `weather_closure`, `sick`, etc. — see `make_up_policies` values from `20260401000000_auth_rls_hardening.sql:347-356`) passes through and **is billed**. Lesson must also be in the `status` filter at lines 492-495 (`"completed"` for delivered-mode, `["scheduled","completed"]` for upfront). Rationale is defensible for `no_show` and `cancelled_by_student` (teacher delivered capacity), but questionable for `sick`/`family_emergency` if the org policy says "waitlist/credit, don't charge" — the billing code does not consult `make_up_policies`. **Severity: MEDIUM (policy-enforcement gap).** The attendance status is checked against exactly one string literal; any other cancelled-reason string (e.g. a future `"cancelled"` bare value or a typo like `"cancelled_by_teacher "` with trailing space) would silently fail the equality check and the lesson would be billed.
- **Consumed make-up credit:** the create-billing-run function **does not apply credits at all**. A grep for `make_up_credits`, `credit_applied_minor`, `applied_to_invoice_id`, or `credit_offset` within `supabase/functions/create-billing-run/index.ts` returns zero matches. Invoice rows are built at lines 712-726 without a `credit_applied_minor` field (defaults to 0) and written via a direct `client.from("invoices").insert(allInvoiceRows)` at lines 732-735 — the code does **not** call the `create_invoice_with_items` RPC which is the only path that consumes credits (see `deep-audit-continuation-part2.md:508` and `20260222164435_...sql` / `20260223004118_...sql:105` where `_total_minor = GREATEST(0, _subtotal + _tax_minor - _credit_offset)`).
  - **Worked outcome:** student has a £20 make-up credit outstanding. Teacher runs the billing run for a period that includes a £20 lesson. Invoice is created with `total_minor=2000, credit_applied_minor=0`. Parent receives a £20 bill. The credit row stays `redeemed_at=NULL, applied_to_invoice_id=NULL` — still "available" — but from the parent's perspective they just paid full price for a lesson the teacher's policy said should be offset by their credit.
  - **Severity: HIGH.** Live parent-facing overcharge on any org that (a) issues make-up credits and (b) generates invoices via the billing run (which is the primary batch path). The credit is not destroyed — it remains available for a later manual invoice — but the billing-run invoice silently ignores it. No audit_log entry flags the mismatch.
- **Other proration / rounding edges:**
  - **VAT rounding at invoice level:** `taxMinor = Math.round(subtotal * (vatRate / 100))` at `create-billing-run/index.ts:709`; per-item VAT is NOT computed (explicit comment at lines 707-708). Matches the RPC path (`20260223004118_...sql:85`). Integer arithmetic after one ROUND → no drift across lessons within an invoice. **NONE** for arithmetic; restates the Section 2 C5 gap at the display level.
  - **Duration rounding:** `durationMins = Math.round((end_at − start_at) / 60000)` at `create-billing-run/index.ts:702`. Lessons scheduled to whole-minute boundaries are exact; any sub-minute drift (rare) would round to nearest minute and map to the nearest `rate_cards.duration_mins`. Since rate cards are keyed by whole-minute buckets (e.g. 30/45/60), a 59-minute lesson would hit the default/first card rather than the 60-minute card. **LOW** (edge case, unlikely in practice).
  - **No "half lesson" or "partial attendance" rate proration** — a student who attends half a 60-min lesson is billed the full rate. Consistent with music-studio policy; not a defect.
- **Summary of precision vs approximation:** LessonLoop billing is **per-lesson discrete** — no period-fraction proration, no per-minute proration — so there is no place for the kind of MMS approximation drift. The precision fails, where they exist, are at the **snapshot coverage** boundary (rate_minor NULL → live fallback) and at the **credit-application boundary** (billing run bypasses credit offset entirely), not at arithmetic.
Section 4 — Payment plans + installments
To be filled in Session-1.4.
Section 5 — Dunning + overdue logic
To be filled in Session-1.5.
Section 6 — Invoice lifecycle state machine
To be filled in Session-1.6.
Section 7 — Family Account / balance brought forward
To be filled in Session-1.7.
Section 8 — UK-specific billing gap analysis (internal-only)
To be filled in Session-1.8.
Section 9 — Audit trail / teacher-facing evidence
To be filled in Session-1.9.
Section 10 — Walked test scenarios
To be filled in Session-1.10.
Section 11 — Findings summary + severity
To be filled in Session-1.11.
