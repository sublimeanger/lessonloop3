# Batch 05 — Billing / Invoicing — Findings

> Path Y Phase B systematic audit. Audit-only mode. Banner remains **AUDIT IN PROGRESS — DO NOT FIX YET**. No findings have been fixed in this batch; severity assignments and fix surfaces are recorded for Phase C sprint planning.

---

## 1. Audit basis

- **Session:** s44 (2026-05-12)
- **Phase:** B — Systematic Audit, batch 05 of 21
- **HEAD baseline:** `86dce8a` (pre-Phase-0 discipline commit; reviewing-Claude handover snapshot persisted at `audit/sweep/handovers/reviewing-claude-s43-close.md` + PLAN.md §10 §10.8 mandate amended)
- **Phases executed:** 0 baseline + 1 FE pages walk + 2 FE hooks walk + multi-pattern TS-cast sweep + 3 edge fn audit + 4 cron + trigger fn body audit + 5 RLS policy enumeration + body audit + 6 class-pattern preliminary aggregation + 7 SECDEF RPC body audit + 8 PI re-verification + severity rubric anchoring + 9 this write-up.
- **Surface audited (verified live):**
  - 4 routes (`/invoices`, `/invoices/:id`, `/settings/recurring-billing/runs/:runId`, `/settings/recurring-billing/:templateId` — all `allowedRoles: ['owner', 'admin', 'finance']` per `src/config/routes.ts:141,142,168,169`)
  - 4 pages (`Invoices.tsx` 567L, `InvoiceDetail.tsx` 871L, `RecurringTemplateDetail.tsx` 475L, `RecurringRunDetail.tsx` 452L) = 2,365 lines net
  - 9 edge fns (3,141 lines net): `create-billing-run` 1060L, `generate-invoice-pdf` 307L, `cleanup-invoice-pdf-orphans` 176L, `send-invoice-email` 127L, `send-invoice-email-internal` 162L, `invoice-overdue-check` 153L, `overdue-reminders` 614L, `recurring-billing-scheduler` 265L, `send-recurring-billing-alert` 277L
  - 14 SECDEF RPCs (live body via `pg_get_functiondef` per s42 methodology lesson)
  - 8 triggers + 8 trigger fn bodies (event coverage decoded via OR-able-bit method per s43 methodology lesson #4)
  - 4 cron schedules (live via `cron.job`)
  - 12 hooks (`useInvoices.ts` 569L, `useInvoicePdf.ts` 170L, `useInvoiceRecalcFailure.ts` 92L, `useBillingRuns.ts` 212L, `useRealtimeInvoices.ts` 151L, `useRecurringInvoiceTemplates.ts` 134L, `useRecurringTemplateDetailPage.ts` 223L, `useRecurringTemplateItems.ts` 74L, `useRecurringTemplateRecipients.ts` 134L, `useRecurringTemplateRuns.ts` 231L, `useRunRecurringTemplate.ts` 125L, `useRateCards.ts` 185L) = ~2,300 lines net
  - 10 batch-05-owned tables (27 RLS policies enumerated live via `pg_policies`)
  - 5 cross-batch tables (FK-predicate-satisfaction probes only): `invoice_installments` (07), `payments` / `refunds` / `guardian_payment_preferences` / `payment_disputes` (06)
  - Schema-constraint posture probed live via `pg_constraint contype IN ('c','u','x','p','f')` (s44 methodology drift #11 correction applied)
- **Methodology constraints (cumulative through s44):**
  - Schema-name verification via `information_schema.tables` / `pg_proc` LIKE patterns BEFORE constructing IN-lists (s42 lesson)
  - Trigger-event decoding via OR-able-bit enumeration in CTE — NOT first-match CASE WHEN (s43 lesson #4)
  - TS-bypass-cast prevalence sweep covers sub-patterns A (`(supabase.rpc as any)`), B (`as any[]`), C (misc payload `as any`), D (inline parameter `: any`) — s43 + s44 lesson #5 + s44 Sub-pattern D declaration
  - Multi-export hook files honoured (`useFooBar.ts` may contain >1 export)
  - Column constraints verified live via `pg_constraint contype='c'` not just `information_schema.columns` (s44 lesson #11)
- **Banner state:** AUDIT IN PROGRESS — DO NOT FIX YET (unchanged at session end).
- **Batch surface coverage:** **11 findings / 14 SECDEF RPCs + 27 RLS policies + 8 triggers + 9 edge fns + 4 pages + 12 hooks = ~50% coverage of named surface items raised at least one finding**, weighted by heaviest evidence at the RLS-policy + RPC-body convergence layer (F-05-001) and the cross-batch billing-pipeline chain layer (F-05-002). Comparison to batch 02 (5C/10H/8M/13L = 36 findings; ~24% FAIL rate) and batch 04 (0C/3H/2M/0L = 5 findings) — batch 05 is the financial-falsification class anchor batch.
- **Batch 05 closes 4 PI active entries** (PI-02, PI-03, PI-04 with severity adjustment ↓ CRITICAL→HIGH; PI-06 batch-migrated 06→05 unchanged HIGH) + closes the batch-05 side of PI-15 PARTIALLY-RESOLVED (creation surface owned by batch 09).

---

## 2. Findings index

### Table 2.1 — Batch 05 findings (11)

| ID | Severity | Phase | One-line |
|---|---|---|---|
| F-05-001 | **Critical** | 5+7 | PERMISSIVE-policy anon-cross-tenant INSERT on invoices via `block_expired_trial_invoice_insert` + `is_org_active` + `generate_invoice_number` (3-layer no-auth composition) |
| F-05-002 | **Critical** | 7 | Billing pipeline lesson-id-only dedup propagates duplicate invoice_items from duplicate-slot lessons (F-04-003 consequence escalation; 4 dedup surfaces) |
| F-05-003 | High | 4+7 | `invoice_status` enum 'outstanding' value unmodelled at every layer (enum + trigger + RPC + FE statusCounts); 16 invisible rows |
| F-05-004 | High | pre-inv + 4 | 72 invoices with stale `paid_minor` cached value drift across 2 orgs |
| F-05-005 | High | 4+7 | `recalculate_invoice_paid` draft→paid blocked by trigger; cron callers silently swallow EXCEPTION at `invoice-overdue-check:125` |
| F-05-006 | High | 3+4 | `invoice-overdue-check:102` silent destructure swallow of `enforce_invoice_status_transition` rejection on draft→overdue (plan-enabled invoices); batch-migrated from PI-06 batch 06 framing |
| F-05-007 | High | 7 | `list_invoice_pdf_objects` SECDEF no-auth + anon EXECUTE enables cross-tenant `(org_id, invoice_id)` storage-path enumeration schema-wide |
| F-05-008 | Medium | 3 | `send-recurring-billing-alert/index.ts:48` undeclared `corsHeaders` ReferenceError on JSON-parse-failure error path (F-03-002 companion) |
| F-05-009 | Low | 1+2 | `RecurringRunDetail.tsx` inline `useQuery` definitions + vestigial PII column select |
| F-05-010 | Low | 4 | `check_invoice_item_amounts` trigger does not enforce `amount_minor = quantity * unit_price_minor` DB-level invariant |
| F-05-011 | Low | 4 | 4 batch-05 cron schedules have implicit ordering with no enforcement; race possible at scale |

### Table 2.2 — PI cross-link table (closures + partial)

| PI | F-NN-NNN | Status | Severity pre → final | Severity-adjustment event |
|---|---|---|---|---|
| PI-02 | **F-05-003** | RESOLVED s44 | Critical → HIGH | Event #5 (s44; ↓ per operational-correctness CAPS-at-HIGH) |
| PI-03 | **F-05-004** | RESOLVED s44 | Critical → HIGH | Event #6 (s44; ↓ cached-value drift recoverable, no falsification) |
| PI-04 | **F-05-005** | RESOLVED s44 | Critical → HIGH | Event #7 (s44; ↓ silent-failure-modes class; banner-surface partial mitigation) |
| PI-06 | **F-05-006** | RESOLVED s44 | HIGH unchanged (batch-migrated 06 → 05) | none |
| PI-15 | (rendering-only closed s44) | PARTIALLY-RESOLVED | HIGH unchanged | none — creation surface = batch 09 `process-term-adjustment/index.ts:847` (`is_credit_note: isCreditNote` per `generate_credit_note` body flag); batch-09 owns canonical closure |

---

## 3. Critical findings (2)

### F-05-001 — PERMISSIVE-policy anon-cross-tenant INSERT on invoices via 3-layer no-auth composition

- **Severity:** Critical
- **Area:** RLS policy semantics / SECDEF helper auth posture / cross-tenant write
- **Phase surfaced:** 5 (PERMISSIVE OR semantics + `is_org_active` body audit) + 7 (`generate_invoice_number` body audit Case A confirmation)
- **Class anchor (NEW class header):** **PERMISSIVE-intended-as-RESTRICTIVE** (CC-19 #13 — see §8.3 + §9.1)
- **Evidence:**
  - **Layer 1: `invoices.block_expired_trial_invoice_insert` PERMISSIVE policy.** Live via `pg_policies`:
    ```
    schemaname=public  tablename=invoices  policyname=block_expired_trial_invoice_insert
    permissive=PERMISSIVE  roles={public}  cmd=INSERT
    using_expr=null  with_check=is_org_active(org_id)
    ```
    In PostgreSQL RLS, multiple PERMISSIVE policies are OR'd — at least one must pass for the row to be allowed. The two INSERT policies on `invoices` are:
    1. "Finance team can create invoices" WITH CHECK `is_org_finance_team(auth.uid(), org_id)` — fails for anon/non-finance.
    2. "block_expired_trial_invoice_insert" WITH CHECK `is_org_active(org_id)` — passes for any caller (incl. anon) whenever the org's subscription is `active` or `trialing`.
    OR semantics → INSERT allowed whenever ANY one passes. The "block" name suggests RESTRICTIVE intent; the declaration is PERMISSIVE → policy ADDS to the OR-set rather than constraining it.
  - **Layer 2: `is_org_active(_org_id uuid)` SECDEF helper.** Live body via `pg_get_functiondef`:
    ```sql
    CREATE OR REPLACE FUNCTION public.is_org_active(_org_id uuid)
     RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $function$
      SELECT CASE
        WHEN subscription_status = 'active' THEN true
        WHEN subscription_status = 'trialing' AND trial_ends_at > NOW() THEN true
        ELSE false
      END
      FROM organisations WHERE id = _org_id;
    $function$
    ```
    **Takes no `_user_id` parameter; no `auth.uid()` reference; returns subscription state regardless of caller.** EXECUTE granted to PUBLIC, anon, authenticated, postgres, service_role (verified via `information_schema.routine_privileges`). Any caller, including anonymous, can invoke and receive a boolean answer.
  - **Layer 3: `generate_invoice_number(_org_id uuid)` SECDEF helper.** Live body:
    ```sql
    CREATE OR REPLACE FUNCTION public.generate_invoice_number(_org_id uuid)
     RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _year text; _current_number integer; _prefix text; _digits integer;
    BEGIN
      _year := to_char(CURRENT_DATE, 'YYYY');
      SELECT COALESCE(invoice_number_prefix, 'LL'), COALESCE(invoice_number_digits, 5)
        INTO _prefix, _digits FROM organisations WHERE id = _org_id;
      IF _digits < 3 THEN _digits := 3; END IF;
      IF _digits > 8 THEN _digits := 8; END IF;
      INSERT INTO invoice_number_sequences (org_id, current_year, current_number)
        VALUES (_org_id, _year, 0) ON CONFLICT (org_id) DO NOTHING;
      UPDATE invoice_number_sequences
        SET current_number = CASE
          WHEN current_year = _year THEN current_number + 1 ELSE 1 END,
            current_year = _year
        WHERE org_id = _org_id
      RETURNING current_number INTO _current_number;
      RETURN _prefix || '-' || _year || '-' || LPAD(_current_number::text, _digits, '0');
    END;
    $function$
    ```
    **No `auth.uid()` reference anywhere in the body.** No `is_org_*` guard. EXECUTE granted to anon. Invoked by `set_invoice_number_trigger` BEFORE INSERT on invoices (SECDEF context); the trigger runs as the function owner regardless of caller, so the INSERT proceeds even when the originating caller is anonymous.
  - **Sweep result (class-pattern):** the same `block_expired_trial_*_insert` shape exists on 3 tables across the schema:
    - `invoices.block_expired_trial_invoice_insert` (batch 05; this anchor)
    - `lessons.block_expired_trial_lesson_insert` (batch 03; closed — F-03-* IDs immutable per PLAN.md §6; cross-reference only)
    - `students.block_expired_trial_student_insert` (batch 02; closed — F-02-* IDs immutable; cross-reference only)
    All three are PERMISSIVE with WITH CHECK `is_org_active(org_id)`. Same exploit shape applies; class anchor at F-05-001 because invoices is batch-05-owned and the financial-falsification dimension surfaces here.
- **Exploit shape:** Anonymous attacker with (a) knowledge of an active or trialing org's `org_id` UUID and (b) a valid `payer_guardian_id` or `payer_student_id` UUID for that org calls:
  ```ts
  supabase.from('invoices').insert({
    org_id: '<active-org-uuid>',
    due_date: '2026-12-31',
    payer_student_id: '<valid-student-uuid>',
    total_minor: 999999999,
  })
  ```
  RLS evaluation:
  - "Finance team can create invoices" WITH CHECK `is_org_finance_team(NULL, org_id)` → false.
  - "block_expired_trial_invoice_insert" WITH CHECK `is_org_active(org_id)` → true (active org).
  - PERMISSIVE OR: at least one passes → INSERT proceeds.
  - `set_invoice_number_trigger` BEFORE INSERT fires; calls `generate_invoice_number(NEW.org_id)` in SECDEF context; assigns a valid sequence number; INSERT commits.
  - Schema constraints satisfied: `invoices_payer_xor` (single payer set), NOT NULL fields covered by defaults or by attacker-supplied values, FK to `organisations` + `students`/`guardians` valid.
  - **Net effect:** victim org's ledger contains an attacker-controlled invoice row with attacker-controlled `total_minor`, payer linkage, due date. The org's accountant sees a forged invoice; the parent linked to that invoice receives no real notification but may show up in subsequent payment chases.
  - Pre-conditions are recoverable: F-02-002 (anonymous `get_students_for_org` cross-tenant child-PII exfiltration; batch 02 CRITICAL anchor; immutable) leaks student UUIDs alongside org_ids. Composition with F-05-001 closes the exploit chain at full anon path.
  - **Combined-class chain composition:** F-05-001 (forged invoice INSERT) + F-02-005 (`record_stripe_payment` anon-cross-tenant payment falsification; batch 02 CRITICAL; immutable) = full forged invoice-plus-payment ledger entries in any active org, end-to-end via anonymous request.
- **Defence-in-depth analysis:**
  - `enforce_invoice_status_transition` BEFORE UPDATE OF status: fires only on UPDATE; does not gate INSERT. INSERTed invoices land at default status `'draft'` per schema; transitions out of draft would hit the trigger.
  - `set_invoice_number_trigger` BEFORE INSERT: sets invoice_number when caller-supplied is NULL/empty. Doesn't block; just defaults. Single-trigger-incomplete-DiD field-defaulting sub-pattern (CC-19 #5; see §8.4).
  - `invoices_org_id_invoice_number_key` UNIQUE(org_id, invoice_number): backstop against duplicate numbers; doesn't gate cross-tenant.
  - `invoices_payer_xor` CHECK: enforces exactly one payer; doesn't gate.
  - **No RESTRICTIVE policy on invoices**; `payments` has a syntactically-Pattern-#15-shaped "Block anonymous access to payments" PERMISSIVE USING=false ALL policy which is semantically inert and does not constrain (cross-batch carry to batch 06 audit).
  - **Live-exploitable in current production against any active or trialing org with at least one student/guardian whose UUID is recoverable** (recoverable via F-02-002 chain or other cross-tenant enumeration surfaces).
- **Severity reasoning (PLAN.md §4):** Critical anchors verbatim — "security exposure" (anonymous cross-tenant write) + "financial loss" (forged ledger; downstream payment chases of fake invoices) + "a defect that would erode user trust on first encounter" (admin sees invoices for parents they never engaged). Class consistency with F-02-001 / F-02-002 / F-02-003 / F-02-004 / F-02-005 (5 CRITICAL anon-cross-tenant anchors at batch 02; same financial-falsification + cross-tenant-write class shape). s41 PI-08 elevation precedent applies — when caller-context validation is absent, severity anchors to CRITICAL regardless of the original pre-investigation tag.
- **Closed-batch immutability statement:** F-02-002 (anchor for student-UUID leak chain pre-condition) and F-02-005 (anchor for payment-falsification chain composition) remain at batch 02 with their original severities; F-03-XXX and F-02-XXX IDs for the closed-batch instances of the same PERMISSIVE-shape policy are NOT created retroactively. Cross-batch instances at `lessons.block_expired_trial_lesson_insert` (batch 03 closed) and `students.block_expired_trial_student_insert` (batch 02 closed) are documented here as class-anchor cross-references only.
- **Anchor fix surface (Phase C reference):** three-layer remediation required:
  - **Layer 1 (RLS):** convert all 3 `block_expired_trial_*_insert` policies from PERMISSIVE to RESTRICTIVE. Postgres RESTRICTIVE policies AND-combine with PERMISSIVE policies; the "Finance team can create invoices" PERMISSIVE WITH CHECK must continue to pass AND the RESTRICTIVE `is_org_active` WITH CHECK must also pass. Worded RESTRICTIVE policy:
    ```sql
    CREATE POLICY block_expired_trial_invoice_insert ON public.invoices AS RESTRICTIVE
      FOR INSERT WITH CHECK (is_org_active(org_id));
    ```
  - **Layer 2 (`is_org_active`):** harden to require caller-context; rename old fn to internal-helper or add `_user_id` parameter and check membership:
    ```sql
    CREATE OR REPLACE FUNCTION public.is_org_active(_user_id uuid, _org_id uuid) ...
      IF _user_id IS NULL THEN RETURN false; END IF;
      IF NOT is_org_staff(_user_id, _org_id) THEN RETURN false; END IF;
      SELECT CASE WHEN subscription_status = 'active' ...
    ```
    Or REVOKE EXECUTE from anon and authenticated where not needed (Pattern #1 EXECUTE-revocation; see batch 02 §7).
  - **Layer 3 (`generate_invoice_number`):** add Pattern #4 derive-then-check or Pattern #10 dual-mode auth at body level so direct anon invocation raises rather than silently advancing sequences. Trigger-fired path remains intact (SECDEF bypasses RLS; the explicit body-level auth still gates direct calls).
- **Phase C sprint candidate:** **S-15-permissive-restrictive-conversion** (cross-batch; addresses all 3 known instances at invoices + lessons + students) + Phase 19 systematic sweep via CC-19 #13 to enumerate further instances.
- **Decision needed:** No (mechanical RESTRICTIVE conversion).
- **Target sprint:** Phase C **S-15-permissive-restrictive-conversion** cluster with **S-16-helper-auth-hardening** (Layer 2 + 3 fixes).
- **Closure:** (open)

---

### F-05-002 — Billing pipeline lesson-id-only dedup propagates duplicate invoice_items from duplicate-slot lessons (F-04-003 consequence)

- **Severity:** Critical
- **Area:** Billing pipeline dedup discipline / cross-batch chain composition
- **Phase surfaced:** 7 (RPC body audit + edge fn inline-dedup confirmation)
- **Class:** F-04-003 consequence escalation — F-04-003 itself stays HIGH at batch 04 per closed-batch immutability; F-05-002 is the CRITICAL escalation via financial-falsification class anchor
- **Evidence:**
  - **Schema invariant (Phase 4 schema probe, live):** `lessons` table has no UNIQUE constraint on `(recurrence_id, start_at)`. Only `lessons_pkey UNIQUE(id)` + non-unique `idx_lessons_recurrence_id` + non-unique `idx_lessons_org_start`. Confirmed at HEAD `86dce8a`.
  - **Class-shape origin (cross-batch carries):**
    - F-02-013 (`materialise_continuation_lessons`; batch 02 HIGH; immutable): RPC body has no ON CONFLICT, no pre-INSERT EXISTS guard against `(recurrence_id, start_at)`; the `EXCEPTION WHEN unique_violation` arm relies on a UNIQUE constraint that doesn't exist → dead code; duplicate-slot INSERTs permitted.
    - F-04-003 (bulk-cancel cascade-completeness-asymmetry; batch 04 HIGH; immutable): `bulk_update_lessons` cancel-path omits recurrence_rules.end_date cap (cascade step 2); subsequent `materialise_continuation_lessons` invocation generates fresh `status='scheduled'` rows at the same `(recurrence_id, start_at)` as the existing cancelled rows.
  - **Batch-05 dedup surfaces (4 confirmed at Phase 7 body audit + Phase 3 edge fn walk):**
    1. **`generate_invoices_from_template` RPC body** (live `pg_get_functiondef`, 13,333 chars; F-01-036 unpinned search_path class instance — see §9.1 CC-19 #7). Delivered/hybrid lesson loop NOT EXISTS subquery:
       ```sql
       AND NOT EXISTS (
         SELECT 1 FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         WHERE ii.linked_lesson_id = l.id AND i.status <> 'void'
       )
       ```
       Dedup key: `linked_lesson_id = l.id` only. No `recurrence_id` or `start_at` component.
    2. **`retry_failed_recipients` RPC body** (live, 11,881 chars; F-01-036 unpinned search_path). Identical NOT EXISTS subquery shape — copy-shape of the gen_invoices loop. Same dedup-on-lesson-id-only.
    3. **`get_unbilled_lesson_ids` RPC body** (live, 1,104 chars; search_path=public; Pattern #1 PASS auth):
       ```sql
       AND NOT EXISTS (
         SELECT 1 FROM invoice_items ii
         WHERE ii.linked_lesson_id = l.id AND ii.student_id = lp.student_id
       )
       ```
       Dedup key: `linked_lesson_id = l.id AND student_id = lp.student_id`. Per-student dedup but lesson-id-only on the lesson axis.
    4. **`create-billing-run/index.ts:582-584` edge fn inline `billedPairs`:**
       ```ts
       const billedPairs = new Set(
         (billedItems || []).map((i: any) => `${i.linked_lesson_id}-${i.student_id}`)
       );
       // ...
       if (billedPairs.has(billedKey)) return;
       ```
       Dedup key: `(linked_lesson_id, student_id)` Set composition. Same shape; per-student lesson-id-only.
  - **None of the 4 surfaces dedup on `(recurrence_id, start_at)`.** Distinct `lessons.id` values at the same `(recurrence_id, start_at)` (created via F-02-013 path) all pass each surface's dedup check.
- **Exploit chain (operationally realised at bulk-scale; s43 Phase 6 empirical verification):**
  1. Admin bulk-cancels lessons on recurrence R via `useBulkLessonActions.handleBulkCancel` → `bulk_cancel_lessons` → `bulk_update_lessons {status:'cancelled'}`. Per-element atomic UPDATE; `recurrence_rules.end_date` for R is NOT capped (F-04-003 omission).
  2. Next `materialise_continuation_lessons` invocation (cron `recurring-billing-scheduler` at 04:00 UTC or user-triggered re-materialise) iterates the date range without consulting `_rec.end_date`. For each cancelled-slot date, INSERTs a fresh `status='scheduled'` row at the same `(recurrence_id, start_at)`. No UNIQUE constraint → both rows persist (F-02-013 dead-code unique_violation arm).
  3. End state: duplicate-slot rows on R — one cancelled (original), one fresh scheduled. Attendance recorded on the new scheduled row (operator marks attendance normally; both lessons appear in calendar; UI may distinguish but the new row is functionally a lesson).
  4. Billing pipeline fires:
     - `recurring-billing-scheduler/index.ts:78-84` invokes `generate_invoices_from_template` per due template, OR `create-billing-run` edge fn invokes the inline `executeBillingLogic` path.
     - Either pipeline reads lesson rows matching `org_id + date-range + status<>'cancelled' + attendance_records.attendance_status IN delivered_statuses`. The duplicate row passes (it's not the cancelled one); the cancelled row is filtered by `status<>'cancelled'`.
     - Dedup NOT EXISTS check: `ii.linked_lesson_id = l.id`. The duplicate lesson has a distinct `lessons.id` from any previous invoice_item, so passes.
     - Invoice item generated for the duplicate slot.
  5. Operationally: if the same slot also gets a separate invoice item via another path (e.g., subsequent billing run on overlapping dates), the dedup-on-lesson-id-only fails to catch it because each path sees a different `lessons.id`.
- **Concrete realised consequence:** an admin bulk-cancels 50 lessons on a recurrence; cron re-materialises 50 duplicate-slot lessons; attendance is recorded; billing pipeline emits 50 invoice items inflating the invoice by 50× one-slot rate. At Lauren shadow term volume (~250 pupils, ~7-week term), the duplicate-slot population can be operationally large.
- **Defence-in-depth analysis:** Zero defensive layers in the billing pipeline. The 4 dedup surfaces all share the same insufficient dedup shape; no compensating per-`(recurrence_id, start_at)` check downstream. The schema-level UNIQUE constraint that would have caught this at lesson INSERT does not exist. The cascade-asymmetry that produces the duplicate-slot state (F-04-003) was identified at s43 as HIGH because the duplicate-slot rows themselves were operational corruption; F-05-002 is the financial-falsification escalation when those duplicates feed the billing pipeline.
- **Severity reasoning (PLAN.md §4):** Critical anchors verbatim — "financial loss" (invoice totals inflated by duplicate items; affected accounts charged 2× or more) + "marketed feature fundamentally broken" (billing accuracy is a core product promise; invoices not reflecting delivered lessons accurately) + "a defect that would erode user trust on first encounter" (parent receives invoice for double-charged lessons). Class anchor: financial-falsification (PLAN.md §4 anchor PI-01 / record_stripe_payment family). The attendance-gate (operator must record attendance on the duplicate row for it to be billed) reduces but does not eliminate the operational profile — bulk-cancel-then-rematerialise is a common admin workflow during term-disruption events.
- **Cross-batch closed-immutability statement:** F-02-013 (`materialise_continuation_lessons`) remains HIGH at batch 02. F-04-003 (`bulk_update_lessons` cascade asymmetry) remains HIGH at batch 04. F-05-002 is the new CRITICAL anchor in batch 05 capturing the consequence escalation via financial-falsification class anchor; original anchors are cross-references only.
- **Anchor fix surface (Phase C reference):** two-layer fix; both recommended:
  - **Layer 1 (root cause — schema):** add partial UNIQUE index on lessons:
    ```sql
    CREATE UNIQUE INDEX lessons_unique_active_slot
      ON public.lessons (recurrence_id, start_at)
      WHERE status <> 'cancelled' AND recurrence_id IS NOT NULL;
    ```
    Closes the dead-code unique_violation arm in `materialise_continuation_lessons` (F-02-013 anchor fix surface; cross-batch carry).
  - **Layer 2 (defence-in-depth in billing pipeline):** extend the 4 dedup NOT EXISTS / `billedPairs` predicates to compare on `(recurrence_id, start_at)` in addition to (or instead of) `linked_lesson_id`. Example for `generate_invoices_from_template`:
    ```sql
    AND NOT EXISTS (
      SELECT 1 FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      JOIN lessons l2 ON l2.id = ii.linked_lesson_id
      WHERE l2.recurrence_id = l.recurrence_id
        AND l2.start_at = l.start_at
        AND i.status <> 'void'
    )
    ```
    Applied to all 4 surfaces: gen_invoices + retry_failed_recipients + get_unbilled_lesson_ids + create-billing-run inline.
- **Phase C sprint candidate:** **S-14-cancel-cascade-unification** (s43 F-04-003 fix surface) extended with **S-17-billing-dedup-tuple-key** for the 4 batch-05 surfaces.
- **Decision needed:** Yes — choose between (a) schema-only fix (Layer 1; closes root for new lessons but leaves existing duplicate-slot rows un-deduplicated by the billing pipeline); (b) pipeline-only fix (Layer 2; defends in depth but doesn't prevent future duplicate-slot creation); (c) both (preferred; root cause + defence-in-depth).
- **Target sprint:** Phase C — combined **S-14-cancel-cascade-unification + S-17-billing-dedup-tuple-key**.
- **Closure:** (open)

---

## 4. High findings (5)

### F-05-003 — `invoice_status` enum 'outstanding' value unmodelled at every layer (PI-02 closure)

- **Severity:** High (severity-adjustment event #5; was Critical pre-tag → HIGH final per operational-correctness class CAPS-at-HIGH; s42 PI-11 precedent)
- **Area:** Enum / trigger / RPC / FE state-machine completeness
- **Phase surfaced:** 4 (`enforce_invoice_status_transition` body — no 'outstanding' rule) + 7 (`get_invoice_stats` body — 'outstanding' not in any FILTER/CASE) + Phase 1 page walk (`Invoices.tsx` statusCounts omission)
- **Class:** operational-correctness — state-machine completeness gap. PI-02 closure.
- **PI-02 lineage (s38 → s44):**
  - s38 pre-investigation (per STATUS.md §5.1): "invoice_status enum has 'outstanding' value not handled anywhere"; 16 rows currently `status='outstanding'`; tagged Critical.
  - s44 Phase 0 pre-investigation re-verification: 16 rows confirmed live; enum has 6 values (`draft / outstanding / overdue / paid / sent / void`); per-status distribution per launch §6.5 = 116 draft / 16 outstanding / 109 overdue / 158 paid / 14 sent / 4 void = 417 invoices.
  - s44 Phase 4 trigger body audit: `enforce_invoice_status_transition` BEFORE UPDATE OF status body has explicit IFs for OLD.status='void' / 'paid' / 'draft' / 'sent' / 'overdue'. **No rule for OLD.status='outstanding'.** Falls through every IF → any UPDATE out of 'outstanding' silently permitted. INSERT-side has no validator trigger (`set_invoice_number_trigger` is INSERT-side but doesn't validate status).
  - s44 Phase 7 `get_invoice_stats` body audit: aggregation per-status counters cover `draft / sent / overdue / paid / void`. `total_outstanding` aggregation IN-list = `status IN ('sent', 'overdue')`. **'outstanding' is absent from every CASE WHEN and every FILTER (WHERE status = 'X')** in the body.
  - s44 Phase 1 FE walk: `Invoices.tsx:112-122` `statusCounts` useMemo maps `stats.draftCount / sentCount / paidCount / overdueCount / voidCount`. **'outstanding' is missing from the map.** URL `?status=outstanding` is cast via `initialStatus as any` at Invoices.tsx:60 (F-02-033 Sub-pattern C class instance) and would deliver a filter, but no count badge renders.
- **Evidence:**
  - **Enum permits but no INSERT-side validator:** invoice_status enum at the schema level permits 'outstanding'. INSERTs into invoices via direct `.from('invoices').insert({...status: 'outstanding'})` would succeed at the trigger layer (no INSERT-side validation). The 16 rows live in this state likely from pre-trigger migration data or direct DB write.
  - **Trigger fall-through (live body):**
    ```sql
    CREATE OR REPLACE FUNCTION public.enforce_invoice_status_transition() ...
    BEGIN
      IF NEW.status = OLD.status THEN RETURN NEW; END IF;
      IF OLD.status = 'void' THEN RAISE EXCEPTION '...'; END IF;
      IF OLD.status = 'paid' THEN ...; END IF;
      IF NEW.status = 'void' AND COALESCE(NEW.paid_minor, 0) > 0 THEN RAISE; END IF;
      IF OLD.status = 'draft' AND NEW.status NOT IN ('sent', 'void') THEN RAISE; END IF;
      IF OLD.status = 'sent' AND NEW.status NOT IN ('paid', 'overdue', 'void') THEN RAISE; END IF;
      IF OLD.status = 'overdue' AND NEW.status NOT IN ('paid', 'sent', 'void') THEN RAISE; END IF;
      RETURN NEW;
    END;
    ```
    OLD.status='outstanding' has no rule → execution falls through to RETURN NEW → any transition out is silently permitted, BUT entries via UPDATE are blocked because the OLD.status='draft'/'sent'/'overdue' IN-lists all EXCLUDE 'outstanding' from their allowed NEW-set.
  - **RPC body omission (live body):** `get_invoice_stats` returns json with `total_outstanding`, `overdue`, `overdue_count`, `past_due_count`, `draft_count`, `sent_count`, `paid_total`, `paid_count`, `void_count`, `total_count` — none of which surface 'outstanding' as a category. `total_outstanding` is computed from `status IN ('sent', 'overdue')` only.
  - **FE omission:** `Invoices.tsx:112-122`:
    ```ts
    const statusCounts = useMemo(() => {
      if (!stats) return undefined;
      return {
        all: stats.totalCount,
        draft: stats.draftCount,
        sent: stats.sentCount,
        paid: stats.paidCount,
        overdue: stats.overdueCount,
        void: stats.voidCount,
      } as Record<string, number>;
    }, [stats]);
    ```
    No 'outstanding' key.
- **Impact:** 16 rows live in 'outstanding' state across the schema. They:
  - Cannot be re-flipped TO 'outstanding' via UPDATE (all transitions to 'outstanding' are blocked because no IN-list in the trigger permits it).
  - CAN transition OUT of 'outstanding' silently (no rule blocks).
  - Are not counted in `total_outstanding`, `outstanding_count`, or any FE widget.
  - Are functionally invisible to admin dashboard observability.
  - Are still real invoices (will appear in InvoiceDetail navigation if URL is hand-crafted; are returned by useInvoices list query if status filter is set to 'outstanding'; pay flow may or may not work depending on InvoiceDetail's status conditionals).
- **Severity reasoning (PLAN.md §4):** High anchors verbatim — "missing UI surfaces for tracked DB state" (16 rows tracked in DB, no FE statusCounts entry, no RPC counter) + "feature works but in a degraded, surprising, or unsupported way" (an admin filtering by `?status=outstanding` finds rows but no counter; a non-technical admin would not know to look). Class consistency with operational-correctness CAPS-at-HIGH (s42 PI-11 precedent; PI-11 Critical pre-tag → F-03-004 HIGH final via the same rubric clause). Severity adjustment event #5 (see §11): pre-investigation tag Critical was a starting point for prioritisation; full audit anchor is HIGH per rubric class consistency.
- **Anchor fix surface (Phase C reference):** two options; (a) preferred:
  - **(a) DDL: remove 'outstanding' from invoice_status enum.** Migration plan:
    1. Backfill the 16 rows to an appropriate status (likely 'sent' or 'overdue' depending on due_date). Audit-trail the migration via audit_log entries.
    2. Drop 'outstanding' from the enum (or rename to `_legacy_outstanding` to preserve historical audit_log references).
    3. Update FE TS types via `npm run gen:types` (cross-batch reinforcement of CC-19 #7 generated-types pipeline drift).
  - **(b) Code: extend trigger + RPC + FE to model 'outstanding'.** Add explicit transition rules for OLD.status='outstanding' in `enforce_invoice_status_transition`; add `outstanding_count` to `get_invoice_stats` body; add 'outstanding' to FE `statusCounts` map. Requires defining the semantic role of 'outstanding' (currently unclear — is it semantically distinct from 'sent' or 'overdue'?).
- **Decision needed:** Yes — choose (a) or (b). Recommend (a) per "delete unused state" principle.
- **Target sprint:** Phase C **S-18-invoice-status-enum-cleanup** (one-shot DDL + backfill + types regen).
- **Closure:** **RESOLVED — PI-02 → F-05-003 HIGH (severity-adjustment event #5).**

---

### F-05-004 — 72 invoices with stale `paid_minor` cached value drift (PI-03 closure)

- **Severity:** High (severity-adjustment event #6; was Critical pre-tag → HIGH final per cached-value-drift recoverable class; no financial falsification)
- **Area:** Cached aggregate value vs source-of-truth payments + refunds
- **Phase surfaced:** pre-investigation s38 + s44 Phase 0 re-verification
- **Class:** operational-correctness — cached-value drift; recoverable via recalc. PI-03 closure.
- **PI-03 lineage:**
  - s38: "72 invoices have paid_minor ≠ sum(payments) − sum(refunds)". 71 in Lauren shadow studio + 1 in E2E Test Academy. Tagged Critical. Hypothesised cause: seed scripts insert payments without calling `recalculate_invoice_paid`.
  - s44 Phase 0 re-verification (live, corrected per s44 methodology drift #8 which surfaced that `refunds.status` canonical value is 'succeeded' not 'completed' — the original drift-counting query used the wrong constant): 72 invoices confirmed; direction 100% under-marked-paid (stored < computed); 2 distinct orgs (matches 71+1 framing).
  - s44 Phase 4 schema probe: `refunds_status_check` CHECK constraint exists (s44 methodology drift #11 correction: refunds.status IS constrained to ('pending','succeeded','failed')). `refunds.amount_minor > 0` CHECK enforced.
  - s44 Phase 7 caller enumeration (`recalculate_invoice_paid` invocation sites):
    - In-DB callers (via PERFORM inside SECDEF RPCs): `record_stripe_payment` body L424 (batch 02 owned via F-02-005 chain); `record_manual_payment` (batch 06 RPC); `record_installment_payment` (batch 07 RPC); `apply_lost_dispute_cascade` (batch 06).
    - Edge fn direct callers: `invoice-overdue-check/index.ts:125` (cron, service-role); `installment-overdue-check/index.ts:102` (batch 07 cron; cross-batch carry).
    - Edge fn helper-wrapped: `_shared/recalc-with-retry.ts:56` invoked from `stripe-webhook/index.ts:1298, 1378` + `stripe-process-refund/index.ts:263`.
    - Direct FE caller: none (FE invokes via mutation hooks that go through atomic SECDEF RPCs).
- **Evidence:**
  - Recalc invocation pattern requires manual call (not a trigger). Production code paths invoke recalc inline within atomic SECDEF RPCs (e.g., `record_stripe_payment` calls `recalculate_invoice_paid(_invoice_id)` after INSERTing the payment row). When recalc succeeds, paid_minor is updated.
  - **Seed-script INSERT path (per s38 hypothesis):** test fixtures populate `payments` and `refunds` directly via `.from('payments').insert(...)` (anon or service-role) WITHOUT calling recalc. paid_minor stays at the pre-existing cached value (typically 0 for newly-created invoices or stale for amended invoices).
  - 71 Lauren shadow rows + 1 E2E Test Academy row consistent with E2E + shadow-data-generation paths bypassing recalc.
  - Production callers (`record_stripe_payment`, `record_manual_payment`, `record_installment_payment`) all invoke recalc inline — verified via Phase 7 caller enumeration. No production-code path of payment INSERTs bypasses recalc.
- **Impact:**
  - 72 invoices show wrong `paid_minor` on InvoiceDetail / invoice listing / admin reports.
  - Admin sees "amount due" greater than actually owed.
  - Parent could be told they still owe when they've paid; payment-chase emails sent to fully-paid accounts.
  - Org's revenue reporting is off by sum of (computed − stored) deltas.
  - **Underlying data is correct:** payments rows + refunds rows hold ground truth; recalc would reconcile.
- **Recovery surface:** one-shot script invoking `recalculate_invoice_paid` for each affected invoice. Caller context: service-role (Pattern #9 bypass branch handles).
- **Severity reasoning (PLAN.md §4):** High anchors verbatim — "feature works but in a degraded, surprising, or unsupported way" (paid invoices show wrong cached state) + "silent failure modes" (no audit_log entry, no banner, no detection until reconciliation). Class anchor: operational-correctness — recoverable cached-value drift; no falsification (payments + refunds remain truthful). Severity adjustment event #6 (see §11): pre-tag Critical → HIGH per rubric class consistency. Critical anchors require "financial loss" in the sense of unrecoverable or actively-misdirected money; here the money has moved correctly (per payments + refunds rows) and only the cached view is stale.
- **Closed-batch carry note:** the production code paths via batch 02 / batch 06 RPCs are CLEAN per Phase 7 audit — no batch reinforcement needed there. The drift is a seed-script + historical-data artefact; recovery is one-shot.
- **Anchor fix surface (Phase C reference):**
  - **One-shot backfill** (preferred): script iterates all invoices with `id` in the 72-row drift set; invokes `recalculate_invoice_paid(_invoice_id)` per row in service-role context (auth.uid()=NULL bypass per Pattern #9). Logs audit_log entries per row.
  - **Defence-in-depth** (cross-batch carry): consider adding a post-INSERT trigger on `payments` and `refunds` that automatically invokes `recalculate_invoice_paid(NEW.invoice_id)` on every INSERT. Closes the seed-script bypass surface. Cross-batch reinforcement of F-02-010 audit_log integrity class — trigger ensures every payments INSERT writes a paired recalc audit row.
  - **E2E hygiene** (CC-19 #8 reinforcement): update test fixtures to invoke recalc after every payments INSERT.
- **Decision needed:** No (mechanical one-shot backfill).
- **Target sprint:** Phase C **S-19-paid-minor-backfill** + optional **S-20-payments-insert-recalc-trigger** for defence-in-depth.
- **Closure:** **RESOLVED — PI-03 → F-05-004 HIGH (severity-adjustment event #6).**

---

### F-05-005 — `recalculate_invoice_paid` draft→paid blocked by trigger; cron callers silently swallow EXCEPTION (PI-04 closure)

- **Severity:** High (severity-adjustment event #7; was Critical pre-tag → HIGH final per silent-failure-modes class with banner-surface partial mitigation)
- **Area:** SECDEF RPC body / state-machine interaction / cron caller error handling
- **Phase surfaced:** 4 (`enforce_invoice_status_transition` body confirms draft→paid raises) + 7 (`recalculate_invoice_paid` body confirms unconditional UPDATE; caller enumeration map)
- **Class:** operational-correctness — silent-failure with partial-mitigation surface. PI-04 closure.
- **PI-04 lineage:**
  - s38: "`recalculate_invoice_paid` attempts draft→paid; trigger rejects → silent fail". Tagged Critical.
  - s44 Phase 4 trigger body audit: `enforce_invoice_status_transition` OLD.status='draft' IN-list = `('sent', 'void')`. draft→paid raises `EXCEPTION 'Invalid status transition from draft to paid'`.
  - s44 Phase 7 `recalculate_invoice_paid` body audit (Pattern #9 canonical reference):
    ```sql
    IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
      RAISE EXCEPTION 'Not authorised';
    END IF;
    -- compute net_paid
    IF _invoice.status != 'void' THEN
      IF _net_paid >= _invoice.total_minor THEN
        _new_status := 'paid';
      ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN
        ...
      END IF;
    END IF;
    UPDATE invoices SET paid_minor = _net_paid, status = _new_status::invoice_status, ...
      WHERE id = _invoice_id;
    ```
    When `_invoice.status = 'draft'` AND `_net_paid >= _invoice.total_minor`, body unconditionally sets `_new_status:='paid'`; UPDATE then hits the BEFORE UPDATE trigger which raises. The fn body has NO try/catch — the EXCEPTION propagates to the caller.
- **Evidence — PI-04 caller enumeration (Phase 7):**

  | Caller | Path | Failure handling | Class verdict |
  |---|---|---|---|
  | `invoice-overdue-check/index.ts:125` | direct `supabase.rpc('recalculate_invoice_paid', {_invoice_id})`; cron service-role context | catches via `if (recalcErr)` at L128 → `console.error(message)` + `recalcFailed++` counter; NO audit_log write | **SILENT** — PI-04 anchor surface |
  | `installment-overdue-check/index.ts:102` | direct RPC; cron service-role | same shape (cross-batch reference; batch 07 owns full audit) | SILENT (cross-batch carry to batch 07) |
  | `_shared/recalc-with-retry.ts:56` (helper) | wraps RPC with 3-attempt retry + 500ms backoff | on final failure: INSERTs `audit_log` row action='invoice_recalc_failed' at L85-97 + returns `{ok:false, error}` | **AUDITED** — operator banner surfaces |
  | `stripe-webhook/index.ts:1298, 1378` | via `recalcWithRetry({...})` | audited via helper | AUDITED |
  | `stripe-process-refund/index.ts:263` | via `recalcWithRetry({...})` | audited via helper | AUDITED |
  | `admin_recalculate_invoice_paid` RPC body | wraps `recalculate_invoice_paid(_invoice_id)`; FE caller `useInvoiceRecalcFailure.useAdminRecalculateInvoice` catches via `toastError(error, 'Failed to recalculate invoice')` (per Phase 2 walk) | toast surfaces on user retry button click | **SURFACED** (UI toast) |
  | In-DB SECDEF RPCs: `record_stripe_payment` body L424; `record_manual_payment`; `record_installment_payment`; dispute cascade | inline `PERFORM recalculate_invoice_paid(_invoice_id)` | EXCEPTION propagates from RPC to FE; FE hooks have `onError` toasts per Phase 2 | SURFACED |

  **Silent paths = 2 cron edge fns (`invoice-overdue-check` + `installment-overdue-check`).** Audited path = `recalcWithRetry` helper at 3 sites. Surfaced paths = admin retry + in-DB SECDEF callers.
- **Impact:**
  - When a draft invoice has payments equal to or exceeding total_minor (e.g., upfront payment plus a credit applied, or seed-script-INSERTed payments on a draft invoice), `recalculate_invoice_paid` raises.
  - Silent paths swallow the EXCEPTION → recalc didn't update; paid_minor stays stale → contributes to F-05-004 drift class.
  - Audited paths via `recalcWithRetry`: helper writes `invoice_recalc_failed` audit_log entry → `useInvoiceRecalcFailure` query → `RecalcFailureBanner` renders on InvoiceDetail → operator sees banner → can click "Retry" → invokes `admin_recalculate_invoice_paid` → same UPDATE fails the same way (admin variant doesn't bypass the trigger; Phase 7 body confirms `admin_recalculate_invoice_paid` simply wraps `recalculate_invoice_paid` with admin auth + extra audit row).
  - **Net:** silent paths are the actual exploit surface; audited paths are partial visibility but not actual recovery. Admin retry banner is informational only — clicking it doesn't unblock the draft→paid transition.
- **Severity reasoning (PLAN.md §4):** High anchors verbatim — "silent failure modes" (cron-direct paths catch + counter only) + "broken edge cases" (draft invoices with prepayment never transition). Banner-surface partial mitigation reduces the silent-fail blast radius but doesn't recover the transition. Class anchor: operational-correctness CAPS-at-HIGH per s42 PI-11 precedent. Severity adjustment event #7 (see §11): pre-tag Critical → HIGH per class consistency + partial-mitigation evidence.
- **Anchor fix surface (Phase C reference):** three layered options:
  - **(a) Wrap cron callers in `recalcWithRetry`** (smallest change; closes silent paths). Modify `invoice-overdue-check/index.ts:125` and `installment-overdue-check/index.ts:102` to use the helper; gains audit-trail + retry + banner surface for cron-triggered recalcs.
  - **(b) Two-step transition in `recalculate_invoice_paid`** (better; closes root). Body branch for `_invoice.status = 'draft' AND _net_paid >= _invoice.total_minor`: first UPDATE to 'sent' (which is a valid transition), then UPDATE to 'paid'. Trigger sees `sent → paid` (valid). Implementation requires careful ordering since the trigger fires per-row per-UPDATE.
  - **(c) Self-audit in `recalculate_invoice_paid`** (defence-in-depth). Body BEGIN/EXCEPTION wraps the UPDATE; on EXCEPTION, INSERT a self-audit row action='invoice_recalc_failed' before re-RAISEing. Makes the silent path observable even if not recovered.
  - Recommend (b) + (c) combined.
- **Decision needed:** Yes — choose between (a) caller-side fix vs (b) RPC-body fix vs (c) self-audit hardening.
- **Target sprint:** Phase C **S-21-recalc-draft-paid-resolution**.
- **Closure:** **RESOLVED — PI-04 → F-05-005 HIGH (severity-adjustment event #7).**

---

### F-05-006 — `invoice-overdue-check:102` silent destructure swallow of `enforce_invoice_status_transition` rejection on plan-enabled draft invoices (PI-06 closure, batch-migrated 06 → 05)

- **Severity:** High (unchanged from pre-tag; batch-migrated 06 → 05)
- **Area:** Edge fn caller error handling / state-machine interaction
- **Phase surfaced:** 3 (edge fn walk surfaced silent-destructure at L102) + 4 (trigger body confirms draft→overdue blocked)
- **Class:** operational-correctness — silent error swallow. PI-06 closure.
- **PI-06 lineage and batch migration:**
  - s38: "invoice-overdue-check silently swallows trigger-rejection errors on plan-enabled draft invoices". Tagged HIGH, batch 06.
  - s44 Phase 3 edge fn walk: actual surface is `invoice-overdue-check/index.ts:102-107` (batch 05 — fn is batch-05 owned per CENSUS §3.4). s38 batch-06 framing was an artefact of conflating "invoice/overdue" topic with batch 06 payments — actual fn ownership is batch 05.
  - s44 Phase 4 trigger body audit: `enforce_invoice_status_transition` OLD.status='draft' IN-list = `('sent', 'void')` — draft→overdue is NOT permitted; raises EXCEPTION.
  - **Batch migration:** PI-06 owner moves from batch 06 to batch 05. STATUS.md §5 PI register Phase 9 commits the migration narrative analogous to PI-15's batch-09 ownership reassignment (s44).
- **Evidence:**
  - **Trigger rejection:** `enforce_invoice_status_transition` body (Phase 4):
    ```sql
    IF OLD.status = 'draft' AND NEW.status NOT IN ('sent', 'void') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
    ```
    draft→overdue is NOT in ('sent', 'void') → raises.
  - **Silent destructure at the call site** (`invoice-overdue-check/index.ts:102-107`):
    ```ts
    if (!pendingInst || pendingInst.length === 0) {
      const { data: invUpdated } = await supabase
        .from("invoices")
        .update({ status: "overdue" })
        .eq("id", invId)
        .in("status", ["draft", "sent"])
        .select("id");

      if (invUpdated && invUpdated.length > 0) {
        planInvoicesUpdated++;
      }
    }
    ```
    The destructure binds only `data`, NOT `error`. When the trigger rejects the draft→overdue transition for an `invId` whose current status is 'draft':
    - PostgreSQL raises EXCEPTION.
    - Supabase JS client returns `{ data: null, error: {...} }`.
    - The destructure picks up `data: null` and discards `error`.
    - `invUpdated` is null → `invUpdated && invUpdated.length > 0` evaluates false → `planInvoicesUpdated` counter does NOT increment.
    - No log line, no audit_log row, no surface anywhere.
  - The non-plan UPDATE at L47-54 uses `.eq("status", "sent")` (only flips sent→overdue rows); draft rows aren't touched there.
  - Plan-enabled invoices: L106 `.in("status", ["draft", "sent"])` widens the filter to include draft. Draft rows fail the trigger silently per the above shape.
  - **Operational impact:** plan-enabled draft invoices whose installments have all transitioned to overdue or paid (the L101 conditional) never have their parent invoice flipped to 'overdue' status. The parent invoice stays 'draft' indefinitely. From an admin dashboard perspective the invoice doesn't appear in overdue counts even though all its installments are overdue.
- **Severity reasoning (PLAN.md §4):** High anchor verbatim — "silent failure modes". Class anchor: operational-correctness CAPS-at-HIGH. Pre-tag HIGH unchanged; no severity adjustment event.
- **Anchor fix surface (Phase C reference):**
  - **(a) Bind error at L102 and surface:**
    ```ts
    const { data: invUpdated, error: invErr } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .eq("id", invId)
      .in("status", ["draft", "sent"])
      .select("id");
    if (invErr) {
      console.error(`Failed to mark plan invoice ${invId} as overdue:`, invErr.message);
      // Or: insert audit_log row for visibility
    } else if (invUpdated && invUpdated.length > 0) {
      planInvoicesUpdated++;
    }
    ```
  - **(b) Narrow filter to exclude draft:**
    ```ts
    .eq("status", "sent")
    ```
    Drops draft handling entirely; admin would need to manually transition draft plan invoices.
  - **(c) Extend trigger state machine** to permit draft→overdue when all installments are overdue (requires defining the semantic; coupled with F-05-005 + F-05-003 state-machine completeness work).
  - Recommend (a) + (c) combined.
- **Decision needed:** Yes — same family decision as F-05-005 (state-machine completeness vs caller-side error handling).
- **Target sprint:** Phase C **S-22-invoice-overdue-check-error-binding** clustered with **S-21-recalc-draft-paid-resolution** (state-machine cluster).
- **Closure:** **RESOLVED — PI-06 → F-05-006 HIGH (batch-migrated 06 → 05; no severity adjustment).**

---

### F-05-007 — `list_invoice_pdf_objects` SECDEF no-auth + anon EXECUTE enables cross-tenant `(org_id, invoice_id)` storage-path enumeration schema-wide

- **Severity:** High (NEW finding surfaced Phase 7; class consistency with F-02-020 information-disclosure family)
- **Area:** SECDEF RPC body / storage-schema-crossing / information disclosure
- **Phase surfaced:** 7
- **Class:** information-disclosure (cross-tenant enumeration). Parameter-spoofing FAIL.
- **Evidence:**
  - Live body via `pg_get_functiondef` (340 chars):
    ```sql
    CREATE OR REPLACE FUNCTION public.list_invoice_pdf_objects()
     RETURNS TABLE(name text, created_at timestamp with time zone)
     LANGUAGE sql SECURITY DEFINER
     SET search_path TO 'public', 'storage'
    AS $function$
      SELECT name, created_at FROM storage.objects
      WHERE bucket_id = 'invoice-pdfs'
      ORDER BY name ASC LIMIT 20000;
    $function$
    ```
  - **No auth check anywhere in body.** No `auth.uid()`; no `is_org_*` guard. Pure SQL fn — no IF/RAISE available, but no inline WHERE-clause auth predicate either.
  - EXECUTE granted to: anon, authenticated, postgres, service_role (verified via `information_schema.routine_privileges`).
  - search_path includes `storage` schema (legitimate — needs storage.objects access). Storage-schema-crossing pattern.
  - **Path scheme** (per `cleanup-invoice-pdf-orphans/index.ts:11` documentation): `{org_id_uuid}/{invoice_id_uuid}_{rev_int}.pdf`. The fn returns up to 20,000 object names — anon caller receives a list of (org_id, invoice_id) pairs across the entire bucket.
- **Exploit shape:**
  - Anonymous attacker invokes `supabase.rpc('list_invoice_pdf_objects')` and receives up to 20,000 path strings.
  - Each path encodes `{org_id_uuid}/{invoice_id_uuid}_{rev}.pdf` — directly parseable into a `(org_id, invoice_id)` pair.
  - At Lauren shadow term scale (~250 pupils × 7-week term × maybe weekly invoices = ~1,750 invoices per org), the 20,000 cap accommodates ~10 orgs' worth of invoice IDs.
  - **Reconnaissance value:** combined with F-02-002 (anon student-UUID leak), F-02-005 (anon payment falsification), F-05-001 (anon invoice INSERT), this surfaces the complete `(org_id, student_id, guardian_id, invoice_id)` 4-tuple needed for end-to-end forged-ledger exploit composition.
  - **Caveat — PDF content not exposed:** knowing a path does NOT grant access to the PDF content. `storage.objects` RLS policies + signed URLs gate retrieval. The leak is metadata-only enumeration.
  - **Storage RLS not audited here:** that's batch 19 / cross-batch storage-policy sweep territory; this finding scopes to the RPC body + EXECUTE grant gap.
- **Defence-in-depth analysis:**
  - Storage RLS gates PDF content retrieval (presumed; not verified at this layer — batch 19 storage sweep owns).
  - `generate-invoice-pdf` edge fn is service-role-only for fresh PDF rendering; signed URLs (7-day TTL per `generate-invoice-pdf/index.ts:38`) gate cached-PDF retrieval.
  - No protective layer prevents metadata enumeration via this RPC.
- **Severity reasoning (PLAN.md §4):** High anchors verbatim — "feature works but in a degraded, surprising, or unsupported way" (admin tool exposed as anon enumeration surface) + class consistency with F-02-020 information-disclosure family (batch 02 HIGH; 19 helper fns flagged for similar cross-tenant enumeration). Critical anchor NOT triggered: no direct PII (UUIDs, not names); no direct write (read-only enumeration); PDF retrieval remains gated. Class anchor: information-disclosure / parameter-spoofing FAIL.
- **Anchor fix surface (Phase C reference):**
  - Add `_org_id uuid` parameter; add Pattern #1 caller-context guard:
    ```sql
    CREATE OR REPLACE FUNCTION public.list_invoice_pdf_objects(_org_id uuid)
     RETURNS TABLE(name text, created_at timestamp with time zone)
     LANGUAGE plpgsql SECURITY DEFINER
     SET search_path TO 'public', 'storage'
    AS $function$
    BEGIN
      IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
        RAISE EXCEPTION 'Not authorised';
      END IF;
      RETURN QUERY
      SELECT name, created_at FROM storage.objects
      WHERE bucket_id = 'invoice-pdfs'
        AND name LIKE _org_id::text || '/%'
      ORDER BY name ASC;
    END;
    $function$
    ```
  - Update `cleanup-invoice-pdf-orphans/index.ts:67` to call with the appropriate org_id parameter (it iterates schema-wide currently; will need to loop orgs and call per-org).
  - Or REVOKE EXECUTE from anon + authenticated; restrict to service_role only (suitable since cron is the primary caller).
- **Decision needed:** Yes — choose between body-level org-gate (preferred; preserves cron use case via service-role bypass with Pattern #9 conditional auth) vs REVOKE-anon (simpler; restricts to service_role only).
- **Target sprint:** Phase C **S-23-storage-path-enumeration-guard** (class-grouped with F-02-020 information-disclosure family fixes if those land same sprint).
- **Closure:** (open)

---

## 5. Medium findings (1)

### F-05-008 — `send-recurring-billing-alert/index.ts:48` undeclared `corsHeaders` ReferenceError on JSON-parse-failure error path (F-03-002 companion)

- **Severity:** Medium
- **Area:** Edge fn error-path correctness
- **Phase surfaced:** 3 (alongside F-03-002 re-verification)
- **Class:** ReferenceError-on-critical-error-path (F-03-002 same-class same-file companion). Cross-batch reinforcement to F-03-002 (batch 03 HIGH; immutable).
- **Evidence:**
  - At `supabase/functions/send-recurring-billing-alert/index.ts:48`:
    ```ts
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    ```
  - `corsHeaders` is NOT declared or imported anywhere in this file. The file imports only `_shared/sentry.ts`, `_shared/shadow-email.ts`, `_shared/escape-html.ts` — no `_shared/cors.ts` import. The file's OPTIONS handler at L24-26 returns a minimal `new Response(null, {status: 204})` without using CORS headers.
  - When this line executes (caller sends malformed JSON body), JavaScript throws `ReferenceError: corsHeaders is not defined`. The outer try/catch at L268 catches it and returns the generic 500 instead of the intended 400.
- **Class match to F-03-002:** same file (`send-recurring-billing-alert/index.ts`), same shape (undefined-identifier-in-critical-error-path), same swallow pattern (outer try/catch masks the type error and returns generic 500). F-03-002 (batch 03 HIGH; immutable) at L232 references `data.org_id` where `data` is undefined; F-05-008 at L48 references `corsHeaders` where it is undefined. Both fire on rare-but-real code paths. F-03-002's path is the main happy-path Resend-send block (high observed frequency in production logs per s42 evidence); F-05-008's path is the JSON-parse-failure branch (low observed frequency — requires a malformed POST body).
- **Severity reasoning (PLAN.md §4):** Medium anchors verbatim — "cosmetic but visible inconsistency" (500 returned when 400 intended) + "minor UX dead-ends" (admin sees generic "Internal error" instead of "Invalid JSON body"). Severity reduced from F-03-002's HIGH because impact-profile is narrower:
  - F-03-002 fires on the **send-success path** for every partial/failed billing-run alert.
  - F-05-008 fires only when an upstream caller sends malformed JSON — near-impossible code path because the sole production caller (`recurring-billing-scheduler/index.ts:190-212`) constructs the body with explicit `JSON.stringify({...})` of a well-typed object literal.
- **Defence-in-depth:** outer try/catch at L268 catches the ReferenceError and returns 500. Caller sees a generic error response; no crash propagation. Limited blast radius.
- **Anchor fix surface (Phase C reference):** one-line fix; two options:
  - **(a)** Import + use shared corsHeaders:
    ```ts
    import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
    // ... in handler:
    const corsResponse = handleCorsPreflightRequest(req);
    if (corsResponse) return corsResponse;
    const corsHeaders = getCorsHeaders(req);
    ```
    This also fixes the minimal-OPTIONS handler at L24-26 (proper CORS preflight).
  - **(b)** Remove the `corsHeaders` spread from the 400 response since service-role-only auth doesn't need CORS preflight:
    ```ts
    { status: 400, headers: { "Content-Type": "application/json" } }
    ```
  - Recommend (a) — class-grouped fix with F-03-002 in the same sprint.
- **Decision needed:** No (mechanical fix).
- **Target sprint:** Phase C **S-10-recurring-billing-alert-bug-fix** (clustered with F-03-002 one-line `data.org_id` → `org_id` fix; same file; same sprint commit).
- **Closure:** (open)

---

## 6. Low findings (3)

### F-05-009 — `RecurringRunDetail.tsx` inline `useQuery` definitions + vestigial PII column select

- **Severity:** Low
- **Area:** FE code hygiene / column-level-privacy sweep candidate
- **Phase surfaced:** 1 + 2 carry
- **Class:** code-hygiene; CC-19 #12 column-level-privacy-bypass systematic sweep candidate (intent-matched; not a class anchor)
- **Evidence:**
  - `src/pages/RecurringRunDetail.tsx:78-94` defines `useRunInvoices` inline as a `useQuery` hook with:
    ```ts
    .from('invoices')
    .select('id, invoice_number, total_minor, status, currency_code, payer_guardian_id, payer_student_id')
    .eq('generated_from_run_id', runId)
    ```
    `payer_guardian_id` + `payer_student_id` are selected but NOT rendered downstream in the page. Vestigial PII linkage columns; minor information-disclosure hygiene gap.
  - `src/pages/RecurringRunDetail.tsx:96-116` defines `useStudentNamesForErrors` inline:
    ```ts
    .from('students')
    .select('id, first_name, last_name')
    .in('id', unique)
    ```
    Direct cross-batch read on `students` table where a canonical RPC (`get_student_names_by_ids` or similar) would be tidier. RLS-gated; no exploit.
  - Both are inline-defined `useQuery` hooks; would more naturally live in `/hooks/` for reusability.
- **Impact:** none functional; pure hygiene. Vestigial select columns enlarge the over-the-wire payload by ~32 bytes per row; CC-19 #12 sweep candidate when batch 19 enumerates column-level privacy bypass surfaces schema-wide.
- **Severity reasoning (PLAN.md §4):** Low anchors verbatim — "code-hygiene drift" + "minor docstring/API inconsistency". RLS-gated; no exploit; intent-matched.
- **Anchor fix surface (Phase C reference):**
  - Extract `useRunInvoices` and `useStudentNamesForErrors` to `src/hooks/`.
  - Drop `payer_guardian_id, payer_student_id` from the select clause (or use them — pick one).
  - Class-grouped CC-19 #12 sweep at Phase 19 would identify other vestigial-PII-select instances.
- **Decision needed:** No.
- **Target sprint:** Phase C **S-24-fe-hygiene-cleanup** (batch-grouped; low-priority).
- **Closure:** (open)

---

### F-05-010 — `check_invoice_item_amounts` trigger does not enforce `amount_minor = quantity * unit_price_minor` DB-level invariant

- **Severity:** Low
- **Area:** DB-invariant gap
- **Phase surfaced:** 4
- **Class:** schema constraint hygiene (CC-19 #11 reinforcement)
- **Evidence:**
  - Live body of `check_invoice_item_amounts` (Phase 4):
    ```sql
    CREATE OR REPLACE FUNCTION public.check_invoice_item_amounts() RETURNS trigger
     LANGUAGE plpgsql AS $function$
    DECLARE v_is_credit BOOLEAN;
    BEGIN
      SELECT is_credit_note INTO v_is_credit FROM invoices WHERE id = NEW.invoice_id;
      IF NOT COALESCE(v_is_credit, false) THEN
        IF NEW.unit_price_minor < 0 THEN
          RAISE EXCEPTION 'unit_price_minor must be >= 0 for non-credit-note items';
        END IF;
        IF NEW.amount_minor < 0 THEN
          RAISE EXCEPTION 'amount_minor must be >= 0 for non-credit-note items';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $function$
    ```
  - Trigger enforces non-negativity for non-credit-note items only. **Does not enforce** the canonical invariant `amount_minor = quantity * unit_price_minor`.
  - FE/RPC enforces the invariant inline (e.g., `create_invoice_with_items` body computes `amount_minor` as `quantity * unit_price_minor` inside the INSERT). But direct `.from('invoice_items').insert({amount_minor: 99999, quantity: 1, unit_price_minor: 100})` would succeed at the trigger layer despite breaking the invariant.
- **Impact:** none observed in production code paths (`create_invoice_with_items` + `update_invoice_with_items` both compute amount_minor inline). The gap is a defence-in-depth weakness: a future code path or direct FE write that bypasses the RPC could write inconsistent rows.
- **Severity reasoning (PLAN.md §4):** Low — "code-hygiene drift" + "minor docstring/API inconsistency" (DB-invariant gap; FE/RPC-enforced only). Class consistency with CC-19 #11 schema constraint hygiene sweep.
- **Anchor fix surface (Phase C reference):**
  - Add CHECK constraint:
    ```sql
    ALTER TABLE invoice_items ADD CONSTRAINT chk_invoice_items_amount_invariant
      CHECK (amount_minor = quantity * unit_price_minor);
    ```
    Or extend `check_invoice_item_amounts` trigger body:
    ```sql
    IF NEW.amount_minor <> NEW.quantity * NEW.unit_price_minor THEN
      RAISE EXCEPTION 'amount_minor must equal quantity * unit_price_minor';
    END IF;
    ```
  - Verify existing rows pass the constraint before applying (one-shot validation script).
- **Decision needed:** No.
- **Target sprint:** Phase C **S-25-schema-invariant-hardening** (CC-19 #11 cluster; group with payments amount-positive CHECK + lessons time-range NOT VALID re-validation).
- **Closure:** (open)

---

### F-05-011 — 4 batch-05 cron schedules have implicit ordering with no enforcement; race possible at scale

- **Severity:** Low
- **Area:** Cron orchestration / operational scaling
- **Phase surfaced:** 4
- **Class:** code-hygiene + Phase E operational-scaling carry
- **Evidence:**
  - Live via `cron.job`:
    - `invoice-pdf-orphan-sweep-daily` (jobid 103): `45 3 * * *` → `cleanup-invoice-pdf-orphans` (independent)
    - `recurring-billing-scheduler-daily` (jobid 93): `0 4 * * *` → `recurring-billing-scheduler` (creates draft invoices + auto-sends)
    - `invoice-overdue-check` (jobid 95): `30 5 * * *` → `invoice-overdue-check` (flips sent→overdue + recalc)
    - `overdue-reminders-daily` (jobid 92): `0 9 * * *` → `overdue-reminders` (sends reminders for overdue invoices)
  - Logical dependency chain: C93 (creates + auto-sends invoices) → C95 (flips sent→overdue) → C92 (sends reminders). 90-minute slack between C93→C95; 3h30m slack between C95→C92.
  - **No explicit dependency enforcement.** Each cron fires independently per its schedule. If C93's edge fn (recurring-billing-scheduler) is still running at 05:30 UTC due to high volume, C95 fires anyway and misses today's freshly-sent invoices for the sent→overdue flip.
  - Slack windows are generous for typical org volume but assumption holds only under low-volume conditions.
- **Impact at scale:** at Lauren shadow term volume (~250 pupils, multiple recurring templates), recurring-billing-scheduler may run for >90 minutes if templates × recipients × invoice generation is sequential. Race-possible but not race-certain.
- **Severity reasoning (PLAN.md §4):** Low — "code-hygiene drift" + "legacy artefacts". Operational-scaling concern, not a class violation. Phase E (Lauren Shadow Term) load analysis owns confirmation.
- **Anchor fix surface (Phase C reference):**
  - **(a) Chain crons via shared lock**: C95 checks a `cron_job_status` table or advisory lock before proceeding; waits or skips if C93 still holds.
  - **(b) Widen slack windows**: move C95 to 06:30 or 07:00 UTC; move C92 to 10:00 UTC.
  - **(c) Single supervisor edge fn**: collapse the 4 crons into one parent cron that orchestrates all four in sequence with explicit waits.
  - Recommend (a) — minimal disruption + best defence at scale.
- **Decision needed:** No (Phase E owns confirmation of whether the race materialises at Lauren shadow scale).
- **Target sprint:** Phase E load-analysis surface; if confirmed, Phase C **S-26-cron-orchestration-discipline**.
- **Closure:** (open)

---

## 7. Positive patterns + HOLDS reinforcements

### 7.1 — New patterns documented this batch (3)

#### Pattern #19 — Service-role-only + defence-in-depth shape guard

**Reference instance:** `supabase/functions/send-invoice-email-internal/index.ts` (Phase 3 walk).

**Body excerpt (compact):**
```ts
// Layer 1: service-role bearer exact-match
const authHeader = req.headers.get("Authorization");
const expected = `Bearer ${serviceKey}`;
if (!authHeader || authHeader !== expected) {
  return new Response(JSON.stringify({error: "Service-role authentication required"}), {status: 401});
}

// Layer 2: enum-check source
const ALLOWED_SOURCES: SendInvoiceSource[] = ["recurring_scheduler", "recurring_manual_run"];
if (!source || !ALLOWED_SOURCES.includes(source)) {
  return new Response(JSON.stringify({error: `source must be one of: ${ALLOWED_SOURCES.join(", ")}`}), {status: 400});
}

// Layer 3: post-fetch entity-shape guard
const { data: invoiceGuard } = await supabaseService.from("invoices")
  .select("id, generated_from_template_id").eq("id", invoice_id).maybeSingle();
if (!invoiceGuard.generated_from_template_id) {
  return new Response(JSON.stringify({error: "...accepts only invoices generated from recurring templates..."}), {status: 400});
}
```

**Use case:** SECDEF service-role-only edge fns where the operation must only be reachable from a trusted upstream creation path. The three layers compose defence-in-depth: (1) service-role auth gates the channel; (2) source enum gates the caller identity; (3) entity-shape guard gates the operation target.

**Distinguishes from Pattern #13** (conjunctive service-role-OR-admin): #19 is service-role-ONLY with explicit shape guard. Use when admin UI must NEVER reach this endpoint.

**Cross-cutting applicability:** any trusted-callers-only operational edge fn (system-generated audit rows, scheduler-only operations, internal trust boundaries).

#### Pattern #20 — Per-element compensating rollback in multi-step write chain

**Reference instance:** `supabase/functions/create-billing-run/index.ts:870-882` per-payer compensating DELETE + `:363-383` outer-catch batch orphan-cleanup.

**Body excerpt (compact):**
```ts
// Per-payer step inside the loop:
const { data: rpcResult } = await client.rpc("create_invoice_with_items", {...});
const invoiceId = (rpcResult as any).id;

const { error: linkError } = await client.from("invoices")
  .update({ billing_run_id: billingRunId, term_id: termId })
  .eq("id", invoiceId).eq("org_id", orgId);

if (linkError) {
  // Per-element compensating rollback: delete the orphan invoice
  await client.from("invoices").delete().eq("id", invoiceId);
  failedPayers.push({...});
  continue;
}

// Outer catch (handleCreate try/catch):
} catch (innerError: any) {
  // Batch orphan-cleanup on unexpected outer failure
  await client.from("invoices").delete().eq("billing_run_id", billingRun.id).eq("org_id", orgId);
  await client.from("billing_runs").update({ status: "failed" }).eq("id", billingRun.id);
}
```

**Use case:** FE/edge-fn-orchestrated multi-step writes that cannot be atomic transactions (e.g., RPC create + post-create UPDATE where the RPC doesn't accept the post-create fields). Each intermediate step explicitly DELETEs the prior-step row on its own failure; outer catch handles unexpected throws by batch-cleaning all created entities.

**Distinguishes from negative class F-02-006 / F-03-001** (silent multi-step rollback gap; compensating-toast-only): #20 has explicit per-element rollback + structured failure-array surface + outer-catch defence-in-depth.

**Cross-cutting applicability:** any multi-step write chain where atomicity is impossible (RPC limitations, external API + DB writes, etc.) and the intermediate state must be cleaned on failure.

#### Pattern #21 — Column-restricted state-machine guard

**Reference instance:** `enforce_invoice_status_transition` (Phase 4 body verification).

**Body excerpt (compact):**
```sql
CREATE TRIGGER enforce_invoice_status_transition
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_status_transition();

CREATE OR REPLACE FUNCTION public.enforce_invoice_status_transition() ...
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF OLD.status = 'void' THEN RAISE EXCEPTION '...'; END IF;
  IF OLD.status = 'paid' THEN ...; END IF;
  IF OLD.status = 'draft' AND NEW.status NOT IN ('sent', 'void') THEN RAISE; END IF;
  IF OLD.status = 'sent' AND NEW.status NOT IN ('paid', 'overdue', 'void') THEN RAISE; END IF;
  IF OLD.status = 'overdue' AND NEW.status NOT IN ('paid', 'sent', 'void') THEN RAISE; END IF;
  RETURN NEW;
END;
```

**Use case:** state-machine guard on a single enum-typed column. `BEFORE UPDATE OF <col>` clause restricts firing to UPDATEs that touch the column; body has explicit IFs per (OLD, NEW) transition with `RAISE EXCEPTION` on invalid transitions.

**Distinguishes from Pattern #14** (AFTER UPDATE OF X + WHEN clause): #21 is BEFORE without WHEN; column restriction at the trigger event level; transition validation in the body.

**Completeness-precondition caveat:** correctness depends on body's state-machine COMPLETENESS. PI-02 anchor (F-05-003 — see §4) confirms incomplete state machines fail silently when an enum value has no rule (falls through all IFs to `RETURN NEW`). When applying Pattern #21, the body MUST enumerate every (OLD, NEW) transition OR have an explicit catch-all RAISE at the end.

**Cross-cutting applicability:** any enum-typed status column with well-defined transitions (subscription states, lesson states, order states, term-adjustment states).

### 7.2 — HOLDS reinforcements (positive patterns verified in batch 05 via Phase 7 body re-reads)

| Pattern | Class definition | Batch-05 reinforcements |
|---|---|---|
| Pattern #1 — caller-context body validation | `IF NOT is_org_*(auth.uid(), _org_id) THEN RAISE` | 5 instances: `void_invoice`, `admin_recalculate_invoice_paid`, `get_recent_recalc_failures_for_invoice`, `delete_billing_run`, `get_unbilled_lesson_ids` |
| Pattern #4 — derive-then-`is_org_admin` (resolve target's org_id from row SELECT, then check caller) | SELECT row + FOR UPDATE + body-level membership check on derived org_id | 3 instances: `void_invoice`, `admin_recalculate_invoice_paid`, `update_invoice_with_items` |
| Pattern #6 — Service-role-only via inverse condition (`auth.uid() IS NULL`) | RLS PERMISSIVE policy USING/WITH CHECK `auth.uid() IS NULL` (service-role only) | 2 instances: `recurring_template_runs` "Service role manages runs" + `recurring_template_run_errors` "Service role manages errors" RLS policies |
| Pattern #9 — Conditional service-role-aware auth (`IF auth.uid() IS NOT NULL AND NOT is_org_*(...) THEN RAISE`) | service-role bypass for cron + authenticated check for UI callers | 4 instances: `recalculate_invoice_paid`, `generate_invoices_from_template`, `retry_failed_recipients`, `cancel_template_run` |
| Pattern #10 — Dual-mode auth with explicit anon-reject branch | Pattern #9 + explicit `ELSIF current_setting('role') <> 'service_role' THEN RAISE` for anon callers | Canonical anchor body re-read at `create_invoice_with_items`; HOLDS unchanged |
| Pattern #11 — Graceful-fail USE-CASE CONSTRAINED (dashboard/display-only `IF NOT is_org_*(...) THEN RETURN '{}'`) | Pattern explicitly use-case constrained to dashboard/display | Canonical anchor body re-read at `get_invoice_stats`; HOLDS unchanged |

---

## 8. Class-pattern analysis

### 8.1 — Sub-class declarations and refinements (4 new s44)

#### 8.1.1 — TS-bypass Sub-pattern D under F-02-033

- **Parent class:** F-02-033 TS-bypass-cast (batch 02 LOW anchor; immutable).
- **Sub-class definition:** inline function-parameter type annotations using `: any`. E.g., `.map((item: any) => ...)`. Disables type checking at the call-site boundary (distinct from expression-level A/B/C casts which disable at the expression boundary).
- **Grep regex:** `\(\w+: any[,)]|, \w+: any[,)]`. Documented limitations: doesn't match destructured-param-with-annotation (`({...}: any)`); doesn't match default-value-with-annotation (s44 drift #10); over-matches when `(x: any)` appears in JS comments.
- **Codebase total (Phase 2 grep, src/ tree):** ≥92 Sub-pattern D sites; Phase 3 edge fn batch-05 contribution: ≥23 D sites. Batch-05 D total: 6 (src) + 23 (edge fn) = 29.
- **F-02-033 cumulative raw codebase-wide (src/ + batch-05-edge-fn):** ≥296 sites total = 29 A + 11 B + 135 C-raw + 92 D in src/ + 0 A + 0 B + 6 C-raw + 23 D in batch-05 edge fns.
- **Sub-pattern E candidate (deliberately deferred for s45+):** variable-binding type annotation `const x: any` / `let y: any[]`. Different mechanism from D (binding vs parameter); methodology refinement.

#### 8.1.2 — Multi-step rollback intent-acknowledged sub-class under F-02-006 / F-03-001

- **Parent classes:** F-02-006 (multi-step write rollback discipline; batch 02 HIGH; immutable) + F-03-001 (compensating-toast pattern; batch 03; immutable).
- **Sub-class definition:** multi-step write chain where the author has self-acknowledged non-atomicity in code comments. Distinct shape from F-02-006 (silent) and F-03-001 (compensating-toast). Severity CAPS at MEDIUM (bounded + author-acknowledged + small-data-volume).
- **4 batch-05 instances:**
  - `useRecurringTemplateItems.useSaveTemplateItems` — DELETE-all + INSERT-all; comment L40-41 "Acceptable for small per-template item counts".
  - `useRecurringTemplateRecipients.useSaveTemplateRecipients` — UPSERT + UPDATE-pause; non-atomic.
  - `useRateCards.useCreateRateCard` — UPDATE-unset-defaults + INSERT; comment L41 "to reduce race window".
  - `useRateCards.useUpdateRateCard` — UPDATE-unset-defaults + UPDATE; comment L77 same.
- **F-02-006 class total post-s44:** 14 surfaces (was 10 post-s43; +4 intent-acknowledged batch-05 instances).
- **Rationale for sub-classification:** the 4 batch-05 instances do not warrant standalone batch-05 findings because they are (a) per-author intent-explicit, (b) bounded by small per-entity row counts, (c) consistent with existing class anchor at batch 02 / batch 03 — they accrete to F-02-006 / F-03-001 as a documented sub-pattern rather than escalate.

#### 8.1.3 — PERMISSIVE-intended-as-RESTRICTIVE class header (NEW s44)

- **Class definition:** RLS policies whose authoring intent was RESTRICTIVE (AND-combined semantics) but declared as PERMISSIVE (OR-combined), thereby broadening the policy surface rather than constraining it. Indicators:
  - Policy named `block_*` / `restrict_*` / similar.
  - WITH CHECK uses `USING=false` OR pure subscription/auth-state predicate (without per-caller gating).
  - Declared as PERMISSIVE.
- **Severity convention:** anchor follows worst-case instance. Anchor instance = F-05-001 (CRITICAL via cross-tenant write + financial falsification). Same-class cross-batch instances inherit class severity ceiling but closed-batch immutability holds for their batch-attributed severity.
- **Known instances (4):**
  - F-05-001: `invoices.block_expired_trial_invoice_insert` — CRITICAL exploitable (batch 05 anchor)
  - `lessons.block_expired_trial_lesson_insert` (batch 03 closed; F-03-XXX immutable; cross-reference annotation in F-05-001's finding body §3)
  - `students.block_expired_trial_student_insert` (batch 02 closed; F-02-XXX immutable; cross-reference annotation in F-05-001's finding body §3)
  - `payments."Block anonymous access to payments"` PERMISSIVE USING=false ALL (batch 06; semantically inert — other PERMISSIVE policies still enforce; not exploitable but same anti-pattern; cross-batch carry to batch 06 audit)
- **CC-19 #13 sweep scope** (batch 19 owned): enumerate all schema policies where `permissive='PERMISSIVE'` AND (qual ~* 'false|is_org_active|is_org_write_allowed' OR with_check ~* 'false|is_org_active|is_org_write_allowed' OR policyname ~* 'block|restrict|deny'); classify each as RESTRICTIVE-needed or correct-as-PERMISSIVE.

#### 8.1.4 — Single-trigger-incomplete-DiD field-defaulting sub-pattern under CC-19 #5

- **Parent class:** CC-19 #5 single-trigger-incomplete-DiD (refined s42; NOT APPLICABLE to RLS policies per s43; IS APPLICABLE to DB triggers).
- **Sub-pattern definition:** BEFORE INSERT/UPDATE trigger that only fires defaulting logic when the column is NULL/empty; FE/caller-supplied non-empty values bypass the trigger entirely. Relies on a parallel constraint (UNIQUE, CHECK, FK) as DiD layer 2.
- **Batch-05 anchor:** `set_invoice_number_trigger` — fires only when `invoice_number IS NULL OR ''`; bypass surface = authenticated finance staff INSERT with explicit invoice_number; DiD layer 2 = `invoices_org_id_invoice_number_key` UNIQUE(org_id, invoice_number).
- **1 batch-05 instance counted.**

### 8.2 — Class accretion summary (batch-05 contribution)

- **F-04-001** silent-query-error: +~45 batch-05 instances (8 page + 12 hook + ~25 edge fn). Class cumulative ≥51 sites.
- **F-02-033** TS-bypass-cast: +52 batch-05 instances (5A/0B/12C/6D src + 0A/0B/6C/23D edge fn). Codebase raw ≥296.
- **F-02-027** useCan-unimplementation: +9 batch-05 instances. Cumulative ≥198.
- **F-02-006 / F-03-001** multi-step rollback: +4 batch-05 intent-acknowledged sub-class instances (MEDIUM cap). Cumulative 14 surfaces.
- **F-01-017** WITH CHECK gap: +4 batch-05 instances (Phase 5 — billing_runs / invoices / invoice_items / rate_cards UPDATE policies). Cumulative ≥15.
- **F-02-020** information-disclosure: +1 batch-05 instance (F-05-007 list_invoice_pdf_objects). Class +1.
- **F-03-002** ReferenceError-on-error-path: +1 batch-05 instance (F-05-008 corsHeaders). Same file as anchor.
- **CC-19 #5** single-trigger-incomplete-DiD: +1 batch-05 (set_invoice_number_trigger field-defaulting sub-pattern).
- **CC-19 #10** Sentry edge-fn instrumentation gap: +2 batch-05 instances (cleanup-invoice-pdf-orphans + recurring-billing-scheduler).
- **CC-19 #11** schema constraint hygiene: +3 reinforcements (payments amount-positive, lessons time-range NOT VALID, invoice_items multiplication invariant).

---

## 9. Cross-batch carry register reinforcements

### Table 9.1 — CC-19 carries (13 active post-s44)

| # | Class | Batch-05 contribution |
|---|---|---|
| 1 | Helper-fn EXECUTE-grant hygiene | EXTEND: `is_org_active` + `generate_invoice_number` + `list_invoice_pdf_objects` all EXECUTE-granted to anon; three exploit-enabling instances at batch 05 |
| 2 | Vestigial-parameter audit on SECDEF fns | No batch-05 reinforcement (Phase 7 confirms canonical signatures clean) |
| 3 | audit_log INSERT integrity gap | No batch-05 reinforcement (Phase 4: F-02-010 proposed BEFORE INSERT trigger still absent; non-exploitable touchpoints noted at `generate-invoice-pdf` + `useInvoicePdf` direct INSERTs with service-role / user-id) |
| 4 | Auth-schema-crossing SECDEF audit | `cancel_template_run` over-specification observation only (search_path=public,auth is redundant since auth.uid() is fully-qualified); not exploitable |
| 5 | Single-trigger-incomplete-DiD | +1 instance: `set_invoice_number_trigger` (field-defaulting sub-pattern declared §8.1.4) |
| 6 | Org-context spoofing class systematic sweep | 2 batch-05 FAIL instances (`generate_invoice_number` + `list_invoice_pdf_objects` — both no auth + anon-EXECUTE); 11 batch-05 PASS instances (Pattern #1/#4/#9/#10/#11 verified per §7.2) |
| 7 | Generated-types pipeline drift CI gate | Reinforced: ≥296 raw codebase-wide; **Sub-pattern D class declared** (§8.1.1); root cause of F-02-033 sub-pattern A/B/C/D |
| 8 | E2E fixture hygiene | No batch-05 reinforcement; PI-03 closure narrative implicates seed-script paths bypassing recalc (cross-batch test-fixture cleanup carry) |
| 9 | Multi-step write rollback discipline class | +4 batch-05 intent-acknowledged instances; **sub-class declared** (§8.1.2); class cumulative now 14 surfaces (was 10 post-s43) |
| 10 | Sentry edge-fn instrumentation gap | +2 batch-05 instances (cleanup-invoice-pdf-orphans + recurring-billing-scheduler) |
| 11 | Schema column constraint hygiene sweep | +3 reinforcements (payments.amount_minor no positive CHECK; lessons.chk_lesson_time_range NOT VALID; invoice_items.amount_minor=qty*price invariant gap = F-05-010) |
| 12 | Column-level-privacy-bypass systematic sweep | No batch-05 class anchor; 2 RecurringRunDetail sweep candidates (intent-matched; F-05-009 hygiene only) |
| 13 | **NEW: PERMISSIVE-intended-as-RESTRICTIVE systematic sweep** | NEW carry (s44 Phase 5/8 §8.1.3); anchor = F-05-001 (CRITICAL); 3 batch-attributable instances + 1 inert; batch-19 sweep scope locked |

### Table 9.2 — Cross-batch finding reinforcements

| Source finding | Source batch | Batch-05 contribution |
|---|---|---|
| F-01-001 parameter mismatch | 01 | None (Phase 7 verified canonical signatures clean for all 14 batch-05 RPCs) |
| F-01-017 WITH CHECK gap | 01 | +4 batch-05 instances (billing_runs / invoices / invoice_items / rate_cards UPDATE policies — Phase 5); F-05-section-not-allocated reinforcement-only |
| F-02-002 student-UUID leak | 02 | Cross-reference: F-05-001 + F-05-002 exploit chain composition pre-condition; no batch-05 finding allocated |
| F-02-005 record_stripe_payment | 02 | Cross-reference: F-05-001 exploit chain composition; no batch-05 finding allocated |
| F-02-006 multi-step rollback class | 02 | +4 batch-05 intent-acknowledged instances (§8.1.2 sub-class) |
| F-02-010 audit_log integrity | 02 | No new batch-05 reinforcement (proposed BEFORE INSERT trigger still absent) |
| F-02-013 materialise_continuation_lessons | 02 | Cross-reference: F-05-002 chain origin; Phase 4 schema probe reconfirms anchor evidence (no UNIQUE on (recurrence_id, start_at)) |
| F-02-020 information-disclosure | 02 | +1 instance: F-05-007 list_invoice_pdf_objects anon enumeration (§4 finding) |
| F-02-027 useCan-unimplementation | 02 | +9 batch-05 instances (8 page Phase 1 + 1 hook Phase 2) |
| F-02-033 TS-bypass-cast | 02 | +52 batch-05 instances; Sub-pattern D class declared (§8.1.1); codebase raw ≥296 |
| F-03-001 multi-step rollback | 03 | Covered by F-02-006 sub-class above (§8.1.2) |
| F-03-002 corsHeaders/ReferenceError class | 03 | +1 instance: F-05-008 same-file companion (§5 finding) |
| F-04-001 silent-query-error | 04 | +~45 batch-05 instances (8 page Phase 1 + 12 hook Phase 2 + ~25 edge fn Phase 3); class cumulative ≥51 sites |
| F-04-003 cascade-completeness-asymmetry | 04 | F-05-002 = consequence escalation (HIGH → CRITICAL via financial-falsification anchor); F-04-003 itself HIGH unchanged per closed-batch immutability |

### Table 9.3 — Positive pattern catalog (21 total)

| # | Pattern | Source batch (anchor) | Reference instance |
|---|---|---|---|
| 1-13 | Patterns #1-#13 (caller-context, EXECUTE-revocation, derive-then-check, parent-portal three-layer, etc.) | 02 (s41) | per `audit/sweep/findings/02-org-management.md` §7 |
| 14 | Column-restricted trigger guard with WHEN clause | 03 (s42) | `trg_cleanup_attendance_on_cancel` |
| 15 | Defensive-anon-block USING=false (RESTRICTIVE form) | 03 (s42) | `closure_dates` policies |
| 16 | Pure-delegating SECDEF wrapper | 04 (s43) | `bulk_cancel_lessons` 289-char wrapper |
| 17 | DB-layer MAX_BULK matching FE cap | 04 (s43) | `bulk_update_lessons` L26-28 MAX_BULK |
| 18 | Per-row trigger on bulk-path UPDATE preserves audit + cascade | 04 (s43) | `audit_lessons` + `trg_cleanup_attendance_on_cancel` |
| **19** | **Service-role-only + defence-in-depth shape guard** | **05 (s44)** | `send-invoice-email-internal` |
| **20** | **Per-element compensating rollback in multi-step write chain** | **05 (s44)** | `create-billing-run` L870-882 + L363-383 |
| **21** | **Column-restricted state-machine guard (with completeness caveat)** | **05 (s44)** | `enforce_invoice_status_transition` |

---

## 10. PI closure table (17 historical)

| PI | s38 framing | Target batch (current) | Severity pre → final | Status | Closure citation |
|---|---|---|---|---|---|
| PI-01 | Payroll mixes major+minor units (100× error for percentage teachers) | 10-reports-analytics-payroll | Critical (unchanged pending audit) | **ACTIVE** | — |
| PI-02 | invoice_status enum 'outstanding' value not handled anywhere | 05-billing-invoicing | Critical → HIGH (↓ s44 event #5) | **RESOLVED s44** | **F-05-003**; anchor = `enforce_invoice_status_transition` (no rule for 'outstanding') + `get_invoice_stats` body omits 'outstanding' + `Invoices.tsx:112-122` statusCounts FE omission |
| PI-03 | 72 invoices have paid_minor ≠ sum(payments) − sum(refunds) | 05-billing-invoicing + 19-cross-cutting | Critical → HIGH (↓ s44 event #6) | **RESOLVED s44** | **F-05-004**; root = payments INSERTed without `recalculate_invoice_paid`; backfill + post-INSERT-on-payments trigger fix in Phase C |
| PI-04 | `recalculate_invoice_paid` attempts draft→paid; trigger rejects → silent fail | 05-billing-invoicing | Critical → HIGH (↓ s44 event #7) | **RESOLVED s44** | **F-05-005**; anchor = `recalculate_invoice_paid` body sets _new_status:='paid' then UPDATE raises (Phase 7); silent callers = `invoice-overdue-check:125` + `installment-overdue-check:102` (cross-batch); partial mitigation via recalcWithRetry helper |
| PI-05 | overpayment_minor column populated by Stripe path but ZERO UI surfaces | 06-payments-stripe-connect + 11-parent-portal | Critical (unchanged pending audit) | **ACTIVE** | — |
| PI-06 | `invoice-overdue-check` silently swallows trigger-rejection errors on plan-enabled draft invoices | 05-billing-invoicing (migrated from 06) | HIGH unchanged (batch-migrated 06 → 05) | **RESOLVED s44** | **F-05-006**; anchor = `invoice-overdue-check/index.ts:102-107` silent destructure swallow of `enforce_invoice_status_transition` rejection on draft→overdue |
| PI-07 | `payment_intent.payment_failed` webhook only logs, no notification or surface | 06-payments-stripe-connect | HIGH (unchanged pending audit) | **ACTIVE** | — |
| PI-08 | `record_stripe_payment` accepts _org_id but never verifies invoice org | 02-org-management (migrated from 06) | HIGH → CRITICAL (↑ s41 event #1) | **RESOLVED s41** | F-02-005 |
| PI-09 | 7+ migration files reference pre-s36 `rate_amount` column | 19-cross-cutting | HIGH (unchanged pending audit) | **ACTIVE** | — |
| PI-10 | Settings → Accounting tab queries `xero_connections` via anon → 0 rows | 18-settings-tabs + 15-calendar-sync-zoom-xero | HIGH (unchanged pending audit) | **ACTIVE** | — |
| PI-11 | `check_lesson_conflicts` DB trigger enforces only 2 of 7 promised checks | 03-calendar-core | Critical → HIGH (↓ s42 event #2) | **RESOLVED s42** | F-03-004 |
| PI-12 | LoopAssist `executeRescheduleLessons` bypasses ALL 7 conflict checks | 17-loopassist | Critical (unchanged pending audit) | **ACTIVE** | — |
| PI-13 | `process-term-adjustment` parses new_time with setUTCHours → wrong UTC offset | 09-term-continuation + 19-cross-cutting | Critical (unchanged pending audit) | **ACTIVE** | — |
| PI-14 | Cancel-this-and-future cascade is fire-and-forget without transaction | 03-calendar-core | HIGH (unchanged) | **RESOLVED s42** | F-03-005 |
| PI-15 | No automatic credit-note generation for paid-then-cancelled lessons | 03 batch-side closed s42; 05 batch-side closed s44; **09 owns canonical creation surface** | HIGH (unchanged) | **PARTIALLY-RESOLVED** | batch-03 cancel-cascade has no credit-note invocation (s42 Phase 7); batch-05 rendering-only confirmed via Phase 2 (`useInvoices.useCreateInvoice` + `useUpdateInvoice` do NOT set `is_credit_note=true`) + Phase 7 (`create_invoice_with_items` + `update_invoice_with_items` bodies confirm no is_credit_note setter); **batch-09 canonical creation surface**: `process-term-adjustment/index.ts:847` writes `is_credit_note: isCreditNote` per `generate_credit_note` body flag at L779 (cross-reference confirmed s44 Phase 7) |
| PI-16 | `bulk_complete_lessons` marks lessons completed regardless of attendance state | 17-loopassist | HIGH (unchanged pending audit) | **ACTIVE** | — |
| PI-17 | `credit-expiry` cron uses UTC date; non-UTC orgs off by ±12h | 08-attendance-credits-waitlists + 19-cross-cutting | MEDIUM (unchanged pending audit) | **ACTIVE** | — |

**Arithmetic verification:** 3 prior-resolved (PI-08, PI-11, PI-14) + 4 closing-this-batch (PI-02, PI-03, PI-04, PI-06) + 1 PARTIALLY-RESOLVED (PI-15) + 9 active (PI-01, PI-05, PI-07, PI-09, PI-10, PI-12, PI-13, PI-16, PI-17) = **17 ✓**.

**PI cohort severity post-batch-05** (active + partial): **4C / 5H / 1M / 0L = 10**. Was 7C/6H/1M/0L = 14 post-s43; net delta −3C/−1H from 4 closures.

---

## 11. Severity-adjustment events table (7 cumulative through s44)

| # | Event | Direction | Reasoning citation |
|---|---|---|---|
| 1 | PI-08 → F-02-005 | HIGH ↑ CRITICAL | s41 Phase 7C body re-audit; no `auth.uid()` reference anywhere in `record_stripe_payment` body; financial-falsification class anchor PLAN.md §4 "financial loss" / "security exposure" |
| 2 | PI-11 → F-03-004 | Critical ↓ HIGH | s42 Phase 6; operational-correctness class CAPS-at-HIGH; `check_lesson_conflicts` 2-of-7 enumerated; class consistency with F-02-002 CRITICAL safeguarding-anchor vs operational gap |
| 3 | F-04-002 lesson_notes.teacher_private_notes | HIGH unchanged (regression-class evidence support) | s43 Phase 9; regression-class evidence chain via migration 20260315100100; CRITICAL anchor requires customer-facing marketing (absent) |
| 4 | F-04-004 lessons.notes_private | HIGH unchanged (intent-ambiguity) | s43 Phase 9; intent-ambiguity documented across 3 citations; closed-batch immutability holds |
| 5 | PI-02 → F-05-003 | Critical ↓ HIGH | s44 Phase 6; PLAN.md §4 anchor = "missing UI surfaces for tracked DB state"; operational-correctness class CAPS-at-HIGH (s42 PI-11 precedent); 16 invisible 'outstanding' rows |
| 6 | PI-03 → F-05-004 | Critical ↓ HIGH | s44 Phase 6; PLAN.md §4 anchor = "silent failure modes"; cached-value drift recoverable, no falsification (payments + refunds hold ground truth) |
| 7 | PI-04 → F-05-005 | Critical ↓ HIGH | s44 Phase 6; PLAN.md §4 anchor = "silent failure modes"; banner-surface partial mitigation via recalcWithRetry helper + RecalcFailureBanner (Phase 2 walk) |

**Methodology statement:** pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments. Full audit owns canonical severity per PLAN.md §4 + s42 precedent. The audit-method appendix (§12) captures all 7 events with class consistency annotations.

---

## 12. Audit-method appendix

### 12.1 — s44-originated drifts (5 events: drifts #7-#11)

Reviewing-Claude pre-investigation methodology drifts surfaced during s44 work and corrected in-session:

- **Drift #7 (Phase 0 pre-investigation):** column-name guess — pre-investigation query assumed `payments.status` column exists. **It does not.** `payments` has `method`/`provider`/`paid_at` but no `status` field (row existence = receipt). Refunds DOES have `status text`. **Fix:** enumerate `information_schema.columns WHERE table_name=...` before constructing WHERE clauses on suspected status fields.
- **Drift #8 (Phase 0 pre-investigation):** column-value guess — pre-investigation drift counted refunds with `status='completed'` as canonical; RPC `recalculate_invoice_paid` body uses `status='succeeded'`. The pre-investigation drift query against the 72-invoice paid_minor anchor used the wrong constant. **Fix:** pull canonical status values from RPC body filters AND from enum/CHECK definitions before constructing distribution queries.
- **Drift #9 (Phase 2 EXIT methodology note):** Sub-pattern C grep matches JS-comment lines containing `as any`. `useRecurringTemplateRuns.ts:180` has a comment `// TODO: remove \`as any\` once types.ts regenerates...` which was matched as a Sub-pattern C site. **Fix for future grep:** exclude lines beginning with `//` OR use AST-based scan. Batch-05 raw C count corrected from 13 to 12 real after FP exclusion.
- **Drift #10 (Phase 2 EXIT methodology note):** Sub-pattern D regex `\(\w+: any[,)]` doesn't match destructured-param-with-annotation (`({...}: any)`) or default-value-with-annotation (`(x: any = ...)`). These are real D sites but under-counted. **Fix proposed for s45+:** extend regex with destructure-aware variant; track Sub-pattern D2 / D3 separately if methodology-warranted.
- **Drift #11 (Phase 4 schema-constraint probe):** refunds.status "unconstrained text" framing in launch §6.7 + s44 pre-investigation drift #8 was wrong. Live `pg_constraint contype='c'` query confirms `refunds_status_check` CHECK `(status = ANY (ARRAY['pending', 'succeeded', 'failed']))` exists. **Fix:** column-constraint queries on `pg_constraint contype='c'` not just `information_schema.columns`. Methodology lesson absorbed into s45+ pre-investigation discipline.

### 12.2 — Prior-session lessons applied at s44

Methodology lessons from prior sessions that were applied during s44 work:

- **s42 lesson — schema-name verification:** `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ~* '<concept-pattern>'` BEFORE constructing IN-lists. Applied during Phase 0 (verifying 10 batch-05 owned tables match CENSUS §11.A entry naming) and Phase 4 (verifying 8 batch-05 triggers + 14 RPCs against live `pg_proc` and `pg_trigger`).
- **s43 lesson #4 — trigger-event OR-able-bit decoding:** decode `pg_trigger.tgtype` via OR-able-bit CTE (`raw_tgtype & 1 = ROW`, `& 2 = BEFORE`, `& 4 = INSERT`, etc.). NOT first-match CASE WHEN. Applied during Phase 4 — 8 batch-05 triggers' event coverage decoded correctly; no event-coverage drift discovered.
- **s43 lesson #5 — TS-bypass-cast multi-pattern sweep:** prevalence sweep covers sub-patterns A/B/C; extended at s44 Phase 2 with Sub-pattern D declaration (§8.1.1).
- **s43 lesson #6 — bun→npm auto-detect:** setup step 2 includes `if command -v bun >/dev/null; then bun install; else npm install; fi`. Applied at Phase 0; npm path taken (bun not present in CC environment); typecheck clean.

### 12.3 — Cumulative drift count through s44 = 11

- s42: 3 drifts (table-name guesses for `lesson_attendance` / `4-vs-8 RLS table count` / `busy_blocks`)
- s43: 3 drifts (trigger-event CASE WHEN first-match decode / TS-bypass-cast grep undercount / bun→npm substitution)
- s44: 5 drifts (#7-#11 per §12.1)

### 12.4 — Methodology refinement proposed for s45+

- **Column-constraint queries on `pg_constraint contype='c'`** (not just `information_schema.columns`) per drift #11 — locked into reviewing-Claude pre-investigation discipline for batch 06+.
- **Sub-pattern E candidate:** variable-binding type annotation `const x: any` / `let y: any[]`. Different mechanism from Sub-pattern D (binding vs parameter); methodology refinement deferred to batch 06 / 19 if observed prevalence warrants formalisation.
- **JS-comment exclusion for grep-based class sweeps:** Sub-pattern C grep at s45+ should exclude `^\s*//` or `^\s*\*` line patterns. AST-based scan via `ts-morph` or equivalent is the long-term hardening direction.
- **`apply_migration` discipline reminder for s45+:** Phase B work uses `execute_sql` read-only via Supabase MCP. NEVER `apply_migration` during Phase B (PLAN.md §10 item 9). Cumulative compliance through s44: 100% (no migrations applied during any Phase B audit batch).
