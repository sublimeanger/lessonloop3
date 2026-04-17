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

### Closure dates

- **Table:** `closure_dates` at `supabase/migrations/20260119233724_0293a85e-fdcd-45b4-a437-2dee7c480b83.sql:2-12`. Columns: `id, org_id, location_id (nullable), date, reason, applies_to_all_locations boolean default true, created_at, created_by`, with `UNIQUE(org_id, location_id, date)`. Per-org, optionally per-location, single day only (no date-range concept). Reason is free-text.
- **Org-level toggle:** `organisations.block_scheduling_on_closures boolean NOT NULL DEFAULT true` added at `20260119233724_...sql:35-36` — intended to harden lesson *creation* against closures.
- **Does the billing run exclude closure-date lessons? NO.** Grep of `supabase/functions/create-billing-run/index.ts` for `closure|holiday|closed|bank_holiday` returns **zero matches**. Lesson selection at `create-billing-run/index.ts:512-533` is a pure date-range query (`lesson.start_at >= startUTC AND start_at <= endUTC`) constrained only by lesson `status` and `is_open_slot`. Nothing consults `closure_dates`.
- **Where closure_dates *is* consulted** (for context — these are all prevention paths, not billing paths):
  - `src/components/calendar/useLessonForm.ts:669-699` — recurring lesson creation filters out series dates that fall on closures before INSERT.
  - `supabase/functions/booking-get-slots/index.ts:161` — parent booking hides closed dates from the picker.
  - `supabase/functions/create-continuation-run/index.ts` — term continuation respects closures when materialising the new term.
  - `supabase/functions/process-term-adjustment/index.ts` — similar prevention at term-adjustment time.
  - `src/hooks/useCalendarData.ts:347` — calendar visual overlay.
- **Consequence — walked case:** an operator creates a recurring lesson series on 2 March, then on 10 March adds a new closure for 15 March because the studio boiler broke. The 15 March lesson was INSERTed on 2 March (closure did not yet exist) with `status='scheduled'`. Nothing auto-cancels it when the closure is added — there is no trigger / RPC that reconciles existing lessons with a new closure. On 16 March the lesson's natural flow (attendance marking) treats it as a normal lesson. The billing run on 31 March picks up this lesson and bills it. The parent is charged for a lesson that didn't happen because the studio was closed.
- **Closure-date management UI:** grep `src/` for `from('closure_dates').insert|upsert` returns **zero matches** and grep for `ClosureDatesTab|ClosureDatesManagement|ClosureDateForm` returns no component. The table has DELETE/INSERT/UPDATE RLS policies permitting `is_org_admin`, but no UI component in this codebase creates or edits rows. Closures are writable only via direct DB / SQL or via a custom admin tool not in this repo. (The marketing pages at `marketing-html/features/scheduling/index.html:323` promise this feature as teacher-facing.)
- **Severity: HIGH.**
  - Billing run billing a closed-studio lesson is **live parent-facing wrong money** (Bucket A by the rules of this audit). The trigger is rare (closure added after lesson creation) but deterministic when it fires.
  - Closure-date management having no UI in this repo compounds it — an operator who realises they need to add a closure has no in-app surface, so they go to direct-DB edits or ignore it. Either way, existing lessons still get billed.

### Bank holidays

- **No awareness of UK bank holidays in any form.** Grep across the full repo for `bank_holiday|bankholiday|public_holiday|uk_holiday|england.holiday|scotland.holiday|gov\.uk|bank-holidays|nager\.at|holidayapi` returns:
  - `docs/SYSTEM_OVERVIEW.md:136` — "Bank Holidays: Configurable closure dates" (explicit statement that the *only* bank-holiday mechanism is manual closure entry).
  - `docs/DATA_MODEL.md:300` — example `reason` value `"Bank Holiday"` (just a free-text label on a manually-created `closure_dates` row).
  - `.lovable/plan.md:68` — "UK school holidays + bank holidays" listed as an intended closure-date use case.
  - `marketing-html/features/scheduling/index.html:323` and sibling marketing pages — "Define your own terms, half-terms, and **bank holidays**" — the marketing copy explicitly claims this as a product capability.
  - `tests/e2e/workflows/crud-terms.spec.ts:161` — test looks for a "Bank Holiday" placeholder string in a UI dialog.
  - Zero third-party holiday-feed integrations (no `gov.uk/bank-holidays.json`, `nager.at`, `holidayapi`, `date-holidays`).
  - Zero seeded `closure_dates` rows for standard UK bank holidays.
- **Teacher-facing reality:** every UK bank holiday (which falls mid-term in Spring, Summer, Autumn) must be typed in manually by an admin as a `closure_dates` row, per-org, per-year. That's 8 bank holidays × (optionally 3 different nations) × every year. Plus an in-app UI to do it doesn't exist — see above, so they can't even do that from the app.
- **Severity: HIGH.** This is the UK-native proposition LessonLoop markets itself on. MMS famously forces this manual work — the stated differentiator is to automate it. The current state is that LessonLoop forces the same manual pro-rata work MMS does, while a feature page actively claims the opposite. Treat as HIGH (UK-market-leadership-blocker), not MEDIUM. SPEC: automatic seeding of UK bank holidays per org's nation on org creation, yearly refresh, plus a UI to edit/disable.

### Four-nation support

- **`organisations.country_code TEXT NOT NULL DEFAULT 'GB'`** at `supabase/migrations/20260119231348_e28c56b1-4cd3-4030-b7b6-713697cd7822.sql:10`. The default and the naming both point at GB-as-a-whole, not at one of the four UK nations.
- **No `country_subdivision` / `region` / `nation` column on `organisations` or anywhere else.** Grep for `organisations.*ADD COLUMN.*region|country_subdivision|nation|GB-ENG|GB-SCT|GB-WLS|GB-NIR` returns **zero matches**. No ISO 3166-2 code anywhere.
- **Consumers of `country_code`:** a standalone reference `country_code` exists on `exam_boards` at `20260223002034_...sql:25` (also `GB`), but I can find no code that branches on `organisations.country_code` value — no switch, no lookup, no currency or VAT behaviour keyed off it. It's effectively a constant.
- **Consequences:**
  - An English org and a Scottish org are indistinguishable to the system, even though they have different bank holiday sets (Scotland has St Andrew's Day and the Monday after New Year; England/Wales don't), different term dates (Scotland terms differ), and in some cases different VAT/education treatment for peripatetic music tuition.
  - Any future "auto-seed UK bank holidays" feature (the Bank holidays finding above) would have nowhere to read the org's nation from.
- **Severity: HIGH (SPEC).** This is the enabling field for everything a UK-native billing product needs to do correctly. Missing today. Not a Bucket A because nothing in the billing run currently reads it — no silent wrong-money path active — but it blocks the bank-holidays fix, a future term-dates preset feature, and regional tax customisation. Flag as Bucket C SPEC with HIGH priority at fix pass.

### Payment plan integration

- **Shape chosen: (a) — single invoice at full total, installments layered on top.** `supabase/functions/create-billing-run/index.ts:712-726` inserts invoice rows with `total_minor = subtotal + taxMinor` — not pre-divided by installment count. After the invoice batch completes successfully, the per-invoice plan-creation loop at lines 872-927 calls `generate_installments` RPC (line 917) which creates `invoice_installments` rows whose amounts sum back to the invoice's outstanding balance.
- **Trigger mechanism: inline in the billing run, after invoice insert.** Not a DB trigger on `invoices`, not a separate frontend action. The RPC is invoked by the edge function only when `planOptions.planEnabled` is true (line 872) — where `planEnabled` is read from `body.plan_enabled` at line 209. The org has `default_plan_threshold_minor`, `default_plan_installments`, `default_plan_frequency` (line 222) which fill in the count/frequency/threshold defaults but do NOT auto-enable planEnabled itself; the operator must tick the "create payment plans" box on each billing run.
- **Plan eligibility logic** (lines 896-914):
  - Gather `student.payment_plan_preference` for every student on the invoice.
  - If ANY student's preference is `'never'` → skip plan (`blockPlan = true` wins, comment at line 910).
  - Else if ANY student's preference is `'always'` → force plan regardless of threshold.
  - Else: invoice total must exceed `threshold` (`planThresholdMinor`). If threshold is null, default is "meets threshold" (line 913).
- **Error handling:** `generate_installments` failure is caught at line 924-926 and logged to console.error only. The invoice row stays — with a FULL total, no installments. No audit_log entry, no UI surface, no retry.
- **Edge-case walks:**
  - **Existing active plan + billing run covers new lessons:** dedup at the billing-run layer is by `linked_lesson_id`+`student_id` (`create-billing-run/index.ts:539-547`), so the *same lesson* cannot be on two invoices. But nothing checks whether the student already has an active payment plan on a prior invoice. A student with an unpaid Jan-Mar plan invoice who then gets an April invoice with plan_enabled=true will have **two concurrent active plans** with different due-date cadences. **MEDIUM** — not double-billing, but a parent-visible mess.
  - **Plan cancelled mid-period:** cancelling a plan invalidates `invoice_installments` rows but does NOT affect the parent invoice. The next billing run has no knowledge of the cancelled plan; if `plan_enabled=true` on the new run and criteria are met, a fresh plan is generated on the new invoice. Not a defect per se, but there's no "this student recently cancelled, consider lump-sum this time" nudge. **LOW**.
  - **Plan enabled on the org default but this student has no plan:** `planEnabled` is a per-request flag, not an org default. Orgs with `default_plan_threshold_minor` set still need the operator to tick "enable plans" on every billing run. If the operator forgets, **no plans get created** regardless of threshold — silent drop of the plan feature. **MEDIUM (UX)** — the op reads "plans are enabled for my org" as permanent state but the wizard treats it as opt-in-per-run.
- **Severity summary for this sub-section: 1 MEDIUM (dual plans) + 1 MEDIUM (opt-in mis-match) + 1 LOW (no cancelled-plan memory).**

### Xero fire-and-forget

