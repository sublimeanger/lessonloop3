# Batch 07 — Payment Plans + Installments

**Session**: s46
**Date**: 2026-05-13
**HEAD pin**: 65fcde4
**Status**: CLOSED
**Findings allocated**: 7 (1C / 1H / 1M / 4L)

---

## §1 Allocation summary

| ID | Severity | Surface | Class anchor | Rubric anchor | Composition / mitigation notes |
|---|---|---|---|---|---|
| F-07-001 | HIGH | `installment-overdue-check/index.ts:102-110` silent-swallow on `recalculate_invoice_paid` EXCEPTION | F-05-005 closed batch-05 silent-swallow class anchor (operational-correctness CAPS chain: PI-11 → F-03-004 + PI-02 → F-05-003 + PI-03 → F-05-004 + PI-04 → F-05-005 + PI-05 → F-06-005 + PI-07 → F-06-007 + F-07-001) | PLAN.md §4 HIGH: "silent failure modes" + "broken edge cases"; operational-correctness CAPS-at-HIGH | No bracket-shift event. Strictly-less-mitigated than F-05-005 anchor (cron-direct callers bypass `recalcWithRetry` helper + `RecalcFailureBanner` surface). Secondary same-class observation at L70-73 documented in body (bounded-impact; not separately allocated). |
| F-07-002 | LOW | `stripe-auto-pay-installment/index.ts:86` bare `serve()` no `wrapEdgeFn` | CC-19 #10 Sentry edge-fn instrumentation gap (6 prior anchors; batch-06 `admin-backfill-default-pm:86-93` anchor) | PLAN.md §4 LOW: "code-hygiene drift" + "legacy artefacts" | Instance-aggravation noted (544L body + 4 INSERT paths + Stripe-integration complexity) but severity CAPS-at-LOW per class precedent. |
| F-07-003 | **CRITICAL** | `public.record_installment_payment` SECDEF + zero body auth + anon EXECUTE | F-02-005 closed batch-02 CRITICAL anchor (parameter-spoofing + financial-falsification 2-fn class) + F-06-001/003 s45 event #9 composition-chain precedent | PLAN.md §4 CRITICAL: "security exposure" (anon-callable financial-state-mutation RPC) + "financial loss" (composition produces falsified `paid_minor` + status flip with operator-trusted state) | **Severity-adjustment event #10**: pre-class HIGH (operational-correctness CAPS chain) ↑ CRITICAL via composition chain with F-02-005-anchored `record_stripe_payment` anon-callable RPC. 5-step attack flow documented §3. Post-hoc-detectable via batch-19-owned `audit_invoice_installments` trigger; severity unchanged (window unbounded). RLS-side read protection sound (§5); SECDEF write-path bypasses RLS. |
| F-07-004 | MEDIUM | `public.recalculate_installment_status` SECDEF + zero body auth + anon EXECUTE | CC-19 #6 Org-context spoofing class (zero-gate variant; distinct from CC-19 #14 misnaming) | PLAN.md §4 MEDIUM: "cosmetic but visible inconsistency + non-critical race conditions" | DoS-shape bounded-impact; state derives from authoritative payments+refunds (no corruption standalone); confirmatory (neutral) in F-02-005+F-07-003 composition (cash-side already poisoned at recalc time); implicit-recovery-via-recalc class observation for batch-19. |
| F-07-005 | LOW | `public.bump_invoice_pdf_rev_from_installments` unsuffixed DEAD orphan trigger fn | F-06-006 closed batch-06 LOW class precedent (CC-19 #15 dead-code SECDEF + orphan trigger fns) | PLAN.md §4 LOW: "legacy artefacts" + "code-hygiene drift" | 5-migration timeline orphan; ZERO trigger bindings + ZERO FE/edge refs; `_stmt` orphan-fn observation (implicit cleanup outside migration tracking) staged for batch-19. |
| F-07-006 | LOW | `public.invoice_installments.amount_minor` integer NOT NULL no positive CHECK | CC-19 #11 Schema column constraint hygiene (3 batch-06 LOW precedents) | PLAN.md §4 LOW: "minor docstring/API inconsistency" — schema-level invariant absence | Custom-schedule loophole observation: `generate_installments` validates SUM(amount_minor)=_remaining but not per-row > 0; bounded recoverability via UPDATE/DELETE+regenerate. |
| F-07-007 | LOW | `public.auto_pay_attempts.amount_minor` integer NOT NULL no positive CHECK | CC-19 #11 Schema column constraint hygiene | PLAN.md §4 LOW: same as F-07-006 | Bounded by upstream `inst.amount_minor` (F-07-006 propagates); defensive FE-edge skip at L237 (`if (outstanding <= 0) continue`); future direct-write callers (admin tools) could persist bad amounts. |

**Severity composition**: 1C + 1H + 1M + 4L = 7 findings ✓

---

## §2 Surface inventory (CENSUS row 07 line 1217 anchored)

**3 Edge functions** (cron-driven; CENSUS §3.6/§3.8 lines 299/327/328):
- `stripe-auto-pay-installment` (544L; cron jobid 90 @ `0 9 * * *`; Jamie's headline surface)
- `installment-overdue-check` (127L; cron jobid 96 @ `0 6 * * *`)
- `installment-upcoming-reminder` (227L; cron jobid 97 @ `0 8 * * *`)

**5 RPCs** (CENSUS §4.2 lines 519-523; bodies audited Phase 3):
- `generate_installments` — Pattern #24 anchor (batch-07)
- `recalculate_installment_status` — F-07-004 (batch-07)
- `record_installment_payment` — F-07-003 (batch-07)
- `cancel_payment_plan` — cross-listed; batch-06 closed §3 immutable; Pattern #1+#4+#8 anchor; zero post-s45 body drift confirmed Phase 3 Task 3.6
- `update_payment_plan` — cross-listed; F-06-008 batch-06 closed LOW DEAD immutable; zero post-s45 body drift + zero callers confirmed Phase 3 Task 3.6

**3 batch-07-owned triggers** on `invoice_installments` (CENSUS lines 710-712; STATEMENT-level transition-table pattern):
- `trg_bump_invoice_pdf_rev_from_installments_ins/_upd/_del`
- Note: `audit_invoice_installments` + `set_updated_at` (CENSUS lines 708-709) are batch-19-owned; existence-verified Phase 4 Task 4.1, body audit deferred to batch-19

**1 Hook** (CENSUS line 1049):
- `useInvoiceInstallments.ts` — 201L; 5 exports

**2 Tables**: `invoice_installments` + `auto_pay_attempts`

**3 Cron jobs** owned: jobid 90 + 96 + 97

**Cross-batch-affecting RPCs** (batch-07 surface touches; bodies CLOSED immutable):
- `record_stripe_payment` (F-02-005 batch-02 CRITICAL anchor) — auto-pay flow: cron → Stripe API → webhook → record_stripe_payment (caller-hygiene N/A at cron entry per Phase 2 Task 2.2.A; ZERO calls from stripe-auto-pay-installment confirmed via disk grep)
- `recalculate_invoice_paid` (closed batches) — called by all installment RPCs

**Out-of-scope** (closed-batch immutability):
- `auto-pay-upcoming-reminder` + `auto-pay-final-reminder` edge fns + jobid 89/91 crons (batch-06 closed; CENSUS lines 318-319; s46 Phase 0 drift #1 corrected at dispatch)
- `recurring_billing_scheduler` + `send-recurring-billing-alert` + recurring_template_* tables/RPCs/policies (batch-05 closed; CENSUS lines 292-293/882; s46 Phase 0 drift #2 corrected)
- Payment-plan UI components + admin/finance payment-plan pages (batch-05/06/11 owned; CENSUS row 07 = 0 routes / 0 pages; s46 Phase 0 drift #3 corrected)

---

## §3 Findings — CRITICAL (1)

### F-07-003 — `record_installment_payment` anon-callable SECDEF (composition chain CRITICAL via F-02-005)

- **Severity**: **Critical** (severity-adjustment event #10; bracket-shifted from HIGH operational pre-class to CRITICAL composition)
- **Area**: SECDEF RPC body / parameter-spoofing class / financial-falsification chain composition
- **Phase surfaced**: 3 (RPC body audit) + 5 (RLS-side reachability adjudication)
- **Class anchor**: F-02-005 closed batch-02 CRITICAL anchor (parameter-spoofing + financial-falsification 2-fn class) + F-06-001/003 s45 event #9 composition-chain precedent (same bracket-shift methodology)
- **Evidence** (DB-verified via `pg_get_functiondef('public.record_installment_payment'::regproc::oid)`):

```sql
CREATE OR REPLACE FUNCTION public.record_installment_payment(
  p_installment_id uuid, p_amount_minor integer,
  p_stripe_payment_intent_id text DEFAULT NULL::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _installment RECORD; _invoice RECORD; _total_inst_paid INTEGER;
        _all_paid BOOLEAN; _net_paid INTEGER; _total_refunded INTEGER;
BEGIN
  SELECT * INTO _installment FROM invoice_installments
    WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Installment not found'; END IF;

  IF _installment.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Installment is not payable (status: %)', _installment.status;
  END IF;

  SELECT * INTO _invoice FROM invoices
    WHERE id = _installment.invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent invoice not found'; END IF;

  IF _invoice.status = 'void' THEN
    RETURN json_build_object('skipped', true, 'reason', 'Invoice is ' || _invoice.status);
  END IF;

  UPDATE invoice_installments SET
    status = 'paid',
    paid_at = NOW(),
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id)
  WHERE id = p_installment_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _net_paid
  FROM payments WHERE invoice_id = _installment.invoice_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
  FROM refunds WHERE invoice_id = _installment.invoice_id AND status = 'succeeded';

  _net_paid := _net_paid - _total_refunded;

  SELECT NOT EXISTS (
    SELECT 1 FROM invoice_installments
    WHERE invoice_id = _installment.invoice_id
      AND status IN ('pending', 'overdue')
  ) INTO _all_paid;

  IF _all_paid AND _net_paid >= _invoice.total_minor THEN
    UPDATE invoices SET paid_minor = _net_paid, status = 'paid'
    WHERE id = _installment.invoice_id;
  ELSE
    UPDATE invoices SET paid_minor = _net_paid
    WHERE id = _installment.invoice_id;
  END IF;

  RETURN json_build_object(
    'installment_id', p_installment_id,
    'invoice_id', _installment.invoice_id,
    'all_paid', _all_paid,
    'net_paid', _net_paid,
    'new_status', CASE WHEN _all_paid AND _net_paid >= _invoice.total_minor THEN 'paid' ELSE _invoice.status END
  );
END;
$function$
```

- **Critical defects (DB-verified)**:
  - `prosecdef=true`, `proconfig=[search_path=public]`
  - `proacl={postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — **anon EXECUTE confirmed**
  - **ZERO `auth.uid()` references in body**
  - **ZERO `is_org_*()` gates of any shape**
  - **ZERO `org_memberships` checks**
  - `_org_id` is NOT a parameter — org-context derived from installment row but never validated against caller (distinct from F-02-005 anchor signature which DOES take `_org_id`; the org-spoofing dimension differs while the parameter-spoofing class shape is identical)

- **Composition chain with F-02-005 anchor (5-step attack flow)**:
  1. **Step A** (F-02-005 anchor; closed batch-02 SECDEF + anon EXECUTE + zero body auth): anon calls `record_stripe_payment` with attacker-controlled `(invoice_id, org_id, amount_minor, provider_reference)` → forged `payments` row INSERTed
  2. **Step B** (this finding): anon calls `record_installment_payment(p_installment_id, p_amount_minor, p_stripe_payment_intent_id)` with installment UUID belonging to same invoice → installment marked `'paid'` + forged `stripe_payment_intent_id` persisted via COALESCE
  3. **Recalc step** (body L37-44 — recalc inside body): `_net_paid := SUM(payments) - SUM(refunds WHERE status='succeeded')` reads authoritative-tables-NOW-CONTAMINATED-WITH-FORGED-ROW → `paid_minor` inflated to forged amount
  4. **Status flip** (body L51-55): if `_all_paid AND _net_paid >= _invoice.total_minor` → `invoices.status = 'paid'` — invoice marked paid without any actual cash
  5. **Result**: full falsified invoice state — installment paid + invoice paid + paid_minor inflated. Parent receives no payment-chase email; operator dashboard shows paid invoice; reconciliation against Stripe shows missing-money discrepancy only after later operator audit.

- **Pure-RPC standalone severity** (without F-02-005 composition): HIGH per operational-correctness CAPS class consistency (silent-swallow sub-class chain). State corruption recoverable via subsequent `recalculate_installment_status` invocation (F-07-004) — recalc reads authoritative cash (uncontaminated in pure-RPC scenario) and restores state.

- **Composition severity** (with F-02-005): CRITICAL bracket via composition chain anchored by F-06-001 + F-06-003 precedent (s45 event #9). Same bracket-shift methodology applied. Class: parameter-spoofing + financial-falsification 2-fn class.

- **RLS-side read protection sound (Phase 5 Task 5.2)**:
  - All 3 `invoice_installments` policies correctly cross-tenant gate via TIGHT predicate-gate fn bodies (`is_org_finance_team`, `is_org_staff`, `is_invoice_payer`)
  - `is_invoice_payer` body audit (Phase 5 Task 5.1.c) confirmed TIGHT-with-bounded-multi-guardian-fallback shape; single-invoice bounded
  - Anon SELECT cross-tenant returns 0 rows (predicates evaluate FALSE for NULL `auth.uid()` per SQL three-valued logic)

- **SECDEF write-path bypasses RLS by definition** — Phase 5 RLS protection narrows the leak surface but does NOT mitigate the SECDEF-side write-side defect. The exploit-path does not traverse RLS at all.

- **Post-hoc-detectability mitigation note (Phase 4 Task 4.2.c)**: `audit_invoice_installments` AFTER ROW trigger fires on the body's UPDATE → forged-state attack IS audit_log-visible post-hoc via batch-19-owned trigger. Operator forensic detection possible: query audit_log for `entity_type='invoice_installment'` + action='update' rows with anomalous `actor_user_id=NULL`. **Severity unchanged** — falsification window between attack and forensic-detection is unbounded; no automated alerting; class-consistent with F-02-005 batch-02 anchor disposition where audit_payments trigger likewise captures forged INSERTs without preventing them.

- **Real-world exploitability vectors (Phase 5 Task 5.4)**:
  1. **Direct SELECT leak via RLS**: NOT POSSIBLE per Phase 5 RLS audit (all 3 predicates TIGHT for non-staff non-payer users)
  2. **Authenticated-cross-org-user knowledge**: a user with legitimate own-org installment access (via `is_org_staff` or `is_invoice_payer`) can extract own-org installment ids; SECDEF bypass means cross-org replay possible if attacker obtains installment_id from any source
  3. **Side-channel disclosure** (PRIMARY realistic vector): financial-transaction emails routinely forwarded/screenshotted; parent forwards payment link to spouse/friend/family; inbox compromise; shared-device browser history
  4. **Cross-tenant authenticated probing**: malicious user with paid LessonLoop account enumerates `record_installment_payment` with installment_ids from side-channel-disclosed sources. UUID brute-force infeasible (`gen_random_uuid` 2^122 search space).

- **Real-world exposure profile**:
  - RLS-side READ leak: **BLOCKED** (Phase 5 evidence)
  - SECDEF-side WRITE: **OPEN** (Phase 3 anchor)
  - Side-channel disclosure: **primary realistic vector**
  - Insider threat (own-org staff replaying side-channel-leaked cross-org installments): **secondary vector**
  - Anon-only attack (no installment id source): **NOT VIABLE**

- **Severity reasoning (PLAN.md §4)**: Critical anchors verbatim — "security exposure" (anon-callable financial-state-mutation RPC) + "financial loss" (composition with F-02-005 produces forged payments + paid_minor drift + status flip). Operational-correctness class would CAP at HIGH for the zero-gate defect in isolation; composition with F-02-005 escalates to financial-falsification CRITICAL bracket per the composition chain. Severity-adjustment event #10: Phase 3 HIGH operational pre-class → Phase 3 CRITICAL via composition.

- **Anchor fix surface (Phase C reference)**: add explicit body gate stack to match Pattern #24 (generate_installments) anchor:

```sql
DECLARE _caller_id UUID;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _installment FROM invoice_installments
    WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Installment not found'; END IF;

  IF NOT is_org_finance_team(_caller_id, _installment.org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  -- ... rest of body unchanged
```

  Or REVOKE EXECUTE from anon + authenticated (preserves service-role for webhook callers; needs caller migration since this is called by stripe-webhook on PI succeeded with metadata).

- **Phase C sprint candidate**: **S-29-installment-payment-rpc-gate** class-grouped with F-02-005 batch-02 fix + F-07-004 fix.
- **Decision needed**: Yes — choose body-gate vs REVOKE+caller-migration; webhook caller path must be preserved.
- **Target sprint**: Phase C **S-29** + class-grouped with F-02-005 financial-falsification 2-fn class.
- **Closure**: (open)

---

## §4 Findings — HIGH (1)

### F-07-001 — `installment-overdue-check:102-110` silent-swallow on `recalculate_invoice_paid` EXCEPTION

- **Severity**: High (no bracket-shift event; class CAPS-at-HIGH)
- **Area**: Edge fn caller error handling / state-machine interaction / cron silent-swallow
- **Phase surfaced**: 1 (Phase 1 hook walk cross-batch carry from s45) + 2 (Phase 2 body audit)
- **Class anchor**: F-05-005 closed batch-05 silent-swallow class anchor. Silent-swallow sub-class chain (6 instances including this finding): F-05-003 → F-05-004 → F-05-005 (anchor) → F-06-005 → F-06-007 → **F-07-001** (6th). Broader operational-correctness CAPS-at-HIGH class subsumes silent-swallow + adjacent sub-classes (e.g., PI-11 → F-03-004 calendar-conflict-detection sub-class).
- **Severity rubric**: PLAN.md §4 HIGH — "silent failure modes" + "broken edge cases"; operational-correctness CAPS-at-HIGH per class-consistency precedent chain.

- **Evidence (verbatim Phase 2 Task 2.1)**:

```typescript
101	  for (const invoiceId of recalcInvoiceIds) {
102	    const { error: recalcErr } = await supabase.rpc("recalculate_invoice_paid", {
103	      _invoice_id: invoiceId,
104	    });
105	    if (recalcErr) {
106	      console.error(`recalc failed for invoice ${invoiceId}:`, recalcErr.message);
107	      recalcFailed++;
108	    } else {
109	      recalcOk++;
110	    }
111	  }
```

- **Silent-swallow class shape confirmed verbatim** (per F-05-005 anchor at `invoice-overdue-check/index.ts:125`):
  - `console.error(...)` only at L106 — no operator-visible surface beyond Deno log
  - `recalcFailed++` counter increment at L107 — count surfaced to body return JSON at L124 (`recalc_failed: recalcFailed`) but `pg_cron` discards response body
  - **NO `audit_log` INSERT** for the recalc failure
  - **NO `throw`** — exception swallowed; loop continues to next invoice
  - **NO banner-surface path** (F-05-005 closed-batch anchor's mitigation `recalcWithRetry` helper at `supabase/functions/_shared/recalc-with-retry.ts:56` is NOT used here — direct `supabase.rpc()` call at L102)

- **State-machine pin from F-05-005 body audit (s44 closed)**: when an installment causes draft→paid recalc (e.g., upfront prepayment plus credit applied), `recalculate_invoice_paid` body unconditionally sets `_new_status:='paid'`, UPDATE hits `enforce_invoice_status_transition` BEFORE UPDATE trigger which raises `EXCEPTION 'Invalid status transition from draft to paid'`. The cron at L102 catches this silently; `paid_minor` stays stale → contributes to F-05-004 drift class.

- **Strictly-less-mitigated than F-05-005 anchor**: closed-batch F-05-005 mitigation via `recalcWithRetry` helper writes `audit_log` row action='invoice_recalc_failed' → `useInvoiceRecalcFailure` query → `RecalcFailureBanner` renders on InvoiceDetail → operator sees banner. The cron at L102 in this finding calls `supabase.rpc()` directly → bypasses banner surface entirely.

- **Secondary same-class observation L70-73** (NOT separately allocated):

```typescript
70	    if (invoiceError) {
71	      console.error("Failed to update invoice statuses:", invoiceError);
72	    } else {
73	      invoicesUpdated = updated?.length || 0;
74	    }
```

  Same silent-log shape on `.update({ status: 'overdue' }).in('id', flippedInvoiceIds)` error; bounded-impact because next-cron-cycle re-evaluates same condition. No state-machine pin; recoverable. Documented in body, not standalone allocation. Reviewing-Claude may escalate to standalone F-07-NNN if class-consistency warrants.

- **Severity reasoning (PLAN.md §4)**: High anchors verbatim — "silent failure modes" (cron-direct path catches + counter only) + "broken edge cases" (draft invoices with prepayment never transition; same state-machine pin as F-05-005 anchor). NO banner-surface mitigation (strictly-less-mitigated than anchor). Class-consistent operational-correctness CAPS-at-HIGH per 6-instance precedent chain.

- **Anchor fix surface (Phase C reference)**: 3 layered options inherit from F-05-005 anchor:
  - **(a)** Wrap cron caller in `recalcWithRetry` (smallest change; closes silent path; gains audit-trail + retry + banner surface)
  - **(b)** Two-step transition in `recalculate_invoice_paid` body (closes root): first UPDATE to 'sent' (valid transition), then UPDATE to 'paid' — trigger sees `sent → paid` (valid)
  - **(c)** Self-audit in `recalculate_invoice_paid` body (defence-in-depth): BEGIN/EXCEPTION wraps UPDATE; on EXCEPTION INSERT self-audit row before re-RAISEing
  - Recommend (b) + (c) combined for batch-07 surface (same as F-05-005 anchor recommendation)

- **Phase C sprint candidate**: **S-30-cron-silent-swallow-resolution** class-grouped with F-05-005 + F-06-007 closed-batch carries.
- **Decision needed**: Yes — same family decision as F-05-005 (caller-side fix vs RPC-body fix vs self-audit hardening).
- **Target sprint**: Phase C **S-30**.
- **Closure**: (open)

---

## §5 Findings — MEDIUM (1)

### F-07-004 — `recalculate_installment_status` anon-callable SECDEF (DoS-shape bounded)

- **Severity**: Medium (no bracket-shift event; class CAPS-at-MEDIUM)
- **Area**: SECDEF RPC body / DoS-shape / state-machine recovery semantics
- **Phase surfaced**: 3 (RPC body audit)
- **Class anchor**: CC-19 #6 Org-context spoofing class (zero-gate variant; distinct from CC-19 #14 misnaming sub-shape)
- **Severity rubric**: PLAN.md §4 MEDIUM — "cosmetic but visible inconsistency + non-critical race conditions"

- **Evidence** (DB-verified via `pg_get_functiondef('public.recalculate_installment_status'::regproc::oid)`):

```sql
CREATE OR REPLACE FUNCTION public.recalculate_installment_status(_installment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _inst RECORD; _applied INTEGER; _new_status TEXT;
BEGIN
  SELECT id, amount_minor, status, paid_at, due_date INTO _inst
  FROM invoice_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst IS NULL THEN RETURN; END IF;
  IF _inst.status = 'void' THEN RETURN; END IF;

  SELECT COALESCE(SUM(p.amount_minor), 0)
       - COALESCE((SELECT SUM(r.amount_minor) FROM refunds r
                    JOIN payments p2 ON p2.id = r.payment_id
                    WHERE p2.installment_id = _installment_id AND r.status = 'succeeded'), 0)
    INTO _applied
  FROM payments p WHERE p.installment_id = _installment_id;

  IF _applied <= 0 THEN
    IF _inst.status = 'overdue' THEN _new_status := 'overdue';
    ELSE _new_status := 'pending'; END IF;
    UPDATE invoice_installments SET status = _new_status, paid_at = NULL WHERE id = _installment_id;
  ELSIF _applied < _inst.amount_minor THEN
    UPDATE invoice_installments SET status = 'partially_paid', paid_at = NULL WHERE id = _installment_id;
  ELSE
    UPDATE invoice_installments SET status = 'paid',
      paid_at = COALESCE(_inst.paid_at, NOW()) WHERE id = _installment_id;
  END IF;
END;
$function$
```

- **Defects (DB-verified)**: `prosecdef=true`; anon EXECUTE granted; ZERO auth gate.

- **State derivation analysis**: `_applied` derives from authoritative tables `payments` + `refunds` (`SELECT COALESCE(SUM(p.amount_minor)... FROM payments p WHERE p.installment_id = ...`). Anon cannot corrupt installment state via this RPC ALONE — recalc reads real cash and writes correct derived state.

- **Threat model**:
  - **DoS-shape**: anon iterates arbitrary installment_ids → `FOR UPDATE` row-lock contention against legitimate writers. Bounded by single-row locking; per-call latency cost. Operator-visible via `pg_stat_activity` if at scale.
  - **Recovery-from-F-07-003 PURE**: in standalone F-07-003 corruption (no F-02-005 chained), authoritative `payments` table is untainted → recalc correctly restores installment to `pending`/`overdue`. **Implicit mitigation surface for F-07-003 standalone exploit**.
  - **NO mitigation for F-02-005+F-07-003 composition**: when F-02-005 has already forged a `payments` row, the recalc reads the contaminated table and "correctly" computes `_applied >= _inst.amount_minor` → marks installment paid. **Composition still produces falsified state.** Confirmatory (neutral) in composition chain.

- **Cross-cutting class observation for Phase 7 / batch-19**: **"implicit-recovery-via-recalc"** pattern — class-consistency anchor for similar SECDEF-no-gate corruption-then-recovery shapes. Distinguishes (a) corruption recoverable via recalc-from-authoritative-cash (this finding) vs (b) corruption NOT recoverable because recalc itself is broken (F-05-005 anchor — recalc raises on draft→paid transition). Different sub-classes of operational-correctness.

- **Severity reasoning (PLAN.md §4)**: Medium anchors verbatim — "cosmetic but visible inconsistency + non-critical race conditions". No silent-failure surface; FOR UPDATE contention is operator-observable. State self-heals (in pure-RPC scenario). **Pretag MEDIUM stands; no bracket-shift event.**

- **Anchor fix surface (Phase C reference)**: add explicit body gate (Pattern #24 stack) OR REVOKE EXECUTE from anon + authenticated (preserves service-role for cron/webhook callers).

- **Phase C sprint candidate**: **S-29** clustered with F-07-003 + F-02-005 anchor fix.
- **Decision needed**: No (fix mechanically identical to F-07-003).
- **Target sprint**: Phase C **S-29**.
- **Closure**: (open)

---

## §6 Findings — LOW (4)

### F-07-002 — `stripe-auto-pay-installment:86` bare `serve()` no `wrapEdgeFn` (CC-19 #10)

- **Severity**: Low
- **Area**: Sentry edge-fn instrumentation gap
- **Phase surfaced**: 1 (Phase 1 surface walk) + 2 (Phase 2 body audit Task 2.2.E)
- **Class anchor**: CC-19 #10 Sentry edge-fn instrumentation gap (~6 prior anchors; batch-06 `admin-backfill-default-pm:86-93` anchor)
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift" + "legacy artefacts"

- **Evidence** (verbatim Phase 2 Task 2.2.E):

```typescript
1	import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
2	import Stripe from "https://esm.sh/stripe@14.21.0";
3	import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
4	import { getStripeClient } from "../_shared/stripe-client.ts";
5	import { validateCronAuth } from "../_shared/cron-auth.ts";
[... no wrapEdgeFn import ...]
85	 */
86	serve(async (req) => {
```

  **Bare `serve()` confirmed** — no `wrapEdgeFn` import (L1-5) + no Sentry wrap at L86. Counter-example `installment-overdue-check/index.ts:5-6` DOES import `wrapEdgeFn` from `../_shared/sentry.ts` and wraps the handler.

- **Instance-aggravation**: 544L body + 4 INSERT paths into `auto_pay_attempts` (L243/L324/L361/L422) + 3 audit_log INSERT paths (L42/L300/L444) + Stripe-integration complexity. Operational consequence of a corrupted-state failure would be higher than typical bare-serve gap. HOWEVER severity does NOT escalate above LOW per class-consistency CAPS-at-LOW.

- **Anchor fix surface (Phase C reference)**:

```typescript
import { wrapEdgeFn } from "../_shared/sentry.ts";
// ...
serve(wrapEdgeFn("stripe-auto-pay-installment", async (req) => {
  // existing body unchanged
}));
```

- **Phase C sprint candidate**: **S-31-sentry-edge-fn-instrumentation** class-grouped with 6 prior CC-19 #10 anchors.
- **Decision needed**: No.
- **Target sprint**: Phase C **S-31**.
- **Closure**: (open)

---

### F-07-005 — `bump_invoice_pdf_rev_from_installments` unsuffixed DEAD orphan trigger fn (CC-19 #15)

- **Severity**: Low
- **Area**: Orphan SECDEF trigger function / schema-archaeology cleanup
- **Phase surfaced**: 1 (Phase 1 Task 1.4 FE/edge zero-refs) + 3 (Phase 3 Task 3.3 body + trigger-binding + migration archaeology)
- **Class anchor**: F-06-006 closed batch-06 LOW class precedent (CC-19 #15 dead-code SECDEF + orphan trigger fns class)
- **Severity rubric**: PLAN.md §4 LOW — "legacy artefacts" + "code-hygiene drift"

- **Evidence (DB-verified body via `pg_get_functiondef`)**:

```sql
CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev_from_installments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _invoice_id uuid;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices
     SET pdf_rev = pdf_rev + 1
   WHERE id = _invoice_id;
  RETURN COALESCE(NEW, OLD);
END;
$function$
```

- **DEAD evidence (3 layers)**:
  1. **ZERO trigger bindings** via Phase 3 Q3 (`pg_trigger` join → `has_trigger_binding=false` for unsuffixed; `=true` for 3 suffixed variants)
  2. **ZERO FE/edge refs** via Phase 1 Task 1.4 `git grep -l "bump_invoice_pdf_rev_from_installments" 65fcde4 -- 'src/**' 'supabase/functions/**' ':!**/migrations/*'` → empty
  3. **Migration archaeology (5-migration timeline)**:

| Date | Migration | Action | Unsuffixed state |
|---|---|---|---|
| 2026-04-26 | `20260426085724_*.sql:87,105,135` | CREATE FUNCTION (ROW-level) + bind trigger `trg_bump_invoice_pdf_rev_from_installments` + REVOKE FROM PUBLIC | **ALIVE** (initial define) |
| 2026-05-01 | `20260501223523_*.sql:453,462,475,484,489-505,565-567` | CREATE 3 suffixed `_ins/_upd/_del` STATEMENT-level + DROP unsuffixed trigger + bind 3 suffixed triggers + REVOKE on 3 suffixed | **ORPHANED 1st time** (FUNCTION not dropped; trigger removed) |
| 2026-05-04 | `20260504100000_invoice_pdfs_storage.sql:116,133-137,168` | RE-CREATE unsuffixed FUNCTION + RE-BIND trigger to unsuffixed + REVOKE | **RE-ALIVED** (full restoration) |
| 2026-05-16 (1) | `20260516100000_canary_walk_batch_1z_combined_fixes.sql:537,555-560,588` | CREATE `_stmt` variant + DROP unsuffixed trigger + bind `_stmt` to trigger + REVOKE | **ORPHANED 2nd time** (FUNCTION not dropped); `_stmt` orphan-class-instance introduced |
| 2026-05-16 (2) | `20260516110000_canary_walk_batch_1z_corrected.sql:630,644,662,676-679,681-697,779-781` | CREATE 3 suffixed `_ins/_upd/_del` + DROP all 4 variant triggers + bind 3 suffixed + REVOKE | **ORPHANED FINAL** (FUNCTION not dropped; trigger never re-bound) |

  **HEAD final state** (Phase 3 Q3): 4 fns exist in DB; 3 wired + 1 unsuffixed orphan. `_stmt` variant absent at HEAD per DB query — implicitly cleaned outside migration tracking (no DROP migration found via `git grep`).

- **Impact**: orphan function consumes schema-namespace; zero behavioural impact at runtime.

- **Anchor fix surface (Phase C reference)**:

```sql
DROP FUNCTION public.bump_invoice_pdf_rev_from_installments();
```

- **CC-19 #15 batch-19 deliverable**: enumerate all SECDEF fns with zero trigger bindings + zero FE/edge refs + migration-archaeology discipline rule "migration must explicitly DROP superseded fns" (per `_stmt` orphan observation; `_stmt` removed outside migration tracking is a process-discipline gap).

- **Phase C sprint candidate**: **S-32-dead-code-sweep** class-grouped with F-06-004 + F-06-006 + F-06-008 + CC-19 #15 batch-19 sweep prep.
- **Decision needed**: No.
- **Target sprint**: Phase C **S-32**.
- **Closure**: (open)

---

### F-07-006 — `invoice_installments.amount_minor` no positive CHECK constraint (CC-19 #11)

- **Severity**: Low
- **Area**: Schema column constraint hygiene / financial-table invariant absence
- **Phase surfaced**: 6 (Phase 6 Task 6.1.c)
- **Class anchor**: CC-19 #11 Schema column constraint hygiene (3 batch-06 LOW precedents: payments.amount_minor + payment_notifications.amount_minor + guardian_payment_preferences)
- **Severity rubric**: PLAN.md §4 LOW — "minor docstring/API inconsistency" — schema-level invariant absence

- **Evidence (DB-verified Phase 6 Q1)**:

| Table | Constraint | Definition |
|---|---|---|
| invoice_installments | `invoice_installments_status_check` | `CHECK ((status = ANY (ARRAY['pending','paid','overdue','void','partially_paid'])))` |
| invoice_installments | **(absent)** | **NO positive-amount CHECK on amount_minor** |
| recurring_template_items (contrast; batch-05 closed) | `recurring_template_items_amount_minor_check` | **`CHECK ((amount_minor > 0))`** |

  Column shape (Phase 6 Q3): `amount_minor integer NOT NULL` (no default).

- **Mutation paths**:
  - `generate_installments` body L36-50 INSERT loop (equal-split path) + L42-44 INSERT loop (custom-schedule path)
  - `update_payment_plan` body INSERT loop (closed batch-06 F-06-008 DEAD; surface exists but unused)
  - Direct REST INSERT/UPDATE via finance-team RLS policy `is_org_finance_team(auth.uid(), org_id)` (Phase 5 verified)

- **Custom-schedule loophole observation** (Phase 6 Task 6.1.c): `generate_installments` body L27-32 validates SUM of caller-supplied `amount_minor` equals `_remaining`, but does NOT validate **each individual `amount_minor > 0`**. Caller could supply:
  - `[{amount_minor:10000}, {amount_minor:0}, {amount_minor:0}]` (SUM=10000=_remaining) → 2 zero-amount installments pass validation
  - `[{amount_minor:15000}, {amount_minor:-2500}, {amount_minor:-2500}]` (SUM=10000=_remaining) → negative-amount installments pass

  Manifestation: parent-portal display "Amount due: -£25.00" or "£0.00". Bounded recoverability via UPDATE/DELETE+regenerate.

- **Anchor fix surface (Phase C reference)**:

```sql
ALTER TABLE public.invoice_installments
  ADD CONSTRAINT invoice_installments_amount_minor_check
  CHECK (amount_minor > 0);
```

  (Mirror of `recurring_template_items_amount_minor_check` batch-05 positive instance.)

- **Phase C sprint candidate**: **S-33-financial-amount-check-sweep** class-grouped with F-06-014/015/016 (batch-06 LOWs) + F-07-006/007.
- **Decision needed**: No.
- **Target sprint**: Phase C **S-33**.
- **Closure**: (open)

---

### F-07-007 — `auto_pay_attempts.amount_minor` no positive CHECK constraint (CC-19 #11)

- **Severity**: Low
- **Area**: Schema column constraint hygiene / financial-table invariant absence
- **Phase surfaced**: 6 (Phase 6 Task 6.1.d)
- **Class anchor**: CC-19 #11 Schema column constraint hygiene
- **Severity rubric**: PLAN.md §4 LOW — same as F-07-006

- **Evidence (DB-verified Phase 6 Q1)**:

| Table | Constraint | Definition |
|---|---|---|
| auto_pay_attempts | `auto_pay_attempts_outcome_check` | `CHECK ((outcome = ANY (ARRAY['succeeded','failed','requires_action','skipped_paused'])))` |
| auto_pay_attempts | **(absent)** | **NO positive-amount CHECK on amount_minor** |

  Column shape (Phase 6 Q3): `amount_minor integer NOT NULL` (no default).

- **Mutation paths** (Phase 2 Task 2.2.B enumeration):
  - L243-251 `skipped_paused` INSERT (outstanding amount)
  - L324-333 `succeeded` INSERT (outstanding amount)
  - L361-374 `failed`/`requires_action` INSERT (outstanding amount)
  - L422-438 catch-block `failed` INSERT (outstanding amount)
  - All 4 INSERT paths derive `amount_minor: outstanding` where `outstanding = inst.amount_minor - priorApplied` (L235)

- **Bounded risk**:
  - Bounded by upstream `inst.amount_minor` (F-07-006 propagates if upstream corrupted via custom-schedule loophole)
  - Defensive FE-edge skip at `stripe-auto-pay-installment/index.ts:237`: `if (outstanding <= 0) continue;`
  - **HOWEVER**: the `<= 0` skip is at FE-edge-fn layer, NOT DB-layer; if a future caller writes auto_pay_attempts directly (e.g., admin manual entry, debugging tool, future feature), bad amounts could persist

- **Anchor fix surface (Phase C reference)**:

```sql
ALTER TABLE public.auto_pay_attempts
  ADD CONSTRAINT auto_pay_attempts_amount_minor_check
  CHECK (amount_minor > 0);
```

- **Phase C sprint candidate**: **S-33** clustered with F-07-006 + batch-06 LOW precedents.
- **Decision needed**: No.
- **Target sprint**: Phase C **S-33**.
- **Closure**: (open)

---

## §7 Positive Pattern catalog additions

### Pattern #24 — Finance-team-gated SECDEF stacking 6 layers

**Anchor**: `public.generate_installments` (batch-07 owned)

**6 layers (verbatim cited from Phase 3 Task 3.4 body)**:

1. **Predicate-fn gate**: `IF NOT is_org_finance_team(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised to manage payment plans'; END IF;` (body L7-9)
2. **Invoice-derived org cross-check** (Pattern #4 instance): `SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id AND org_id = _org_id;` (body L11) — derive-then-cross-check
3. **State-machine guard**: `IF _invoice.status IN ('paid', 'void') THEN RAISE EXCEPTION 'Cannot add payment plan to % invoice', _invoice.status;` (body L13-15)
4. **Partial-payment guard**: `IF _partial_count > 0 THEN RAISE EXCEPTION 'Cannot regenerate plan: % installment(s) have partial payments attributed. Resolve those first.', _partial_count;` (body L17-22)
5. **Value-integrity SUM validation**: `IF _custom_sum != _remaining THEN RAISE EXCEPTION 'Custom installment amounts (%) do not equal remaining balance (%)', _custom_sum, _remaining;` (body L27-32)
6. **audit_log INSERT on success**: `INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after) VALUES (_org_id, auth.uid(), 'payment_plan_created', 'invoice', _invoice_id, jsonb_build_object('installment_count', _final_count, 'frequency', _frequency, 'remaining_minor', _remaining));` (body L60-63)

**Class dimension**: SECDEF-write-hygiene exemplar — "create-path" positive pattern (distinguishes from cancel_payment_plan + update_payment_plan "modify-path" patterns).

**Kinship**:
- Pattern #1 (auth.uid + role check) refined via Pattern #4 (predicate-fn delegation via `is_org_finance_team`)
- Pattern #21 (column-restricted state-machine guard; closed batch-05) extended at SECDEF level
- Pattern #23 (non-SECDEF row-lock value-integrity validation; closed batch-06) extended at SECDEF level
- audit_log INSERT compensation class-consistent with batch-06 stripe-webhook handler-INSERT shape

**Distinguishes from**:
- `cancel_payment_plan` body (closed batch-06 §3 Pattern #1+#4+#8 anchor): 4-layer + audit_log; LACKS value-integrity SUM check + partial-payment guard (cancel doesn't need to lay new rows)
- `update_payment_plan` body (closed batch-06 F-06-008 DEAD): input validation + state-machine; NO audit_log INSERT in body; modify-path shape

---

### Pattern #25 — Defensive-narrowing-via-roles in PERMISSIVE RLS policies

**Anchor**: `Org staff can view auto_pay_attempts` policy on `public.auto_pay_attempts` (batch-07 owned; DB-verified Phase 5 Q2)

**Policy specifics**:
- `permissive=PERMISSIVE`
- `roles={authenticated}` (NOT Supabase-default `{public}`)
- `cmd=SELECT`
- `qual=is_org_staff(auth.uid(), org_id)`
- `with_check=null`

**Defining property**: PERMISSIVE policy with `roles={authenticated}` (or stricter) instead of Supabase-default `{public}`. Anon role excluded from policy match → RLS-default-deny if no other policy matches.

**Defense-in-depth value**:
- Even with anon-CRUD GRANTs intact (Supabase-default; verified Phase 5 Q4)
- Even if a future PERMISSIVE write policy is accidentally added with `roles={public}`, the existing `roles={authenticated}` provides no anon-reach
- Stacks defense layers: GRANTs (table-level) + policy roles (policy-level) + qual evaluation (predicate-fn-level)

**Kinship**:
- Complementary to existing Pattern #2 (RLS-default-deny via no PERMISSIVE write policy; closed batch-01)
- Cross-cutting refinement over Pattern #6 base shape (closed batch-05 service-role-via-inverse-condition; Pattern #6 catalog refinement target via batch-19)

**Distinguishes from**: invoice_installments + most batch-07 RLS policies which use `roles={public}` and rely on predicate-gate fn body to anon-exclude (predicate evaluates FALSE for `auth.uid()=NULL`). Pattern #25 makes anon-exclusion explicit at the policy-roles layer.

**Cross-batch observation**: FIRST instance of `roles={authenticated}` defensive narrowing in audited surface set (batches 01-07). Most prior PERMISSIVE policies authored with default `{public}`. **Batch-19 sweep target**: enumerate all PERMISSIVE policies + bifurcate `{public}` vs `{authenticated}` + identify systemic gaps where Pattern #25 would be defense-in-depth.

---

### Pattern #26 candidate — Log-shape table protection cohort

**Status**: PLACED AS CANDIDATE — final ratification at batch-19 catalog refinement pass.

**Defining 4 properties**:
1. Append-only-by-design (no UPDATE/DELETE paths in batch-N-owned code)
2. Service-role-only INSERTs from edge fns or cron paths
3. SELECT-only PERMISSIVE RLS for org staff / finance team
4. RLS-default-deny on writes via PERMISSIVE write-policy absence

**Clean instances** (verified or self-ledger):
- `auto_pay_attempts` (batch-07; Phase 4 + Phase 5 verified clean)
- `stripe_webhook_events` (batch-06 closed; self-ledger positive pattern per s45 close)
- `stripe_checkout_sessions` (batch-06 closed; self-ledger positive pattern per s45 close)

**Negative-shape cohort** (NOT clean; dual-classified):
- `recurring_template_runs` (batch-05 closed; Pattern #6 POSITIVE per s44 immutable + CC-19 #14 + #13 NEGATIVE-in-practice per s45 declared)
- `recurring_template_run_errors` (batch-05 closed; same dual-classification)

**Class-taxonomy resolution**: recurring_template_runs + _run_errors are simultaneously Pattern #6 POSITIVE (s44 closed-batch immutable) + CC-19 #14 + #13 NEGATIVE-in-practice (s45 declared after closure). They are NOT clean Pattern #26 instances because their RLS policies use `auth.uid() IS NULL` PERMISSIVE sub-shape WITH anon-CRUD GRANTs intact (Phase 0 Q16 evidence) — anon-CRUD reachability per F-06-003 class structure. auto_pay_attempts distinguishes via Pattern #25 defensive-narrowing (`roles={authenticated}`) + absence of any PERMISSIVE write policy.

**Batch-19 deliverable**: ratify Pattern #26 catalog entry; bifurcate clean cohort from negative-shape cohort; cross-reference Pattern #6 sub-shape refinement.

---

### Class-consistency PASS — 3 suffixed bumps STATEMENT-level transition-table

`bump_invoice_pdf_rev_from_installments_{ins,upd,del}` (batch-07; Phase 3 Task 3.5 body audited via `pg_get_functiondef`) — structurally parallel to `bump_invoice_pdf_rev_from_payments_{ins,upd,del}` (batch-06 closed positive pattern instance per s45 close).

Bit-decode (Phase 4 Q1): `tgtype=4` (INSERT only, AFTER, STATEMENT) + `tgtype=16` (UPDATE only, AFTER, STATEMENT) + `tgtype=8` (DELETE only, AFTER, STATEMENT). All 3 enabled.

**UPDATE variant defensive shape**: `WHERE i.id IN (SELECT DISTINCT invoice_id FROM _new_rows UNION SELECT DISTINCT invoice_id FROM _old_rows)` — covers invoice_id-change edge case (defensive against `invoice_installments.invoice_id` immutability assumption).

NOT a new pattern. **Cross-batch class-consistency PASS observation**: existing batch-06 anchored STATEMENT-level transition-table positive pattern; batch-07 instance reinforces the pattern. No new catalog entry.

---

**Positive Pattern catalog total post-batch-07**: 25 placed + 1 candidate = **26 entries** (was 23 placed pre-s46).

---

## §8 Class-consistency observations (non-allocation)

### §8.1 3 suffixed bumps STATEMENT-level transition-table PASS

Verbatim see §7 above. Cross-batch class-consistency PASS — batch-06 anchored pattern; batch-07 instance reinforces.

### §8.2 `generate_installments` dual-INSERT redundant-audit pattern

Phase 4 Task 4.2.b observation: `generate_installments` body has its OWN `INSERT INTO audit_log` at body L60-63 (Pattern #24 Property #6). COMBINED with the AFTER ROW trigger `audit_invoice_installments` firing per INSERT row, this produces **N + 1 audit_log entries per `generate_installments(N installments)` call**:
- **N row-level entries** via `log_audit_event_singular` (one per installment INSERT row)
- **1 summary entry** via the body's explicit INSERT with action=`'payment_plan_created'`

Same shape applies to `cancel_payment_plan` (1 DELETE → N trigger-emitted rows + 1 body summary `'payment_plan_cancelled'`; closed batch-06). `update_payment_plan` (closed batch-06 F-06-008) does NOT have a body summary INSERT — only trigger-emitted rows.

**Class observation (not a finding)**: defensive-depth audit pattern. Cross-batch class observation for batch-19 catalog accumulation.

### §8.3 §6.7 cascade-completeness-asymmetry safety-direction

Phase 6 Task 6.2 DB-verified Q2:
- `invoice_installments_payment_id_fkey`: `FOREIGN KEY (payment_id) REFERENCES payments(id)` (NO ON DELETE clause; defaults NO ACTION)
- `payments_installment_id_fkey`: `FOREIGN KEY (installment_id) REFERENCES invoice_installments(id) ON DELETE SET NULL`

**Direction analysis**:
- Delete payment when installment.payment_id references it → NO ACTION raises FK violation → **BLOCKED (safe)**
- Delete installment when payments.installment_id references it → SET NULL nullifies linkage → **graceful**

**Direction is SAFETY**, NOT data-loss. F-04-003 / F-05-002 anchors are danger-direction (silent orphan-creation / financial-falsification reach). **Class-observation-only disposition** per batch-06 close precedent.

**Batch-19 sub-classification observation**:
- Sub-class A: data-loss-direction (F-04-003 + F-05-002 anchors) — HIGH/CRITICAL when reached
- Sub-class B: safety-direction (batch-06 payment_id observation + batch-07 invoice_installments.payment_id pair) — observation-only

### §8.4 §6.8 Stripe idempotencyKey + audit-trail UNIQUE-INDEX-free design

Phase 2 Task 2.2.D `stripe-auto-pay-installment/index.ts:278-281`:

```typescript
278	        const stripeOpts: Stripe.RequestOptions = {
279	          // Idempotency: guard against duplicate PIs if the webhook lags and
280	          // the cron re-triggers before payments.installment_id lands.
281	          idempotencyKey: `auto-pay-${inst.id}-${outstanding}`,
282	        };
```

Stripe-side idempotency at PaymentIntent.create call. The `${outstanding}` component changes if partial payment lands between cron runs → new key → Stripe treats as new charge. Intentional retry-by-day-with-different-key design.

`auto_pay_attempts.stripe_payment_intent_id` has NO UNIQUE INDEX (verified Phase 0 Q via `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` + `pg_constraint contype IN ('u','p')` both empty) — **intentional audit-trail design** allowing multiple rows per PI (cron attempts + retries + skipped_paused logs). **NOT a finding** per Phase 2 + Phase 6 lock.

### §8.5 useCan unimplementation positive observation

Phase 1 Task 1.5 + Phase 6 Task 6.6: `git grep -nE "useCan|role\s*===\s*['\"](admin|owner|teacher|guardian|parent)['\"]|user_metadata\.role|app_metadata\.role" 65fcde4 -- 'src/hooks/useInvoiceInstallments*' 'src/components/**payment*' 'src/components/**installment*'` returned empty. **0 batch-07 role-check sites**.

Class-consistent with batch-06 hook role-check-free pattern (all 9 batch-06 hooks role-check-free per s45). Continues server-side delegation pattern.

### §8.6 Generated-types pipeline drift positive observation

Phase 1 Task 1.3 + Phase 6 Task 6.7: 5/5 batch-07-touched RPC signatures aligned DB ↔ types.ts:

| RPC | types.ts line | Args + Returns match DB |
|---|---|---|
| `generate_installments` | 6913 | ✓ |
| `recalculate_installment_status` | 7281 | ✓ |
| `record_installment_payment` | 7286 | ✓ |
| `cancel_payment_plan` (cross-listed) | 6795 | ✓ |
| `update_payment_plan` (cross-listed) | 7383 | ✓ |

CC-19 #7 generated-types-pipeline-drift class: positive batch-07 observation.

---

## §9 Cross-batch carries

### §9.1 F-05-005 class-consistency carry → F-07-001 (Phase 2 allocation)

F-05-005 closed batch-05 HIGH anchor (`invoice-overdue-check:125` silent-swallow on `recalculate_invoice_paid` EXCEPTION) carried per s45 close §10 to batch-07 surface at `installment-overdue-check/index.ts:102-110`. Structurally identical class shape; batch-07 owns F-07-NNN allocation per closed-batch immutability. **F-07-001 HIGH allocated Phase 2**.

### §9.2 F-02-005 composition chain → F-07-003 (Phase 3 event #10)

F-02-005 closed batch-02 CRITICAL anchor (`record_stripe_payment` anon-callable SECDEF + zero body auth) composes with `record_installment_payment` (batch-07 owned; identical class shape — SECDEF + zero body auth + anon EXECUTE) to produce 5-step financial-falsification attack flow. **F-07-003 CRITICAL allocated Phase 3 via event #10 bracket-shift** per F-06-001+F-06-003 s45 event #9 composition-chain precedent.

### §9.3 F-06-006 class-analogue → F-07-005 (Phase 3 allocation)

F-06-006 closed batch-06 LOW anchor (`bump_invoice_pdf_rev_from_payments` unsuffixed orphan trigger fn) class-analogue surface confirmed on installments side. Same class structure: SECDEF + ROW-level body + zero trigger bindings + zero FE/edge refs + migration archaeology evidence. **F-07-005 LOW allocated Phase 3** per CC-19 #15 class.

### §9.4 CC-19 #11 batch-06 +3 LOW class extension → F-07-006 + F-07-007 (Phase 6)

CC-19 #11 schema column constraint hygiene batch-06 instances: payments.amount_minor + payment_notifications.amount_minor + guardian_payment_preferences (3 LOWs). Batch-07 extends class to `invoice_installments.amount_minor` + `auto_pay_attempts.amount_minor` (2 LOWs). Class total ~6 → ~8 visible.

### §9.5 Pattern #6 catalog refinement note → §10b reviewing-Claude handover snapshot

s44 closed batch-05 classified `recurring_template_runs` + `recurring_template_run_errors` RLS policies as Pattern #6 POSITIVE (s44 STATUS log line 78). Phase 0 Q16 GRANT-probe evidence: anon has full CRUD GRANTs on both tables. Combined with PERMISSIVE ALL policies `qual=(auth.uid() IS NULL)`: structurally identical to F-06-003 sub-shape (batch-06 closed CRITICAL anchor).

s44 Pattern #6 classification was made BEFORE CC-19 #14 declared at s45; "claimed-service-role-gate misnaming" was not a sweep target at s44 closure. **Closed-batch immutability holds**: Pattern #6 POSITIVE classification stands per PLAN.md §6.

**Pattern #6 sub-shape bifurcation for batch-19 catalog refinement**:
- Sub-shape A: `auth.uid() IS NULL` PERMISSIVE + anon CRUD GRANTs INTACT → NEGATIVE in practice (F-06-003 class shape)
- Sub-shape B: `auth.uid() IS NULL` PERMISSIVE + anon CRUD GRANTs REVOKEd → POSITIVE intended-as-implementation

Recurring_* members: sub-shape A. Pattern #6 catalog header needs explicit GRANT-state precondition documentation.

**Batch-19 sweep deliverable**: catalog Pattern #6 refinement + identify all sub-shape A instances + remediate via GRANT-REVOKE migrations.

### §9.6 9 batch-19 sweep targets (Phase 7 Task 7.4 enumeration)

1. **CC-19 #11 CI-enforced positive-amount CHECK** on financial-table amount_minor columns (payments + payment_notifications + guardian_payment_preferences + invoice_installments + auto_pay_attempts; contrast with recurring_template_items > 0 CHECK)
2. **CC-19 #14 claimed-service-role-gate misnaming sub-shape sweep**: enumerate all SECDEF RPCs with `auth.uid() IS [NOT] NULL` body gates + RLS policies with `auth.uid() IS NULL` quals; bifurcate sub-shape A vs B per GRANT-state
3. **CC-19 #15 dead-code SECDEF RPCs + orphan trigger fns sweep**: 4 instances (F-06-004 + F-06-006 + F-06-008 + F-07-005); enumerate all SECDEF fns with zero trigger bindings + zero FE/edge refs; **migration-archaeology discipline rule**: "migration must explicitly DROP superseded fns" (per `_stmt` orphan observation)
4. **Pattern #6 catalog refinement**: bifurcate sub-shape A vs B per GRANT-state precondition; remediate sub-shape A instances via GRANT-REVOKE
5. **Cascade-completeness-asymmetry sub-classification**: bifurcate data-loss-direction (F-04-003 + F-05-002 anchors) vs safety-direction (batch-06 payment_id + batch-07 invoice_installments.payment_id); F-04-003 class header refinement
6. **Pattern #25 defensive-narrowing-via-roles enumeration**: identify all `roles={public}` PERMISSIVE policies where `roles={authenticated}` would be defense-in-depth
7. **Pattern #26 candidate ratification**: confirm log-shape table protection cohort across all log-shape tables
8. **CC-19 #8 E2E fixture hygiene**: Supabase auth-js storage mock unhandled rejections baseline (carried s45; not advanced s46 due to baseline test skip)
9. **CC-19 #1 EXECUTE-grant hygiene**: anon-EXECUTE on SECDEF RPCs sweep + REVOKE for fns without anon-exec-need (9 batch-07 SECDEF anon-EXECUTE observed)

---

## §10 PI register

**No batch-07-owned PIs** per STATUS.md §2 line 43.

**Cohort unchanged at 8 active+partial / 3C / 4H / 1M / 0L**:

| # | PI | Severity | Owning batch | Status |
|---|---|---|---|---|
| 1 | PI-01 | CRITICAL | 10 (reports-analytics-payroll) | Active |
| 2 | PI-12 | CRITICAL | 17 (loopassist) | Active |
| 3 | PI-13 | CRITICAL | 09 + 19 | Active |
| 4 | PI-09 | HIGH | 19 | Active |
| 5 | PI-10 | HIGH | 15 + 18 | Active |
| 6 | PI-15 | HIGH (partial) | 09 canonical | Partially-resolved |
| 7 | PI-16 | HIGH | 17 (loopassist) | Active |
| 8 | PI-17 | MEDIUM | 08 + 19 | Active |

---

## §11 Audit-method appendix

### §11.1 Severity-adjustment events (10 cumulative; +1 from s46)

| # | Event | Direction | Reasoning |
|---|---|---|---|
| 1 | PI-08 → F-02-005 (s41) | HIGH ↑ CRITICAL | No `auth.uid()` in `record_stripe_payment`; financial-falsification class |
| 2 | PI-11 → F-03-004 (s42) | Critical ↓ HIGH | Operational-correctness CAPS-at-HIGH; `check_lesson_conflicts` 2-of-7 |
| 3 | F-04-002 (s43) | HIGH unchanged | Regression-class support; no customer-facing marketing anchor |
| 4 | F-04-004 (s43) | HIGH unchanged | Intent-ambiguity; closed-batch immutability holds |
| 5 | PI-02 → F-05-003 (s44) | Critical ↓ HIGH | "Missing UI for tracked DB state"; operational-correctness CAPS |
| 6 | PI-03 → F-05-004 (s44) | Critical ↓ HIGH | "Silent failure modes"; cached-value drift recoverable |
| 7 | PI-04 → F-05-005 (s44) | Critical ↓ HIGH | "Silent failure modes"; banner-surface partial mitigation |
| 8 | PI-05 → F-06-005 (s45) | Critical ↓ HIGH | "Missing UI for tracked DB state" + operational-correctness CAPS; marketed-feature-broken anchor evaluated + rejected per discoverability-vs-actionability distinction |
| 9 | F-06-001 mid-session (s45) | (Phase 3 MEDIUM/HIGH bracket) ↑ CRITICAL (Phase 5) | Phase 5 F-06-003 composition discovery shifted bracket from operational-correctness HIGH to financial-falsification CRITICAL via composition chain |
| **10** | **F-07-003 mid-session (s46 Phase 3)** | **(Phase 3 HIGH operational pre-class) ↑ CRITICAL (Phase 3 composition)** | **Pre-class HIGH per operational-correctness CAPS class consistency (s42 PI-11 + s44 PI-02/03/04 + s45 PI-05/F-06-005 + s45 PI-07/F-06-007 + F-07-001 chain); bracket-shifted to CRITICAL via composition chain with F-02-005 closed-batch CRITICAL anchor (`record_stripe_payment` anon-callable financial-falsification). Anchored by F-06-001+F-06-003 composition precedent (s45 event #9 same bracket-shift methodology). Class: parameter-spoofing + financial-falsification 2-fn class.** |

**Methodology principles** (carry from s45 + PLAN.md §4.1):
- Pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments
- Mid-session adjustments are EVENTS when severity class bracket shifts
- Pre-class refinements WITHIN a bracket are NOT events
- Class-consistency precedent is primary anchor for adjudication

### §11.2 Class-consistency anchors used (s46)

- **F-05-005** silent-swallow anchor → F-07-001 class-instance allocation
- **F-02-005** composition anchor → F-07-003 event #10 bracket-shift
- **F-06-006** dead-code anchor → F-07-005 class-instance allocation
- **CC-19 #11** schema-constraint anchor → F-07-006 + F-07-007 class-instance allocations
- **CC-19 #10** Sentry-gap anchor → F-07-002 class-instance allocation

### §11.3 Methodology-discipline ledger (3-category)

#### Category 1 — Reviewing-Claude origin pre-investigation drifts: cumulative count 21

| Session | Count | Drifts + mitigations |
|---|---|---|
| s42 | 3 | table-name guesses (lesson_attendance vs attendance_records; 4-vs-8 RLS table count; busy_blocks vs external_busy_blocks). Mitigation: `information_schema.tables` regex-match BEFORE IN-list construction |
| s43 | 3 | trigger-event CASE WHEN first-match decode bug; TS-bypass-cast grep undercount; bun→npm assumption. Mitigation: bit-decode CTE, 4-sub-pattern enumeration, package-manager auto-detect |
| s44 | 5 | column-name guess; column-value guess; Sub-pattern C grep matches JS comments; Sub-pattern D regex misses default-value annotation; refunds.status unconstrained-text framing wrong. Mitigation: `pg_constraint contype='c'`, `pg_enum`, `pg_get_functiondef` body filter |
| s45 | 7 | RPC regex narrow; auto-pay-installment batch over-attribution; tally check format brittle; hallucinated Connect-onboarding fn names; trigger count 14 vs 15; partial UNIQUE INDEX shape missed; cumulative-tally projection arithmetic error. Mitigations: pg_proc × CENSUS cross-check; filesystem-first edge fn enumeration; CENSUS owning-batch verbatim cite; DB-verified counts canonical; `pg_indexes WHERE indexdef` alongside `pg_constraint`; direct post-state cohort projection |
| **s46 Phase 0** | **3** | auto-pay-upcoming-reminder + auto-pay-final-reminder batch-06 over-attribution (recurrence of s45 #2 class); recurring_* batch-14 misattribution; src/ over-broad scope (CENSUS row 07 = 0R/0P). Mitigations: CENSUS verbatim-cite (recurrence-mitigation); CENSUS row R/P verification before src/ scope claims |

#### Category 2 — Environment caveats discovered s46: 1

- **Git object database corruption with partial blob unreadability** for some HEAD-pinned blobs (e.g., `stripe-auto-pay-installment/index.ts` blob `49213e0f...` unreadable via `git show`; reflog corruption + broken historical objects from `git fsck` output of `e8720a3...` and others)
- **Mitigation**: filesystem Read with `git diff HEAD -- <path>` pre-verification of working-tree cleanliness vs HEAD; verified zero drift across all 5 Phase 1 audit targets (useInvoiceInstallments.ts + 3 edge fns + types.ts)
- **Generalization**: technique applicable to future sessions with corrupted git state
- **Discipline rule for future sessions**: when `git show 65fcde4:<path>` returns "missing blob", fall back to filesystem Read + `git diff HEAD --` verification; log per-target in EXIT report

#### Category 3 — CC-origin methodology drifts s46: 1

- **Drift #5 (Phase 2 CC-origin)**: Sub-pattern D undercount at Phase 2 EXIT; missed 2 `supabase: any` helper signature instances at `stripe-auto-pay-installment/index.ts:10` (`async function incrementAndCheckPause(supabase: any, ...)`) + `:60` (`async function invokeFailureNotification(supabase: any, ...)`)
- **Mitigation rule** (logged for future Phase 2 audits): run explicit `grep -nE "supabase:\s*any"` (or `git grep` against HEAD-pinned blob if readable) on all edge fn helper signatures BEFORE Phase 2 EXIT
- **Class anchor**: s44 4-sub-pattern enumeration Sub-pattern D (`supabase: any` parameter annotation in handler/helper signatures); s45 reinforcement
- **Class total correction**: ≥336 (Phase 2 EXIT claim) → ≥338 (Phase 6 corrected count); +2 reattributed to batch-07 edge-fn surface

**Discipline rule for future audit phases**:
- Reviewing-Claude origin drifts: increment cumulative ledger (Category 1)
- Environment caveats: separate audit-method appendix category (Category 2) with mitigation methodology
- CC-origin methodology drifts: separate audit-method appendix category (Category 3) with mitigation rule + class-consistency anchor citation

---

## §12 Cohort tally (post-batch-07)

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active+partial | 8 | 3 | 4 | 1 | 0 |
| Batch 01 (closed s40) | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (closed s41) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (closed s42) | 5 | 0 | 4 | 1 | 0 |
| Batch 04 (closed s43) | 5 | 0 | 3 | 2 | 0 |
| Batch 05 (closed s44) | 11 | 2 | 5 | 1 | 3 |
| Batch 06 (closed s45) | 8 | 2 | 3 | 0 | 3 |
| **Batch 07 (closed s46)** | **7** | **1** | **1** | **1** | **4** |
| **GRAND ACTIVE** | **116** | **16** | **34** | **24** | **42** |

**Arithmetic verification** (s45 drift #7 mitigation — direct post-state cohort projection):
- Row sum: 8+36+36+5+5+11+8+7 = **116** ✓
- C: 3+3+5+0+0+2+2+1 = **16** ✓
- H: 4+4+10+4+3+5+3+1 = **34** ✓
- M: 1+10+8+1+2+1+0+1 = **24** ✓
- L: 0+19+13+0+0+3+3+4 = **42** ✓
- Column sum check: 16+34+24+42 = **116** ✓

**Net delta from 109 (15C/33H/23M/38L)**: +1C / +1H / +1M / +4L = +7 active findings (batch-07 contribution). PI cohort delta: 0 (no batch-07-owned PIs).
