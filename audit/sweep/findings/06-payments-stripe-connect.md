# Batch 06 — Payments / Stripe / Connect — Findings

> Path Y Phase B systematic audit. Audit-only mode. Banner remains **AUDIT IN PROGRESS — DO NOT FIX YET**. No findings have been fixed in this batch; severity assignments and fix surfaces are recorded for Phase C sprint planning.

---

## 1. Audit basis

- **Session:** s45 (2026-05-12)
- **Phase:** B — Systematic Audit, batch 06 of 21
- **HEAD baseline:** `1c67968` (s44 Phase 10 commit close; established as s45 Phase 0 working baseline; HALT-gate verified at Phase 0)
- **Phases executed:** 0 baseline + READ-FIRST + s45 prep summary; 1 surface inventory walk (file:line); 2 edge fn deep audit; 3 RPC body deep audit; 4 trigger + audit_log + bump_pdf_rev path verification; 5 schema + RLS audit; 6 PI-05 deep dive + F-06-002 Stripe-side validation analysis; 7 PI-07 deep dive; 8 class-pattern sweep; 9 severity adjudication + finding allocation; 10 REQUIRED-UPDATES three-category landing (this commit).
- **Surface audited (verified live):**
  - 0 routes + 0 pages (batch-06 is server-tier only; FE consumption via the 9 hooks)
  - **20 edge fns** (5,981 lines net): stripe-billing-history 112L + stripe-connect-onboard 118L + stripe-connect-status 141L + stripe-create-checkout 435L + stripe-create-payment-intent 396L + stripe-customer-portal 116L + stripe-detach-payment-method 101L + stripe-list-payment-methods 122L + stripe-process-refund 338L + stripe-update-payment-preferences 128L + stripe-verify-session 128L + stripe-webhook **1,690L** + auto-pay-final-reminder 41L + auto-pay-upcoming-reminder 44L + send-auto-pay-alert 286L + send-auto-pay-failure-notification 345L + send-dispute-notification 326L + send-payment-receipt 378L + send-refund-notification 282L + admin-backfill-default-pm 136L
  - **13 SECDEF RPCs** (live body via `pg_get_functiondef` per cumulative methodology): record_stripe_payment (F-02-005 closed-batch immutable cross-ref) + record_manual_payment + record_manual_refund + record_payment_and_update_status (DEAD) + recalculate_invoice_paid + admin_recalculate_invoice_paid + apply_lost_dispute_cascade (F-06-001 anchor) + cancel_payment_plan + update_payment_plan (DEAD) + get_active_disputes_for_org + get_disputes_for_invoice + backfill_guardian_default_pm_set (F-06-002 anchor)
  - **6 trigger functions**: 4 bump_invoice_pdf_rev_from_payments variants (1 unsuffixed orphan F-06-006; 3 suffixed *_ins/_upd/_del statement-level) + payment_disputes_touch_updated_at + validate_refund_amount (Pattern #23 anchor)
  - **15 triggers** across the 8 in-scope tables (event coverage decoded via OR-able-bit method per s43 lesson #4)
  - **9 hooks** (650 lines net): useOrgPaymentPreferences 34L + useInvoicesWithDisputes 37L + useInvoiceDisputes 83L + useStripeConnect 95L + useStripeElements 20L + useStripePayment 67L + useEmbeddedPayment 80L + useSavedPaymentMethods 71L + useRefund 163L
  - **0 cron entries owned by batch 06** — stripe-auto-pay-installment-daily (jobid 90) is CENSUS §7:879 batch-07-owned; webhook-retention-daily (jobid 102) is CENSUS §7:891 batch-19-owned. Launching prompt §6.11 over-attribution corrected at Phase 1 (s45 drifts #2 + #4).
  - **8 tables** (live `pg_policies` + `pg_constraint` + `pg_indexes`): payments + refunds + payment_disputes + payment_notifications + stripe_webhook_events + stripe_checkout_sessions + invoice_installments (cross-batch w/ 07) + guardian_payment_preferences
- **Methodology constraints applied (cumulative through s45):**
  - Schema-name verification via `information_schema.tables` LIKE before IN-list (s42 lesson)
  - Trigger-event OR-able-bit CTE decoding (s43 lesson #4)
  - TS-bypass-cast 4-sub-pattern sweep A/B/C/D incl. JS-comment exclusion (s43 + s44 lessons #5/#9/#10)
  - Multi-export hook files honoured
  - Column-constraint queries on `pg_constraint contype='c'` (s44 lesson #11)
  - **NEW s45**: UNIQUE-shape queries join `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` alongside `pg_constraint contype IN ('u','p')` (s45 drift #6 mitigation)
- **Batch surface coverage:** **8 findings / 13 SECDEF RPCs + 27 RLS-policy-equivalent gates audited + 15 triggers + 20 edge fns + 9 hooks + 8 tables = 71 surface items**, weighted by RLS-policy-defect + RPC-gate-defect convergence layer (F-06-001 + F-06-003 composition chain). Comparison to closed batches: batch 02 (5C/10H/8M/13L = 36 findings) + batch 03 (0C/4H/1M/0L = 5) + batch 04 (0C/3H/2M/0L = 5) + batch 05 (2C/5H/1M/3L = 11). Batch 06 is the **second composition-class CRITICAL batch** (after batch 02 + batch 05) — the F-06-001 + F-06-003 chain is the headline finding-pair.
- **Batch 06 closes 2 PI active entries** (PI-05 + PI-07 — severity events #8 + no-event respectively).

---

## 2. Findings index

### Table 2.1 — Batch 06 findings (8)

| ID | Severity | Phase surfaced | One-line |
|---|---|---|---|
| F-06-001 | **Critical** | 3+5 | `apply_lost_dispute_cascade` broken service-role gate (`auth.uid() IS NOT NULL` blocks authenticated but not anon); composition with F-06-003 enables forged-refund chain |
| F-06-002 | High | 3+5+6 | `backfill_guardian_default_pm_set` no body auth + anon EXECUTE; Stripe-side PM-to-customer validation narrows realised exploit to DoS-on-auto-pay |
| F-06-003 | **Critical** | 5 | `payment_disputes "Service role manages disputes"` PERMISSIVE policy with qual=(auth.uid() IS NULL) enables anon-CRUD across all orgs; NEW class anchor for auth-state-only sub-shape of PERMISSIVE-intended-as-RESTRICTIVE |
| F-06-004 | Low | 3 | `record_payment_and_update_status` is dead code (zero callers; SECDEF + anon EXECUTE + is_org_finance_team body gate) — Phase C cleanup target |
| F-06-005 | High | pre-inv + 6 | PI-05 closure — `invoices.overpayment_minor` populated by Stripe inflow; zero UI renders; helpArticles.ts:1349-1354 workflow claims with no operator-discovery surface |
| F-06-006 | Low | 3+4 | `bump_invoice_pdf_rev_from_payments` (unsuffixed, 388 bytes) is orphan trigger function; zero trigger bindings; suffixed *_ins/_upd/_del variants in production use |
| F-06-007 | High | pre-inv + 2+7 | PI-07 closure — `stripe-webhook:299-303` silent `payment_intent.payment_failed` handler; console.error + break only |
| F-06-008 | Low | 4 | `update_payment_plan` is dead code (zero callers across all broad-pattern greps); SECDEF + Positive Pattern #1/#4/#8/#21 body still PASS |

### Table 2.2 — PI cross-link table (closures)

| PI | F-NN-NNN | Status | Severity pre → final | Event |
|---|---|---|---|---|
| PI-05 | **F-06-005** | RESOLVED s45 | Critical → HIGH | Event #8 (s45 Phase 6; operational-correctness CAPS-at-HIGH + missing-UI-for-tracked-state anchor; marketed-feature-broken evaluated + rejected per discoverability-vs-actionability distinction) |
| PI-07 | **F-06-007** | RESOLVED s45 | HIGH unchanged | none (pre-tag HIGH confirmed per silent-failure-modes + operational-correctness CAPS-at-HIGH) |

---

## 3. Critical findings (2)

### F-06-001 — `apply_lost_dispute_cascade` broken service-role gate; CC-19 #14 NEW anchor

- **Severity:** Critical (severity-adjustment event #9 — mid-session bracket-shift from Phase 3 MEDIUM/HIGH pre-class (operational-correctness defence-in-depth weakness when isolated) to CRITICAL pre-class at Phase 5 via F-06-003 composition discovery)
- **Area:** SECDEF RPC body / claimed-service-role-gate misnaming / financial-falsification chain composition
- **Phase surfaced:** 3 (RPC body audit) + 5 (composition reachability via F-06-003)
- **Class anchor:** NEW class header **claimed-service-role-gate misnaming** — RPC variant `auth.uid() IS NOT NULL` (CC-19 #14)
- **Evidence:** Live `pg_get_functiondef` for `apply_lost_dispute_cascade(_dispute_id uuid)`:
  ```sql
  CREATE OR REPLACE FUNCTION public.apply_lost_dispute_cascade(_dispute_id uuid)
   RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $function$
  DECLARE _dispute payment_disputes%ROWTYPE; _refund_id uuid; _recalc_result json; _existing_cascade_refund uuid;
  BEGIN
    -- No auth gate: this RPC is only called by the stripe-webhook
    -- edge fn running service-role. Adding an is_org_finance_team
    -- check would block it. Defence-in-depth: ensure auth.uid() IS NULL
    -- (service-role has no auth.uid()).
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'apply_lost_dispute_cascade is service-role-only';
    END IF;
    ...
  END;
  $function$
  ```
  EXECUTE granted to anon, authenticated, postgres, service_role (verified via `information_schema.routine_privileges`).

  **Structural defect**: `auth.uid()` returns NULL for BOTH service_role AND anon in Supabase Auth. The gate `auth.uid() IS NOT NULL` blocks authenticated users but PASSES for both anon + service_role. The body comment self-acknowledges "service-role-only" intent but implementation is "non-authenticated-only".

- **Composition chain with F-06-003 (Phase 9 §9.2 full chain documentation)**:
  1. Anon harvests payment_disputes rows via direct SELECT (F-06-003 RLS gap permits anon SELECT).
  2. **Path A** — anon UPDATEs existing dispute SET outcome='lost' (F-06-003 RLS gap permits anon UPDATE).
  3. **Path B** — anon INSERTs forged dispute with attacker-controlled (payment_id, invoice_id, org_id, outcome='lost') (F-06-003 RLS gap permits anon INSERT; FK constraints satisfied via harvested values).
  4. Anon calls `supabase.rpc('apply_lost_dispute_cascade', {_dispute_id: <id>})` → F-06-001 broken gate passes for anon.
  5. Body preconditions: `_dispute.outcome='lost'` (set in step 2/3); idempotency guard `SELECT id FROM refunds WHERE refund_from_dispute_id=_dispute_id AND status='succeeded' LIMIT 1` returns NULL (no prior cascade).
  6. Body INSERTs compensating refund: `refunds (payment_id, invoice_id, org_id, amount_minor, reason='Chargeback lost: <reason>', status='succeeded', stripe_refund_id=NULL, refunded_by=NULL, refund_from_dispute_id=<id>)`. SECDEF privilege bypasses refunds RLS write-block.
  7. Body PERFORMs `recalculate_invoice_paid(invoice_id)` (SECDEF) → `_net_paid := _total_paid − _total_refunded` reduced; invoice status flips paid → sent or overdue per enforce_invoice_status_transition rules.
  8. Body INSERTs audit_log with `action='dispute_lost_cascade_applied'` + `actor_user_id=NULL` (indistinguishable from legitimate webhook cascade).
  9. Downstream: overdue cron picks up "newly overdue" invoice → sends overdue reminder email to parent who has already paid.

- **Realised harm**: parent receives payment-chase email for already-paid invoice; operator sees forged dispute in dashboard ("Chargeback opened on payment X for £Y"); audit trail attribution ambiguous (forged vs legitimate cascade indistinguishable); attacker can iterate.

- **Defence-in-depth analysis**: 
  - Idempotency guard ensures each dispute can only fire ONE cascade (anon vs webhook race → only one wins; both produce identical data).
  - validate_refund_amount trigger (Pattern #23 reinforcement; non-SECDEF) limits refund amount to ≤ parent payment amount; bounds the exploit's per-row financial impact.
  - F-02-005 closed-batch caller-context-validation gap on `record_stripe_payment` is the upstream payment-fabrication anchor; not directly chained here (this exploit uses real payment rows as targets, not forged ones).

- **Legitimate caller**: `supabase/functions/stripe-webhook/index.ts:1640-1668` (`handleDisputeClosed` outcome='lost' branch) — service-role context + Stripe-signature-pre-gated. The webhook caller passes the gate correctly (service-role has `auth.uid()=NULL` → gate's `IS NOT NULL` returns false → no RAISE).

- **Severity reasoning (PLAN.md §4)**: Critical anchors verbatim — "security exposure" (anon-callable financial-cascade RPC) + "financial loss" (composition with F-06-003 produces forged refund + paid_minor drift). Operational-correctness class would CAP at HIGH for the gate-misnaming defect in isolation; composition with F-06-003 escalates to financial-falsification CRITICAL bracket per the composition chain. Severity-adjustment event #9: Phase 3 MEDIUM/HIGH pre-class → Phase 5 CRITICAL via composition.

- **Anchor fix surface (Phase C reference)**: rewrite body gate as service-role-explicit check:
  ```sql
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'apply_lost_dispute_cascade is service-role-only';
  END IF;
  ```
  Or REVOKE EXECUTE from anon + authenticated (preserves service-role grant; webhook unaffected):
  ```sql
  REVOKE EXECUTE ON FUNCTION public.apply_lost_dispute_cascade(uuid) FROM anon, authenticated;
  ```
  Both surfaces close the gate-misnaming defect; combination is preferred for defence-in-depth.

- **Phase C sprint candidate:** **S-27-claimed-service-role-gate-remediation** clustered with F-06-003 anchor fix (RLS variant) per CC-19 #14 batch-19 sweep prep.

- **Decision needed:** Yes — choose service-role-explicit body gate vs REVOKE-anon vs both. Recommend both per defence-in-depth.

- **Target sprint:** Phase C **S-27** + class-grouped with F-06-003 fix surface.

- **Closure:** (open)

---

### F-06-003 — `payment_disputes "Service role manages disputes"` PERMISSIVE policy enables anon-CRUD; NEW PERMISSIVE-intended-as-RESTRICTIVE auth-state-only sub-shape anchor

- **Severity:** Critical
- **Area:** RLS policy semantics / PERMISSIVE-intended-as-RESTRICTIVE class header expansion / cross-tenant write to financial dispute table
- **Phase surfaced:** 5 (RLS policy enumeration discovered the qual shape)
- **Class anchor:** PERMISSIVE-intended-as-RESTRICTIVE (F-05-001 batch-05 anchor) — NEW sub-shape `auth.uid() IS NULL` (distinct from F-05-001 anchor's `is_org_active(org_id)` sub-shape; CC-19 #14 + CC-19 #13 dual carry)
- **Evidence:** Live `pg_policies`:
  ```
  schemaname=public  tablename=payment_disputes
  policyname=Service role manages disputes
  permissive=PERMISSIVE  roles={public}  cmd=ALL
  qual_expr=(auth.uid() IS NULL)
  with_check_expr=(auth.uid() IS NULL)
  ```
  Plus second policy: `"Finance team can view disputes"` PERMISSIVE role={public} cmd=SELECT qual=`is_org_finance_team(...)`.

  **Independent table-grant verification** (reviewing-Claude Phase 5 close): `information_schema.role_table_grants` for `public.payment_disputes` shows anon role has SELECT + INSERT + UPDATE + DELETE + REFERENCES + TRIGGER + TRUNCATE. Standard Supabase default-grant pattern. Combined with the broken RLS qual, anon has full CRUD reachability across all orgs.

  **PERMISSIVE OR semantics**: at least one policy must pass. For anon caller (`auth.uid()=NULL`):
  - "Service role manages disputes" qual `(auth.uid() IS NULL)` → TRUE → policy passes.
  - "Finance team can view disputes" qual `is_org_finance_team(NULL, _org_id)` → FALSE.
  - PERMISSIVE OR: at least one passes → access permitted.

  Therefore:
  - **anon SELECT**: returns all payment_disputes rows across all orgs (no org_id filter).
  - **anon INSERT**: with_check `(auth.uid() IS NULL)` → TRUE → INSERT permitted with attacker-controlled fields (FK constraints to payments + invoices + organisations must satisfy; harvested via prior SELECT).
  - **anon UPDATE**: qual and with_check both pass → UPDATE permitted including `outcome='lost'` mutation on any existing dispute.
  - **anon DELETE**: qual passes → DELETE permitted → operator loses chargeback audit trail.

- **Composition with F-06-001**: F-06-003 is one half of the forged-refund chain documented at §3.F-06-001. F-06-003 alone permits forged dispute INSERT/UPDATE (operator-visible "Chargeback opened on payment X for £Y"); composition with F-06-001 unlocks the SECDEF-context refund INSERT via apply_lost_dispute_cascade.

- **Standalone harm (without F-06-001 composition)**:
  - Forged disputes in operator dashboard → operator pursues bogus evidence submission → wasted operational time + reputational confusion when contacting Stripe.
  - Forged historical disputes affect analytics + reports.
  - DELETE of legitimate dispute → loss of forensic audit trail.

- **Defence-in-depth analysis**: ZERO defensive layers at DB. payment_disputes has the broken policy + a single benign "Finance team can view" policy. No RESTRICTIVE policy; no triggers that would gate caller context. Webhook handler's `if (insertErr.code === "23505") log('already recorded')` idempotency (per `idx_payment_disputes_stripe_id` UNIQUE INDEX on stripe_dispute_id) catches duplicate INSERTs from the webhook path; does NOT distinguish anon-forged from legitimate webhook.

- **Closed-batch class anchor reinforcement**: F-05-001 (invoices.block_expired_trial_invoice_insert) is the batch-05 CRITICAL anchor for PERMISSIVE-intended-as-RESTRICTIVE class. Class header now spans **5 instances bifurcated by sub-shape**:
  | Sub-shape | Instances | Reachability |
  |---|---|---|
  | `is_org_active(org_id)` | 3 (F-05-001 anchor + lessons batch-03 closed cross-ref + students batch-02 closed cross-ref) | requires active/trialing org (bounded by subscription state) |
  | `auth.uid() IS NULL` (NEW s45) | **1 anchor F-06-003** | unconditional anon-CRUD |
  | `qual=false` (inert) | 1 (payments "Block anonymous access to payments") | INERT (PERMISSIVE qual=false adds zero rows to OR-set) |

- **Severity reasoning (PLAN.md §4)**: Critical anchors verbatim — "security exposure" (anon CRUD on financial table) + "financial loss" (composition with F-06-001 enables forged refund + paid_minor drift) + "first-encounter trust erosion" (operator sees fabricated chargebacks in dashboard on Lauren Shadow Term first-touch). Class consistency with F-05-001 CRITICAL anchor.

- **Anchor fix surface (Phase C reference)**: convert policy to RESTRICTIVE OR rewrite qual:
  ```sql
  -- Option A: convert to RESTRICTIVE
  DROP POLICY "Service role manages disputes" ON public.payment_disputes;
  CREATE POLICY "Service role manages disputes" ON public.payment_disputes AS RESTRICTIVE
    FOR ALL USING (current_setting('request.jwt.claim.role', true) = 'service_role')
              WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

  -- Option B: explicit service-role qual
  ALTER POLICY "Service role manages disputes" ON public.payment_disputes
    USING (current_setting('request.jwt.claim.role', true) = 'service_role')
    WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');
  ```
  Option B simpler if no other PERMISSIVE policies need to OR with it. Option A safer if more policies join the OR-set in future.

- **Phase C sprint candidate:** **S-28-permissive-restrictive-conversion-batch-06** clustered with batch-05 S-15 (F-05-001 fix) + cross-tenant class fix across `lessons` (batch-03 closed) + `students` (batch-02 closed) PERMISSIVE instances. Class-grouped fix.

- **Decision needed:** Yes — Option A vs B (RESTRICTIVE vs explicit-qual). Mechanical fix either way.

- **Target sprint:** Phase C **S-28** + class-grouped with F-05-001 sprint + F-06-001 sprint.

- **Closure:** (open)

---

## 4. High findings (3)

### F-06-002 — `backfill_guardian_default_pm_set` no body auth + anon EXECUTE; DoS-on-auto-pay realised exploit

- **Severity:** High (Phase 6 Stripe-side PM validation analysis confirmed DoS-on-auto-pay realised shape; not financial-falsification)
- **Area:** SECDEF RPC body / parameter-spoofing class / Stripe-side downstream validation analysis
- **Phase surfaced:** 3 (body audit) + 5 (anon-enumerability chain via F-02-020 closed-batch class) + 6 (Stripe-side PM-to-customer validation)
- **Class anchor:** parameter-spoofing FAIL (F-02-005 / F-02-002 closed-batch CRITICAL family)
- **Evidence:** Live `pg_get_functiondef`:
  ```sql
  CREATE OR REPLACE FUNCTION public.backfill_guardian_default_pm_set(_guardian_id uuid, _org_id uuid, _payment_method_id text)
   RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $function$
  DECLARE _existing record;
  BEGIN
    IF _guardian_id IS NULL OR _org_id IS NULL OR _payment_method_id IS NULL THEN
      RAISE EXCEPTION 'guardian_id, org_id, and payment_method_id are required';
    END IF;
    SELECT id, default_payment_method_id INTO _existing
      FROM public.guardian_payment_preferences
      WHERE guardian_id = _guardian_id AND org_id = _org_id FOR UPDATE;
    IF _existing IS NULL THEN
      INSERT INTO public.guardian_payment_preferences (guardian_id, org_id, default_payment_method_id, updated_at)
      VALUES (_guardian_id, _org_id, _payment_method_id, now());
      RETURN json_build_object('updated', true, 'previous', null, 'action', 'inserted');
    END IF;
    IF _existing.default_payment_method_id IS NULL THEN
      UPDATE public.guardian_payment_preferences SET default_payment_method_id = _payment_method_id, updated_at = now() WHERE id = _existing.id;
      RETURN json_build_object('updated', true, 'previous', null, 'action', 'updated');
    END IF;
    RETURN json_build_object('updated', false, 'previous', _existing.default_payment_method_id, 'action', 'skipped');
  END;
  $function$
  ```
  EXECUTE granted to anon, authenticated, postgres, service_role.

  **Structural defects**:
  - Zero `auth.uid()` reference.
  - Zero `is_org_*` guard.
  - Zero guardian-ownership cross-check (`guardians.user_id` not consulted).
  - Caller-supplied `_payment_method_id` (Stripe PM ID controlling future debit routing) stored without Stripe-side validation.

  **Boundaries**:
  - `guardian_payment_preferences_guardian_id_org_id_key UNIQUE (guardian_id, org_id)` per `pg_constraint` — exploit bounded to one row per (guardian, org) pair.
  - Body L24-32 skip-on-already-set guard: if `_existing.default_payment_method_id IS NOT NULL`, returns `'skipped'` without overwrite. Exploit window narrows to NULL-PM-pair only.

- **Anon-enumerability chain** (Phase 5 §5.3):
  - `guardians` table direct anon SELECT: BLOCKED via RLS (all guardians policies require authenticated context).
  - `get_guardian_ids_for_user(_user_id)` SECDEF + anon EXECUTE — F-02-020 closed-batch helper-class instance from batch 02 immutable. Returns `guardian.id[]` for any caller-supplied `_user_id`. **Anon can enumerate guardian.id values via this chain.**

- **Stripe-side PM validation analysis** (Phase 6 §6.7) — `stripe-auto-pay-installment` (batch-07 owned; cross-batch read NOT audit):
  - L205-211: reads `default_payment_method_id` + `stripe_customer_id` + `auto_pay_enabled`; guards on all three non-null.
  - L265-268: `paymentIntentParams = {customer: prefs.stripe_customer_id, payment_method: prefs.default_payment_method_id, off_session: true, confirm: true}`.
  - L295: `stripe.paymentIntents.create(...)`.

  **Stripe-side semantics**: `PaymentIntent.create` with `customer + payment_method` validates that PM is attached to that customer. Attacker-supplied PM is NOT attached to victim's Stripe customer (attaching requires server-side Stripe secret-key access; out of scope for anon). Stripe returns `invalid_request_error` ("The payment method must be attached to the customer to be used in this way"). PI creation fails. Auto-pay debit fails. Edge fn catches the error.

  **Realised exploit**: DoS-on-auto-pay. Attacker silently breaks victim's auto-pay setup by planting non-attached PM ID. Each subsequent auto-pay attempt fails. No fraudulent debit occurs.

- **Legitimate caller**: `supabase/functions/admin-backfill-default-pm/index.ts:86-93`. The edge fn validates auth via `validateCronAuth(req)` (L29) + uses service-role client (L34) + filters guardians with `default_payment_method_id IS NULL` and `stripe_customer_id IS NOT NULL` (L48-52) + calls Stripe API to list real PMs attached to that customer (L72-76) + picks the most recent card (L84). The legitimate path is operator-driven one-shot per environment; not on a cron schedule.

- **Severity reasoning (PLAN.md §4)**: High anchors verbatim — "silent failure modes" (auto-pay debit attempts fail silently at Stripe layer; no audit-log entry on default_payment_method_id mutation; victim guardian has no banner indicating auto-pay disabled) + "missing UI surfaces for tracked DB state" (default_payment_method_id mutation invisible to operator + parent). Operational-correctness class CAPS-at-HIGH per s42 PI-11 + s44 PI-02/03/04 + s45 PI-05 precedent chain (4 prior Critical→HIGH adjustments on this class).

  **CRITICAL evaluated + rejected**: pre-class CRITICAL framing (per §6.13 launching prompt) was conservative — Stripe-side PM-to-customer validation catches the financial-falsification scenario. The realised exploit is DoS-on-auto-pay, not forged-debit. Class consistency with parameter-spoofing FAIL family confirmed (F-02-005 / F-02-002 anchors closed-batch immutable) but realised severity HIGH due to Stripe-side downstream validation.

- **Anchor fix surface (Phase C reference)**:
  - Add body-level guardian-ownership cross-check + caller-context gate:
    ```sql
    IF NOT EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid() AND org_id = _org_id AND status = 'active'
        AND role IN ('owner', 'admin', 'finance')
    ) THEN
      IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Not authorised'; END IF;
      -- service-role bypass for cron caller; check via JWT claim
      IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Not authorised';
      END IF;
    END IF;
    ```
  - Or REVOKE EXECUTE from anon + authenticated:
    ```sql
    REVOKE EXECUTE ON FUNCTION public.backfill_guardian_default_pm_set(uuid, uuid, text) FROM anon, authenticated;
    ```
    Preserves service-role + postgres grants; admin-backfill-default-pm edge fn caller path unaffected.
  - Add audit_log INSERT in RPC body for PM mutation forensic trail (defence-in-depth).

- **Phase C sprint candidate:** **S-29-parameter-spoofing-batch-06** clustered with CC-19 #14 batch-19 sweep prep (REVOKE EXECUTE class fix) + Stripe-side PM-attachment-validation defence-in-depth.

- **Decision needed:** Yes — body gate (preserves explicit anon/authenticated rejection path) vs REVOKE-anon (preserves service-role grant only). Recommend body gate for forensic clarity.

- **Target sprint:** Phase C **S-29** + class-grouped with F-02-020 helper class Track 1/Track 2 split if same sprint.

- **Closure:** (open)

---

### F-06-005 — PI-05 closure: `invoices.overpayment_minor` populated by Stripe path; zero UI renders (severity event #8 ↓)

- **Severity:** High (severity-adjustment event #8 — Critical pre-tag → HIGH final per operational-correctness CAPS + missing-UI-for-tracked-state anchor)
- **Area:** column populated by Stripe inflow; FE renders zero references; help-article-claimed workflows have no discovery surface
- **Phase surfaced:** pre-investigation s38 + s45 Phase 6 deep-dive
- **Class:** operational-correctness — missing UI for tracked DB state. PI-05 closure.
- **PI-05 lineage:**
  - s38: "overpayment_minor column populated by Stripe path but ZERO UI surfaces"; tagged Critical.
  - s45 Phase 6 re-verification (live `information_schema.columns ~* 'overpay'`): `invoices.overpayment_minor [integer NOT NULL DEFAULT 0]` — single column schema-wide.
- **Evidence:**
  - **Populator** — `recalculate_invoice_paid` body (live):
    ```sql
    _overpayment := GREATEST(0, _net_paid - _invoice.total_minor);
    ...
    UPDATE invoices SET paid_minor = _net_paid, status = _new_status::invoice_status, overpayment_minor = _overpayment
      WHERE id = _invoice_id;
    ```
    Auth gate: `IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN RAISE` — Positive Pattern #19.
  - **Manual-vs-Stripe asymmetry CONFIRMED** (live `record_manual_payment` body L46-52):
    ```sql
    -- Overpayment hard-reject (manual intent only; Stripe path accepts).
    _current_paid_minor := COALESCE(_invoice.paid_minor, 0);
    _new_paid_minor := _current_paid_minor + p_amount_minor;
    IF _new_paid_minor > _invoice.total_minor THEN
      RAISE EXCEPTION 'Payment of % would exceed invoice balance of %', ...
        USING ERRCODE = '22023', HINT = 'Reduce the payment amount to at most the outstanding balance.';
    END IF;
    ```
    **Manual path REJECTS overpayment via 22023 BEFORE call**. **Stripe path ACCEPTS** (record_stripe_payment body F-02-005 closed-batch immutable has no equivalent guard). `invoices.overpayment_minor > 0` is reachable ONLY via Stripe inflow.
  - **Caller enumeration** (Phase 6 §6.2): 6 in-DB callers (record_stripe_payment + record_manual_payment + record_manual_refund + record_payment_and_update_status [DEAD] + admin_recalculate_invoice_paid + apply_lost_dispute_cascade) + 4 edge fn callers (recalc-with-retry helper + invoice-overdue-check:125 + installment-overdue-check:102 batch-07 carry) + 1 FE caller (useInvoiceRecalcFailure:67 wraps admin_recalculate_invoice_paid).
  - **UI surface enumeration via `rg -n 'overpayment_minor' src/`**:
    - `src/integrations/supabase/types.ts:2042, 2073, 2104` — generated Database types (Row, Insert, Update). Auto-generated; not UI surface.
    - `src/hooks/useInvoiceRecalcFailure.ts:75` — TS type alias on RPC response `data as {net_paid, total_minor, new_status, overpayment_minor: number}`. Type-only reference; onSuccess toast at L83-86 renders ONLY `result.new_status`, NOT overpayment value.
    - **No UI component RENDERS the value of `invoices.overpayment_minor` anywhere in `src/`.**
  - **Help-article observation** (`src/components/help/helpArticles.ts:1349-1354`) — operator-facing help text:
    ```
    ## Overpayments
    If the parent paid more than the total:
    - Apply the overpayment to a different invoice, OR
    - Record as credit for future lessons, OR
    - Refund the difference via your bank
    ```
    Workflows themselves EXIST (refund via stripe-process-refund + credit-note via process-term-adjustment + manual re-record on different invoice). **What's missing is the DISCOVERY surface** — no operator-visible badge/banner/list-column showing overpayment per invoice.

- **Impact:**
  - Parent pays £100 for £90 invoice → no notification of overpayment → may pay again next month thinking nothing was overpaid.
  - Operator doesn't know which invoices have overpayment → can't initiate any of the help-article workflows without direct DB query.
  - At Lauren Shadow Term scale, an unknown number of guardians may overpay (e.g., partial-prepayment after price adjustment); operator never sees it.
  - **Underlying data is correct**: payments + refunds rows hold ground truth; `invoices.overpayment_minor` stores the canonical computed value. Recovery via report or direct query.

- **Severity reasoning (PLAN.md §4)**: High anchors verbatim — "missing UI surfaces for tracked DB state" + operational-correctness class CAPS-at-HIGH (s42 PI-11 + s44 PI-02/03/04 precedent chain: 3 prior Critical→HIGH adjustments). **CRITICAL anchor evaluated + rejected**:
  - "Financial loss": rejected — money is in Stripe; not lost.
  - "Marketed feature fundamentally broken": evaluated via helpArticles.ts:1349-1354 claim — the 3 workflows themselves exist (refund + credit-note + manual re-record); only the discovery surface is missing. Operational-correctness class per discoverability-vs-actionability distinction; not "fundamentally broken" per rubric.
  - "First-encounter trust erosion": evaluated — parent payment receipt fires successfully (payment_notifications + receipt email); the trust erosion would manifest only if parent overpays + later notices discrepancy. Not first-encounter.

  Severity-adjustment event #8 (s45 Phase 6): pre-tag Critical → HIGH per class consistency with PI-02/03/04 closures (events #5, #6, #7 from s44).

- **Cross-batch propagation note**:
  - **Batch 11 (parent portal)**: parent does not see overpayment_minor either. Parent invoice detail surface may need PI-05-class fix on parent-side.
  - **Batch 10 (reports-analytics-payroll)**: aggregate overpayment reporting (total overpaid per org; reconciliation reports) would surface this column. None observed in batch-06 scope.

- **Anchor fix surface (Phase C reference)**:
  - Add operator-visible badge on InvoiceDetail when `overpayment_minor > 0`.
  - Add "Overpayments" filter / aggregate to Invoices list page.
  - Add `overpayment_count` + `overpayment_total_minor` to `get_invoice_stats` body output.
  - Per-org overpayment-resolution UI: button "Apply to next invoice" / "Convert to credit note" / "Refund the difference" wired to existing workflows.
  - Cross-batch parent-portal display (batch-11 fix surface).

- **Phase C sprint candidate:** **S-30-overpayment-discovery-surface** — operator-side + parent-side display + workflow wiring. Class-grouped with PI-02 (S-18-invoice-status-enum-cleanup) per common state-machine + UI-surface theme.

- **Decision needed:** No (mechanical UI additions; workflows already exist).

- **Target sprint:** Phase C **S-30** + batch-11 cross-batch coordination.

- **Closure:** **RESOLVED — PI-05 → F-06-005 HIGH (severity-adjustment event #8).**

---

### F-06-007 — PI-07 closure: silent `payment_intent.payment_failed` webhook handler (HIGH unchanged)

- **Severity:** High (no severity adjustment; pre-tag HIGH confirmed per silent-failure-modes + operational-correctness CAPS)
- **Area:** Stripe webhook event handler / silent operational failure surface
- **Phase surfaced:** pre-investigation s38 + s45 Phase 2 (surface walk) + Phase 7 (deep dive + class consistency)
- **Class:** silent-failure-modes (F-05-005 closed-batch class anchor) — operational-correctness CAPS-at-HIGH
- **PI-07 lineage:**
  - s38: "payment_intent.payment_failed webhook only logs, no notification or surface"; tagged HIGH.
  - s45 Phase 2 surface walk: confirmed line-by-line.
- **Evidence:** Live `supabase/functions/stripe-webhook/index.ts:299-303`:
  ```ts
  case "payment_intent.payment_failed": {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.error(`Payment failed: ${truncate(paymentIntent.id)}`, paymentIntent.last_payment_error?.message);
    break;
  }
  ```
  **5 lines exactly. No handler function call. No dispatcher.**

  **Surface-update enumeration** (Phase 7 §7.1):
  | Side-effect | Present? |
  |---|---|
  | payment_notifications INSERT | NO (success-side per Phase 4 §4.1 schema; failure-event writes incompatible) |
  | audit_log INSERT | NO (handler-level audit_log writes at 6 stripe-webhook sites; L299-303 is NOT one of them) |
  | Email enqueue (`send-*` fire-and-forget) | NO |
  | Operator surface update (banner / dashboard write) | NO |
  | Idempotency-ledger row | YES (passive — outer flow L353-358 marks stripe_webhook_events.processed_at = now()) |

  **Net: zero operator-discoverable signal that a payment failed on this PI.**

- **Counter-example** (`payment_intent.succeeded` at L293-297 → `handlePaymentIntentSucceeded` L855-1054):
  - record_stripe_payment RPC (atomic payment + recalc) L901-908
  - payment_notifications INSERT L951-958 (real-time teacher alert)
  - guardian_payment_preferences upsert (default_PM auto-promote) L979-996
  - send-payment-receipt fire-and-forget L1007-1018
  - xero-sync-payment fire-and-forget L1036-1046
  - audit_log via audit_payments trigger (implicit via record_stripe_payment payments INSERT)

  **Side-effect ratio**: success 6 explicit + 1 implicit ; failure 1 (console.error). **7 : 1 asymmetry.**

- **Idempotency-ledger framing precision** (Phase 7 §7.3):
  - `stripe_webhook_events` schema: 4 columns only (event_id PK + event_type + processed_at + created_at).
  - No payload, no error_message, no retry_count, no failure_code preserved.
  - Operator querying stripe_webhook_events sees: "we received N payment_intent.payment_failed events between T1 and T2"; cannot determine which PIs, which customers, which failure reasons, which amounts — all detail is in Stripe Dashboard only.

  **Severity framing precision**: "minimally tracked at idempotency-ledger level; not tracked at failure-detail level; zero operator surface". The minimal ledger tracking does not change severity adjudication — HIGH per missing-UI-for-tracked-state stands.

- **Class consistency** (Phase 7 §7.4):
  | ID | Site | Mitigation | Severity | Status |
  |---|---|---|---|---|
  | F-05-005 (closed batch 05) | invoice-overdue-check:125 | recalcWithRetry helper + RecalcFailureBanner | HIGH (event #7 ↓) | immutable |
  | **F-06-007 (this batch)** | **stripe-webhook:299-303** | **ZERO** | **HIGH** | **open** |
  | (carry) | installment-overdue-check:102 | (batch-07 owned) | TBD | batch-07 carry |

  **F-06-007 is STRICTLY-LESS-MITIGATED than F-05-005**. Same class, worse operator-impact profile. Same severity bracket (HIGH); no CRITICAL escalation anchor (Stripe holds the money; no falsification; no security exposure; not marketed-feature broken).

- **Impact:**
  - Parent's card fails → Stripe sends payment_intent.payment_failed → handler logs to Sentry console + does nothing → parent thinks payment went through (no email failure receipt either) → operator doesn't chase → invoice goes overdue via cron eventually (after L298 invoice-overdue-check default 14-day window).
  - Auto-pay-related failures dispatch via send-auto-pay-failure-notification only on cron-side, NOT on webhook-side.
  - At Lauren Shadow Term scale (~250 pupils, recurring billing), failed-card events accumulate without operator awareness until late-stage overdue reminders fire.

- **Severity reasoning (PLAN.md §4)**: High anchors verbatim — "silent failure modes" + "missing UI surfaces for tracked DB state". Operational-correctness class CAPS-at-HIGH per s42 PI-11 + s44 PI-02/03/04 + s45 PI-05 precedent (now 4 prior Critical→HIGH adjustments). No CRITICAL anchor: Stripe holds the money (no movement = no falsification); not first-encounter (parent doesn't see anything either; the failure is invisible everywhere). No severity-adjustment event — pre-tag HIGH at s38; final HIGH at Phase 9.

- **Anchor fix surface (Phase C reference)**:
  - INSERT to `payment_notifications` with negative event-type framing (requires schema extension to support failure events — currently `amount_minor NOT NULL` schema rejects):
    ```sql
    ALTER TABLE payment_notifications ADD COLUMN event_type text NOT NULL DEFAULT 'payment_succeeded';
    ALTER TABLE payment_notifications ALTER COLUMN amount_minor DROP NOT NULL;
    ALTER TABLE payment_notifications ADD CONSTRAINT chk_payment_notifications_event CHECK (event_type IN ('payment_succeeded','payment_failed','refund_succeeded','refund_failed','dispute_opened','dispute_closed'));
    ```
  - Or dispatch to `send-auto-pay-failure-notification` (existing edge fn) on webhook-side for non-cron payment_intent.payment_failed events:
    ```ts
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.error(`Payment failed: ${truncate(paymentIntent.id)}`, paymentIntent.last_payment_error?.message);
      // S-31 FIX: dispatch failure notification + audit_log
      await dispatchPaymentFailedNotification(supabase, paymentIntent);
      await supabase.from('audit_log').insert({
        org_id: <derived>,
        actor_user_id: null,
        action: 'payment_failed',
        entity_type: 'invoice',
        entity_id: <derived from PI metadata>,
        after: { stripe_payment_intent_id: paymentIntent.id, failure_code, failure_message, amount_minor },
      });
      break;
    }
    ```

- **Phase C sprint candidate:** **S-31-payment-failed-surface** — webhook handler dispatch + payment_notifications schema extension + parent-portal display. Class-grouped with F-05-005 (S-22-invoice-overdue-check-error-binding) per state-machine + silent-failure cluster.

- **Decision needed:** Yes — payment_notifications schema extension vs dedicated failure-event table vs send-auto-pay-failure-notification dispatcher reuse.

- **Target sprint:** Phase C **S-31** + class-grouped with S-22 state-machine cluster.

- **Closure:** **RESOLVED — PI-07 → F-06-007 HIGH (pre-tag HIGH confirmed; no severity adjustment).**

---

## 5. Medium findings (0)

None this batch.

---

## 6. Low findings (3)

### F-06-004 — `record_payment_and_update_status` is dead code; CC-19 #15 NEW anchor

- **Severity:** Low
- **Area:** Dead-code SECDEF RPC / parallel-implementation drift cleanup
- **Phase surfaced:** 3 (§6.7 parallel-implementation deep-dive)
- **Class:** dead-code SECDEF RPC — CC-19 #15 NEW anchor
- **Evidence:**
  - Signature: `record_payment_and_update_status(_org_id uuid, _invoice_id uuid, _amount_minor integer, _currency_code text, _method text, _provider_reference text) RETURNS json` — SECDEF + search_path=public, body 5,154 bytes, EXECUTE granted to anon + authenticated + postgres + service_role.
  - **Callers across src/ + supabase/functions/**: **ZERO** (Phase 3 grep verified).
  - **Parallel implementation**: `record_manual_payment(p_invoice_id, p_amount_minor, p_method, p_paid_at, p_reference, p_installment_id)` — newer signature, robust auto-allocation by (due_date ASC, id ASC), explicit installment targeting, overpayment hard-reject. Active caller at `src/hooks/useInvoices.ts:466`.
  - Body has `IF NOT is_org_finance_team(auth.uid(), _org_id) THEN RAISE` gate (Positive Pattern #1) — anon cannot exploit via direct REST call.
- **Impact**: live REST attack surface despite zero in-app usage. Gate-protected so no exploit, but unused surface is a maintenance burden + cleanup target.
- **Severity reasoning (PLAN.md §4)**: Low — "legacy artefacts" + "code-hygiene drift". RPC body itself is Positive Pattern #1 PASS; class consistency check at F-05-002 dedup-class is clean (uses provider_reference dedup like record_stripe_payment).
- **Anchor fix surface (Phase C reference)**: REVOKE EXECUTE + DROP FUNCTION:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.record_payment_and_update_status(uuid, uuid, integer, text, text, text) FROM anon, authenticated, postgres;
  DROP FUNCTION public.record_payment_and_update_status(uuid, uuid, integer, text, text, text);
  ```
- **Phase C sprint candidate:** **S-32-dead-code-sweep** class-grouped with F-06-006 + F-06-008 + CC-19 #15 batch-19 sweep prep.
- **Decision needed:** No.
- **Target sprint:** Phase C **S-32**.
- **Closure:** (open)

---

### F-06-006 — `bump_invoice_pdf_rev_from_payments` (unsuffixed) is orphan trigger function

- **Severity:** Low
- **Area:** Orphan SECDEF trigger function / schema-archaeology cleanup
- **Phase surfaced:** 3 (dead-code check) + 4 (migration archaeology)
- **Class:** dead-code SECDEF trigger function — CC-19 #15 NEW anchor
- **Evidence:**
  - Signature: `bump_invoice_pdf_rev_from_payments()` RETURNS trigger — SECDEF + search_path=public, body 388 bytes.
  - **Zero trigger bindings** (Phase 3 `pg_trigger` join verified).
  - Suffixed variants `*_ins / *_upd / *_del` (3 statement-level transition-table-driven functions) are bound to payments triggers (Phase 1 §1.4 + Phase 4 §4.3 confirmed).
  - **Migration archaeology** (Phase 3 grep on supabase/migrations/):
    - `20260426085724_*.sql:110-131` — original ROW-level CREATE FUNCTION + trigger binding.
    - `20260504100000_invoice_pdfs_storage.sql:143-164` — re-CREATE FUNCTION (still ROW-level) + trigger binding.
    - `20260501223523_*.sql:539` + `20260516100000_canary_walk_batch_1z_combined_fixes.sql:580` + `20260516110000_canary_walk_batch_1z_corrected.sql:749` — progressive DROPs replacing with STATEMENT-level *_ins/_upd/_del variants.
    - Final DB state: unsuffixed function persists with zero bindings.
- **Impact**: orphan function consumes schema-namespace; zero behavioural impact; CC-19 #15 cleanup target.
- **Severity reasoning (PLAN.md §4)**: Low — "legacy artefacts" + "code-hygiene drift".
- **Anchor fix surface (Phase C reference)**:
  ```sql
  DROP FUNCTION public.bump_invoice_pdf_rev_from_payments();
  ```
- **Phase C sprint candidate:** **S-32-dead-code-sweep**.
- **Decision needed:** No.
- **Target sprint:** Phase C **S-32**.
- **Closure:** (open)

---

### F-06-008 — `update_payment_plan` is dead code; CC-19 #15 NEW reinforcement anchor

- **Severity:** Low
- **Area:** Dead-code SECDEF RPC / installment-plan editing surface absent
- **Phase surfaced:** 4 (broad-pattern caller re-grep per Phase 3 carry-forward task)
- **Class:** dead-code SECDEF RPC — CC-19 #15 NEW
- **Evidence:**
  - Signature: `update_payment_plan(p_invoice_id uuid, p_installments integer, p_frequency text DEFAULT 'monthly') RETURNS SETOF invoice_installments` — SECDEF + search_path=public, body 3,489 bytes, EXECUTE granted to anon + authenticated + postgres + service_role.
  - **Callers** (broad-pattern re-grep across src/ + supabase/functions/ + supabase/migrations/ + literal-string `'update_payment_plan'`): **ZERO**.
  - **Body gate**: Positive Pattern #1 + #4 + #8 + #21 simultaneously (Phase 3 §3.1 analysis):
    - L11-13: `_caller_id := auth.uid()` + `IF _caller_id IS NULL THEN RAISE 'Not authenticated'`
    - L21-28: org_memberships EXISTS check `role IN ('owner', 'admin', 'finance')`
    - L30-33: state-machine gate `IF _invoice.status IN ('paid', 'void') THEN RAISE`
    - L35-40: input validation `p_installments BETWEEN 2 AND 12` + `p_frequency IN ('monthly','fortnightly','custom')`
  - Multi-step write rollback PASS via PL/pgSQL implicit transaction (DELETE + INSERT loop + UPDATE atomic).
- **Impact**: live REST attack surface despite zero in-app usage. Gate-protected so anon cannot exploit, but unused surface is cleanup target.
- **Severity reasoning (PLAN.md §4)**: Low — "legacy artefacts" + "code-hygiene drift". Body is exemplary positive pattern stack; could be preserved if future installment-plan-editing UI feature emerges.
- **Anchor fix surface (Phase C reference)**:
  - Option A: REVOKE + DROP (if no future feature planned):
    ```sql
    REVOKE EXECUTE ON FUNCTION public.update_payment_plan(uuid, integer, text) FROM anon, authenticated, postgres;
    DROP FUNCTION public.update_payment_plan(uuid, integer, text);
    ```
  - Option B: preserve as reference + REVOKE anon-EXECUTE only:
    ```sql
    REVOKE EXECUTE ON FUNCTION public.update_payment_plan(uuid, integer, text) FROM anon;
    ```
    Allows future FE feature to repoint to the RPC without re-implementing the well-formed positive-pattern stack.
- **Phase C sprint candidate:** **S-32-dead-code-sweep** with Option A/B decision.
- **Decision needed:** Yes — Option A (drop) vs Option B (preserve for future).
- **Target sprint:** Phase C **S-32**.
- **Closure:** (open)

---

## 7. Positive patterns + HOLDS reinforcements

### 7.1 — New patterns documented this batch (2)

#### Pattern #22 — Two-state-managed webhook dedup with stale-recovery

**Anchor**: `supabase/functions/stripe-webhook/index.ts:121-233`.

**Shape** (Phase 2 §2.1 + Phase 9 §9.3 documentation):
```
Phase 1 (claim):
  INSERT into idempotency_ledger (event_id, event_type, processed_at=NULL)
  IF 23505 conflict THEN
    SELECT event from ledger
    IF processed_at IS NOT NULL → duplicate; return 200 with {duplicate: true}
    IF processed_at IS NULL AND age < STALE_THRESHOLD → in-flight; return 409
    IF processed_at IS NULL AND age >= STALE_THRESHOLD → stale-recovery:
       INSERT platform_audit_log ('webhook_stale_recovery', source, severity, details)
       DELETE ledger row WHERE event_id = X AND processed_at IS NULL
       reclaim

Phase 2 (dispatch):
  TRY: handler dispatch
  ON SUCCESS:
    UPDATE ledger SET processed_at = now() WHERE event_id = X AND processed_at IS NULL
  ON FAILURE:
    DELETE ledger row WHERE event_id = X AND processed_at IS NULL
    return 500 (external retry re-enters phase 1)
```

**Class**: defensive-layering positive pattern. Solves the "webhook handler crashed mid-flight" problem without losing idempotency. The two-state-managed axis is `processed_at NULL` (in-flight) vs `processed_at = <timestamp>` (complete); the stale-recovery layer handles the crashed-handler edge case via age-threshold + forensic audit log entry to `platform_audit_log`.

**Relation to existing patterns**:
- Distinct from Pattern #19 (service-role + DiD shape guard): #19 is body-level auth; #22 is idempotency-state-management.
- Distinct from Pattern #20 (per-element compensating rollback): #20 is multi-write rollback discipline; #22 is single-event-handler dedup with crash-recovery.

---

#### Pattern #23 — Non-SECDEF row-lock validation trigger with intent-acknowledged compensating-cascade bypass

**Anchor**: `validate_refund_amount` (refunds BEFORE INSERT/UPDATE OF amount_minor; non-SECDEF; 2,030 bytes).

**Shape** (Phase 4 §4.5 + Phase 9 §9.3):
```sql
-- Acquire FOR UPDATE row-lock on parent (payment row)
SELECT amount_minor INTO _payment_amount FROM payments WHERE id = NEW.payment_id FOR UPDATE;

-- Validate non-negativity + per-row max
IF _payment_amount IS NULL THEN RAISE 'Payment not found for refund validation';
IF NEW.amount_minor <= 0 THEN RAISE 'Refund amount must be positive';
IF NEW.amount_minor > _payment_amount THEN RAISE 'Refund amount exceeds payment amount';

-- Intent-acknowledged bypass for compensating-cascade rows
IF NEW.refund_from_dispute_id IS NOT NULL THEN
  RETURN NEW;  -- documented carve-out: Stripe has moved money; this row catches up local ledger
END IF;

-- SUM remaining children excluding current row (status filter applies)
SELECT COALESCE(SUM(amount_minor), 0) INTO _existing_refunds
FROM refunds WHERE payment_id = NEW.payment_id
  AND status IN ('pending', 'succeeded')
  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

_total_after := _existing_refunds + NEW.amount_minor;
IF _total_after > _payment_amount THEN RAISE 'Total refunded would exceed payment amount';
RETURN NEW;
```

**Class**: defensive validation trigger running as caller (RLS-permitted finance-team callers via SECDEF body context; service-role bypass) with documented carve-out for legitimate-bypass compensating-cascade rows.

**Relation to existing patterns**:
- **Kinship to Pattern #21** (column-restricted state-machine guard): both are `BEFORE [INSERT/UPDATE] OF col + body state machine` shape. Pattern #21 enforces state transitions (`OLD.status → NEW.status` legality); Pattern #23 enforces value invariants (`SUM(children) ≤ parent.amount` integrity). Cross-reference in catalog: "Pattern #23 is to value-integrity what Pattern #21 is to state-machine-transition."
- Distinct from Pattern #20 (per-element compensating rollback): #20 is body-level reactive rollback; #23 is body-level reactive validation.

---

### 7.2 — HOLDS reinforcements (positive patterns verified in batch 06 via Phase 3 + Phase 4 body re-reads)

| Pattern | Source batch | Batch-06 reinforcement |
|---|---|---|
| #1 — `auth.uid()` non-null + role check at body entry | 02 | `update_payment_plan` body L11-13 + `get_active_disputes_for_org` body + `get_disputes_for_invoice` body + `anonymise_guardian` body (cross-ref check Phase 5 §5.3) |
| #4 — Derive-then-check (org_id from invoice, not from caller) | 02 | `update_payment_plan` body L15-19 lock-then-derive |
| #8 — Cancel-path discipline with active+role-explicit gate | 04 | `update_payment_plan` body L21-28 |
| #9 — Service-role conditional auth bypass | 02 | `recalculate_invoice_paid` body L11-13 `IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(...) THEN RAISE` |
| #19 — Service-role-only + DiD shape guard | 05 | `recalculate_invoice_paid` (Phase 6 §6.1 anchor) |
| #21 — Column-restricted state-machine guard | 05 | `update_payment_plan` body L30-33 state-machine block |

---

## 8. Class-pattern analysis

### 8.1 — Sub-class declarations and refinements (1 new s45)

#### 8.1.1 — PERMISSIVE-intended-as-RESTRICTIVE class header — auth-state-only sub-shape declared

**Pre-s45 state** (F-05-001 class header, post-s44): 4 instances, all `is_org_active(org_id)` shape (invoices anchor + lessons/students closed-batch cross-refs) + 1 inert (payments qual=false).

**s45 declaration**: **NEW sub-shape `auth.uid() IS NULL` variant** anchored by **F-06-003** (payment_disputes "Service role manages disputes"). Sub-shape distinct from is_org_active variant per:
- `is_org_active(org_id)` variant: exploit bounded by subscription state (active/trialing org required).
- **`auth.uid() IS NULL` variant**: unconditional anon-CRUD; no subscription-state dependency.

**Post-s45 class header**: 5 instances bifurcated by sub-shape (3 is_org_active + 1 auth.uid() IS NULL + 1 inert qual=false). CC-19 #13 batch-19 sweep scope updated to enumerate BOTH sub-shapes.

---

### 8.2 — Class accretion summary (batch-06 contribution post-s45)

| Class | Pre-s45 | Batch-06 delta | Post-s45 |
|---|---|---|---|
| Parameter-spoofing (SECDEF anon-RPC-callable + no body auth) | ~43 | +1 (F-06-002) | ~44 |
| PERMISSIVE-intended-as-RESTRICTIVE | 4 (incl. 1 inert) | +1 anchor (F-06-003 NEW sub-shape) | 5 (bifurcated by sub-shape) |
| Silent-failure-modes / missing-UI-for-tracked-state | ≥1 active + closed anchors | +2 (F-06-005 + F-06-007) | ≥3 active |
| TS-bypass-cast (F-02-033) | ≥296 raw | +~39 batch-06 | ≥335 raw |
| useCan unimplementation | ≥198 | +0 (positive observation — all 9 batch-06 hooks role-check-free) | ≥198 |
| Silent-query-error → empty-state masquerade | ≥51 | +4 batch-06 hooks | ≥55 |
| Multi-step-write-rollback | 14 | +3 intent-acknowledged | ~17 |
| Fire-and-forget-by-design | ~5 | +6 intent-acknowledged | ~11 |
| audit_log INSERT integrity gap (CC-19 #3) | 27 tables | +4 batch-06 (1 compensated + 1 uncompensated + 2 self-ledger) | reinforced |
| Generated-types pipeline drift (CC-19 #7) | active class | reinforced via Sub-pattern D 17 instances | reinforced |
| E2E fixture hygiene (CC-19 #8) | active class | +3 test files Supabase auth-js storage mock unhandled rejections at baseline | reinforced |
| Column-level-privacy-bypass (CC-19 #12) | 2 anchors | +0 (consecutive_failure_count + auto_pay_paused_* not FE-surfaced) | 2 |
| Cascade-completeness-asymmetry (F-04-003) | 1 anchor + 1 escalation | observation only | unchanged |
| Information-disclosure (F-02-020) | 19-fn class | reinforced via Pattern #1 at 2 dispute getters | unchanged |
| Sentry edge-fn instrumentation gap (CC-19 #10) | ~5 | +1 (admin-backfill-default-pm bare serve) | ~6 |
| Schema column constraint hygiene (CC-19 #11) | ~3 | +3 batch-06 (payments.amount_minor + payment_notifications.amount_minor + guardian_payment_preferences no checks) | ~6 |
| **NEW Claimed-service-role-gate misnaming (CC-19 #14)** | — | **2 anchors** (F-06-001 RPC + F-06-003 RLS) | **2** |
| **NEW Dead-code SECDEF RPCs + orphan trigger fns (CC-19 #15)** | — | **3 anchors** (F-06-004 + F-06-006 + F-06-008) | **3** |

---

## 9. Cross-batch carry register reinforcements

### Table 9.1 — CC-19 carries (15 active post-s45)

| # | Carry | Source | Batch-06 contribution | Batch-19 sweep scope |
|---|---|---|---|---|
| 1 | Helper-fn EXECUTE-grant hygiene | s40/s41 | Extended via 13 batch-06 SECDEF RPCs (all anon EXECUTE) | enumerate REVOKE candidates |
| 2 | Vestigial-parameter audit | s41 | none | follow-up sweep |
| 3 | audit_log INSERT integrity | s41/s43 | +1 truly uncompensated (payment_notifications); +1 compensated via handler-INSERTs (payment_disputes) | BEFORE INSERT integrity trigger sweep |
| 4 | Auth-schema-crossing SECDEF | s41 | none batch-06 | proconfig schema crossing audit |
| 5 | Single-trigger-incomplete-DiD | s42/s44 | +1 observation (`trg_prevent_org_id_change` BEFORE UPDATE only) | trigger-coverage matrix |
| 6 | Org-context spoofing class systematic sweep + CI lint | s41 | 13 batch-06 SECDEF RPCs audited; F-06-001 + F-06-002 are FAIL instances | CI-lint deliverable |
| 7 | Generated-types pipeline drift CI gate | s41 | Sub-pattern D 17 batch-06 instances (supabase: any signatures dominant) | Database<T> threading lint |
| 8 | E2E fixture hygiene | s41 | +3 test files (FeatureGate + AuditLog + RbacRoutes Supabase auth-js storage mock unhandled rejections) | test storage shim sweep |
| 9 | Multi-step write rollback discipline | s41 | +3 intent-acknowledged batch-06 surfaces | rollback-discipline class fix |
| 10 | Sentry edge-fn instrumentation gap | s42 | +1 (admin-backfill-default-pm) | wrapEdgeFn-presence sweep |
| 11 | Schema column constraint hygiene | s42/s44 | +3 (payments.amount_minor + payment_notifications.amount_minor + guardian_payment_preferences no checks) | column-CHECK completeness sweep |
| 12 | Column-level-privacy-bypass systematic sweep | s43 | +0 batch-06 anchors | RLS-intent-vs-enforcement axis sweep |
| 13 | PERMISSIVE-intended-as-RESTRICTIVE systematic sweep | s44 | +1 NEW anchor F-06-003 (auth-state-only sub-shape) | enumerate both sub-shapes |
| **14 NEW (s45)** | **Claimed-service-role-gate misnaming** | s45 | 2 batch-06 anchors (F-06-001 RPC + F-06-003 RLS) | enumerate RPCs/policies with claimed "service-role-only" via `auth.uid() IS [NOT] NULL` gate; replace with explicit JWT-claim check or REVOKE EXECUTE from anon |
| **15 NEW (s45)** | **Dead-code SECDEF RPCs + orphan trigger fns** | s45 | 3 batch-06 anchors (F-06-004 + F-06-006 + F-06-008) | enumerate SECDEF RPCs not called from src/+functions/+cron+migration; enumerate orphan trigger fns; REVOKE + DROP |

### Table 9.2 — Cross-batch finding reinforcements

| Closed-batch finding | Batch-06 reinforcement | Severity at batch 06 |
|---|---|---|
| F-02-005 `record_stripe_payment` CRITICAL anchor batch 02 | Caller hygiene confirmed clean at stripe-webhook L492 + L901 (`_org_id` derived from authenticated-state via stripe_checkout_sessions or PI metadata) | cross-ref only |
| F-02-020 helper-fn information-disclosure HIGH batch 02 | `get_active_disputes_for_org` + `get_disputes_for_invoice` Pattern #1 gated; `get_guardian_ids_for_user` enables F-06-002 enumerability chain | cross-ref only |
| F-04-003 cascade-completeness-asymmetry HIGH anchor batch 04 | Mixed payment_id FK ON DELETE behaviour (CASCADE + NO ACTION) class observation | cross-ref only |
| F-05-001 PERMISSIVE-intended-as-RESTRICTIVE CRITICAL anchor batch 05 | F-06-003 NEW anchor for auth-state-only sub-shape | NEW anchor at batch 06 (independent finding) |
| F-05-002 dedup-class CRITICAL anchor batch 05 | payments-provider-reference + refunds-stripe-refund-id confirmed UNIQUE-INDEX-protected (s45 drift #6 correction) | cross-ref only |
| F-05-005 silent-swallow HIGH anchor batch 05 | F-06-007 same class anchor; strictly-less-mitigated (no banner equivalent) | NEW anchor at batch 06 (independent finding) |

### Table 9.3 — Positive pattern catalog (23 total post-s45)

| # | Pattern name | Anchor | Source batch |
|---|---|---|---|
| 1 | `auth.uid()` self-check at body entry | various | 01/02 |
| 2 | Per-row trigger discipline | various | 01 |
| 3 | RLS-dependent mutation policy | various | 02 |
| 4 | Derive-then-check (org_id from canonical) | various | 02 |
| 5 | Dual-nature SECDEF | various | 02 |
| 6 | Service-role-via-inverse-condition | various | 02 |
| 7 | Anti-recursion SECDEF | various | 02 |
| 8 | Bulk-path cancel discipline | bulk_update_lessons | 04 |
| 9 | Service-role conditional auth bypass | recalculate_invoice_paid | 02 |
| 10 | Dual-mode auth | various | 02 |
| 11 | Per-element org-check in bulk | various | 02 |
| 12 | (reserved) | — | — |
| 13 | Conjunctive service-role-OR-admin | various | 02 |
| 14 | Trigger-level guard with column-restricted UPDATE OF + WHEN | trg_cleanup_attendance_on_cancel | 03 |
| 15 | Defensive-layering anon-block USING=false | various | 03 |
| 16 | Pure-delegating SECDEF wrapper | bulk_cancel_lessons | 04 |
| 17 | DB-layer MAX_BULK matching FE-layer cap | bulk_update_lessons | 04 |
| 18 | Per-row trigger on bulk-path UPDATE preserves audit + cascade | audit_lessons | 04 |
| 19 | Service-role-only + DiD shape guard | send-invoice-email-internal | 05 |
| 20 | Per-element compensating rollback | create-billing-run | 05 |
| 21 | Column-restricted state-machine guard | enforce_invoice_status_transition | 05 |
| **22 NEW (s45)** | **Two-state-managed webhook dedup with stale-recovery** | **stripe-webhook:121-233** | **06** |
| **23 NEW (s45)** | **Non-SECDEF row-lock validation trigger with intent-acknowledged compensating-cascade bypass** | **validate_refund_amount** | **06** |

---

## 10. PI closure table (17 historical)

| PI | s38 framing | Target batch (current) | Severity pre → final | Status | Closure citation |
|---|---|---|---|---|---|
| PI-01 | Payroll mixes major+minor units | 10-reports-analytics-payroll | Critical (unchanged pending audit) | **ACTIVE** | — |
| PI-02 | invoice_status enum 'outstanding' not handled | 05-billing-invoicing | Critical → HIGH (event #5) | RESOLVED s44 | F-05-003 |
| PI-03 | 72 invoices stale paid_minor | 05 + 19 | Critical → HIGH (event #6) | RESOLVED s44 | F-05-004 |
| PI-04 | recalculate_invoice_paid draft→paid silent fail | 05 | Critical → HIGH (event #7) | RESOLVED s44 | F-05-005 |
| **PI-05** | **overpayment_minor populated but zero UI surfaces** | **06 + 11** | **Critical → HIGH (event #8)** | **RESOLVED s45** | **F-06-005**; populator `recalculate_invoice_paid` L34 + 0 UI renders in src/ (only types.ts + useInvoiceRecalcFailure.ts:75 type alias); helpArticles.ts:1349-1354 workflow claims with no discovery surface |
| PI-06 | invoice-overdue-check silently swallows | 05 (migrated 06 → 05) | HIGH unchanged | RESOLVED s44 | F-05-006 |
| **PI-07** | **payment_intent.payment_failed webhook only logs** | **06** | **HIGH unchanged (no event)** | **RESOLVED s45** | **F-06-007**; stripe-webhook:299-303 console.error + break only; zero payment_notifications/audit_log/email/operator-surface |
| PI-08 | record_stripe_payment no caller-context validation | 02 (migrated 06 → 02) | HIGH → CRITICAL (event #1) | RESOLVED s41 | F-02-005 |
| PI-09 | 7+ migrations reference pre-s36 rate_amount | 19 | HIGH (unchanged pending audit) | **ACTIVE** | — |
| PI-10 | Settings → Accounting tab queries via anon | 18 + 15 | HIGH (unchanged pending audit) | **ACTIVE** | — |
| PI-11 | check_lesson_conflicts 2-of-7 checks | 03 | Critical → HIGH (event #2) | RESOLVED s42 | F-03-004 |
| PI-12 | LoopAssist executeRescheduleLessons bypasses checks | 17 | Critical (unchanged pending audit) | **ACTIVE** | — |
| PI-13 | process-term-adjustment setUTCHours wrong offset | 09 + 19 | Critical (unchanged pending audit) | **ACTIVE** | — |
| PI-14 | Cancel-this-and-future fire-and-forget | 03 | HIGH unchanged | RESOLVED s42 | F-03-005 |
| PI-15 | No automatic credit-note generation | 03 + 05 + 09 | HIGH unchanged | **PARTIALLY-RESOLVED** | batch-09 canonical creation surface owned |
| PI-16 | bulk_complete_lessons marks regardless of attendance | 17 | HIGH (unchanged pending audit) | **ACTIVE** | — |
| PI-17 | credit-expiry cron UTC date off ±12h | 08 + 19 | MEDIUM (unchanged pending audit) | **ACTIVE** | — |

**Arithmetic verification:** 9 RESOLVED + 1 PARTIALLY-RESOLVED + 7 ACTIVE = **17 ✓**.

**PI cohort severity post-s45** (active + partial): **3C / 4H / 1M / 0L = 8**. Was 4C/5H/1M/0L = 10 post-s44; net delta −1C/−1H from 2 s45 closures (PI-05 + PI-07).

---

## 11. Severity-adjustment events table (9 cumulative through s45)

| # | Event | Direction | Reasoning citation | Session |
|---|---|---|---|---|
| 1 | PI-08 → F-02-005 | HIGH ↑ CRITICAL | Phase 7C body re-audit; no `auth.uid()` in record_stripe_payment; financial-falsification class anchor | s41 |
| 2 | PI-11 → F-03-004 | Critical ↓ HIGH | Phase 6; operational-correctness CAPS-at-HIGH; check_lesson_conflicts 2-of-7 enumerated | s42 |
| 3 | F-04-002 lesson_notes.teacher_private_notes | HIGH unchanged (regression-class support) | Phase 9; regression evidence via migration 20260315100100; CRITICAL anchor requires customer-facing marketing (absent) | s43 |
| 4 | F-04-004 lessons.notes_private | HIGH unchanged (intent-ambiguity) | Phase 9; intent-ambiguity across 3 citations; closed-batch immutability holds | s43 |
| 5 | PI-02 → F-05-003 | Critical ↓ HIGH | Phase 6; "missing UI for tracked DB state"; operational-correctness CAPS | s44 |
| 6 | PI-03 → F-05-004 | Critical ↓ HIGH | Phase 6; "silent failure modes"; cached-value drift recoverable | s44 |
| 7 | PI-04 → F-05-005 | Critical ↓ HIGH | Phase 6; "silent failure modes"; banner-surface partial mitigation | s44 |
| **8** | **PI-05 → F-06-005** | **Critical ↓ HIGH** | **Phase 6; "missing UI for tracked DB state" + operational-correctness CAPS (s42 PI-11 + s44 PI-02/03/04 precedent); marketed-feature-broken anchor evaluated + rejected per discoverability-vs-actionability distinction** | **s45** |
| **9** | **F-06-001 mid-session upward adjustment** | **(Phase 3 MEDIUM/HIGH bracket) ↑ CRITICAL (Phase 5)** | **Phase 5; bracketed Phase-3 pre-class (operational-correctness defence-in-depth weakness when isolated) escalated to CRITICAL after F-06-003 composition discovery in Phase 5 — operational-correctness HIGH → financial-falsification CRITICAL bracket shift via composition chain. Class anchor: PERMISSIVE-intended-as-RESTRICTIVE + CC-19 #14 NEW gate-misnaming.** | **s45** |

**Cumulative severity-adjustment events through s45: 9**.

**Methodology statement**: pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments. Mid-session adjustments are events when the severity class bracket shifts; pre-class refinements within a bracket are NOT events. F-06-002 pre-class refinement (Phase 5 "HIGH or CRITICAL" → Phase 6 HIGH-confirmed via Stripe-side validation analysis) is NOT an event — Phase 6 evidence resolved a bracket-internal question without bracket-class shift. F-06-001 IS an event — Phase 5 evidence shifted from operational-correctness HIGH bracket to financial-falsification CRITICAL bracket via composition.

---

## 12. Audit-method appendix

### 12.1 — s45-originated drifts (7 events: drifts #1-#7)

All s45 drifts are reviewing-Claude origin; CC handled gracefully via Phase 1-9 scope-reconciliation walk. Catalogued for future-session methodology refinement.

- **Drift #1**: pre-investigation RPC regex too narrow — missed `backfill_guardian_default_pm_set` from §6.5 enumeration. Mitigation: future pre-investigation cross-checks CENSUS §4.x rows directly against `pg_proc` inventory before assembling §6.5. Resolved Phase 0 via reviewing-Claude §6.13 amendment.
- **Drift #2**: launching §4 over-attributed `stripe-auto-pay-installment` to batch-06 HEAD-pin-sensitive paths. CENSUS §3.6:299 owns batch-07. Mitigation: launching prompt §4 must cross-check CENSUS owning-batch before listing HEAD-pin-sensitive paths. Resolved Phase 1 via filesystem walk + CENSUS reconciliation.
- **Drift #3**: launching §2 step 5 literal-string tally check failed (`103 / 14 critical / 31 high / 23 medium / 35 low`). STATUS.md formats severity-then-total, not total-then-severity. Mitigation: tally checks specify "verify presence of all five values; format may vary". Resolved Phase 0.
- **Drift #4**: launching §7 hallucinated Stripe Connect onboarding fn names (`account-onboarding`, `account-link`, `account-status`, `connected-account-*` family) — none exist in filesystem (only `account-delete` which is batch-01 auth). Stripe Connect onboarding is implemented via `stripe-connect-onboard` + `stripe-connect-status`. Plus launching §4 + §6.11 over-attributed `cleanup-webhook-retention` to batch-06 (CENSUS §3.22:454 owns batch-19). Mitigation: pre-investigation §6 enumeration of edge fns must verify via filesystem grep, not generic Stripe-API pattern inference. Resolved Phase 1 via filesystem walk + CENSUS reconciliation.
- **Drift #5**: launching §6.6 trigger count was 14; DB-verified 15 (`audit_guardian_payment_preferences` missed). Mitigation: DB-verified `pg_trigger` count is canonical. Resolved Phase 1 via OR-able-bit query enumeration.
- **Drift #6**: launching §6.8 dedup framing used `pg_constraint contype IN ('u','p','f')` only; missed partial UNIQUE INDEXes on `payments.provider_reference` + `refunds.stripe_refund_id` + `payment_disputes.stripe_dispute_id`. Live `pg_indexes` confirmed dedup IS enforced at DB level. Mitigation: future UNIQUE-shape claims must query `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` alongside `pg_constraint contype IN ('u','p')`. F-05-002 class consistency check at batch 06: **PASS** — payments-provider-reference + refunds-stripe-refund-id ARE dedup-protected. Resolved Phase 5.
- **Drift #7**: Phase 7 + Phase 8 paste-back cumulative-tally projection propagated incorrect 103 → 111 by failing to account for PI-05 + PI-07 closures as single-count (PIs MOVE from PI cohort TO batch-06 cohort; not added separately). Correct cumulative is 103 → 109 (+6 net: +1C / +2H / 0M / +3L). Mitigation: future cumulative projections must subtract PI closures from PI cohort before adding batch totals, OR project the post-state cohort directly without delta arithmetic. Resolved Phase 9 §9.7 with corrected arithmetic.

### 12.2 — Prior-session lessons applied at s45

Methodology lessons from s42 + s43 + s44 applied during s45 work:

- **s42 lesson — schema-name verification**: applied during Phase 0 (8 in-scope tables match CENSUS §3.6 + §4.3 + §5.6 entry naming via `information_schema.tables ~* '<concept>'` cross-check).
- **s43 lesson #4 — trigger-event OR-able-bit CTE decoding**: applied during Phase 1 §1.4 — 15 batch-06 triggers' event coverage decoded correctly; no event-coverage drift discovered (caught launching §6.6 14-vs-actual-15 undercount as drift #5).
- **s43 lesson #5 — TS-bypass-cast multi-pattern sweep**: applied during Phase 8 §8.4 — Sub-patterns A (3) + B (0) + C (14) + D (~22) batch-06 instance count.
- **s43 lesson #6 — bun→npm auto-detect**: applied at Phase 0 setup; `bun` not installed in CC env; npm fallback taken; typecheck clean.
- **s44 drift #11 — `pg_constraint contype='c'` for column-constraint claims**: applied during Phase 5 §5.4 — full 8-table CHECK constraint sweep + CC-19 #11 reinforcement.

### 12.3 — Cumulative drift count through s45 = 18

- s42: 3 drifts (table-name guesses)
- s43: 3 drifts (trigger-event CASE WHEN / TS-bypass-cast grep undercount / bun→npm substitution)
- s44: 5 drifts (#7-#11 per s44 §12.1)
- **s45: 7 drifts (#1-#7 per §12.1 above)**

**Total cumulative through s45 = 18, all reviewing-Claude origin.** Mitigations baked into reviewing-Claude pre-investigation discipline for s46+.

### 12.4 — Methodology refinement proposed for s46+

- **Cumulative-tally projection methodology** (s45 drift #7 mitigation): future post-state projections must apply the formula `post_total = pre_total + (new_findings) - (PI_resolutions_counted_in_pre_PI_cohort)` OR project the post-state cohort directly. Reviewing-Claude paste-backs should adopt the second approach to avoid double-count arithmetic.
- **UNIQUE-index-shape queries** (s45 drift #6 mitigation): `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` alongside `pg_constraint contype IN ('u','p')` for all dedup-class claims. Locked into pre-investigation discipline.
- **Filesystem-first edge fn enumeration** (s45 drift #4 mitigation): pre-investigation §6 edge fn lists must derive from `ls supabase/functions/` filtered by directory-name pattern, NOT from Stripe-API pattern inference or generic feature-area knowledge.
- **CENSUS owning-batch cross-check** (s45 drift #2 mitigation): launching prompt HEAD-pin-sensitive paths must cite CENSUS row owning-batch verbatim.
- **DB-verified count canonical** (s45 drift #5 mitigation): trigger / RPC / table counts come from live `pg_proc` + `pg_trigger` + `information_schema` queries, not from launching prompt arithmetic.
- **`apply_migration` discipline reminder for s46+**: Phase B work uses `execute_sql` read-only via Supabase MCP. NEVER `apply_migration` during Phase B (PLAN.md §10 item 9). Cumulative compliance through s45: 100% (no migrations applied during any Phase B audit batch).