- **Call site:** `supabase/functions/create-billing-run/index.ts:933-967`. Gated on `xero_connections.sync_enabled AND auto_sync_invoices` (line 942). For each created invoice: `fetch(…/functions/v1/xero-sync-invoice, { method: POST, body: { invoice_id } }).catch(err => console.error(…))` — all wrapped in `await Promise.all(...)`.
- **Fire-and-forget confirmation:** the outer `await Promise.all` *does* wait for the fetch promises to settle, **but** every fetch has a trailing `.catch(err => console.error(...))` (line 955-957) that swallows rejections and resolves to `undefined`. `Promise.all` therefore never rejects, the outer `try` at line 935 never catches, and the success log `[BillingRun] Xero auto-sync triggered for N invoices` (line 960) prints even if every sync returned 500. Effectively fire-and-forget at the error-handling level despite the `await` being present.
- **Crucial observation:** `fetch()` only rejects on network failure. A Response with HTTP 500 is a fulfilled promise — `response.ok` is false but the `.catch` does not fire. **This code never checks `response.ok` or `response.status`.** Any non-network failure (Xero 500, Xero 401 token expired, Xero 429 rate-limited, LessonLoop's own xero-sync-invoice function returning 500 on error, e.g. `supabase/functions/xero-sync-invoice/index.ts:247-250` on Xero create failure) is treated as success by the calling billing run.
- **Silent failure mode walks:**
  - **Xero endpoint returns 500** (xero-sync-invoice returns 500 at line 247-250 on Xero create failure, 281-283 on internal error): fetch resolves normally → `.catch` doesn't fire → Promise.all resolves → billing run prints success log. No `xero_entity_mappings` row inserted (insert at xero-sync-invoice:257-264 is unreachable after the early-return). No `xero_connections.error_message` updated (xero-sync-invoice only updates `last_sync_at` on success at line 268-271). No trace in the DB; only a line in the edge-function console log.
  - **Xero scope missing/revoked:** same outcome. xero-sync-invoice returns 500 with an error body, fetch resolves, billing run thinks it succeeded.
  - **Network timeout:** fetch rejects → `.catch` logs `console.error` → Promise.all resolves → billing run continues. No DB state written.
  - **Xero rate limit (HTTP 429):** xero-sync-invoice's own handling of Xero's 429 is not in scope here, but whatever it returns is invisible to the billing run the same way 500 is.
- **Operator visibility of per-invoice sync failures:** **effectively none.**
  - `invoices` table has **no Xero-related column** (confirmed via `src/integrations/supabase/types.ts:1908-1935` — no xero_id, no xero_synced_at, no xero_sync_status, no last_xero_sync). The link between a LessonLoop invoice and a Xero invoice lives entirely in the separate `xero_entity_mappings` table.
  - `xero_connections.sync_status` + `error_message` DO surface in the UI at `src/components/settings/AccountingTab.tsx:261-275` (amber warning card with "Sync error" message). But `xero-sync-invoice` **never updates these fields on per-invoice failure** — only `last_sync_at` on success (line 268-271). Connection-level errors come from a different flow (OAuth / token refresh). Invoice-level sync failures never set `sync_status='error'`.
  - `xero_entity_mappings.error_message` column exists (`src/integrations/supabase/types.ts:5785`) but `xero-sync-invoice` **does not INSERT a mapping row on failure**. The early-return at line 247-250 precedes the mapping insert at line 257-264. So no row, no error_message, no evidence.
  - The only mechanism the operator has to notice an unsynced invoice is the manual "Sync all unsynced" button in AccountingTab at lines 140-163, which compares `xero_entity_mappings.local_id` against `invoices.id` and treats the missing ones as "unsynced". This catches the gap but requires manual triage, has no proactive alert, no badge, no email.
- **Severity: HIGH.** Parents see an invoice in LessonLoop; the accountant's Xero ledger doesn't contain it; the operator has no in-product signal that the two are diverging until someone manually clicks "Sync all unsynced" and notices the count > 0. This is the exact kind of silent data-divergence bug that erodes trust in the product, and it sits on the **primary** billing path (every auto-billed invoice goes through this code). Not filed as Bucket A per the instruction — Xero reliability is a dedicated Session 2 workstream per the original plan — but the severity stays HIGH and should be near the top of that queue.

### Audit trail: what the billing run records per invoice

For each audit datum asked about, the **persist** status:

- **Billing-run FK (which run produced this invoice):** ✓ **present.** `invoices.billing_run_id uuid REFERENCES billing_runs(id) ON DELETE SET NULL` added at `supabase/migrations/20260316210000_fix_billing_audit_findings.sql:59-61`. Written at `supabase/functions/create-billing-run/index.ts:725` (`billing_run_id: billingRunId`). Retention caveat: `ON DELETE SET NULL` means if the billing_run row is later deleted, the invoice loses its provenance pointer silently.
- **Lesson → invoice_item link:** ✓ **present.** `invoice_items.linked_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL` at `supabase/migrations/20260119234233_...sql:45`, plus `invoice_items.student_id uuid REFERENCES students(id) ON DELETE SET NULL` at line 46. Both written at `create-billing-run/index.ts:765-766`. Caveats: (a) ON DELETE SET NULL means if the lesson is hard-deleted, the invoice line loses its source; (b) one row per (invoice, lesson, student) triple — no join table captures which `lesson_participant` row fed the rate.
- **Rate used per line item:** ✓ **present as stored number**, ✗ **absent as provenance.** `invoice_items.unit_price_minor` and `amount_minor` hold the money (`20260119234233_...sql:43-44`, written at `create-billing-run/index.ts:763-764`). But nothing records *where* that number came from — whether it's the `lesson_participants.rate_minor` snapshot, a live `rate_cards` fallback (see Section 3b), or the caller-supplied `fallback_rate_minor`. A teacher reconciling "why did this lesson bill £25 when I thought it was £20" has no in-DB answer.
- **Date of billing run execution:** ✓ **present.** `billing_runs.created_at timestamptz DEFAULT now()` at `20260119234233_...sql:74`. Plus `billing_runs.start_date` and `end_date` for the period covered.
- **Actor who triggered the billing run:** ✓ **present.** `billing_runs.created_by uuid NOT NULL` at `20260119234233_...sql:71` (no FK to auth.users — just a uuid), set at `create-billing-run/index.ts:265`. For invoices created *outside* a billing run (manual invoice), there is no `invoices.created_by` column — actor is only recoverable from the audit_log trigger's captured `actor_user_id`.
- **Credits/discounts applied:** partial. `invoices.credit_applied_minor integer NOT NULL DEFAULT 0` exists and represents the total credit offset on the invoice (`src/integrations/supabase/types.ts:1913`). `make_up_credits.applied_to_invoice_id` lets you query backward from credit → invoice. **But:** `create-billing-run/index.ts` does not set `credit_applied_minor` and does not touch credits at all (Section 3b HIGH finding — billing run bypasses credit application entirely), so for billing-run-generated invoices this column is 0 regardless of what credits were outstanding. A teacher auditing "which credits offset this invoice" on a billing-run invoice will see: none, ever.
- **Closure-date exclusions (post-commit `9f60d71`):** ✗ **ephemeral only.** The `skippedForClosure` count is written to `billing_runs.summary` (jsonb) at `create-billing-run/index.ts:318-329` as a single integer. The individual lesson IDs that were skipped are not persisted. The `console.warn` for attendance-contradiction cases is written only to the edge-function log, not to any DB row. A teacher investigating "which lessons did the run skip for closures, and why" can see *how many* in the summary, but not *which* lessons, not *which* closure_dates rows triggered the skip, and not *which* students were affected.
- **Audit-log trigger coverage:** `audit_invoices` trigger fires INSERT/UPDATE/DELETE on `invoices` (`supabase/migrations/20260120002039_5a489cca-...sql:96-98`), capturing row-level changes to `audit_log` via `log_audit_event()`. **But:** no `audit_invoice_items` trigger — line-item changes (adding/editing/removing items) leave no row in `audit_log`. If a teacher edits a line item after the fact, the money changes but there's no trail of what it was before.
- **Reminders sent / email delivery:** no per-invoice record. No table for "reminder_sent_at", "reminder_log", or similar. The reminder modal at `src/pages/InvoiceDetail.tsx:89, 686` sends a one-shot email but doesn't persist a row.

### What a teacher sees on InvoiceDetail

Walk of `src/pages/InvoiceDetail.tsx` (768 lines). Per invoice, the teacher can see:

- **Line items table** at lines 335-393 — description, quantity, unit_price_minor, amount_minor. For each item with a non-null `linked_lesson`, a clickable link to `/calendar?date=…` showing the lesson date/time (`:350-357` desktop, `:378-386` mobile). Rate is shown as a number; source of that number is not displayed.
- **Totals block** at lines 395-451 — subtotal, VAT (% shown if > 0), credit applied (if `credit_applied_minor > 0` at `:409-415`), invoice total.
- **Payment history** at lines 456-540 — each payment with date, method, provider_reference, amount. Refund rows appear nested under each payment (`:504-525` approximately).
- **Refund action** — per-payment button visible to `canManageBilling`.
- **Void action** (admin, at `:745-750`) with a warning that applied credits will be restored.
- **Reminder send modal** at `:686` — one-shot, no history persisted.

The teacher **cannot** see any of the following on this page:

- ✗ Which `billing_run` produced the invoice (FK exists but is not rendered; no "Generated by March billing run, 31 March 2026 at 14:22 by Sarah" line).
- ✗ Who created the invoice (for manual invoices, no `created_by` column exists; for billing-run invoices, the run's `created_by` isn't surfaced).
- ✗ Status-transition history (draft → sent → paid → partially refunded). The current status is shown, but not *when* it transitioned or *who* transitioned it — despite the `audit_invoices` trigger capturing this in `audit_log`, the InvoiceDetail page does not query that table.
- ✗ Reminder log — no record of whether reminders have been sent, when, or to whom.
- ✗ Line-item edit history.
- ✗ Per-credit breakdown — only the total `credit_applied_minor` is visible; not "£20 from credit #a1b2, £10 from credit #c3d4".
- ✗ Xero sync status — no indication this invoice is in Xero, out of Xero, or syncing (see Section 3d — `invoices` has no xero column; the AccountingTab shows only connection-level state).
- ✗ Rate source / fallback indicator — line shows "£25" but no "(rate card default, live lookup)" vs "(snapshotted 2 Feb 2026)".
- ✗ Closure-date skips that affected this student — see the "ephemeral only" note above.

Grep of `src/pages/InvoiceDetail.tsx` for `audit_log|activity|timeline|history|created_by|generated_by|reminder_sent_at` returns zero matches outside the one-shot reminder modal state variable. There is **no activity feed / history tab / event timeline component** on this page.

**Verdict against the "angry parent" benchmark:** a teacher asked "why is this £15 higher than last month?" can see the line items and their lesson dates, which is enough to cross-check "oh, that lesson on the 18th was a 60-minute, not 30". That's the *happy* path. The moment the parent's question touches provenance — "why did you use *this* rate", "who generated this", "did you send the reminder I asked for", "was my credit applied", "why wasn't the 24 March lesson included", "why *was* the 24 March lesson included given the Bank Holiday closure" — the teacher has to leave the app (Supabase dashboard, spreadsheet, support ticket, or guesswork).

**Severity: HIGH (parent-trust blocker).** Ticks one half of the benchmark (line items visible, lesson links clickable). Fails the other half (provenance, history, actor, source-of-truth for rate/credit/closure/reminder). A teacher cannot answer an informed parent question about an invoice end-to-end without breaking flow.

### Traceability gaps (SPECs)

Gaps surfaced, each a Bucket C item to spec:

- **SPEC-TRACE-1 (HIGH) — Invoice activity timeline.** Missing: a first-class "activity" component on InvoiceDetail surfacing `audit_log` events for this invoice (created, status changes, items added/removed, payment recorded, refund issued, reminder sent, voided). Data model addition: **none required for status/insert/update/delete** (the `audit_invoices` trigger already writes them). New addition required: `audit_invoice_items` trigger so line-item mutations are captured. UX sketch: a collapsible "Activity" section below the Line Items card, listing `created_at DESC` entries with icon per action type, actor name, and a diff-like before/after for line-item edits. Covers 80% of the "angry parent" gap immediately from data that already exists.
- **SPEC-TRACE-2 (HIGH) — Rate provenance on `invoice_items`.** Missing: record which source produced each line's `unit_price_minor`. Proposed new nullable column: `invoice_items.rate_source text` (enum-like: `'lp_snapshot'` / `'rate_card_exact'` / `'rate_card_default'` / `'rate_card_first'` / `'fallback_body'` / `'manual_entry'`). Populated by `create-billing-run/index.ts` at line 763-764 alongside `unit_price_minor`. Teacher UX: small badge next to the rate number ("snapshotted" / "live rate card" / "manual"). Resolves the "why £25 not £20" question in-app without SQL.
- **SPEC-TRACE-3 (HIGH) — Closure-skip persistence per lesson.** Missing: persist which (lesson_id, student_id, closure_id) triples were skipped during the billing run. Proposed new table `billing_run_skipped_lessons` with columns `id, billing_run_id, lesson_id, student_id, reason (enum: 'closure' / 'cancelled_by_teacher' / 'no_payer' / 'already_billed'), closure_id nullable, created_at`. `create-billing-run/index.ts` populates it during the closure filter at the fix site. Teacher UX: a "Skipped" tab or collapsible section on the billing-run summary page listing each skip with its reason + a link back to the lesson. Closes the contradiction-loop (the `console.warn` at commit `9f60d71` becomes a row instead of a log line).
- **SPEC-TRACE-4 (MEDIUM) — `invoices.created_by`.** Missing: for manually-created invoices, nothing records who made them. Proposed: add nullable `invoices.created_by uuid REFERENCES auth.users(id)`. For billing-run invoices, derive from the run's `created_by`. Teacher UX: "Created by Sarah on 31 March 2026 via March billing run" header line.
- **SPEC-TRACE-5 (MEDIUM) — Reminder log.** Missing: no record of reminder emails sent. Proposed new table `invoice_reminders` with `id, invoice_id, sent_at, sent_by, recipient_email, template, delivery_status`. Populated by the existing reminder-send flow. Surfaces on InvoiceDetail as a "Reminders sent" line or inside the SPEC-TRACE-1 timeline. Prevents the "did you send the reminder I asked for" loop.
- **SPEC-TRACE-6 (MEDIUM) — Per-credit offset breakdown.** Missing: the invoice shows a single `credit_applied_minor` scalar but no breakdown of *which credits* were consumed. Data model has `make_up_credits.applied_to_invoice_id` for the reverse lookup — a simple `useInvoiceCredits(invoiceId)` hook on InvoiceDetail would surface the per-credit list. Small UX addition: expand the credit line into a collapsible "(3 credits applied — £20, £10, £5)" chip list.
- **SPEC-TRACE-7 (LOW) — Xero sync status per invoice.** Cross-links with Section 3d. Join `invoices` ↔ `xero_entity_mappings` to derive a per-invoice sync badge. Already flagged under the Xero workstream; noted here for the InvoiceDetail surface.

### Section 3 summary

**Findings across 3a-3e:** 0 CRITICAL, 9 HIGH (1 resolved, 8 open), 8 MEDIUM, 5 LOW.

Resolved during Section 3: the `closure_dates` exclusion on the billing run (commit `9f60d71`) — a Bucket A that was silently over-billing closed-studio lessons for any org that added a closure after lessons were created.

**Two most important findings that remain open:**
1. Billing run bypasses credit application entirely (Section 3b). A student with an available make-up credit gets billed full price and the credit sits unredeemed. Parent-facing wrong money on any org that issues credits.
2. Xero fire-and-forget with zero operator visibility into per-invoice failures (Section 3d). Every failed sync leaves no DB trace; the operator's Xero ledger can silently diverge from LessonLoop invoice totals indefinitely.

**SPECs that pair naturally with later sections:**
- **SPEC-TRACE-1 / C17** (invoice activity timeline) pairs with **Section 9** (teacher-facing evidence) — the timeline *is* the answer to "teacher in front of angry parent".
- **SPEC-TRACE-6 / C20** (per-credit breakdown on invoice) pairs with **Section 7** (Family Account / balance brought forward) — credits are the main cross-invoice ledger flow and they need a unified provenance view there.
- **SPEC-TRACE-3 / C19** (closure-skip persistence) pairs with **Section 3c's C11 / C12** (UK bank holidays + four-nation field) — once bank holidays auto-populate `closure_dates`, the volume of skipped lessons per run grows, which raises the cost of having no per-lesson skip-reason record.
- **C4** (Section 2 partial-refund status reopen) will need to be revisited under **Section 6** (invoice lifecycle state machine) — the `partially_paid` / `refunded` intermediate states don't exist anywhere in the invoice_status enum.

**Out-of-audit fixes delivered during Section 3:**
- Rate snapshot fix — 4 commits (`c3c0b2d`, `d42b3f4`, `40137f3`, `2abf1e2`) plus migration `20260417120000_rate_snapshot_on_confirm_makeup_booking.sql` (not yet applied).
- Closure-dates billing-run exclusion — 1 commit (`9f60d71`). Pure edge-function change, deployable immediately.
- Xero OAuth unblock — 2 commits (`5d89594` scope re-add; `d8afb08` schema-sync migration). Live DDL already applied; the migration is a repo-parity snapshot.

**Recommended top priorities for post-Section-11 fix-pass planning:**
1. **C17 — SPEC-TRACE-1: invoice activity timeline UI.** Highest leverage; uses existing `audit_log` data, surfaces the single most visible gap against the "angry parent" benchmark, and unblocks teacher trust work that Sections 9 and 11 will build on.
2. **C18 — SPEC-TRACE-2: rate provenance on invoice_items.** Pairs with the rate snapshot work already in this branch — closes the loop between "we captured the rate source" and "we can show it".
3. **C19 — SPEC-TRACE-3: closure-skip persistence.** Low data-model cost, eliminates the `console.warn`-only trail from commit `9f60d71`, and becomes load-bearing once C11 (UK bank holidays) multiplies the skip volume.
4. **C11 — UK bank holiday awareness.** Market positioning blocker; marketing copy already claims this. Prerequisite C12 (four-nation field) is small; together they turn LessonLoop's UK-native promise from aspiration into product.
## Section 4 — Payment plans + installments

Sources read: `supabase/migrations/20260401000000_auth_rls_hardening.sql:126-222` (latest `generate_installments`), `supabase/migrations/20260222155555_...sql` (invoice_installments DDL), `supabase/migrations/20260316350000_payment_plans_phase1.sql:151-207` (`cancel_payment_plan` RPC) + `:211-291` (`record_installment_payment`, orphan — see Section 1 B1), `supabase/functions/stripe-auto-pay-installment/index.ts`, `supabase/functions/installment-overdue-check/index.ts`, `supabase/functions/overdue-reminders/index.ts`.

### Installment rounding

- **Algorithm** (`20260401000000_auth_rls_hardening.sql:189-190, 199-208`): `_per_installment = _remaining / _count` (integer division, truncates); last installment absorbs the remainder via `_last_amount = _remaining − (_per_installment × (_count − 1))`; all other installments use `_per_installment`.
- **£600 / 6 walk:** `_per_installment = 100`, `_last_amount = 600 − 100×5 = 100`. Installments: 100, 100, 100, 100, 100, 100. Sum = £600. **Exact.**
- **£100 / 3 walk:** `_per_installment = 100 / 3 = 33` (truncated from 33.33). `_last_amount = 100 − 33×2 = 34`. Installments: 33, 33, 34. Sum = £100. **Exact — last installment carries the 1p remainder.**
- **Custom schedule path** (`:168-186`): validates that the sum of caller-supplied `amount_minor` values equals `_remaining`, RAISEs if not. So custom schedules are exact-or-rejected.
- **Lifecycle drift:** no drift within a single `generate_installments` call — the arithmetic is integer. Across the plan lifecycle the `paid_minor` on the invoice is recomputed via `SUM(payments) − SUM(succeeded refunds)` by `recalculate_invoice_paid` (see Section 2), *not* from the installments table. So even if installments are later marked `'void'`, the invoice's `paid_minor` still reflects money actually moved, not the scheduled amounts. This means **`SUM(invoice_installments.amount_minor WHERE status != 'void') ≠ total_minor − paid_minor`** after any void or after `_remaining` was set from a non-zero starting `paid_minor`.
- **Severity: LOW.** No arithmetic drift; but the decoupling between the installments table and the recalc math means there is no trigger or invariant check enforcing "sum of unvoided installments equals outstanding balance". A future bug that desynchronises them would go undetected.

### Auto-pay double-charge guards

- **In-loop dedup:** `supabase/functions/stripe-auto-pay-installment/index.ts:88-94` — per installment, `SELECT id FROM payments WHERE installment_id = inst.id LIMIT 1`. If present, `continue` without charging.
- **Status gate at query time:** `:51-52` — only installments with `status IN ('pending','overdue')` are selected. An installment that's already `'paid'` or `'void'` is never picked up.
- **Stripe-side idempotency:** **NONE.** `paymentIntents.create(paymentIntentParams, stripeOpts)` at `:132` does not include `idempotency_key` in either the params or the request options. Stripe treats each call as a distinct request.
- **Race window:** cron fires → creates PI → PI succeeds → webhook delivery delayed (Stripe outage, LL webhook handler timeout, DB connection issue). Next cron fires (same day if manually re-triggered, next day in normal schedule). Query at `:88-94` finds no `payments` row for `installment_id` because the webhook hasn't inserted one yet. `continue` does not fire. A second PI is created. **Double charge.** Scenario is rare (requires > 24h webhook lag for daily cron, or operator manually re-running the function) but not mitigated at the Stripe layer.
- **Failure-path DB update:** after a successful PI, the auto-pay function does NOT update the installment itself — it relies on the webhook handler (`supabase/functions/stripe-webhook/index.ts` → `record_stripe_payment`) to insert the `payments` row and flip installment status. Comment at `:135` confirms: "The webhook will handle recording the payment, so we just log success". If the webhook fails to ever arrive (routing loss), the installment stays `'pending'`/`'overdue'` despite real money having moved — parent is charged and still appears to owe it.
- **Severity: MEDIUM.** Live-impact likelihood today is small (daily cadence, normal webhook latency is seconds). Live-impact magnitude if it fires is high (duplicate charge of an installment amount). Fix is a single-line idempotency key like `idempotencyKey: \`auto-pay-${inst.id}\`` wrapped into `stripeOpts`.

### Failed installment behaviour

- **On card decline** (`stripe-auto-pay-installment/index.ts:147-192`): Stripe throws → `catch (err)` logs + pushes `{installmentId, status:'failed', error}` to results. If `err.code === 'card_declined'` or `err.type === 'StripeCardError'`, a one-shot Resend email is sent to the guardian (`:177-186`) with a "pay manually" link. **No DB update** on the installment — status stays as it was (typically `'pending'` or `'overdue'`).
- **No attempt counter, no last-attempt timestamp, no pause state.** There is no `invoice_installments.last_auto_pay_attempted_at` or `auto_pay_attempts` column. Next cron run picks the same installment up again (still pending/overdue + guardian still auto-pay enabled).
- **Retry cadence:** daily. Every day until either (a) the installment becomes `'paid'` through some other path, (b) the invoice status flips to `'void'`/`'paid'`, (c) the guardian disables auto-pay, or (d) the card finally succeeds. A declined card hit 30 days in a row is plausible. Each day produces another decline email. Stripe may flag the card/account for repeated fraud-pattern declines.
- **Plan-pause:** does not exist. Installment 4 will auto-attempt on its own due_date regardless of installment 3's decline history.
- **Operator-visible record:** nothing persistent. The decline exists only in (a) Stripe dashboard, (b) edge-function console logs, (c) the parent's email inbox. No badge or alert on the invoice / plan / parent page tells the operator "this card has declined N times".
- **Severity: HIGH.** Infinite retry loop on a bad card, no-op UI, no operator surface. Not wrong money today (no charge is succeeding) but a direct support burden and a Stripe-risk-profile liability. Queue as Bucket B (defect, not live-wrong-money).

### Dunning on installments

- **Reminder cron:** `supabase/functions/overdue-reminders/index.ts` covers both plain overdue invoices (excluding plan invoices — `:46` `if (invoice.payment_plan_enabled) continue`) and overdue installments separately (`:59-85`).
- **Cadence:** `org.overdue_reminder_days`, default `[7, 14, 30]` (`:238, :334`). Logic at `:241` and `:337`: `if (!reminderDays.includes(daysOverdue)) return "skip"` — **exact day-number match.** Must fire on exactly day 7 of overdue, exactly day 14, exactly day 30.
- **Missed-day consequence:** if the cron doesn't run on exactly day 7 (weekend window skip, outage, Supabase Functions downtime), day 7's reminder is missed and never re-fires. Day 8 evaluates as `daysOverdue=8`, `[7,14,30].includes(8)` is false → skip. Only 14 and 30 are reachable; the 7-day nudge is permanently lost for that installment.
- **Duplicate-day consequence:** no reminder log exists (confirmed Section 3e B11). If cron runs twice on the same day (operator manual trigger + scheduled, or redeploy quirk), the parent receives the **same reminder twice** — there is no `invoice_installments.last_reminder_sent_at` or `invoice_reminder_log` table gating on already-sent.
- **UI surface:** no indication on InvoiceDetail or a plan summary page of which reminders were sent, on which date, to whom. See Section 3e SPEC-TRACE-5.
- **Severity: MEDIUM.** Exact-match brittle + duplicate risk + invisibility in UI. Cross-ref with B11 (reminder log) from Section 3e.

### Partial payment against an installment

- **Manual-payment path behaviour:** `record_payment_and_update_status` at `supabase/migrations/20260401000000_auth_rls_hardening.sql:71-89` — greedy-cascades installments by `installment_number ASC`, only marking an installment `'paid'` when the remaining payment amount is `>= _inst.amount_minor` (line 79). `ELSE EXIT` (line 86) on the first installment where remaining < amount.
- **Walked case — parent pays £30 by bank transfer against a £50 installment:** teacher records via the UI calling `record_payment_and_update_status(_amount_minor=3000, ...)`. Flow:
  - `payments` row inserted (£30, provider=`manual`). `paid_minor` recalcs to include the £30.
  - Greedy loop: `_remaining_payment=3000`, first pending installment is £5000, `3000 >= 5000` is false → EXIT.
  - Installment stays `'pending'` with due_date unchanged. On its due_date it becomes `'overdue'` via `installment-overdue-check`.
  - `overdue-reminders` starts emitting reminders asserting "£50 installment N is overdue" — but £30 of it has been paid.
- **System state vs parent state:** the parent has paid £30 toward a £50 installment. The invoice `paid_minor` is correct (+£30). The installment row shows `status='overdue', amount_minor=5000` unchanged. Reminders use the installment's `amount_minor`, not the "outstanding against this installment" figure. Parent is told they owe £50; their view says they owe £20.
- **No partial-payment model:** `invoice_installments` has no `paid_minor` column, no `partial_amount`, no `remaining_minor`. The schema assumes full-or-nothing per installment.
- **Stripe-side:** Stripe's off-session auto-pay always charges `inst.amount_minor` exactly (`stripe-auto-pay-installment/index.ts:105`), so there is no partial-payment path through that flow.
- **Parent-portal Stripe path:** if a parent paying via the portal chooses to pay a custom amount less than the full installment, no code prevents that — the payment lands, `_pay_remaining=false` by default, `_installment_id` might not be set, and the installment doesn't auto-flip. Same conflict as the manual path.
- **Severity: HIGH — Bucket A candidate.** Parent-facing contradictory statements are a trust-breaking live state: the parent knows they paid £30 and the product keeps sending reminder emails saying the full £50 is overdue. Not wrong money in the accounting sense (the £30 is correctly recorded), but wrong-money-communication, which is exactly what the "parent + invoice + argument" benchmark protects against.

### Plan cancellation mid-way

- **RPC behaviour:** `supabase/migrations/20260316350000_payment_plans_phase1.sql:151-207`. `cancel_payment_plan(p_invoice_id)` checks `SELECT COUNT(*) FROM invoice_installments WHERE invoice_id = p_invoice_id AND status = 'paid'`. If `> 0` → **RAISE EXCEPTION 'Cannot cancel plan with paid installments'** (`:193-195`).
- **Walked case — £600 / 6, 2 paid, operator wants to cancel:** `cancel_payment_plan` rejects. Alternative routes:
  - `void_invoice` (`supabase/migrations/20260315220002_void_invoice_clear_billing_markers.sql`) — this *does* work since the invoice status would be `'sent'` / `'overdue'` (not `'paid'`). It marks remaining installments `'void'` and transitions the invoice to `'void'`. Paid installments stay `'paid'`. `paid_minor` stays at £200. The parent sees a `'void'` invoice with £200 recorded as paid and £400 written off implicitly.
  - Manually UPDATE each remaining installment to `status='void'` via direct DB access — not exposed as an RPC; no RLS path.
- **No write-off flow:** no RPC lets the operator say "keep the 2 paid installments credited, forgive the remaining 4, leave the invoice open so the parent can still see it". The only options are "cancel before any payment" or "void the entire invoice".
- **No audit_log entry** by `cancel_payment_plan` — unlike `generate_installments` which logs (`:214-217`), `cancel_payment_plan` deletes + updates silently. No trail of who cancelled the plan, when, or why.
- **Severity: MEDIUM.** Forces teachers into an either/or that isn't how real fee-dispute flows work. Also the silent cancellation is a Section 3e-style evidence gap.

### Invoice vs installment reconciliation

- **Auto-marking invoice paid:** happens via `recalculate_invoice_paid` math at `supabase/migrations/20260316240000_fix_refund_audit_findings.sql:189-208`: `_net_paid = SUM(payments) − SUM(succeeded refunds)`. If `_net_paid >= invoice.total_minor`, `status = 'paid'`. This is called from `record_stripe_payment`, `record_installment_payment` (orphan), `record_manual_refund`, and `record_payment_and_update_status` (inline math, not the RPC itself).
- **Mechanism:** recalc is triggered on every payment-write path but is NOT triggered by installment-status changes directly. If a teacher manually marks an installment `'void'` via RLS-permitted UPDATE, the invoice's `paid_minor` does not auto-recalc. (No trigger on `invoice_installments` updates `invoices.paid_minor`.)
- **Walked case — one installment voided mid-plan:** operator UPDATEs installment 4 (£100) to `status='void'`. Nothing cascades. Invoice still shows `total_minor=600, paid_minor=200` (the 2 paid), `status='sent'`. Nothing indicates "this plan now only owes £300 not £400". The overdue-reminders cron continues to use the *installments* table (`overdue-reminders/index.ts:70` filters `.eq("status","overdue")`), so the voided installment doesn't send reminders, but the *invoice* has no awareness of the voided amount — for an accountant reconciling, the total outstanding `total_minor − paid_minor = 400` is wrong; it should be 300.
- **Cross-ref to Section 1 C3:** only P1 (`record_payment_and_update_status`) sets `invoice_installments.payment_id`. P2 (`record_stripe_payment`) leaves it NULL — so for Stripe-paid installments, "which payment settled this installment" is only queryable indirectly via `payments.installment_id` (the reverse link is populated at `stripe-webhook/index.ts` / `record_stripe_payment` via the PI metadata, but the mirror column on the installment row stays NULL). Still answerable, but two hops instead of one.
- **Severity: MEDIUM.** Normal happy path (all installments pay in turn, recalc math flips invoice to `'paid'`) works. Edge paths (void, refund, manual adjustment) can leave invoice total and installments desynchronised with no in-DB invariant check.

### Section 4 severity summary

- CRITICAL: 0
- HIGH: 2 (failed-installment infinite retry; partial-payment installment-reminder conflict)
- MEDIUM: 4 (auto-pay no idempotency key; dunning exact-match day number + no reminder log; plan cancellation forces void on partially-paid plans; invoice/installment reconciliation has no invariant check)
- LOW: 1 (installment-sum-vs-outstanding can diverge after void/edits)

Bucket A candidate: the partial-payment conflict (parent paid some, still gets full-amount reminders). Live today, parent-facing wrong-money-communication. Filed in queue as A-item for Section 4.
## Section 5 — Dunning + overdue logic

Sources read: `supabase/functions/invoice-overdue-check/index.ts` (full), `supabase/functions/installment-overdue-check/index.ts` (re-read from Section 3c), `supabase/functions/overdue-reminders/index.ts` (re-read post-A3 fix), `supabase/functions/installment-upcoming-reminder/index.ts`, `supabase/functions/auto-pay-upcoming-reminder/index.ts`, `supabase/functions/_shared/check-notification-pref.ts`, `docs/CRON_JOBS.md`, `audit-feature-03-roles-permissions.md`. Schemas: `message_log`, `notification_preferences`, `organisations.overdue_reminder_days`.

### Cron trigger map

Five cron functions touch dunning / overdue logic:

| # | Function | Schedule (UTC) | Source for schedule | Purpose |
|---|----------|----------------|---------------------|---------|
| 1 | `invoice-overdue-check` | `0 3 * * *` (03:00) | `docs/CRON_JOBS.md:30-34` | Transitions invoices `sent → overdue`; ALSO transitions installment `pending → overdue`; ALSO marks parent invoice overdue if all installments overdue |
| 2 | `installment-overdue-check` | `5 3 * * *` (03:05) | `docs/CRON_JOBS.md:37-42` | Transitions installments `pending → overdue` (overlaps with #1) |
| 3 | `stripe-auto-pay-installment` | `0 6 * * *` (06:00) | `docs/CRON_JOBS.md:53-59` | Charges installments due today / overdue (Section 4 audit) |
| 4 | `auto-pay-upcoming-reminder` | `0 9 * * *` (09:00) | `docs/CRON_JOBS.md:62-67` | Email parents 3 days before auto-pay |
| 5 | `installment-upcoming-reminder` | `0 9 * * *` (09:00) | `docs/CRON_JOBS.md:70-75` | Email parents 7 days before installment due |
| 6 | `overdue-reminders` | **NOT DOCUMENTED** | grep `docs/CRON_JOBS.md` returns 0 hits | Sends overdue reminder emails (invoice + installment); referenced by `audit-feature-03-roles-permissions.md:228` as a cron but has no schedule entry |

**Overlap finding:** functions #1 and #2 BOTH transition installment `pending → overdue` (`invoice-overdue-check/index.ts:55-70` and `installment-overdue-check/index.ts:18-39`). The 5-minute schedule offset means #1 runs first and #2 finds the same rows already transitioned (no-op UPDATE). Wasted query; not a correctness bug, but it's twice the work and doubles the surface area for race conditions. Neither function transitions `partially_paid` (correct per the A3 fix design — partially_paid should remain partially_paid regardless of due date).

**Schedule gap (B-grade defect):** `overdue-reminders` is documented as a cron in the role-permissions audit (`audit-feature-03-roles-permissions.md:228`) but is missing from the canonical `docs/CRON_JOBS.md`. If an operator sets up a fresh Supabase project from `CRON_JOBS.md`, the overdue-reminders cron is never scheduled and **no overdue emails ever go out**. Silent feature loss.

### Reminder cadence for a single overdue invoice

- **Source of truth:** `organisations.overdue_reminder_days int[]` with default `[7, 14, 30]` (read at `overdue-reminders/index.ts:243, 334`).
- **Trigger logic:** `if (!reminderDays.includes(daysOverdue)) return "skip"` (line 246, line 337) — exact day-number match.
- **Maximum 3 reminders** per invoice over the lifetime: at +7, +14, +30 days past due. After day 30, no further reminders fire — the invoice goes silent.
- **Cadence is per-org configurable** (the array column accepts any integer values). No UI surface in this audit's scope to set the array; presumably operator-edits via Supabase or a settings screen elsewhere.
- **Tone tiers** (`overdue-reminders/index.ts:258`): `daysOverdue >= 30` → "urgent" (red, "Pay Now Urgently Required"), `>= 14` → "important", else "friendly".
- **Severity: MEDIUM** — already covered by Section 4 B16 (exact-match brittleness — missed cron day permanently loses that reminder; double-fired cron sends duplicates). The 3-reminders-then-silent ceiling is correct UX (avoid harassment) but pairs poorly with the lack of teacher escalation (see below) — invoices over 30 days overdue silently rot until a human notices.

### Duplicate-suppression between overlapping crons

- **Mechanism:** `shouldSkipGuardian` at `overdue-reminders/index.ts:134-159`. Queries `message_log` for a row matching `related_id + message_type + created_at >= today.toISOString()` (start of today UTC). If any row found → skip.
- **Coverage:** same-day dedup, robust within and across runs. Two cron triggers in the same calendar day will not double-email.
- **Race window — parent pays vs cron sends:**
  - Cron starts at 06:00, queries `WHERE invoice.status = 'overdue'` — snapshot is good at this moment.
  - Parent pays at 06:01 via Stripe; webhook → `record_stripe_payment` flips invoice status to `'paid'`.
  - Cron iterates the snapshot (still contains this invoice) and at 06:02 calls `processInvoiceReminder` → sends email saying "you owe £100".
  - The reminder email goes out for an invoice that just became paid. Parent sees a contradiction.
  - **Severity: MEDIUM.** Window is seconds for daily cron; rare but possible. Mitigation: refetch invoice status inside `processInvoiceReminder` before send.
- **Multi-invoice scope** (cross-cron): if a guardian has 3 overdue invoices on day 7 of overdue, the dedup is per-invoice (`related_id` = invoice.id), so the parent receives **3 separate emails** on the same morning. No email-digest aggregation. Treat as Bucket-C UX, not a defect (`message_log` correctly tracks per-invoice).

### Weekend + bank-holiday awareness

- **None.** Grep across `supabase/functions/` for `isWeekend|getDay\(\)|saturday|sunday|business_day|holiday` returns zero matches in any dunning function.
- Reminders fire at 9:00 AM UTC every day — Saturday, Sunday, Christmas Day, Easter Sunday, all the same.
- A parent whose due-date passes on the day of a UK bank holiday receives a "URGENT: invoice 30 days overdue" email at 09:00 on the bank holiday morning if the +30 day mark lands there.
- **Cross-reference C11** (Section 3c — UK bank holiday awareness SPEC): without the underlying `bank_holidays` data, suppression in dunning crons cannot be implemented. C11 is the prerequisite.
- **Severity: HIGH (parent-trust-breaker SPEC).** The single most quoted complaint about MMS-style billing tools is "they emailed my parents on Christmas Day demanding payment". Currently LessonLoop has the same behaviour. UK-native positioning requires fixing this. Filed as Bucket C.

### Unsubscribe / pause mechanism

- **Email header:** `List-Unsubscribe: <${FRONTEND_URL}/portal/settings?tab=notifications>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (`overdue-reminders/index.ts:195-196`). The header is set, but the URL is a settings page, not a POST endpoint that toggles the preference. Per RFC 8058, mail clients may POST to the URL with `List-Unsubscribe=One-Click` body; the portal settings route is unlikely to handle that (it's a React route, not an API endpoint). **Functional one-click unsubscribe is missing despite the header.**
- **Notification preferences:** `notification_preferences` table with `email_invoice_reminders` boolean. Checked at `overdue-reminders/index.ts:141` via `isNotificationEnabled(orgId, userId, "email_invoice_reminders")`.
  - Defaults to **opt-in** (transactional category — `_shared/check-notification-pref.ts:33`). If no row exists, reminders go out.
  - **Requires a `user_id`** (line 140 — `if (guardian.user_id)`). For parents who have never created a portal account (guest billing relationship), there is no `user_id`, no notification_preferences row, and no opt-out path. They receive every reminder unconditionally with no way to stop them short of replying-to-noreply or contacting the teacher.
- **Per-invoice pause (teacher-side):** does not exist. Grep for `pause_dunning|dunning_paused|reminder_paused|dunning_pause|payment_hold` returns zero matches in source. There is no `invoices.dunning_paused_at` column, no `pause_invoice_reminders(_invoice_id)` RPC, no UI control. A teacher who agreed verbally with a parent "I'll wait until Friday" cannot tell the system to wait — the cron will email regardless.
- **Org-wide pause:** also does not exist. No "snooze all dunning for 7 days" toggle for sensitive periods (a teacher dealing with a bereavement in their parent community has no in-product way to pause).
- **Severity:**
  - One-click unsubscribe header pointing at a non-API URL → MEDIUM (RFC compliance + Gmail/Outlook bulk-sender treatment).
  - Guest parents have no opt-out → HIGH (GDPR/PECR compliance risk + parent UX).
  - Per-invoice pause missing → MEDIUM (workaround: void+reissue, but loses history).
  - Org-wide pause missing → MEDIUM (workaround: ad-hoc cron disable, brittle).

### Teacher escalation

- **No proactive notification** to teachers about overdue parents. Grep `overdue-reminders/index.ts` for `teacher|admin|notify_admin|escalat` returns zero matches.
- **Passive surface only:** `Dashboard.tsx:158, 220, 271, 314` shows a count card "Outstanding £X" with subtitle `"${stats.overdueCount} overdue"` linking to `/invoices`. Teacher must actively visit the dashboard.
- **No email-the-teacher cron** when a parent crosses a threshold (e.g. 14 days overdue, or after 3 reminders go unanswered).
- **No in-app notification badge** for "X new overdue invoices since you last visited".
- **No escalation policy** at the cron level — if a parent ignores all 3 reminders and goes 31+ days overdue, the system goes silent and only the dashboard counter knows.
- **Severity: MEDIUM.** A solo teacher who runs admin once a week can have a parent go 30 days overdue, receive 3 emails, and then go silent — and the teacher learns about it only on next dashboard glance. For agency owners with multiple teachers, the lack of "Sarah has 4 students in dunning" is a bigger gap. Filed as Bucket C SPEC because the right answer involves data-model decisions (notification cadence per role, threshold settings).

### Email content quality

Sample of the +14 day "important" tier (`overdue-reminders/index.ts:269-296`):

- ✓ **Branded header** with org logo + brand colour (`buildBrandedHeader` at line 271).
- ✓ **Three urgency tiers** with subject + colour shifts (friendly → important → urgent at 30+ days).
- ✓ **Clear figures:** total / paid / remaining when partial; amount due otherwise (lines 279-283).
- ✓ **Original due date + days overdue** (line 284-285).
- ✓ **Pay Now button** linking to the parent portal Stripe checkout (line 292).
- ✓ **"If already paid, please disregard"** footer (line 294).
- ✗ **No BACS / bank transfer details.** UK music schools rely heavily on bank transfer; the email forces parents into the Stripe-only Pay Now flow. Operators may have configured a bank-reference prefix elsewhere (`PaymentPlanInvoiceCard.tsx:36` carries one) but it's not in the dunning email.
- ✗ **No PDF invoice attachment.** Parents who want to print or forward to a partner / accountant get a "click here" link only. PDF generation exists (`useInvoicePdf.ts`) but isn't wired into the cron emails.
- ✗ **No multi-invoice digest** (covered above as a separate finding).
- ✗ **No plain-text alternative** in the email envelope. HTML-only emails get penalised by some spam filters.
- ✗ **`reply-to` not configured** in the visible code — likely defaults to `noreply@mail.lessonloop.net`, meaning a parent who replies to the dunning email gets a bounce. UK convention is to allow reply-to-the-org's-email for dunning.
- **Severity: MEDIUM (UX / brand)** — baseline is professional but missing the "built for UK music schools" affordances that distinguish from MMS-style boilerplate.

### Section 5 severity summary

- CRITICAL: 0
- HIGH: 2 (no UK bank-holiday / weekend suppression — sends "URGENT" on Christmas Day; guest parents have no opt-out path)
- MEDIUM: 6 (overdue-reminders missing from CRON_JOBS.md; invoice/installment overdue cron overlap; race window between cron snapshot and parent payment; List-Unsubscribe points at non-API URL; teacher pause-per-invoice missing; teacher escalation passive only; email-content quality gaps)
- LOW: 1 (overlap is a no-op UPDATE — wasted query, not a correctness bug)
- Cross-references C11 (UK bank holidays prerequisite) and B16 (exact-match cadence — already filed in Section 4).
## Section 6 — Invoice lifecycle state machine

Sources read: `supabase/migrations/20260222211425_568be73d-...sql:3-39` (`enforce_invoice_status_transition` trigger + binding), `supabase/migrations/20260315220002_void_invoice_clear_billing_markers.sql` (`void_invoice` RPC), `supabase/migrations/20260417190000_installment_partially_paid_state.sql` (latest `recalculate_invoice_paid` body — A3 fix), `src/hooks/useInvoices.ts:269-280` (client-side `ALLOWED_TRANSITIONS`), `src/pages/InvoiceDetail.tsx:43-69, 257-274, 588` (status rendering + action gating), `audit-feature-12-invoices.md`, `docs/AUDIT_TEST_CHECKLIST.md:155`. Schema fields: `invoices.status invoice_status` (`"draft" | "sent" | "paid" | "overdue" | "void"` per `src/integrations/supabase/types.ts:6655`).

### Full state transition matrix

Trigger: `enforce_invoice_status_transition` BEFORE UPDATE OF status ON public.invoices (`20260222211425_...sql:36-39`). Logic:

- Same-value: NO-OP (line 10-12).
- `OLD.status IN ('paid', 'void')`: RAISE (line 15-17). **Both paid and void are terminal.**
- `OLD.status = 'draft'`: allow only `'sent'` or `'void'` (line 20-22).
- `OLD.status = 'sent'`: allow only `'paid'`, `'overdue'`, `'void'` (line 24-26).
- `OLD.status = 'overdue'`: allow only `'paid'`, `'sent'`, `'void'` (line 28-30).

| From → To | Allowed? | Trigger reasoning | Notes |
|-----------|----------|-------------------|-------|
| draft → sent | ✓ | line 20 | Normal happy path. |
| draft → paid | ✗ | line 20 (only sent/void) | Cannot record payment without sending first. Manual P1 workaround: also send. |
| draft → void | ✓ | line 20 | Discarding an unsent draft. |
| draft → overdue | ✗ | line 20 | Cron cannot transition draft to overdue. |
| sent → draft | ✗ | line 24 (paid/overdue/void only) | No "unsend" path. **MEDIUM** — operator who sent wrong invoice cannot retract; must void+reissue. |
| sent → paid | ✓ | line 24 | Standard flow. |
| sent → overdue | ✓ | line 24 | Cron-driven (Section 5). |
| sent → void | ✓ | line 24 | Standard cancel. |
| paid → sent | ✗ | line 15-17 (paid terminal) | **CRITICAL.** This is the exact transition `recalculate_invoice_paid` attempts on refund (`20260417190000_...sql` recalc body, lines `IF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN _new_status := 'sent'`). The trigger raises. Refunds on paid invoices silently corrupt the math (see "Side effects" below). |
| paid → draft | ✗ | line 15-17 | No reversal of payment recording. |
| paid → overdue | ✗ | line 15-17 | Even if refunded, can't re-overdue. |
| paid → void | ✗ | line 15-17 | **HIGH.** Cannot void a paid invoice through any path: trigger blocks paid→void; `void_invoice` RPC also raises on `status='paid'` (`void_invoice/...sql:20-22`). To void a fully-paid invoice operators have no in-product route. The intended workflow ("refund first, then void") is broken because the refund step (paid→sent) is also blocked. |
| overdue → draft | ✗ | line 28 (paid/sent/void only) | No reversal. |
| overdue → sent | ✓ | line 28 | Allows "un-overdue" if the operator extends due_date — but no UI surfaces this. |
| overdue → paid | ✓ | line 28 | Normal. |
| overdue → void | ✓ | line 28 | Normal cancel. |
| void → draft / sent / paid / overdue | ✗ | line 15-17 (void terminal) | **MEDIUM.** Mistaken voids cannot be reversed. Operator must create a new invoice with same items. Audit log shows the void but the new invoice has no link back. |
| (any) → 'partially_paid' / 'cancelled' | N/A | enum doesn't include these values | See "Missing states" below. |

**Documentation drift:** `audit-feature-12-invoices.md:179` claims "`recalculate_invoice_paid()` can transition paid → sent (after refund), but correctly skips void invoices." This is **false** — the trigger blocks it. Same doc at line 174-175 simultaneously and correctly states paid + void are terminal. Internal contradiction.

### Missing states

- **`partially_paid` at invoice level: does NOT exist.** A3 fix (Section 4) added `'partially_paid'` to `invoice_installments.status` only. The invoice-level enum at `src/integrations/supabase/types.ts:6655` is unchanged: `"draft" | "sent" | "paid" | "overdue" | "void"`. Partial payment on an invoice is represented purely by `paid_minor < total_minor` while `status` stays at `'sent'` (or `'overdue'` if past due). Recommendation: **do NOT add invoice-level `partially_paid`**. The math model (`paid_minor` + `total_minor`) is sufficient at invoice level — the dunning email already shows "Total: £100, Paid: £30, Remaining: £70" from those columns. Adding a status would be duplicative state with no upside. The installment-level `partially_paid` was needed because the installment row had no `paid_minor` column — a different shape. Cross-reference A3: **deliberate parity break — invoice level uses scalars, installment level uses status enum**.

- **`overdue` exists as a real status** (in the enum) AND is a computed property (cron `installment-overdue-check` + `invoice-overdue-check` flip status when `due_date < today`). The dunning cron `overdue-reminders` filters on `WHERE status = 'overdue'` (`overdue-reminders/index.ts:37`) — relies on the column. The InvoiceDetail badge ALSO computes `isOverdue = status === 'sent' && due_date < today` for the visual (`InvoiceDetail.tsx:47`) — derives independently of the column. These can disagree if the cron hasn't run yet today: the badge shows "Overdue" while the DB still says "sent". Minor UX glitch (the visual is more eager than the data) but the behaviour is intentional and benign. **LOW**.

- **`'cancelled'` referenced in code, missing from enum.** `record_stripe_payment` and `recalculate_invoice_paid` both have branches `IF _invoice.status IN ('void', 'cancelled')` (e.g. `20260331160001_...sql:38, 64`; `20260417190000_...sql` recalc body). The enum has no `'cancelled'` value. Branches on it are dead code today — but if a future migration adds the enum value, the trigger has no handling for it (lines 20-30 don't include `cancelled`), so any transition out of `'cancelled'` would fall through and be silently allowed. **LOW (latent)**.

### Side effects of transitions

| Transition | Side effects observed in code |
|------------|-------------------------------|
| draft → sent | `useUpdateInvoiceStatus` UPDATE invoices SET status='sent' (`useInvoices.ts:282+`). NO `sent_at` column on invoices — the timestamp lives only in `audit_log` via the `audit_invoices` trigger. NO automatic email dispatch from the status change itself; the Send modal at InvoiceDetail.tsx:258 separately calls `send-invoice-email` edge function. NO Xero auto-sync from this transition (Xero sync only fires on the billing-run path per Section 3d). |
| sent → paid | Set by `recalculate_invoice_paid` (`20260417190000_...sql` recalc body) when `_net_paid >= total_minor` — UPDATE invoices SET paid_minor = _net_paid, status = 'paid'. NO `paid_at` column on invoices. Cascade to installments (post-A3): each non-void installment gets `recalculate_installment_status` called, which sets installment.paid_at. NO Xero sync. NO email to parent confirming receipt (the `payment_recorded` audit log fires; user-facing receipt depends on a separate flow in `stripe-webhook`). |
| sent → overdue | Cron-driven (`invoice-overdue-check/index.ts:37-44`). NO email at the moment of transition; reminder cadence handled separately by `overdue-reminders`. |
| overdue → paid | Same as sent → paid. |
| sent / overdue → void | `void_invoice` RPC at `20260315220002_...sql`. Side effects: clears `linked_lesson_id` on every invoice_item (line 25-27, so lessons can be re-billed); UPDATE invoices SET status='void', payment_plan_enabled=false (line 29); UPDATE invoice_installments SET status='void' WHERE status IN ('pending','overdue') (line 31-33 — note: post-A3, this misses `'partially_paid'` installments — see Section 4 cascade); restores any redeemed make_up_credits applied to the invoice (line 36-41); writes `audit_log` action='invoice_voided' (line 44-47). NO Xero sync. NO email to parent. **`payments` rows are NOT touched.** **`refunds` rows are NOT auto-created.** |

**Voiding a partially-paid invoice — what happens to existing payments?**
- (a) deleted: NO
- (b) **left as-is (selected behaviour)**: payments rows persist with `invoice_id` pointing at the now-voided invoice. `paid_minor` stays at whatever was paid.
- (c) marked voided themselves: NO (`payments` table has no `status` column with a `'voided'` value)
- (d) auto-refunded: NO

**Walked case** — operator voids a "sent" invoice with £30 already paid via Stripe:
- `void_invoice` succeeds (status='sent' is not paid/void, trigger allows sent → void).
- `invoices.paid_minor` stays at 3000.
- `invoices.status='void'`.
- `payments` row for £30 still exists, still attributes to this invoice.
- The accountant sees a voided invoice with a recorded payment against it — implicitly a £30 credit to the parent that nothing in the product visibly tracks. The £30 is real (in Stripe), but where does the parent see it? Nowhere — the invoice is voided, the dashboard "outstanding" subtracts paid_minor but the invoice is excluded from the totals.
- **Severity: HIGH.** Operator action that quietly orphans real money. No prompt at void-time saying "this invoice has £30 in payments — refund first?"; no auto-refund; no balance-brought-forward credit (Section 7). Filed Bucket A.

**Refund on a paid invoice — recalc fails silently:**
- `record_manual_refund` / `stripe-process-refund` / `handleChargeRefunded` all INSERT a `refunds` row, then call `recalculate_invoice_paid`.
- recalc computes `_net_paid < total_minor`, sets `_new_status = 'sent'`, executes `UPDATE invoices SET paid_minor = _net_paid, status = 'sent'`.
- `enforce_invoice_status_transition` trigger fires BEFORE UPDATE: `OLD.status='paid' IN ('paid','void')` → RAISE EXCEPTION.
- The recalc transaction aborts. `paid_minor` is not updated. `status` stays `'paid'`.
- The refunds row was committed earlier (separate Supabase client call). Caller's error handler:
  ```
  if (recalcError) console.error("Failed to recalculate invoice after refund:", recalcError);
  ```
  Logs and continues.
- **End state:** refunds.amount_minor=3000 exists, invoices.paid_minor still =10000, invoices.status still ='paid'. Internally inconsistent. Outstanding-amount math (`total − paid + refunded`) gives £30 owed, but status says paid → dunning excludes it. Parent received the refund cash but the LessonLoop ledger says the invoice is fully paid.
- **Severity: CRITICAL.** Live parent-facing wrong money on every refund of a paid invoice. Filed Bucket A.

**audit_log coverage:** the `audit_invoices` trigger (`supabase/migrations/20260120002039_5a489cca-...sql:96-98` per Section 3e) fires INSERT/UPDATE/DELETE — so transitions are captured in `audit_log` even though invoice columns lack timestamps. The trigger conflict above means a refund-on-paid attempt logs nothing because the UPDATE rolls back before the audit trigger fires (audit trigger is also on UPDATE, but a failed UPDATE doesn't write).

### Invoice edit after send

- **No edit UI.** Grep `src/` for `EditInvoiceModal|EditInvoiceForm|editInvoice` returns zero matches. Grep for `invoice_items.update(` returns zero matches in `src/`. The InvoiceDetail page exposes Send / Reminder / Record Payment / Refund / Void / Download PDF actions only (`InvoiceDetail.tsx:257-274, 484-501`).
- **No edit RPC.** `update_invoice_items` or similar does not exist in migrations.
- **Conclusion:** invoices and their line items are effectively **write-once after creation**. The only post-creation mutations are status changes (gated by the trigger) and `paid_minor` recomputation.
- **Sanctioned correction mechanism:** void-and-reissue. The voided invoice keeps its number; the new invoice gets a fresh number; nothing links them in the schema (no `superseded_by_invoice_id`). For credit-note flows (per Section 2 C6) the partial `is_credit_note` plumbing exists but is only reachable from the term-adjustment pipeline, not from a teacher-initiated correction.
- **Severity: MEDIUM (UX) / HIGH (audit cleanliness).** A teacher who undercharges by £5 on a sent invoice has to: void the invoice (losing the original number from active counters), create a brand new invoice with corrected amounts and new number, manually message the parent explaining. No "edit and send revised" path. No supersession link. The original invoice and its replacement are connected only by inference (same payer, similar items, voided around the same time). Cross-reference Section 2 C6 (credit-note SPEC).

### UI representation of state

- **Single badge** on InvoiceDetail (`InvoiceDetail.tsx:45-68`). Variants:
  - `draft` → secondary (grey)
  - `sent` → default (primary brand colour)
  - `paid` → default + custom green class (`bg-success`)
  - `overdue` → destructive (red)
  - `void` → outline (muted)
  - **Computed special:** `status === 'sent' && due_date < today` → renders "Overdue" (destructive) even before the cron has flipped the column. Visual eagerness ahead of data.
- **No partial-paid visual differentiation.** A `'sent'` invoice with `paid_minor = 0` and a `'sent'` invoice with `paid_minor = 30%` of total render with the same badge. The Totals block on the same page (`InvoiceDetail.tsx:395-451`) does show "Total / Paid / Outstanding" lines, so the partial state is *legible*, just not *signalled* by the status badge.
- **Action gating** (`InvoiceDetail.tsx:257-274`):
  - `draft`: Send button only (Reminder / Record Payment hidden).
  - `sent` or `overdue`: Reminder + Record Payment buttons (Send hidden).
  - `paid` and `void`: only Download PDF (Reminder + Record Payment + Send all hidden).
- **Void action** (line 588) is a separate card visible only when `status NOT IN ('paid','void')`, with a destructive AlertDialog confirming.
- **Severity: LOW** for the badge gap (legibility is fine; signalling could be richer). No partial_paid invoice state was deemed necessary above.

### Section 6 severity summary

- **CRITICAL: 1** (refund-on-paid trigger/recalc conflict — every refund of a paid invoice silently corrupts the ledger; live since the trigger was added in Feb 2026).
- HIGH: 2 (voiding a partially-paid invoice strands real money in `payments` with no refund and no balance-forward; cannot void a paid invoice through any in-product route — locking the operator out of the intended void+reissue correction flow).
- MEDIUM: 3 (no `sent → draft` recovery path for mistaken sends; no edit-after-send UI / RPC — must void+reissue; voiding leaves no `superseded_by` link to the replacement invoice).
- LOW: 2 (invoice "Overdue" badge can show before cron runs; `'cancelled'` referenced in branches but missing from enum — dead branches today, latent footgun).

**`partially_paid` at invoice level recommendation:** **NOT NEEDED** as a follow-on SPEC. The invoice already carries `paid_minor` + `total_minor`; adding a status would be duplicative. Installment-level `partially_paid` was needed because installments lacked an applied-amount column; that asymmetry is intentional and stays.
## Section 7 — Family Account / Balance Brought Forward

Sources read: `supabase/migrations/20260119232402_...sql:23-43` (guardians + student_guardians DDL), `supabase/migrations/20260222230314_...sql` (latest `get_parent_dashboard_data` RPC), `supabase/functions/create-billing-run/index.ts` (payer grouping at 595-660), `src/hooks/useParentPortal.ts` (portal balance surfaces), `src/pages/portal/PortalInvoices.tsx`, `src/pages/Students.tsx`, `src/pages/StudentDetail.tsx`, full directory scan of `src/pages/`, `src/components/`, `src/hooks/`, full repo grep for family/household/balance/credit concepts.

### Data model: does a family exist as a concept?

- **No `family`, `household`, or `billing_unit` table exists.** Grep for `family_id`, `household_id`, `payer_family_id`, `billing_unit_id` across migrations returns zero matches.
- **The de-facto billing unit is the guardian.** `guardians` table at `supabase/migrations/20260119232402_...sql:23-31` is a per-org entity with `full_name, email, phone`. `student_guardians` junction at lines 34-43 links many-to-many with `relationship (mother/father/guardian/other)` + `is_primary_payer boolean` + `UNIQUE(student_id, guardian_id)`.
- **One student → many guardians is supported.** Divorced / two-parent households → two `guardians` rows, one of them flagged `is_primary_payer=true`. The other guardian exists for contact purposes only.
- **One guardian → many students is supported.** A parent with 3 children at the same teacher is represented as 3 `student_guardians` rows pointing at the same `guardian_id`. This is the closest LessonLoop has to a "family".
- **Invoices are addressed to a single payer** — `invoices.payer_guardian_id uuid nullable` OR `invoices.payer_student_id uuid nullable` (one or the other is populated; both nullable at the column level). Resolved at billing-run time by `create-billing-run/index.ts:611-637`: if the student has a primary-payer guardian, the invoice's `payer_guardian_id` is that guardian; else if the student has an email, the invoice is addressed to the student directly (`payer_student_id`); else skipped with `'no_primary_payer'`.
- **No household entity binding two parents into a single billing unit.** A divorced household where Mum has `is_primary_payer=true` will receive all invoices; Dad is a contact. There is no concept of "shared parental liability" or "split invoice across both parents".

**Verdict: the "family" exists implicitly as (primary-payer guardian + their linked students), but only one guardian per household is the billing entity. Adequate for the common case; does not model the complex household split.**

### Rolling balance: does it exist?

- **No `guardians.balance_minor` column.** No `guardian_balance`, no `family_balance`, no `rolling_balance`, no `account_balance` anywhere in the schema.
- **No view, materialised view, or RPC that aggregates money across a family.** Grep for `family_outstanding`, `guardian_outstanding`, `get_family_balance` returns zero matches.
- **Closest thing: `get_parent_dashboard_data` RPC** at `supabase/migrations/20260222230314_c096f5c1-...sql:1-115`. Returns `outstanding_balance` per-guardian computed as:
  ```sql
  SELECT SUM(total_minor) FROM invoices
  WHERE payer_guardian_id = _guardian_id AND status IN ('sent','overdue') AND org_id = _org_id
  ```
  (line 88-94). **This is parent-facing only (called from parent portal), uses `total_minor` not `total_minor - paid_minor`, and does NOT subtract succeeded refunds, make-up credits, or any other adjustment.**
- **Bug — parent-facing inflated outstanding balance.** A partially-paid invoice (`total_minor=10000, paid_minor=3000`, status='sent') contributes `10000` to the reported balance instead of `7000`. Parent sees £100 outstanding on the portal dashboard while the Invoices page (`src/pages/portal/PortalInvoices.tsx:275`, which computes `total_minor - paid_minor` correctly) shows £70. Inconsistent numbers across two surfaces of the same portal. **Filed as Bucket A-6 — live parent-facing wrong-money-display.**
- **No teacher-side "family balance" surface anywhere.** Grep for a Parents / Guardians / Families list page returns none. Teacher's only aggregate invoice surface is `Invoices.tsx` (per-invoice listing with filters) and Dashboard's org-wide `outstandingAmount` counter.
- **How does a teacher answer "what does the Jones family currently owe me" today?** Either (a) open the Invoices page, filter/search by guardian name, mentally sum outstanding across invoices; (b) open StudentDetail for each student in the household and aggregate; or (c) leave the app for spreadsheet / support ticket.
- **Severity: CRITICAL SPEC.** This is the Section 7 headline finding. The absence of a rolling family balance is the single largest gap between LessonLoop and MMS-style positioning. Filed as C32 (family-account data model) and C33 (teacher-facing Parents page).

### Brought-forward balance when new invoice generated

- **Does not happen.** `create-billing-run/index.ts:712-726` builds each invoice row as a standalone document: subtotal from current-period line items, VAT computed, total derived. The `credit_applied_minor` column is NOT set (defaults to 0) — confirmed in Section 3b as the HIGH finding that billing run bypasses credit application entirely.
- **No query of "previous outstanding balance on this guardian"** before invoice insert. No logic that adds a "Balance brought forward" line item. Grep for `brought_forward`, `carryover`, `previous_balance` across migrations + src returns zero matches.
- **Each invoice is standalone** — has no forward/backward link to prior invoices for the same guardian except via the `billing_run_id` FK (different run, different invoice set). No notion of "running account".
- **No mechanism for "apply £30 credit from last month to this invoice" at creation time.** The `credit_applied_minor` column is only populated by `create_invoice_with_items` RPC (manual invoice creation) from make-up credit redemption — which is lesson entitlements, not money.
- **Severity: HIGH SPEC.** Filed as C37 — "Brought-forward balance on billing-run-generated invoices". Depends on C32 (family-account data model) to land first.

### Credits: what counts as a credit today?

| Mechanism | What it represents | Money or lesson entitlement? | Where it surfaces | Integrated into a unified balance? |
|-----------|--------------------|------------------------------|-------------------|------------------------------------|
| `make_up_credits` table (`20260124020340_d8ce35e7-...sql:6+`) | Right to one make-up lesson per credit; issued on absence, redeemed when a waitlist match happens OR via `create_invoice_with_items` credit-offset | **Lesson entitlement** (consumed by booking a make-up); can be *valued* in minor units via the credit_value_fallback chain, but is not real money-on-account | Parent portal's `useParentCredits` hook; teacher's `MakeUpCreditsPanel`; automatically redeemable at invoice creation time | ✗ Siloed. Value-when-redeemed only. |
| `invoices.credit_applied_minor` column | Snapshot of make-up credit value applied at the moment of invoice creation | **Derived money** at that moment, sourced from `make_up_credits`; zero for billing-run invoices | Invoice total math (subtotal + VAT − credit) | ✗ Per-invoice only. Not a rolling family balance. |
| `invoices.is_credit_note` column | Term-adjustment credit-note document (per Section 2 C6) | **Money** within the specific context of a term adjustment | Invoice PDF + detail page | ✗ Not reachable from a refund path; unrelated to family balance. |
| `refunds` table | Record of money returned to a parent via Stripe or manually | **Money** (outbound); reduces invoice `paid_minor` via recalc | Invoice payment history | ✗ Refunds aren't held as credit; they're direct payouts. No "refund → hold as family credit" option. |
| (nothing) | Family credit / overpayment / goodwill / balance brought forward | — | — | **Does not exist.** |

**Summary:** there are four distinct credit mechanisms today, and **none of them combine into a unified family credit balance**. Make-up credits are the only parent-visible "credit" but they are lesson entitlements, not money — a parent with 3 make-up credits cannot "cash them out" or apply them to a non-lesson invoice item. The word "credit" in the LessonLoop UI currently means "lesson voucher", which is a permanent semantic trap vs MMS's money-on-account usage.

### Multi-student household math

- **One invoice per primary-payer per billing period (not one per student).** `create-billing-run/index.ts:582-660` groups lessons by `payerType + payerId` (Map key `guardian-{id}` or `student-{id}`). A primary-payer guardian with 3 children gets ONE invoice per billing run, with 3 groups of line items (one per child).
- **Per-student line-item breakdown exists** — `invoice_items.student_id uuid` FK (Section 3e, DDL at `20260119234233_...sql:46`). InvoiceDetail renders each line item with its student_id; the PDF generator groups items by student. Operator can see "you owe £100 total = £60 for Alice + £40 for Bob" within one invoice.
- **Severity: NONE.** This part works as a UK-teacher expects. The multi-student→single-invoice bundling is a legitimate "family" feature at the invoice level, even without a family-balance layer above.

### Guardian-facing UI

Per `src/pages/portal/*` + `src/hooks/useParentPortal.ts`:

| Capability | Present today? | Evidence |
|------------|---------------|----------|
| See all invoices across all children on one page | ✓ | `PortalInvoices.tsx` lists all invoices where `payer_guardian_id = guardian.id`. Also shows per-student invoices where the student is in this guardian's `student_guardians`. |
| Running family balance | ✗ (bug) | `PortalHome` consumes `useParentDashboardData`, which returns `outstanding_balance` from the RPC using `SUM(total_minor)` — inflated for partial-paid invoices. No credit subtraction. |
| Upcoming charges (payment plans, pending lessons this month) | Partial | Installments visible via `PaymentPlanInvoiceCard`. Pending lessons this month → no billing preview ("you'll be charged £X for April"). |
| Credits accrued | Partial (lessons only) | `useParentCredits` shows make-up credit count + value. No money-on-account — it doesn't exist. |
| Bulk pay multiple invoices in one transaction | ✗ | Each invoice → one Stripe checkout per `PaymentDrawer.tsx`. No "pay all 3 outstanding invoices" button. |

### Teacher-facing UI (parents list page)

- **No Parents, Guardians, or Families route in `src/pages/`.** Grep for any such file returns none.
- **Only guardian surface teachers have** is through `StudentDetail` (shows this student's guardians) and the Invoices filter dropdown (can filter by payer guardian name).
- **No balance column per family anywhere** — because the column doesn't exist.
- **Cannot sort "most owed first"** — no family-balance value to sort by.
- **Cannot filter to "families with any overdue invoice"** — only filter is per-invoice status.
- **Cannot see last-payment-date per family** — no such aggregate.
- **Severity: CRITICAL SPEC.** This is the teacher-facing half of the C32 gap. Filed as C33.

### Adjustments / manual credits / write-offs

- **Manual goodwill credit: does NOT exist as an RPC or UI.** Grep for `goodwill`, `apply_credit_to_family`, `manual_credit`, `adjust_balance`, `write_off` returns zero matches.
- **Workarounds today:**
  - "Give a £10 goodwill credit" → create an invoice for -£10 and immediately mark it paid (hacky, uses the `is_credit_note` path indirectly, breaks invoice numbering coherence).
  - "Write off a bad debt" → void the unpaid invoice (using `void_invoice` — per A5 fix, works only if `paid_minor = 0`). Loses the "we gave up on this" story; no dedicated "written off" state.
- **Severity: HIGH SPEC.** Filed as C35.

### Payment reconciliation at family level

- Walk: parent sends £200 bank transfer, no invoice reference, no family has that exact amount outstanding.
- Today: teacher must pick ONE invoice to record the payment against (`useRecordPayment` requires `invoice_id`). The payment's amount cannot exceed the chosen invoice's outstanding (P1 over-application guard per Section 1).
- **Cannot spread £200 across 3 invoices.** No payment-allocation table, no `allocate_payment_to_invoices(...)` RPC. `payments.invoice_id` is NOT NULL.
- **Cannot hold £200 as family credit for future invoices.** No family-credit concept.
- **Only option: split mentally into N sub-payments, record each against a different invoice.** If £200 doesn't evenly match outstanding amounts, one payment might have to be over-applied (rejected by P1 guard) or the parent credits get stranded.
- **Severity: HIGH SPEC.** Filed as C34.

### Comparative benchmark — MMS gap

| Benchmark capability | LessonLoop current | MMS current | Gap severity |
|----------------------|---------------------|-------------|--------------|
| Per-family rolling balance as a first-class number | ✗ | ✓ (headline feature) | **CRITICAL** |
| Teacher sees family balance on a list page with sort/filter | ✗ | ✓ | **CRITICAL** |
| Parent sees unified balance on portal (not per-invoice) | Partial (buggy summation, no credits) | ✓ | HIGH |
| Brought-forward previous balance on new invoice | ✗ | ✓ | HIGH |
| Family credit (money on account, distinct from lesson credits) | ✗ | ✓ | HIGH |
| Multi-invoice payment allocation (one payment, many invoices) | ✗ | ✓ | HIGH |
| Bulk pay multiple invoices (parent portal) | ✗ | ✓ | MEDIUM |
| Manual goodwill credits | ✗ | ✓ | MEDIUM |
| Bad-debt write-off as a distinct status | ✗ | ✓ | MEDIUM |
| Multi-student single invoice with per-student breakdown | ✓ | ✓ | NONE (LessonLoop competitive) |
| Multi-guardian household with one primary payer | ✓ (partial — two guardians modelled but no split liability) | ✓ | LOW |

**Positioning reality:** on the family-account axis, LessonLoop today cannot credibly claim parity with MMS. The most visible gap (rolling family balance) is the single biggest differentiator, and its absence makes "balance brought forward", "goodwill credits", "bulk pay", "family-first invoicing" all unreachable.

### Bucket assignments

- **Bucket A (live parent-facing wrong money TODAY):**
  - **A6** — `get_parent_dashboard_data` inflated outstanding balance via `SUM(total_minor)` instead of `SUM(total_minor - paid_minor)`. Parent portal dashboard contradicts Invoices page (which does the right math). Simple fix: one-line SQL change to subtract `paid_minor`. Cross-reference with Section 3e C20 (per-credit breakdown) because the real fix also subtracts credit value, but the minimal patch is the arithmetic correction.

- **Bucket C (SPECs — design endpoints):**
  - **C32** — Family-account data model: `family_credits` (money) + per-guardian rolling balance view + brought-forward mechanism.
  - **C33** — Teacher-facing Parents / Families list page with balance column, sort by "most owed", filter by overdue.
  - **C34** — Multi-invoice payment allocation (one £200 payment, split across 3 invoices).
  - **C35** — Manual goodwill credits + bad-debt write-off as first-class actions.
  - **C36** — Bulk pay multiple invoices from parent portal in a single Stripe checkout.
  - **C37** — Brought-forward balance as a line item on billing-run-generated invoices (depends on C32).
  - **C38** — Rename in-product "credit" concept: currently "credit" = lesson entitlement (make_up_credits); post-C32 "credit" should be unambiguously money-on-account. Either rename make_up_credits to "makeup entitlements" everywhere, or introduce "money credits" with a clearly distinct term.
  - **C39** — Two-guardian shared liability (split invoice across Mum + Dad). Not a day-one requirement; most UK music schools assign one primary payer. Defer.

### Strategic summary

> The minimum data-model work to credibly position LessonLoop as an MMS-replacement on the family-accounts front is four pieces: (1) a `family_credits` table holding money-on-account keyed by guardian, with sources distinguished (`refund`, `overpayment`, `goodwill`, `write_off`); (2) a `get_family_balance(_guardian_id)` RPC returning `SUM(outstanding invoices) − SUM(available family_credits)` with the same arithmetic rigour as `recalculate_invoice_paid`; (3) a teacher-facing Parents list page surfacing that balance per family with sort/filter; (4) a brought-forward mechanism inside `create-billing-run` that queries the family balance and inserts a `"Balance brought forward"` line item on the new invoice when non-zero. Plus renaming the existing "credit" concept so "makeup credit" and "money credit" are never confused. Everything else — multi-invoice payment allocation, bulk pay, goodwill credits, write-off status — is a natural extension once the balance primitive exists. Estimate: 4-6 weeks of focused product work. The A5 fix's C31 (family-credit conversion on void) and the Section 2 C6 credit-note gap both collapse into this work. Until it lands, the most honest positioning is "LessonLoop owns the per-invoice billing rigour; MMS still owns the family account". After it lands, LessonLoop has a credible "UK-native, per-family, rigorous" story.
## Section 8 — UK-specific billing gap analysis (internal spec)

Gap-analysis section, not a bug hunt. Output is a roadmap input for Session 2. Defaults to Bucket C (SPEC). Cross-references prior queue items rather than re-creating them.

### Part 1 — Current state assessment

#### 1. Currency + VAT

- **Currency:** `organisations.currency_code TEXT NOT NULL DEFAULT 'GBP'` (`supabase/migrations/20260119231348_...sql:11`). Org-configurable at creation; default GBP. Stripe `stripe_checkout_sessions.currency_code TEXT NOT NULL DEFAULT 'gbp'` (`20260121120401_...sql:10`) — lowercase convention for Stripe API. Currency flows through to `invoices.currency_code`, `payments.currency_code`, `refunds.currency_code` consistently.
- **VAT:** org-level single-rate model. `organisations.vat_enabled BOOLEAN DEFAULT false`, `vat_rate NUMERIC(5,2) DEFAULT 0`, `vat_registration_number TEXT` (`20260119231348_...sql:13-15`). Each invoice stores `vat_rate` at creation time (good — retroactive rate changes don't affect past invoices).
- **VAT per-line classification: ABSENT.** No `invoice_items.vat_rate` column; no enum for zero-rated / exempt / reduced (5%). UK music teaching is generally VAT-exempt for under-18 pupils taught by a VAT-registered individual sole trader under the "education" exemption — but a VAT-registered limited company providing the same tuition is standard-rated. No flag to distinguish. **Severity: Bucket C (SPEC)** — filed as C45.
- **Non-VAT-registered rendering:** `src/hooks/useInvoicePdf.ts:324-327` conditionally renders `VAT: {vat_registration_number}` only when the column is set. PDF correctly omits VAT ref for non-registered orgs. The VAT **percentage** line in the invoice totals block (`:447`) renders whenever `inv.vat_rate > 0` — which is tied to `invoices.vat_rate` stored at creation from `org.vat_rate`. Non-VAT-registered orgs with `vat_enabled=false` get `vat_rate=0` and no VAT line renders. **Current state: works correctly for both registered and unregistered.**
- **VAT threshold monitoring (£90k rolling 12 months, UK 2024/25):** ABSENT. No org-level rolling-12-month turnover query; no warning when an org crosses the threshold. Solo teachers typically below threshold but growing agencies can silently cross it. **Severity: Bucket C (SPEC)** — filed as C43.

#### 2. Payment rails

- **`payment_method` enum** (`supabase/migrations/20260119234233_...sql:10`): `'card'`, `'bank_transfer'`, `'cash'`, `'other'`. Cash + BAC are first-class. No `'direct_debit'` value.
- **`payment_provider` enum** (line 11): `'stripe'`, `'manual'`. No GoCardless provider.
- **Stripe:** full integration (Section 3d / Xero OAuth + Section 4 auto-pay).
- **GoCardless (UK Direct Debit, Bacs Core Scheme):** ABSENT. Grep across `supabase/functions/`, `src/` for `gocardless|direct.debit|bacs.core` returns zero code hits; only blog content references it. UK music schools and agencies heavily use Direct Debit for recurring monthly fees (mandated + 3-4% fee vs Stripe's 1.4% + 20p for UK cards, but zero decline risk). **Severity: Bucket C (SPEC)** — filed as C40. Highest payment-rail gap for UK positioning.
- **BACS details on invoice PDF:** YES. `org.bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix` (`useInvoicePdf.ts:62-65`), rendered at line 603 as `Sort Code: ... Account: ...` block. Good.
- **Bank transfer manual recording:** supported via `useRecordPayment` with `method='bank_transfer'`. Section 5 C27 already flags that dunning emails don't surface the BACS details (only the Stripe Pay Now CTA).
- **Parent UX:** parent portal offers only Stripe card payment via `PaymentDrawer`. To pay by BACS the parent reads the bank details off the PDF and initiates the transfer separately; the teacher then records the payment manually.

#### 3. Invoice PDF HMRC compliance

Walk of `src/hooks/useInvoicePdf.ts` against HMRC invoice requirements:

| HMRC requirement | LessonLoop PDF | File:line |
|------------------|---------------|-----------|
| Unique invoice number | ✓ `UNIQUE(org_id, invoice_number)` enforced (`20260119234233_...sql:33`); rendered at top of PDF | `useInvoicePdf.ts` near line 150 |
| Invoice date | ✓ `issue_date` rendered in "BILL TO + DATES" block | near line 340 |
| Seller name + address | ✓ `invoice_from_name/address_line1/city/postcode/country` | `:53-58, :283-322` |
| Seller VAT number (if registered) | ✓ Conditional render | `:324-327` |
| Buyer name | ✓ `payer_guardian.full_name` or student fallback | `:333-335` |
| Description of service | ✓ per line item | `items[].description` |
| Rate per unit and total | ✓ `unit_price_minor`, `amount_minor` | per line |
| VAT amount | ✓ Conditional on `inv.vat_rate > 0` | `:447` |
| Gross total | ✓ `total_minor` | near totals block |

**All HMRC line-items present.** But two structural concerns:

- **Invoice number sequencing (Bucket C).** `generate_invoice_number` at `supabase/migrations/20260119234233_...sql:78-100` uses `SELECT COUNT(*) + 1` filtered by year prefix. This is **non-gap-tolerant**: if any invoice is hard-deleted (e.g. via `delete_billing_run` RPC, which does DELETE on draft invoices of a failed run), the next generated number REUSES the deleted slot. HMRC accepts sequential gaps with justification but does NOT tolerate duplicate numbers across an audit trail. The `UNIQUE(org_id, invoice_number)` constraint prevents the 2nd insert from succeeding, but an audit later comparing deleted+regenerated invoices would find that number N was associated with two different issue dates via `audit_log`. Fix: use a Postgres SEQUENCE per org, persisted monotonically. **Severity: Bucket C (SPEC) — filed as C42.** Not Bucket A because no evidence of deletion-then-regeneration happening today.
- **Concurrent-insert race.** `COUNT(*) + 1` under concurrent inserts can return the same value to two sessions; one gets 23505 UNIQUE violation. `create-billing-run` batch inserts multiple rows — per-row BEFORE triggers rely on Postgres `CommandCounterIncrement` between rows so later triggers see earlier rows. Works in practice; would break on direct UPDATE-via-API concurrent billing runs across two admins in the same org. Same fix as C42.

#### 4. Bank holidays and term dates

- **Bank holidays:** covered by C11 (Section 3c). Not re-audited.
- **Terms table** (`supabase/migrations/20260209170759_...sql:3-12`): `id, org_id, name, start_date, end_date, created_by, UNIQUE(org_id, name)`. Per-org configurable.
- **NOT pre-seeded with UK state-school term dates.** No seed data per nation (C12 dependency). No fetch-from-external-source logic. Operator must manually create "Autumn 2025", "Spring 2026" etc. each year.
- UK reality: state schools follow a 3-term pattern broadly standardised via local authorities. Private schools differ (usually 3 longer terms). Music academies often align with the state pattern. Pre-seeding UK state-school term dates per nation (C12 dep) is a clear UK-native win MMS doesn't deliver.
- **Severity: Bucket C (SPEC)** — filed as C41. Depends on C12 (four-nation field).

#### 5. Payment dates vs UK banking conventions

- **No weekend / working-day awareness** in due_date logic. `invoice-overdue-check` cron (Section 5) transitions `sent → overdue` on calendar days regardless of weekend / bank-holiday.
- **No BACS 3-working-day float buffer.** An invoice with due_date Friday and a BACS payment initiated Thursday takes until Tuesday to settle; the cron flags overdue Monday and dunning emails Tuesday morning — for a parent whose money is in flight.
- Already covered by existing C24 (Section 5 — bank-holiday / weekend suppression on dunning). The BACS-float aspect extends C24's scope: the fix needs not just "skip weekends/holidays" but also "give N-day grace after due date for BACS-expected payments". Note as addendum to C24 rather than separate C item.

#### 6. Parent / guardian legal concerns

- **GDPR exports:** `supabase/functions/gdpr-export/index.ts` and `gdpr-delete/index.ts` exist. Subject-access-request flow is plumbed.
- **Retention policy: ABSENT.** No `organisations.data_retention_months` column; no automatic purge of ex-student invoices after N years. HMRC requires financial records retention for 6 years; GDPR requires active-minimisation for non-financial personal data. No opinionated handling — orgs keep everything forever by default. **Severity: Bucket C (SPEC)** — filed as C47.
- **Email consent:** covered by Section 5 C25 (guest-parent opt-out gap). Not re-audited.

#### 7. Accounting integration

- **Xero:** full bi-directional integration (confirmed in Section 3d post-Xero unblock). Orgs can sync invoices + payments.
- **GoCardless → Xero:** N/A without GoCardless (C40).
- **QuickBooks:** ABSENT. `supabase/functions/` contains no qb-* functions; grep returns zero hits.
- **FreeAgent:** ABSENT. Popular with UK sole traders (solo music teachers). Would be a differentiator.
- **Sage:** ABSENT.
- **HMRC Making Tax Digital:** indirect via Xero's own MTD submission. LessonLoop has no direct HMRC hook and realistically doesn't need one — Xero handles MTD filing — but the audit trail from LessonLoop → Xero → HMRC needs to be clean. Section 3d B6 (webhook orphan-audit gap) + SPEC-TRACE items (C17) are relevant. **Severity: Bucket C (SPEC) for QuickBooks + FreeAgent** — filed as C46.

#### 8. Teaching-specific UK concerns

- **Pass-through expenses (ABRSM / Trinity / RSL / LCM exam fees):** NOT distinguished. No `invoice_items.is_pass_through` flag. Teacher billing "Grade 4 exam fee £65" to parent treats it as taxable service revenue if the teacher is VAT-registered — which is wrong for a pure pass-through. The teacher's HMRC return will over-state turnover. **Severity: Bucket C (SPEC)** — filed as C44. Common UK flow; real impact on teachers' own tax filings.
- **Group lessons:** billed per-participant via `lesson_participants.rate_minor` (Section 3b). Each participant has their own snapshot rate, each becomes a line item on the payer's invoice. UK norm is per-head for group lessons — LessonLoop matches.
- **Makeup lessons:** handled via `make_up_credits` (Section 4). Parent-facing surface shows credit count + value (Section 7 noted the "credits" semantic trap — C38).

#### 9. Multi-location teachers

- **`locations` table** (`supabase/migrations/20260119231833_...sql:53`) + `closure_dates.location_id` already permit multi-location per org.
- **No `teacher_locations` junction.** Grep returns zero hits. Teachers aren't explicitly assigned to a subset of locations. Lessons carry `location_id` per-lesson, so a peripatetic teacher teaching at 3 schools just creates lessons with different location_id values.
- **Billing works per-lesson-location** naturally — each invoice_item's linked_lesson carries the location, PDF can reference it in the line item description. **What does NOT work:** the PDF header still shows the ORG's `invoice_from_address_line1...invoice_from_country` (`useInvoicePdf.ts:53-58`), not the location's address. A UK peripatetic teacher invoicing for lessons at "Ealing Primary" would want the PDF to say "Lessons at Ealing Primary, W5 5AA" in the Bill-from block. Not a common demand but flag as minor UX.
- **Severity: Bucket C (SPEC) for teacher-locations junction + per-location-invoice-address** — filed as C48. Low priority; most UK music teachers with multiple locations are happy billing from their one registered address.

#### 10. UK music-education-specific wins MMS doesn't deliver

The structural UK-native wins LessonLoop can ship that MMS's US-centric model cannot:

| Capability | Why MMS can't | What LessonLoop needs |
|------------|---------------|------------------------|
| Auto-seeded UK bank holidays per nation | No `country_subdivision` column in MMS data model | C11 + C12 |
| Auto-seeded UK state-school term dates per nation | Same — no nation awareness | C12 + C41 |
| GoCardless Direct Debit as first-class payment rail | Stripe-only US-centric | C40 |
| HMRC-compliant invoice sequencing (gap-safe) | Non-issue in US | C42 |
| VAT threshold monitor + auto-register prompt at £90k | US has state sales tax, not VAT | C43 |
| Per-line VAT classification (exempt for under-18s, standard for adults) | US sales tax is flat | C45 |
| Pass-through expense distinction (exam fees) | US doesn't have ABRSM/Trinity equivalent | C44 |
| BACS details on invoice + portal multi-rail UX | US uses ACH/cards, BACS is UK-specific | existing + C40 |
| GDPR-compliant retention policy | CCPA is looser; MMS built for US | C47 |
| UK-native Xero/FreeAgent accounting stack | MMS integrates QuickBooks (US-centric) | existing + C46 |

**No UK-specific Bucket A live bugs surfaced.** The gaps are all SPEC / design endpoints, not live corruption.

---

### Part 2 — UK-native roadmap priority list for Session 2

| Priority | Item | PMF impact | Eng cost | Dependencies | Suggested Session 2 position |
|----------|------|-----------|----------|--------------|------------------------------|
| 1 | **C12 — Four-nation field on `organisations`** | HIGHEST — unlocks C11, C41, future regional features. Teachers explicitly ask for "Scotland-aware" scheduling. | Low (1 column + onboarding UX) | None — foundational | Week 1. Land first, everything else hangs off it. |
| 2 | **C11 — UK bank holidays auto-seeded per nation** | HIGHEST — marketing already claims it. "Closed on Christmas Day" and "emailed me on a bank holiday" are the two loudest MMS complaints. | Medium (C12 dep + data source decision + seed + cron) | C12 | Week 1-2. |
| 3 | **C32 — Family-account data model (Section 7)** | HIGHEST — the single biggest MMS-parity gap. Until this lands, teachers telling us they can't switch is correct. | High (4-6 weeks focused) | None | Weeks 3-8. Parallel with C11/C12 or sequential. |
| 4 | **C40 — GoCardless Direct Debit integration** | HIGH — UK teachers lean on DD for recurring fees; Stripe-only leaves money on the table (DD is cheaper per transaction + zero decline for in-mandate payments). | Medium-high (3-4 weeks: OAuth + mandates + webhooks + refund flow + Xero pass-through) | None | Weeks 5-8 (parallel with C32). |
| 5 | **C42 — HMRC-safe invoice number sequencing** | MEDIUM — latent compliance risk; immediate fix value for any VAT-registered org. | Low (1 week: Postgres sequence per org + migration + backfill) | None | Week 2 (small parallel task). |
| 6 | **C44 — Pass-through expense flag on invoice_items** | MEDIUM — impacts teacher's OWN HMRC filings; real money story per teacher. | Low-medium (1-2 weeks: column + invoice total math + PDF render + Xero mapping) | None | Week 3. |
| 7 | **C41 — Pre-seeded UK state-school term dates per nation** | MEDIUM-HIGH — supplies the "it just knows" moment. Lands alongside C11 for double UK-native win. | Low (1 week: data work + seed migration + yearly refresh cron) | C12 | Week 3-4 (bundled with C11 release). |
| 8 | **C24 — Dunning bank-holiday + weekend suppression + BACS float** | MEDIUM — completes the C11 story at the parent-facing surface. "My teacher stopped sending harassment emails at Christmas" is a real anecdote. | Low-medium (1-2 weeks once C11 lands) | C11, C12 | Week 4-5. |

Items not in the top 8 (deferred to Session 3 or later):
- C33 (Teacher Parents list page) — depends on C32, bundle with it.
- C25 (guest-parent opt-out / GDPR) — Bucket B priority, Session 2 cleanup.
- C43 (VAT threshold monitor), C45 (per-line VAT), C46 (QuickBooks/FreeAgent), C47 (retention policy), C48 (teacher-locations) — all legitimate but lower PMF per week of engineering. Park for Session 3.
- C13 (closure_dates date-range) — small quality-of-life, bundle into whichever week is lightest.
- C31 (family-credit conversion on void, A5 upgrade) — depends on C32; ships naturally alongside.

**Top-level takeaway:** Session 2's UK-native story ships in 3 beats. **Beat 1 (weeks 1-2):** C12 + C11 + C42 — four-nation, bank holidays, invoice sequencing. These are low-cost, high-visibility, and don't block on anything. **Beat 2 (weeks 3-6):** C41 + C44 + C24 — term-date seeding, pass-through expenses, dunning suppression. Midway, C32 family-account work starts in parallel. **Beat 3 (weeks 5-8):** C40 GoCardless + C32 family accounts wrap together. End of Session 2, LessonLoop can credibly say "we're the UK-native MMS alternative" with receipts.
## Section 9 — Audit trail synthesis

Sources: `supabase/migrations/20260120002039_5a489cca-...sql:1-108` (audit_log DDL + log_audit_event function + trigger bindings), `supabase/migrations/20260130162532_...sql:176-179` (teachers audit trigger), `supabase/migrations/20260201204906_...sql:65-67` (internal_messages audit trigger), `src/hooks/useAuditLog.ts` (consumer hook), `src/components/settings/AuditLogTab.tsx` (UI), prior section findings (C17 / C18 / C19 / B10 / B11 / B12 / B13).

### Event inventory

Scope: every billing-adjacent event. Column legend: **Persisted where** — "audit_log (generic)" = row-level trigger via `log_audit_event`; "audit_log (manual RPC)" = explicit `INSERT INTO audit_log` inside an RPC body; "side table" = dedicated table; "ephemeral" = console log only / no DB record.

| Event | Entity | Emitter | Persisted where | Teacher-visible surface | Gap severity |
|-------|--------|---------|-----------------|-------------------------|--------------|
| Invoice created (manual) | invoices | `create_invoice_with_items` RPC + audit_invoices trigger | audit_log (generic) | Settings → Audit Log (org-wide filter) | MEDIUM — no per-invoice drill-down |
| Invoice created (billing run) | invoices | `create-billing-run` + audit_invoices trigger | audit_log (generic) + `invoices.billing_run_id` FK | Audit log + billing-run summary | MEDIUM — same |
| Invoice status transition (draft→sent / sent→paid / sent→overdue / sent→void / paid→sent refund / void blocks) | invoices | `enforce_invoice_status_transition` trigger + audit_invoices trigger | audit_log (generic) UPDATE with before/after status | Audit log | MEDIUM |
| Invoice line items edited | invoice_items | — | **ephemeral** (no audit trigger — B12) | ✗ | **HIGH — B12 already filed** |
| Invoice sent to parent (email dispatched) | invoices + message_log | `send-invoice-email` edge fn | `message_log` table (has its own row per sent email) + audit via invoice status change | Audit log (coarse); message_log not surfaced to teachers today | MEDIUM |
| Payment received (manual recording) | payments | `record_payment_and_update_status` RPC — manual audit INSERT + audit_payments trigger | **doubly logged**: audit_log (generic via trigger) + audit_log (manual with action='payment_recorded') | Audit log | LOW — cosmetic duplication |
| Payment received (Stripe webhook) | payments | `record_stripe_payment` RPC + audit_payments trigger | audit_log (generic only — webhook doesn't write manual audit entry per Section 1 finding #4) | Audit log (generic action='create') | MEDIUM — missing the rich "payment_recorded" action metadata |
| Payment refunded (manual via record_manual_refund) | refunds | `record_manual_refund` RPC — manual audit INSERT | audit_log (manual, action='manual_refund_recorded') | Audit log (text-only); Invoice detail payment history shows refund rows | MEDIUM |
| Payment refunded (Stripe webhook) | refunds | `handleChargeRefunded` | audit_log (manual, action='refund_recorded') **IF NOT** the orphan-reconciliation branch (B6) | Audit log | MEDIUM — B6 orphan-recon skips audit |
| Payment refunded (admin via stripe-process-refund) | refunds | `stripe-process-refund` | audit_log (manual, action='refund_processed') | Audit log + invoice payment history | LOW |
| Installment paid via auto-pay | invoice_installments + payments | `record_stripe_payment` RPC (via webhook) | audit_log (via audit_payments generic trigger — **installments table has no audit trigger**) | Audit log shows the payment row; no installment-level log | **HIGH — new finding for this section** |
| Installment flipped to partially_paid | invoice_installments | `recalculate_installment_status` helper (A3 fix) | **ephemeral** — no audit trigger on invoice_installments | ✗ | HIGH |
| Installment status → overdue (cron) | invoice_installments | `installment-overdue-check` / `invoice-overdue-check` crons | **ephemeral** — cron console log only | ✗ | MEDIUM |
| Reminder email sent (overdue + upcoming) | — | `overdue-reminders` / `installment-upcoming-reminder` / `auto-pay-upcoming-reminder` crons | `message_log` table (per-email row) | ✗ in invoice / installment UI; visible only in Settings → Audit Log as implied (but message_log is not joined) | **HIGH — B11 already filed** |
| Credit applied to invoice (make-up redemption) | invoices.credit_applied_minor + make_up_credits | `create_invoice_with_items` RPC (manual) | audit_log (manual, action='invoice_created' with credit details in `after`) | InvoiceDetail shows `credit_applied_minor` total only; no per-credit breakdown | MEDIUM — C20 already filed |
| Make-up credit issued | make_up_credits | `auto_issue_credit_on_absence` trigger | **ephemeral** — no audit trigger on make_up_credits | Parent portal credit widget shows current state, not history | MEDIUM |
| Make-up credit consumed | make_up_credits | various trigger updates | **ephemeral** | Same | MEDIUM |
| Lesson added / edited / cancelled | lessons | audit_lessons trigger | audit_log (generic) | Audit log; Calendar UI doesn't surface history per-lesson | MEDIUM |
| Billing run executed (with stats) | billing_runs | `create-billing-run` edge fn | **no audit trigger on billing_runs** → ephemeral in audit_log terms; `billing_runs.summary` jsonb captures stats but is written by the fn not the trigger | Billing run detail page (shows summary) | MEDIUM |
| Billing run deleted | billing_runs + invoices | `delete_billing_run` RPC | audit_log (manual entry) — filed per `20260316210000_...sql` | Audit log (text-only) | LOW |
| Closure date added / removed | closure_dates | direct DB INSERT/UPDATE/DELETE via RLS | **ephemeral** — no audit trigger | ✗ | MEDIUM — paired with C19 closure-skip persistence |
| Teacher added / removed | teachers | audit_teachers_changes trigger (`20260130162532_...sql:176-179`) | audit_log (generic) | Audit log | LOW (covered) |
| Student added / removed | students | audit_students trigger | audit_log (generic) | Audit log | LOW (covered) |
| Guardian added / linked to student | guardians + student_guardians | **no audit trigger** on either table | **ephemeral** | ✗ | MEDIUM |
| Xero connection created / disconnected | xero_connections | edge fn UPDATEs | **no audit trigger** | Settings → Accounting | MEDIUM — stable state visible, transition history invisible |
| OAuth scope change | xero_connections | — | ephemeral | ✗ | LOW |
| Payment plan created (generate_installments) | invoice_installments | `generate_installments` RPC — manual audit INSERT | audit_log (manual, action='payment_plan_created') | Audit log | LOW (covered) |
| Payment plan cancelled | invoice_installments | `cancel_payment_plan` RPC — manual audit INSERT (added in A5 fix) | audit_log (manual, action='payment_plan_cancelled') | Audit log | LOW (covered post-A5) |

**Event-inventory severity tally:** 2 HIGH (installment-level events both uncovered, plus reminder log B11), 11 MEDIUM (mostly "data exists in audit_log but no per-entity UI drill-down"), 6 LOW.

### Audit trigger coverage

**Tables WITH audit triggers** (via `log_audit_event`):
- `students` (`20260120002039_...sql:86-88`)
- `lessons` (`:91-93`)
- `invoices` (`:96-98`)
- `payments` (`:101-103`)
- `org_memberships` (`:106-108`)
- `ai_action_proposals` (`20260120002350_...sql:93-95`)
- `teachers` (`20260130162532_...sql:176-179`)
- `internal_messages` (`20260201204906_...sql:65-67`)

**Billing-adjacent tables WITHOUT audit triggers:**
- `invoice_items` (B12 filed) — line-item edits invisible
- `invoice_installments` — installment state transitions invisible (A3 cascade, auto-pay flips, overdue transitions all ephemeral)
- `refunds` — only captured via the manual audit INSERT in whichever RPC created the row; DELETE or UPDATE of a refund leaves no trail
- `make_up_credits` — issue / redeem / void cycle invisible
- `billing_runs` — execution metadata in `summary` jsonb on the row itself but no timeline
- `closure_dates` — add/remove/edit invisible (relevant to C19)
- `guardians` — GDPR-relevant changes invisible
- `student_guardians` — relationship / primary-payer changes invisible
- `rate_cards` — C8 filed (wider docs claimed coverage that doesn't exist)
- `xero_connections`, `xero_entity_mappings` — connection-lifecycle invisible

**Trigger pattern consistency:** one shape via `log_audit_event()` (`20260120002039_...sql:36-83`). Uses `TG_TABLE_NAME` for `entity_type`, `NEW.id`/`OLD.id` for `entity_id`, `NEW.org_id`/`OLD.org_id` for `org_id`, `auth.uid()` for `actor_user_id`. Consistent — but the table-plural naming (`'invoices'` via `TG_TABLE_NAME`) collides with many manual RPC audit entries using `'invoice'` singular (e.g. `record_payment_and_update_status` at `20260401000000_...sql:106`, `record_manual_refund` at `20260331160000_...sql:77-80`, `void_invoice` at `20260315220002_...sql:45`). **Query fragility — anyone filtering `WHERE entity_type = 'invoice'` misses half the events; filtering `'invoices'` misses the other half.** Flag as a new finding in this section.

### Audit log shape — is it useful?

- **Schema** (`20260120002039_...sql:2-12`): `id, org_id, actor_user_id (nullable), action text, entity_type text, entity_id uuid, before jsonb, after jsonb, created_at`.
- **Indexes:** `org_id`, `entity_type`, `created_at DESC`, `actor_user_id`. **No index on `entity_id`**, no composite `(entity_type, entity_id)` index.
- **Query "all events for this invoice":** would be `WHERE entity_type IN ('invoice','invoices') AND entity_id = '<uuid>'`. Plan: index scan on `entity_type` → filter on `entity_id` (sequential). OK for small orgs (hundreds of rows per entity_type), increasingly slow for large orgs. Add `CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id)` when needed.
- **Query "all events for this guardian across their invoices":** impossible via a single audit_log query — `guardians` has no audit trigger, and invoice events are keyed by `entity_id = invoice.id`, not `guardian_id`. The join would be `audit_log al JOIN invoices i ON i.id = al.entity_id WHERE i.payer_guardian_id = X AND al.entity_type IN ('invoice','invoices')`. Plus union with payment events (entity_id = payment.id JOIN payments JOIN invoices). Doable but not a single index-friendly query. **This is the Section 7 family-account visibility gap expressed in audit-log terms.**
- **Actor capture:** `auth.uid()` into `actor_user_id`. Webhook-driven writes (Stripe refund, webhook-initiated) run under service role — `auth.uid()` is NULL. So webhook-derived events show `actor_user_id = NULL` → `useAuditLog.ts:94` renders as `'System'`. Correct behaviour; parents/teachers see "System" for automated events.
- **Retention:** no retention policy. No cron purges old audit_log rows. Long-running orgs accumulate indefinitely. Cross-reference C47 (retention policy SPEC).

### Missing audit surface

- **Generic org-wide audit UI: exists.** `src/components/settings/AuditLogTab.tsx` via `useAuditLog` hook. Admin-only (RLS gated). Filters by entity_type, action, date range. Limit 100–200 rows. Renders with `getChangeDescription()` helper that has cases for `students/lessons/invoices/payments/org_memberships`.
- **What's missing:**
  - **Per-invoice timeline on InvoiceDetail (C17 — SPEC-TRACE-1).** Teacher looking at a single invoice cannot see "this was created on X, sent on Y, partially paid on Z, reminded on W". Data exists (audit_log + message_log) but no drill-down.
  - **Per-guardian / per-family timeline.** Even bigger gap — Section 7's family-account visibility requires aggregating events across all of a family's invoices + payments + refunds + credits. No surface exists. Filed as new C49.
  - **Per-lesson timeline.** For lesson reschedule/cancellation disputes, no drill-down.
  - **Per-student timeline.** For guardian queries "what did you do with my child's record", no surface.
  - **Reminder-send history surface.** `message_log` has the data but isn't joined into any entity-specific view. Teacher can't see "last reminder was sent 14 March, 28 March" without direct DB query. B11 already filed.
  - **entity_type naming inconsistency** — `'invoice'` (singular, from manual RPC) vs `'invoices'` (plural, from trigger). Breaks any filter by entity_type. Filed as new finding C50 below.
  - **Actor rendering for webhooks** — actor_user_id=NULL rendered as 'System'. Teachers sometimes want to know "was this the Stripe webhook or the admin panel" — could render as 'Stripe (webhook)' if the manual audit entry sets a source metadata field. Minor. Tracked not filed.

### Section 9 severity summary

- CRITICAL: 0
- HIGH: 2 new
  - Installment-level events (A3 partially_paid flip, auto-pay, overdue transitions) are all ephemeral — no audit trail on `invoice_installments`.
  - `entity_type` naming inconsistency between trigger-generic (`'invoices'`) and RPC-manual (`'invoice'`) — breaks all entity-type filtering; listed as C50 below.
- MEDIUM: 11 (per-entity drill-down gaps; tables without audit triggers where changes matter)
- LOW: 6 (cosmetic duplication; webhook vs manual audit coverage for same event)
- Cross-references: C17, C18, C19, C20, C47, B10, B11, B12, B13 all already filed in prior sections.

### New Bucket C items surfaced in Section 9

- **C49 — Per-guardian timeline across invoices / payments / refunds / credits.** Section 7's family-account visibility expressed in audit terms. Requires the C32 family-account primitive + a UI aggregator. Pairs with C17 (per-invoice timeline), C33 (Parents page).
- **C50 — `entity_type` naming inconsistency between generic audit trigger (`'invoices'` via `TG_TABLE_NAME`) and manual RPC audit entries (`'invoice'` singular).** Filter queries break silently. Fix options: (a) standardise all manual audit INSERTs to plural-table-name; (b) add a UNION-friendly column `canonical_entity` derived. Option (a) is simpler; one-pass refactor across RPCs. Low complexity, meaningful correctness.
- **C51 — Missing audit triggers on billing-adjacent tables.** Apply `log_audit_event` trigger to: `invoice_installments` (covers A3 state transitions + auto-pay flips), `refunds` (UPDATE / DELETE coverage), `make_up_credits`, `closure_dates`, `guardians`, `student_guardians`. Each is a one-line `CREATE TRIGGER` added in a consolidation migration. Cheap. Closes most of Section 9's ephemeral gaps in one pass. Does NOT include `invoice_items` — covered separately by B12.
- **C52 — `audit_log` composite index on `(entity_type, entity_id)`.** Needed for efficient per-entity timeline queries once C17 lands. Low-cost migration; delivers ~100× query speed-up on per-invoice timeline lookups at scale.
Section 10 — Walked test scenarios
To be filled in Session-1.10.
Section 11 — Findings summary + severity
To be filled in Session-1.11.
