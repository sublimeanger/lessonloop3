# Batch 09 — Term Continuation

**Session**: s48
**Date**: 2026-05-14
**HEAD pin**: `<s48 Phase 10 commit SHA>`
**Status**: CLOSED
**Findings allocated**: 10 (1C / 4H / 1M / 4L)

---

## Allocation summary

| ID | Severity | Surface | Class anchor | Rubric anchor | Composition / mitigation notes |
|---|---|---|---|---|---|
| F-09-001 | **CRITICAL** | `public.materialise_continuation_lessons` SECDEF + zero body auth + PUBLIC+anon EXECUTE — cross-tenant lesson + lesson_participant INSERT with attacker-controlled `p_org_id` + `p_rate_minor` + `p_created_by` (200/recurrence per-call cap; unbounded across distinct recurrence_ids) | F-08-001 closed batch-08 CRITICAL anchor (parameter-spoofing standalone class) + F-02-005 closed batch-02 CRITICAL anchor (financial-falsification class) + F-07-003 closed batch-07 CRITICAL anchor (composition-chain class) | PLAN.md §4 CRITICAL: "security exposure" (anon-callable cross-tenant state-mutation RPC) + "financial loss" (lp.rate_minor flows through generate_invoices_from_template:131-149 into create_invoice_with_items as canonical unit_price_minor) | Standalone CRITICAL — no composition needed. Financial-downstream chain DB-traced via `generate_invoices_from_template:131-149` JOIN + `get_unbilled_lesson_ids:18-29` finance-team manual billing surface. Conflict-trigger silent-swallow at body L120-123 = composition modifier reinforcing CRITICAL bracket (defence-in-depth bypass). Zero-UUID actor fallback in audit_log + p_created_by impersonation via lesson.created_by = partial forensic recoverability (magnitude-not-bracket per s47 F-07-003 precedent). Cross-batch reach LEGITIMATE at bulk-process-continuation:262-273 (POSITIVE caller hygiene observation; does NOT amplify standalone CRITICAL via direct anon invocation). |
| F-09-006 | **HIGH** | `supabase/functions/create-continuation-run/index.ts:1029 + :1226` — handleSend + handleSendReminders reference undeclared `supabase` identifier in `transformEmailForShadow(..., { orgId, supabase: supabase })` call site; ES modules strict mode raises ReferenceError on object-literal evaluation; emails NEVER send when RESEND_API_KEY configured | F-03-002 closed batch-03 HIGH (corsHeaders ReferenceError, happy-path impact-profile match) + silent-failure-modes PLAN.md §4 anchor + operational-correctness CAPS-at-HIGH chain (events #2/#5/#6/#7/#8/#10/#11) | PLAN.md §4 HIGH: "feature works in degraded way" (entire term-continuation email feature broken when RESEND key set) + "silent failure modes" (FE displays aggregated failed-count but discards individual error details) | NOT a severity-adjustment event (new finding starting HIGH per impact-profile match to F-03-002). FE hook surfaces "Sent to 0 families, N failed" toast at useTermContinuation.ts:368-372; root-cause investigation requires Sentry/edge-fn logs (semi-blind operator diagnosis = MIDDLE-strength magnitude factor, NOT bracket modifier per F-08-001 zero-UUID-actor precedent). Inner try-catch at create-continuation-run:1058 catches ReferenceError as "supabase is not defined" message, populates `failed[]` array, sets run status='failed' at L1077. |
| F-09-007 | **HIGH** (event #12 ↓) | `supabase/functions/process-term-adjustment/index.ts:735` `setUTCHours(hours, minutes, 0, 0)` ignores `origRecurrence?.timezone` fetched at L622; FE `TermAdjustmentWizard:343-349` plain `<Input type="time">` no TZ-affordance + `PortalContinuation:337` UTC-substring output no TZ-label = end-to-end timezone-naive pipeline | PI-17 class shape (batch-08 batch-19 carry; UTC-based time arithmetic ignoring org timezone) + operational-correctness CAPS-at-HIGH chain (events #2 PI-11, #5 PI-02, #6 PI-03, #7 PI-04, #8 PI-05, #10 F-07-003, #11 F-08-003 kinship) | PLAN.md §4 HIGH: "feature works in degraded way" (non-UTC orgs get lessons scheduled at wrong-by-N-hours where N = UTC offset; UK orgs in BST get +1h drift) | **Severity-adjustment event #12**: pre-tag CRITICAL via PI-13 (Phase 2 tag) ↓ HIGH (Phase 5 class-precedent reassessment). PI-17 class shape match: same UTC-based time arithmetic ignoring org timezone shape. No composition path to financial-falsification CRITICAL (Phase 2 + Phase 3 composition probe confirmed bounded to edge-case day-boundary mis-classification near midnight). Driver type: class-precedent reassessment (kinship to s44 events #5-#7 PI-02/03/04 Critical ↓ HIGH chain). PI-13 CLOSES at this finding. |
| F-09-008 | **HIGH** | `supabase/functions/process-term-adjustment/index.ts:777-940` handleConfirm 10+ sequential DB ops with no transaction wrap (cancel lessons + delete attendance + cap recurrence end_date + insert new recurrence + insert lessons + insert lesson_participants + insert invoice + insert invoice_items + update term_adjustments + insert audit_log); failure of step-3 (recurrence + lessons + participants) or step-4 (invoice + invoice_items) leaves DB partial-commit; operator retry produces DUPLICATE invoices/lessons (no idempotency check on these INSERTs) | Pattern #20 multi-step-write-rollback discipline class (~20 cumulative active surfaces post-s48) + F-04-003 + F-05-002 cascade-completeness-asymmetry class neighbouring + operational-correctness CAPS-at-HIGH chain + PI-15 inherited HIGH severity | PLAN.md §4 HIGH: "feature works in degraded way" (retry-amplification produces duplicates) + "missing UI surfaces for tracked DB state" (partial-commit state invisible to operator) | NOT a severity-adjustment event (HIGH selected from {MEDIUM, HIGH} ambiguous Phase 2 pre-tag = adjudication per §18 methodology). UI binary-state magnitude factor: TermAdjustmentWizard.tsx:482-505 step='complete' shows success counts only; on partial-fail returns to step='preview' with generic "Adjustment failed" toast (no partial-commit affordance). Step 2 (cancel + delete + cap recurrence end_date) IS idempotent on retry; steps 3 + 4 are NOT. PI-15 CLOSES fully-resolved at this finding (canonical creation surface confirmed sole at L847 `is_credit_note: isCreditNote`). |
| F-09-011 | **HIGH** | `public.term_continuation_runs` table has NO `audit_term_continuation_runs` AFTER INSERT/UPDATE/DELETE trigger (only `set_tcr_updated_at` BEFORE UPDATE for `updated_at` maintenance); 4 of 7 state transitions unaudited (`sent` at create-continuation-run:1077; `reminding` at L1254; `partial`/`failed` at L1077; `completed` at bulk-process-continuation:427-433) | CC-19 #3 audit_log INSERT integrity gap class + F-08-005 silent-swallow class neighbouring + operational-correctness CAPS-at-HIGH chain + class-asymmetry with 3 sibling batch-09 tables (terms + term_adjustments + term_continuation_responses all have `audit_*` AFTER triggers) | PLAN.md §4 HIGH: "missing UI surfaces for tracked DB state" (state-machine transitions not in audit_log) + operational-correctness CAPS | NOT a severity-adjustment event (HIGH selected from {MEDIUM, HIGH} ambiguous Phase 4 pre-tag = adjudication per §18 methodology). Partial mitigation: manual `audit_log` INSERTs at create-continuation-run:339-350 (`continuation_run.created`) + L1321-1332 + L1381-1388 (`continuation_run.deadline_processed`) + bulk-process-continuation:437-450 (`continuation_run.processed`) cover 3 of 7 transitions. F-04-005 MEDIUM precedent (lesson_notes missing audit) diverges on mitigation completeness (content-recoverable vs partial-state-recoverable). Remediation-class note: see §11 audit-method appendix. |
| F-09-009 | **MEDIUM** | useCan unimplementation cohort — 13 batch-09 mutation hooks with zero `useCan(...)` calls: useCreateTerm + useUpdateTerm + useDeleteTerm + useCreateContinuationRun + useSendContinuationRun + useSendContinuationReminders + useProcessDeadline + useRespondToContinuation + useBulkProcessContinuation + useDeleteContinuationRun + useUpdateContinuationResponse + useTermAdjustmentPreview + useTermAdjustmentConfirm | CC-19 useCan unimplementation class precedent (cumulative ≥198 post-s47 → ≥211 post-s48); class-consistency with batch-04 useCan instances tagged MEDIUM | PLAN.md §4 MEDIUM: "minor UX dead-ends" (FE-layer permission gate missing; relies on RLS server-side) | RLS load-bearing server-side compensating control (verified Phase 4: term_adjustments + term_continuation_runs INSERT WITH CHECK is_org_admin; UPDATE/DELETE USING is_org_admin; terms ALL is_org_admin; term_continuation_responses ALL is_org_admin). FE-side useCan gate is defence-in-depth, not load-bearing for the security boundary. Cohort presentation (13 instances enumerated in §6 evidence); class-register +13 to CC-19 useCan cumulative. |
| F-09-002 | LOW | `public.recalc_continuation_summary` SECDEF + body-gate correct (`is_org_staff(auth.uid(), _org_id)` at body L5-7) BUT EXECUTE granted to **PUBLIC + anon + authenticated + postgres + service_role** — anon EXECUTE grant negligent (body gate prevents exploit; grant is hygiene-class drift) | CC-19 #1 helper-fn EXECUTE-grant hygiene class | PLAN.md §4 LOW: "code-hygiene drift" + "minor docstring/API inconsistency" | POSITIVE body-gate component surfaces as Pattern #36 promotion candidate (ratified at Phase 8). Class CAPS-at-LOW per CC-19 #1 hygiene class precedent. Remediation path: REVOKE EXECUTE ON FUNCTION recalc_continuation_summary FROM PUBLIC, anon (keep authenticated + service_role). |
| F-09-003 | LOW | **MERGED** (F-09-004 ID released): `public.continuation_run_org_id(_run_id uuid)` 1-line SECDEF body returning org_id given any run_id UUID + `public.user_has_continuation_response_in_run(_user_id uuid, _run_id uuid)` 7-line SECDEF EXISTS-join body with caller-parameterised `_user_id` — both anon-callable; both INCIDENTAL per Phase 2 adjudication (token-write path uses service-role bypass; portal-read path uses authenticated role; anon grants exercised by zero required code paths) | F-02-020 + F-05-007 + F-08-002 information-disclosure cross-tenant enumeration class | PLAN.md §4 LOW: "code-hygiene drift" | Information-disclosure bounded class — 1 UUID return (org_id) or 1 boolean (response-exists) per call; no PII; UUID brute-force infeasible. Phase 2 structural-necessity adjudication confirmed INCIDENTAL: continuation-respond:100 service-role adminClient for token-write; useParentContinuationPending uses authenticated supabase for parent-read. Anon EXECUTE grants are negligent hygiene. Phase C remediation: REVOKE anon EXECUTE on both helpers; zero functional impact. |
| F-09-010 | LOW | `src/components/term-adjustments/TermAdjustmentWizard.tsx:482-505` step='complete' renders binary success-counts only (cancelled_count + created_count + credit_note_invoice_id presence); on partial-fail returns to step='preview' with generic "Adjustment failed" toast; NO UI affordance for partial-commit DB state | Pattern #20 multi-step-write-rollback discipline UI-side sub-class; magnitude factor for F-09-008 | PLAN.md §4 LOW: "code-hygiene drift" + "minor UX dead-ends" | RETAIN-SPLIT from F-09-008 per Phase 5 + Phase 8 adjudication (UI-side gap + edge-fn-side gap have distinct remediation paths; fix-sprint visibility). Class-consistency UI-side observation: F-09-008 edge-fn-side handles the server transaction wrap; F-09-010 UI-side handles operator-visible partial-failure surfacing. |
| F-09-012 | LOW | `pg_constraint` query at HEAD confirms zero CHECK constraints on 4 financial-amount columns: `term_adjustments.lesson_rate_minor` (should `> 0`), `term_adjustments.original_lessons_remaining` (should `>= 0`), `term_adjustments.new_lessons_count` (should `>= 0` when not null), `term_continuation_responses.next_term_fee_minor` (should `>= 0` when not null) | CC-19 #11 financial-amount CHECK constraint cohort precedent (7 entries pre-s48: 5 negative batches 06+07 + 2 positive batches 05+08) | PLAN.md §4 LOW: "code-hygiene drift" | Class CAPS-at-LOW per CC-19 #11 cohort precedent. Defence-in-depth code-hygiene class; no exploitable impact when app code paths enforce invariants. CC-19 #11 cohort post-s48: 11 entries (9 negative + 2 positive). |

**Severity composition**: 1C + 4H + 1M + 4L = 10 findings ✓

---

## §1 Surface inventory (CENSUS rows 86 + 99 + 165 + 353-356 + 583-586 + 1099-1101 anchored)

**4 Edge functions** (CENSUS §4.4 lines 353-356):
- `bulk-process-continuation` (472L; auth-required; bearer + getUser + role-IN(owner/admin) + rate-limit + run-belongs-to-org; cross-batch reach at :394 invokes `cleanup_withdrawal_credits` LEGITIMATE caller hygiene; at :262-273 invokes `materialise_continuation_lessons` LEGITIMATE caller hygiene; Sentry-instrumented via `wrapEdgeFn` at :57)
- `continuation-respond` (433L; dual-mode token-path (public) + portal-path (authenticated); service-role adminClient for ALL token-path UPDATE operations; token rate-limit at :181 by token-hash; Sentry-instrumented via `wrapEdgeFn` at :91)
- `create-continuation-run` (1394L; orchestrator entry; auth-required for create/send/send_reminders/process_deadline actions; cron path at :432 gated by explicit `=== Bearer ${serviceRoleKey}` equality; Sentry-instrumented via `wrapEdgeFn` at :408; **F-09-006 anchor** at L1029 + L1226)
- `process-term-adjustment` (981L; dual-action preview + confirm; auth-required; role-IN(owner/admin/finance); dual-client pattern (userClient + adminClient); Sentry-instrumented via `wrapEdgeFn` at :98; **PI-13 anchor** at L735 + **PI-15 anchor** at L847)

**4 SECDEF RPCs** (CENSUS §4.5 lines 583-586):
- `materialise_continuation_lessons` — **F-09-001 CRITICAL** (anon-callable + zero body auth + cross-tenant write to lessons + lesson_participants + financial-downstream chain via lp.rate_minor)
- `recalc_continuation_summary` — **F-09-002 LOW** (anon+PUBLIC EXECUTE grant despite body-gate `is_org_staff(auth.uid(), _org_id)`)
- `continuation_run_org_id` — **F-09-003 LOW** (merged; anon-callable bounded info-disclosure INCIDENTAL)
- `user_has_continuation_response_in_run` — **F-09-003 LOW** (merged; anon-callable bounded info-disclosure INCIDENTAL)

**4 Tables** (DB-verified):
- `terms` — 7 columns (id + org_id + name + start_date + end_date + created_at + created_by); UNIQUE (org_id, name); NO updated_at column or trigger (class-asymmetry §10.6); base CRUD via `useTerms.ts` per CENSUS line 1099
- `term_adjustments` — 30 columns (financial: lesson_rate_minor + adjustment_amount_minor + lessons_difference + currency_code 'GBP' + credit_note_invoice_id FK + cancelled_lesson_ids uuid[] + created_lesson_ids uuid[]); CHECK adjustment_type ∈ {withdrawal, day_change, manual}; CHECK status ∈ {draft, confirmed, cancelled}; NO CHECK on financial columns (F-09-012)
- `term_continuation_runs` — 15 columns (orchestrator state-machine status ∈ {draft, sent, partial, failed, reminding, deadline_passed, completed}; notice_deadline date; reminder_schedule int[] default {7,14}; assumed_continuing bool default true; summary jsonb); CHECK status enum; **NO audit_* trigger (F-09-011)**
- `term_continuation_responses` — 21 columns (parent self-service; response_token text default `encode(gen_random_bytes(32), 'hex')` = 256-bit; response ∈ {pending, continuing, withdrawing, assumed_continuing, no_response}; term_adjustment_id FK; reminder cadence cols); UNIQUE (response_token); CHECK response enum

**7 Triggers** (DB-verified via `pg_trigger`):
- `audit_terms` AFTER I/U/D — log_audit_event_singular('term'); batch-19 attributed per CENSUS line 784
- `enforce_term_no_overlap` BEFORE I/U → `check_term_overlap()` — batch-09 attributed per CENSUS line 785; **POSITIVE pattern observation** (Pattern #30 ratified §8)
- `audit_term_adjustments` AFTER I/U/D — batch-19 attributed per CENSUS line 786
- `set_term_adjustments_updated_at` BEFORE UPDATE — batch-19 attributed per CENSUS line 787
- `audit_term_continuation_responses` AFTER I/U/D — batch-19 attributed per CENSUS line 788
- `set_tcr_response_updated_at` BEFORE UPDATE — batch-19 attributed per CENSUS line 789
- `set_tcr_updated_at` BEFORE UPDATE on `term_continuation_runs` — batch-19 attributed per CENSUS line 790

**3 Hooks** (CENSUS lines 1099-1101):
- `useTerms.ts` (123L; 4 hook exports: useTerms + useCurrentTerm + useCreateTerm + useUpdateTerm + useDeleteTerm)
- `useTermContinuation.ts` (822L; 12 hook exports incl. realtime subscription + portal pending fetch + bulk-process + delete-run + admin-override paths)
- `useTermAdjustment.ts` (177L; 3 hook exports: useTermAdjustmentPreview + useTermAdjustmentConfirm + useTermAdjustments)

**2 Pages**:
- `src/pages/Continuation.tsx` (769L; admin orchestrator UI; per CENSUS line 165)
- `src/pages/portal/PortalContinuation.tsx` (506L; dual-mode token-path + portal-path; CENSUS line 99 for batch-09 `/respond/continuation`; CENSUS line 53 for batch-11 `/portal/continuation` parent-portal route)

**5 Components** (organic descendants of CENSUS-listed routes/hooks/pages):
- `src/components/term-adjustments/TermAdjustmentWizard.tsx` (555L; 3-step wizard; **PI-13 + PI-15 FE-side touch surface**)
- `src/components/continuation/ContinuationRunWizard.tsx` (498L)
- `src/components/continuation/ContinuationResponseDetail.tsx` (261L)
- `src/components/settings/ContinuationSettingsTab.tsx` (cross-batch 18-settings-tabs)
- `src/components/dashboard/ContinuationWidget.tsx` (cross-batch dashboard)

**3 Routes** (CENSUS lines 86 + 99 + 53; routes.ts lines 127 + 159 + 179):
- `/continuation` → Continuation, protected, allowedRoles=['owner','admin'] (batch-09)
- `/respond/continuation` → PortalContinuation, public (token URL handler; batch-09)
- `/portal/continuation` → PortalContinuation, protected, allowedRoles=['parent'] (batch-11; cross-batch)

**Cross-batch-affecting RPCs** (batch-09 surface touches; bodies CLOSED immutable):
- `cleanup_withdrawal_credits` (F-08-001 batch-08 CRITICAL anchor) — invoked LEGITIMATE at bulk-process-continuation:394 via adminClient service-role (POSITIVE caller hygiene §7); F-08-001 standalone CRITICAL stands
- `generate_invoices_from_template` (batch-05 closed) — financial-downstream chain at L131-149 JOINs lessons + lesson_participants on lp.rate_minor (F-09-001 chain target §6)
- `get_unbilled_lesson_ids` (batch-05 closed) — secondary financial surface at body L18-29 (finance-team manual billing; F-09-001 chain target §6)

**Out-of-scope** (closed-batch immutability + CENSUS attribution):
- `/portal/continuation` route + PortalContinuationList component path — batch-11-parent-portal owned per CENSUS line 53 (batch-09 audit covers the SHARED component but route ownership stays batch-11)
- 6 cross-batch triggers on term-family tables (audit_terms + audit_term_adjustments + audit_term_continuation_responses + 3 set_*_updated_at) — batch-19-cross-cutting owned per CENSUS lines 784,786,787,788,789,790
- Zoom integration sub-surface — deferred per AUDIT SCOPE COMPLETENESS rule (none in batch-09 scope)
- Enrolment waitlist surface — batch-14 owned

---

## §2 RPC body audit (Phase 1 evidence)

DB-fetched via `pg_get_functiondef` at HEAD `e9cffe8f...`; line numbers count from `AS $function$` opening anchor.

### §2.1 `materialise_continuation_lessons(p_org_id, p_recurrence_id, p_student_id, p_from_date, p_to_date, p_rate_minor DEFAULT NULL, p_created_by DEFAULT NULL)` — F-09-001 CRITICAL

- **Signature**: 7 args confirmed; `p_rate_minor` + `p_created_by` default NULL.
- **`prosecdef`**: true.
- **`proconfig` search_path**: `search_path=public` pinned.
- **EXECUTE grants**: PUBLIC + anon + authenticated + postgres + service_role (5 grants — all 5 confirmed via `routine_privileges`).
- **Body length**: 145 lines (BEGIN at L19).
- **Body-level auth grep**: ZERO matches for `auth.uid()`, `is_org_staff`, `is_org_admin`, `is_org_member`, `current_setting('role')`, `INTERNAL_CRON_SECRET`. **No caller validation.**
- **`p_org_id` use**: structural integrity only — L23 `WHERE id = p_recurrence_id AND org_id = p_org_id` on recurrence_rules; L34-35 same on lessons template fetch; L52 on existing-lesson count; L58 on closure_dates. No caller-relationship-to-p_org_id check.
- **`p_created_by` impersonation surface**: L109 `COALESCE(p_created_by, _template.created_by)` written to `lessons.created_by` column.
- **Write surface (2 tables)**:
  - lessons (13 cols at L99-111 incl. `status='scheduled'` + teacher_*/location_*/room_* from template + `created_by` COALESCE)
  - lesson_participants (4 cols at L114-116: `org_id=p_org_id`, `lesson_id=_new_lesson_id`, `student_id=p_student_id`, `rate_minor=p_rate_minor`; ON CONFLICT (lesson_id, student_id) DO NOTHING)
- **Cap discipline**: L82 + L133: `_max_cap=200` against `_existing_count + _created_count` where `_existing_count` is COUNT lessons WHERE recurrence_id+org_id+status≠'cancelled'. Cap is per-(org_id, recurrence_id) tuple PER CALL; **unbounded across distinct recurrence_ids** in same target org.
- **EXCEPTION arms** (L120-123 + L124-126):
  - WHEN raise_exception → `_conflict_count += 1` (silent-continue on `check_lesson_conflicts` trigger fire; defence-in-depth bypass for parameter-spoof attacker)
  - WHEN unique_violation → `_skipped_count += 1` (**DEAD CODE for lessons INSERT** per F-04-003 batch-04 re-confirmation: lessons table has only `lessons_pkey UNIQUE(id)`; lesson_participants uses ON CONFLICT DO NOTHING)
- **`conflicts` surfacing**: L141 `RETURN jsonb_build_object(..., 'conflicts', _conflict_count, ...)` — caller receives count; function continues iterating.
- **Composition chain confirmed (Phase 1.1 financial-downstream trace)**: `generate_invoices_from_template:131-149` JOINs `lessons ↔ lesson_participants ON lesson_id AND student_id`, then `_rate_minor := _lesson_row.lp_rate_minor` at L154 (rate-card fallback at L155-157 only fires if NULL). Phantom lesson_participants row with attacker-controlled rate_minor → invoice unit_price_minor.

### §2.2 `recalc_continuation_summary(_run_id uuid, _org_id uuid)` — F-09-002 LOW (positive body-gate)

- **Signature + SECDEF + search_path + EXECUTE grants (PUBLIC+anon+authenticated+postgres+service_role)** confirmed.
- **Body length**: 31 lines (BEGIN at L4).
- **Body-auth gate**: L5-7 `IF NOT is_org_staff(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Access denied'`. Anon → `auth.uid()=NULL` → gate raises. ✓
- **Run-belongs-to-org check**: L10-13 `IF NOT EXISTS (SELECT 1 FROM term_continuation_runs WHERE id = _run_id AND org_id = _org_id)`. ✓
- **UPDATE scoping**: L26-28 `UPDATE term_continuation_runs SET summary, updated_at WHERE id = _run_id AND org_id = _org_id`. ✓
- **Aggregation filter literals vs CHECK enum**: L18-23 filters on `'continuing' + 'withdrawing' + 'pending' + 'no_response' + 'assumed_continuing'` — all 5 values match `term_continuation_responses.response` CHECK enum exactly. No silent-empty-bucket class.
- **Positive observation** (Phase 8 Pattern #36 ratified): canonical RPC body-auth-gate anon-block pattern.

### §2.3 `continuation_run_org_id(_run_id uuid)` — F-09-003 LOW (merged INCIDENTAL)

- **SECDEF + STABLE + search_path=public**; 1-line SQL body: `SELECT org_id FROM public.term_continuation_runs WHERE id = _run_id;`
- **EXECUTE grants**: anon + authenticated + postgres + service_role (NO PUBLIC).
- **No body auth**.
- **Usage in RLS**: `term_continuation_responses` parent SELECT policy `((guardian_id IN (SELECT sg.guardian_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE g.user_id = auth.uid())) AND (org_id = continuation_run_org_id(run_id)))` — invoked from RLS context, NOT direct anon path.
- **Phase 2 INCIDENTAL adjudication**: continuation-respond:100 service-role adminClient for token-write bypasses RLS entirely; useParentContinuationPending uses authenticated supabase client → RLS helper resolves under authenticated role. Anon EXECUTE grant exercised by ZERO required code paths.

### §2.4 `user_has_continuation_response_in_run(_user_id uuid, _run_id uuid)` — F-09-003 LOW (merged INCIDENTAL)

- **SECDEF + STABLE + search_path=public**; 7-line SQL body: `SELECT EXISTS (SELECT 1 FROM term_continuation_responses tcr JOIN guardians g ON g.id = tcr.guardian_id WHERE tcr.run_id = _run_id AND g.user_id = _user_id);`
- **EXECUTE grants**: anon + authenticated + postgres + service_role (NO PUBLIC).
- **Caller-parameterised `_user_id`** (NOT auth.uid binding in body).
- **Usage in RLS**: `term_continuation_runs` parent SELECT policy passes `auth.uid()` as `_user_id` → safe within RLS context.
- **Phase 2 INCIDENTAL adjudication**: same as §2.3 (helpers' anon grants negligent hygiene; not structurally required).

### §2.5 `generate_credit_note` CENSUS-completeness verification

`pg_proc` query at HEAD: EMPTY result for `proname = 'generate_credit_note' OR ILIKE '%credit_note%'`. Hypothesis (c) "exists in pg_proc absent from CENSUS" DEFINITIVELY REFUTED. Phase 2 filesystem closure: identifier resolves as request body BOOLEAN field name (TermAdjustmentRequest interface field at process-term-adjustment:25 + boolean toggle at L779 `body.generate_credit_note !== false`) — NOT an RPC, NOT a TS helper. F-09-005 hypotheses (a) phantom + (b) helper + (c) absent-CENSUS ALL refuted; no new finding; no CENSUS-completeness gap. PI-09 cohort NOT enriched at batch-09.

---

## §3 Edge function audit (Phase 2 evidence)

Filesystem-first enumeration at `supabase/functions/` returned 102 edge fn directories + 1 `_shared/`. All 4 batch-09 edge fns present per CENSUS §4.4. No CENSUS-completeness gap.

### §3.1 `process-term-adjustment/index.ts` (981L) — PI-13 + PI-15 + F-09-005 surface

- **Sentry**: `Deno.serve(wrapEdgeFn("process-term-adjustment", ...))` at L98 ✓
- **Auth flow** (L104-126): bearer required → userClient.auth.getUser(token) explicit JWT verification → adminClient with service-role for ops → role-IN(owner/admin/finance) check at L140-147 via org_memberships
- **Body actions**: preview (L157-528) + confirm (L538-981)
- **PI-13 anchor (F-09-007)** at L735: `startAt.setUTCHours(hours, minutes, 0, 0)` ignoring `origRecurrence?.timezone` fetched at L622. L703-707 parse `adjustment.new_time` "HH:MM" → `hours, minutes` integers; L733-736 constructs lesson startAt by setting UTC hours directly on midnight-UTC parse of date string. Org-local time not honoured. 6+ adjacent timezone-naive surfaces in same fn: L209 (90-day projection via UTC ms arithmetic), L235-236 (UTC-based date-range filter), L575 (same in confirm), L601 (UTC-based dayBefore), L840-841 (issue_date + due_date via `new Date().toISOString().split("T")[0]`).
- **PI-15 anchor (F-09-008)** at L847: `is_credit_note: isCreditNote` in invoice INSERT (handleConfirm step 4). L798 `const isCreditNote = adjustmentAmount > 0;` sign-driven; L862-868 INSERT invoices; L893-903 INSERT invoice_items; L906-924 UPDATE term_adjustments.credit_note_invoice_id. **3 sequential ops with no transaction wrap.**
- **F-09-005 closure**: L25 `generate_credit_note?: boolean;` (TermAdjustmentRequest interface field) + L779 `const generateInvoice = body.generate_credit_note !== false;` (boolean toggle). NOT an RPC invocation.
- **Multi-step-write-rollback (F-09-008)**: handleConfirm L538-981 has 10+ sequential DB ops. Step 2 (cancel lessons + delete attendance + cap recurrence end_date L569-608) idempotent on retry. Step 3 (insert new recurrence + lessons + lesson_participants L641-773) NOT idempotent — retry produces duplicate recurrence + duplicate lessons. Step 4 (insert invoices + invoice_items L777-904) NOT idempotent — retry produces duplicate credit-note invoice. Step 5 (UPDATE term_adjustments.status='confirmed' L906-924) idempotent.
- **POSITIVE caller hygiene observation**: dual-client pattern (userClient validates JWT; adminClient runs ops) + explicit role check before payload trust. Pattern #31 ratified §8.

### §3.2 `bulk-process-continuation/index.ts` (472L) — F-08-001 + F-09-001 cross-batch reach

- **Sentry**: `Deno.serve(wrapEdgeFn("bulk-process-continuation", ...))` at L57 ✓
- **Auth flow** (L64-150 — 5-layer defence-in-depth; Pattern #31 anchor):
  1. L64-67: bearer auth required
  2. L77-88: `userClient.auth.getUser(token)` explicit JWT verification
  3. L117-124: role-IN(owner/admin) check via org_memberships
  4. L135-138: rate limit via `checkRateLimit`
  5. L141-150: run-belongs-to-org verification (`eq("id", body.run_id).eq("org_id", body.org_id)`)
- **F-08-001 cross-batch reach LEGITIMATE** (§7.1):
  - L392-399: `if (anyWithdrawalSucceeded) { await adminClient.rpc('cleanup_withdrawal_credits', { _student_id: resp.student_id, _org_id: body.org_id, _effective_date: body.next_term_start_date }); }`
  - Client = `adminClient` (service-role at L114)
  - `_student_id` from validated responses rowset (L164-170 already scoped to body.run_id + body.org_id)
  - `_org_id` already validated against user's org_memberships at L117-124
  - Per-iteration: process-term-adjustment internally re-validates
  - **Verdict: LEGITIMATE caller hygiene; F-08-001 standalone CRITICAL stands; NOT amplified by this caller.**
- **F-09-001 cross-batch reach LEGITIMATE** (§7.2):
  - L262-273: `await adminClient.rpc("materialise_continuation_lessons", { p_org_id: body.org_id, p_recurrence_id: lesson.recurrence_id, p_student_id: resp.student_id, p_from_date: oldEndDate, p_to_date: body.next_term_end_date, p_rate_minor: lesson.rate_minor ?? null, p_created_by: userId })`
  - All params server-derived from validated context
  - **Verdict: LEGITIMATE caller hygiene; F-09-001 standalone CRITICAL stands; NOT amplified by this caller.**
- **Conflict-warning surfacing**: L283-288 surfaces materialise's `result.conflicts > 0` to `conflictWarnings` array → returned to FE.
- **Audit log INSERT**: L437-450 manual `audit_log` row with `actor_user_id=userId` (NOT zero-UUID) ✓ — covers `continuation_run.processed` action; partial CC-19 #3 mitigation for F-09-011.

### §3.3 `create-continuation-run/index.ts` (1394L) — F-09-006 anchor

- **Sentry**: `Deno.serve(wrapEdgeFn("create-continuation-run", ...))` at L408 ✓
- **Auth flow**:
  - Cron path L430-437: explicit `if (authHeader !== \`Bearer ${serviceRoleKey}\`)` equality (Pattern #35 ratified §8 — CC-19 #14 sub-shape B intended POSITIVE)
  - Regular path L440-457: `userClient.auth.getUser(token)` + adminClient + rate-limit + role-IN(owner/admin)
- **4 actions dispatched** at L488-509: create + send + send_reminders + process_deadline.
- **F-09-006 anchor**:
  - L1029 (handleSend): `body: JSON.stringify(await transformEmailForShadow({...}, { orgId: orgId, supabase: supabase }))`
  - L1226 (handleSendReminders): same shape
  - **`supabase` identifier UNDECLARED** — verified via `grep -nE "(^|[^a-zA-Z_])supabase($|[^a-zA-Z_])"` returning 3 matches: L1 import module path (not identifier), L1029 + L1226 (the bugs). No `const supabase = ...` declaration anywhere in file.
  - ES modules strict mode → ReferenceError thrown at object-literal evaluation; caught at inner try-catch L1058 (`catch (e: any)`) → `failed.push({...error: "supabase is not defined"})` → `sentCount` stays 0 → status='failed' set at L1077
- **transformEmailForShadow signature** (`_shared/shadow-email.ts:68-71`): `ShadowContext { orgId; supabase: any; req?: Request }` — body at L77 uses `await ctx.supabase.from("organisations").select(...)` so when `supabase` is undefined at call site, it never gets that far (ReferenceError at argument evaluation, not inside transformEmailForShadow).
- **POSITIVE caller hygiene observation**: explicit `=== Bearer ${serviceRoleKey}` for cron path (Pattern #35 ratified §8).

### §3.4 `continuation-respond/index.ts` (433L) — F-09-003 + F-09-004 structural-necessity adjudication

- **Sentry**: `Deno.serve(wrapEdgeFn("continuation-respond", ...))` at L91 ✓
- **Two flows**:
  - Token-based (L171-287): rate-limit by token-hash at L181-184; lookup by `response_token` equality at L190; check `respRow.response !== 'pending'` at L201 for replay protection; UPDATE via service-role adminClient at L237-257
  - Portal-based (L289-433): authenticated; rate-limit by userId at L147; UPDATE via service-role adminClient at L394-403
- **Client construction**: L100 `const adminClient = createClient(supabaseUrl, serviceRoleKey);` — service-role for ALL token-path DB ops.
- **F-09-003 + F-09-004 structural-necessity verdict** (Phase 2 §2.4):
  - Token-write path uses service-role → bypasses RLS entirely; helpers `continuation_run_org_id` + `user_has_continuation_response_in_run` NEVER invoked on write path
  - Portal-read path (useParentContinuationPending) uses authenticated supabase client → RLS helper resolves under authenticated role; anon EXECUTE grants NOT exercised
  - **Verdict: INCIDENTAL hygiene LOW.** Anon EXECUTE grants are negligent; Phase C remediation REVOKE anon EXECUTE has zero functional impact.
- **Token surface specifics**:
  - Token entropy: `gen_random_bytes(32)` = 256-bit; column UNIQUE constraint (`term_continuation_responses_response_token_key`); rate-limit prevents brute force at L181
  - Replay protection: `if (respRow.response !== 'pending')` at L201 returns "already responded" branch (idempotent); response_token not invalidated post-use (acceptable — single-use enforced by branch)
  - Deadline enforcement at L229: `if (run.notice_deadline && new Date(run.notice_deadline) < new Date()) return 400`
  - Token leak surfaces: no `console.log(token)` observed; rate-limit key uses token but stored in DB/KV (Phase 4 didn't enumerate rate_limit_attempts table policies; minor risk surface)

---

## §4 Frontend surface audit (Phase 3 evidence)

### §4.1 Route guards (`src/config/routes.ts` lines 127 + 159 + 179)

- L159: `/continuation` → Continuation, auth='protected', allowedRoles=['owner', 'admin'] ✓ matches RLS `is_org_admin`
- L127: `/portal/continuation` → PortalContinuation, auth='protected', allowedRoles=['parent'] (batch-11 owned)
- L179: `/respond/continuation` → PortalContinuation, auth='public' (email-link token URL handler)

PortalContinuation component detects mode via `hasToken = !!searchParams.get('token')` at L467; renders TokenResponse (public flow) or PortalContinuationList (authenticated parent flow). Route guards correctly configured.

### §4.2 useTerms.ts (123L)

- 5 hook exports: `useTerms` + `useCurrentTerm` + `useCreateTerm` + `useUpdateTerm` + `useDeleteTerm`
- Direct `supabase.from('terms')` queries (anon client + RLS server-side); FE org_id filter is defence-in-depth
- 3 mutation hooks (useCreateTerm + useUpdateTerm + useDeleteTerm) WITHOUT useCan → 3 of 13 F-09-009 cohort instances
- Error handling: `if (error) throw error;` → onError surfaces raw `error.message` to toast (`enforce_term_no_overlap` trigger fire raises "Term dates overlap with an existing term" — user-friendly message §10.7)
- `useCurrentTerm` at L38-42: `today = new Date().toISOString().split('T')[0]` UTC-based → PI-17 class shape (batch-19 owning)

### §4.3 useTermContinuation.ts (822L)

- 12 hook exports incl. 8 mutation paths (useCreateContinuationRun + useSendContinuationRun + useSendContinuationReminders + useProcessDeadline + useRespondToContinuation + useBulkProcessContinuation + useDeleteContinuationRun + useUpdateContinuationResponse) — 8 of 13 F-09-009 cohort
- Realtime subscription at L183-207: postgres_changes on term_continuation_responses (Pattern #33 ratified §8)
- 42P01 graceful-degradation at L133-138, L164-167, L231-233, L275-278 — 4 sites (Pattern #34 CANDIDATE deferred; tech-debt-borderline)
- **F-09-001 conflict-count surfacing (Phase 1 deferred fork resolved)** at L585-593 (useBulkProcessContinuation onSuccess): destructive toast with `conflictWarnings` list (dual-surfacing Pattern #32 ratified §8)
- **F-09-006 failed[] display (Phase 2 deferred fork resolved)** at L368-372 (useSendContinuationRun onSuccess): aggregated count visible ("Sent to N families, M failed") but individual errors discarded — magnitude factor for F-09-006 (semi-blind operator diagnosis)
- 11 `(supabase as any).from/.rpc` Sub-A literal casts (Sub-pattern A/C nested-join shape)
- Direct `(supabase as any).rpc('recalc_continuation_summary', ...)` at L499 + L803 — acceptable per body-auth gate (F-09-002 positive observation)
- `logAudit(...)` at L808-810 in useUpdateContinuationResponse — manual FE audit-log entry (redundant given DB-side AFTER trigger; not a finding-class concern)

### §4.4 useTermAdjustment.ts (177L)

- 3 hook exports: `useTermAdjustmentPreview` + `useTermAdjustmentConfirm` + `useTermAdjustments` — 2 mutation paths of 13 F-09-009 cohort
- Sub-A `(supabase as any).from('term_adjustments')` at L155 (1 Sub-pattern A literal cast)
- `generate_credit_note: generateInvoice` at L166 confirm payload — FE passes user-controlled boolean (TermAdjustmentWizard checkbox defaults true)
- onSuccess at L113-136 surfaces aggregate counts (cancelled_count + created_count + credit_note_invoice_id presence) — binary success state for F-09-008 / F-09-010 magnitude

### §4.5 Continuation.tsx (769L; admin orchestrator UI)

- Uses useContinuationRuns + useContinuationRun + useContinuationResponses + useSendContinuationReminders + useProcessDeadline + useBulkProcessContinuation + usePreviewBulkProcess + useDeleteContinuationRun + useUpdateContinuationResponse — 9 hooks via composition; zero direct supabase access (Pattern #27 sub-class A reinforcement)
- **F-09-001 conflict-count surfacing (Phase 3 confirmation)** at L713-725: `bulkPreview.conflicts` rendered as `<ul>` list in AlertDialog before bulk-process confirmation; dual-surfacing Pattern #32 anchor
- Delete confirmation dialog at L741-766 (AlertDialog destructive variant) ✓
- Admin response override at L582-587 (inline Select dropdown via updateResponse.mutate) — no confirmation modal before audit-logged change (UX observation only)

### §4.6 PortalContinuation.tsx (506L; dual-mode parent flow)

- TokenResponse component (L37-240) — handles `/respond/continuation?token=...` URL; uses `supabase.functions.invoke('continuation-respond', ...)` at L71-81 directly (Pattern #27 sub-class B architectural-exception anchor §8)
- PortalContinuationList component (L242-462) — authenticated parent flow; uses useParentContinuationPending + useParentRespondToContinuation hooks (Pattern #27 sub-class A reinforcement; authenticated supabase client → RLS-internal invocation of `continuation_run_org_id` + `user_has_continuation_response_in_run` confirms F-09-003 INCIDENTAL adjudication)
- 1 `<any>` generic: `useState<any>(null)` at L45 (responseData state)
- Schedule display at L337: `{lesson.day}s at {lesson.time}` — UTC-substring with no TZ label (F-09-007 FE output evidence)

### §4.7 TermAdjustmentWizard.tsx (555L; 3-step wizard)

- 3 Sub-A literal casts (Sub-pattern C nested-join shape)
- **PI-13 FE input (Phase 3 confirmation)** at L343-349: plain `<Input type="time">` no TZ-affordance label
- **F-09-008 + F-09-010 step='complete' surface (Phase 3 confirmation)** at L482-505: renders binary success counts (cancelled_count + created_count + credit_note_invoice_id presence); on partial-fail returns to step='preview' with generic "Adjustment failed" toast from hook onError; NO partial-commit UI affordance
- `generate_credit_note` checkbox at L440-453 defaults true (L87 `useState(true)`); operator explicit toggle; semantics aligned with edge fn `body.generate_credit_note !== false` at L779

### §4.8 useCan coverage map (F-09-009 cohort)

`grep -nE "useCan\(" src/hooks/useTerm*.ts src/pages/Continuation.tsx src/pages/portal/PortalContinuation.tsx src/components/term-adjustments/TermAdjustmentWizard.tsx src/components/continuation/*.tsx src/components/settings/ContinuationSettingsTab.tsx src/components/dashboard/ContinuationWidget.tsx` returns **0 matches**.

13 mutation hook sites without useCan check (F-09-009 cohort §6):
| Hook | File:line |
|---|---|
| useCreateTerm | src/hooks/useTerms.ts:50 |
| useUpdateTerm | src/hooks/useTerms.ts:83 |
| useDeleteTerm | src/hooks/useTerms.ts:110 |
| useCreateContinuationRun | src/hooks/useTermContinuation.ts:291 |
| useSendContinuationRun | src/hooks/useTermContinuation.ts:334 |
| useSendContinuationReminders | src/hooks/useTermContinuation.ts:385 |
| useProcessDeadline | src/hooks/useTermContinuation.ts:426 |
| useRespondToContinuation | src/hooks/useTermContinuation.ts:469 |
| useBulkProcessContinuation | src/hooks/useTermContinuation.ts:520 |
| useDeleteContinuationRun | src/hooks/useTermContinuation.ts:743 |
| useUpdateContinuationResponse | src/hooks/useTermContinuation.ts:779 |
| useTermAdjustmentPreview | src/hooks/useTermAdjustment.ts:70 |
| useTermAdjustmentConfirm | src/hooks/useTermAdjustment.ts:96 |

### §4.9 TS-bypass-cast literal counts (batch-09 FE)

`grep -cE "as any" + grep -cE "<any>"`:
- useTerms.ts: 0 + 0
- useTermContinuation.ts: 12 + 0
- useTermAdjustment.ts: 1 + 0
- Continuation.tsx: 0 + 0
- PortalContinuation.tsx: 0 + 1
- TermAdjustmentWizard.tsx: 3 + 0
- ContinuationResponseDetail.tsx: 0 + 0
- ContinuationRunWizard.tsx: 1 + 0

**Total batch-09 FE: 17 `as any` + 1 `<any>` = 18 instances.** Sub-pattern C (nested-join shape) cohort growth flagged for batch-19 cohesion sweep §11.

---

## §5 RLS + trigger audit (Phase 4 evidence)

### §5.1 RLS re-verification at HEAD `e9cffe8f...`

`pg_policies` + `pg_policy` queries returned 13 policies across 4 batch-09 tables. **Delta vs s48 prompt §6.4 Phase 0 snapshot: ZERO** — no policies added/removed/modified between Phase 0 and Phase 4.

**`terms` (2 policies)**:
- "Admin can manage terms" cmd=ALL, USING `is_org_admin(auth.uid(), org_id)`, WITH CHECK inherits USING (SAFE shape per PG cmd=ALL semantics)
- "Staff can view terms" cmd=SELECT, USING `is_org_staff(auth.uid(), org_id)`

**`term_adjustments` (3 policies)**:
- "Admins can create term adjustments" cmd=INSERT, WITH CHECK `is_org_admin(auth.uid(), org_id)` ✓
- "Admins can update term adjustments" cmd=UPDATE, USING `is_org_admin(auth.uid(), org_id)`, **WITH CHECK NULL — F-01-017 class instance** §10.1
- "Members can view org term adjustments" cmd=SELECT, USING `is_org_member(auth.uid(), org_id)`
- No DELETE policy → default deny ✓

**`term_continuation_runs` (5 policies)**:
- "Org admins can create continuation runs" cmd=INSERT, WITH CHECK `is_org_admin(auth.uid(), org_id)` ✓
- "Org admins can delete continuation runs" cmd=DELETE, USING `is_org_admin(auth.uid(), org_id)`
- "Org admins can update continuation runs" cmd=UPDATE, USING `is_org_admin(auth.uid(), org_id)`, **WITH CHECK NULL — F-01-017 class instance** §10.1
- "Org staff can view continuation runs" cmd=SELECT, USING `is_org_staff(auth.uid(), org_id)`
- "Parents can view runs they have responses in" cmd=SELECT, USING `user_has_continuation_response_in_run(auth.uid(), id)`

**`term_continuation_responses` (3 policies)**:
- "Org admins can manage continuation responses" cmd=ALL, USING `is_org_admin(auth.uid(), org_id)`, WITH CHECK inherits USING (SAFE per PG cmd=ALL semantics)
- "Org staff can view continuation responses" cmd=SELECT, USING `is_org_staff(auth.uid(), org_id)`
- "Parents see own responses" cmd=SELECT, USING `((guardian_id IN (SELECT sg.guardian_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE g.user_id = auth.uid())) AND (org_id = continuation_run_org_id(run_id)))`

All 13 policies `permissive=true`; zero RESTRICTIVE policies → no CC-19 #13 PERMISSIVE-intended-as-RESTRICTIVE class instances at batch-09.

### §5.2 `enforce_term_no_overlap` / `check_term_overlap` trigger body audit

Body verbatim:
```sql
CREATE OR REPLACE FUNCTION public.check_term_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.terms
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Term dates overlap with an existing term';
  END IF;
  RETURN NEW;
END;
$function$
```

- **SECDEF + search_path=public** ✓
- **Overlap-detection**: `daterange(start_date, end_date, '[]') &&` PG built-in operator with inclusive-inclusive bounds — structurally complete coverage of all overlap shapes
- **Self-row exclusion**: `AND id != NEW.id` ✓ correctly excludes self on UPDATE
- **Error message**: user-friendly `'Term dates overlap with an existing term'`
- **Class precedent vs F-03-004 (`check_lesson_conflicts` 2-of-7 partial-coverage)**: structurally complete via daterange operator — **NOT class-shape-adjacent**; promotion candidate Pattern #30 ratified §8

### §5.3 `term_continuation_runs` audit-trigger gap (F-09-011)

`pg_trigger` query at HEAD confirms only 1 non-internal trigger: `set_tcr_updated_at` BEFORE UPDATE → `update_updated_at_column()`. **NO `audit_term_continuation_runs` AFTER I/U/D trigger** ✗

Compare 3 sibling batch-09 tables (all DO have audit triggers):
- terms: `audit_terms` AFTER I/U/D → `log_audit_event_singular('term')` ✓
- term_adjustments: `audit_term_adjustments` AFTER I/U/D → `log_audit_event_singular('term_adjustment')` ✓
- term_continuation_responses: `audit_term_continuation_responses` AFTER I/U/D → `log_audit_event_singular('term_continuation_response')` ✓
- **term_continuation_runs: MISSING** — F-09-011 anchor

State-machine transition coverage:
- `draft → created`: covered (manual audit_log INSERT at create-continuation-run:339-350)
- `created → sent`: **UNAUDITED** (status update at L1077; no manual audit)
- `sent → reminding`: **UNAUDITED** (status update at L1254; no manual audit)
- `sent/reminding → partial/failed`: **UNAUDITED** (status update at L1077)
- `sent/reminding → deadline_passed`: covered (manual audit_log INSERT at L1321-1332 + L1381-1388)
- `deadline_passed → completed`: **UNAUDITED** (status update at bulk-process-continuation:427-433; partial mitigation via L437-450 manual audit for `continuation_run.processed` action)

**4 of 7 state transitions unaudited.**

### §5.4 `cmd=ALL` WITH CHECK NULL safe-inheritance pattern

`pg_policy` direct query confirms:
- terms "Admin can manage terms" polcmd='*', polwithcheck=NULL → inherits USING per PG semantics for INSERT/UPDATE WITH CHECK; SAFE
- term_continuation_responses "Org admins can manage continuation responses" polcmd='*', polwithcheck=NULL → SAFE

No CC-19 #13 PERMISSIVE-intended-as-RESTRICTIVE concern.

### §5.5 CHECK constraint cohort (F-09-012)

`pg_constraint contype IN ('c','u','p')` query returned 10 constraints across 4 tables. Financial-column CHECK gaps:
| Table.column | Expected CHECK | Status |
|---|---|---|
| term_adjustments.lesson_rate_minor | `> 0` | MISSING |
| term_adjustments.adjustment_amount_minor | (any integer) | N/A — appropriate |
| term_adjustments.lessons_difference | (any integer) | N/A — appropriate |
| term_adjustments.original_lessons_remaining | `>= 0` | MISSING |
| term_adjustments.new_lessons_count | `>= 0` when not null | MISSING |
| term_continuation_responses.next_term_fee_minor | `>= 0` when not null | MISSING |
| term_continuation_responses.reminder_count | `>= 0` (default 0) | not in F-09-012 cohort (bounded by app code; ambiguous business semantic) |

**4 negative-instances batch-09** → CC-19 #11 cohort post-s48: 11 entries (9 negative + 2 positive).

### §5.6 audit_log NULL-actor pattern at parent token surface (F-07-003 class-consistency)

`SELECT count(*) FROM audit_log WHERE entity_type = 'term_continuation_responses'` returned **0 rows** (pre-launch all-test-data caveat). Structural concern stands: continuation-respond:100 service-role adminClient → AFTER trigger `audit_term_continuation_responses` fires with `auth.uid()=NULL` → `log_audit_event_singular` records `actor_user_id = COALESCE(NULL, '00000000-0000-0000-0000-000000000000')` zero-UUID. Partial forensic recoverability via `guardian_id` + `response_token` columns. Class-consistency per s47 F-07-003 magnitude-not-bracket precedent; no new finding §10.2.

### §5.7 `terms` table additional structural observations

- UNIQUE (org_id, name) ✓
- NO CHECK on `start_date <= end_date` — implicitly prevented at trigger level via `daterange()` constructor raising PG SQLSTATE 22000 on inverse ranges, but generic PG message UX class observation §10.7
- NO `updated_at` column or `set_*_updated_at` trigger — class-asymmetry with 3 sibling batch-09 tables §10.6

---

## §6 Findings F-09-NNN (severity-grouped)

### §6.1 CRITICAL (1)

#### F-09-001 — `materialise_continuation_lessons` anon-callable SECDEF (parameter-spoofing + financial-falsification composition)

- **Severity**: **Critical** (no bracket-shift event; standalone class-anchor stack)
- **Area**: SECDEF RPC body / parameter-spoofing class / financial-falsification class
- **Phase surfaced**: 1 (RPC body audit)
- **Class anchor**: F-08-001 closed batch-08 CRITICAL anchor (parameter-spoofing standalone — `cleanup_withdrawal_credits` same shape: anon-callable SECDEF + zero body auth + cross-tenant destructive write) + F-02-005 closed batch-02 CRITICAL anchor (financial-falsification class — `record_stripe_payment` no caller-context validation) + F-07-003 closed batch-07 CRITICAL anchor (composition-chain via F-02-005)
- **Severity rubric**: PLAN.md §4 CRITICAL — "security exposure" (anon-callable cross-tenant state-mutation RPC) + "financial loss" (lp.rate_minor flows through invoice creation pipeline)

**Evidence** (DB-verified via `pg_get_functiondef('public.materialise_continuation_lessons'::regproc::oid)`):

- **EXECUTE grants** (`information_schema.routine_privileges`): PUBLIC + anon + authenticated + postgres + service_role
- **Body-level auth grep** (165-line body): **ZERO matches** for `auth.uid()`, `is_org_staff`, `is_org_admin`, `is_org_member`, `current_setting('role')`, `INTERNAL_CRON_SECRET`. No caller validation.
- **Cross-tenant write surface**:
  - Body L99-111: INSERT INTO lessons (org_id, recurrence_id, start_at, end_at, lesson_type, status, teacher_user_id, teacher_id, location_id, room_id, title, is_online, created_by) — 13 columns; `org_id = p_org_id` attacker-controlled; `status = 'scheduled'`; `created_by = COALESCE(p_created_by, _template.created_by)` actor-impersonation surface
  - Body L114-116: INSERT INTO lesson_participants (org_id, lesson_id, student_id, rate_minor) — `org_id = p_org_id` + `rate_minor = p_rate_minor` both attacker-controlled; ON CONFLICT (lesson_id, student_id) DO NOTHING
- **Cap discipline** (body L82 + L133): `_max_cap = 200` per-(org_id, recurrence_id) tuple PER CALL; **unbounded across distinct recurrence_ids** in same target org (N × 200 if attacker enumerates recurrence_ids)
- **Conflict-trigger silent-swallow** (body L120-123): `WHEN raise_exception THEN _conflict_count := _conflict_count + 1` — defence-in-depth bypass for parameter-spoof attacker; function continues iterating despite `check_lesson_conflicts` trigger fire

**Attack chain — standalone parameter-spoof**:
1. Attacker obtains `(p_org_id, p_recurrence_id, p_student_id)` UUID triple via side-channel (organisational disclosure, leaked URL params, screenshot, etc. — same threat model as F-08-001)
2. Anon `POST /rest/v1/rpc/materialise_continuation_lessons` with chosen `p_rate_minor` (any int) + chosen `p_created_by` (any uuid) + chosen date range
3. RPC executes SECDEF as postgres role; bypasses RLS entirely
4. Up to 200 phantom lessons (status='scheduled') inserted in target org's calendar with attacker-controlled rate_minor on each lesson_participant row
5. Phantom lessons visible to legitimate staff via existing dashboard/calendar surfaces
6. `lessons.created_by` = attacker-chosen UUID OR template's `created_by` (legitimate-user mask); `audit_log.actor_user_id` = zero-UUID per anon caller context

**Financial-downstream composition chain** (Phase 1.1 DB-traced):

`generate_invoices_from_template` body L131-149:
```sql
FOR _lesson_row IN
  SELECT l.id AS lesson_id, l.title AS lesson_title, lp.rate_minor AS lp_rate_minor
  FROM lessons l
  JOIN lesson_participants lp ON lp.lesson_id = l.id AND lp.student_id = _recipient_row.student_id
  LEFT JOIN attendance_records ar ON ar.lesson_id = l.id AND ar.student_id = _recipient_row.student_id
  WHERE l.org_id = _template.org_id
    AND l.status <> 'cancelled'
    AND l.end_at::date >= _period_start AND l.end_at::date <= _period_end
    AND ar.attendance_status IS NOT NULL AND ar.attendance_status::text = ANY(_template.delivered_statuses)
    AND NOT EXISTS (SELECT 1 FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE ii.linked_lesson_id = l.id AND i.status <> 'void')
  ORDER BY l.end_at
LOOP
  _rate_minor := _lesson_row.lp_rate_minor;
```

After phantom lessons exist + legitimate staff marks attendance ('present' satisfies `validate_attendance_participant` trigger because lesson_participants row exists) → `generate_invoices_from_template` picks up phantom lessons → `_rate_minor := lp.lp_rate_minor` (attacker-chosen) → `create_invoice_with_items` creates invoice at attacker amount.

**Secondary surface — `get_unbilled_lesson_ids` body**: body auth `is_org_finance_team(auth.uid(), _org_id)`; finance-team manual billing UI picks up phantom lessons directly (status IN ('completed', 'scheduled') filter) **without attendance gating** → direct invoice path.

**Magnitude factors** (NOT bracket modifiers per s47 F-07-003 precedent):
- Cross-batch reach LEGITIMATE at bulk-process-continuation:262-273 (caller hygiene: service-role + 5-layer defence-in-depth + all-server-derived params) — POSITIVE caller observation §7.2; does NOT amplify standalone CRITICAL
- F-04-003 dedup-ABSENT empirical re-confirmation at HEAD: unique_violation arm L124-126 is DEAD CODE for lessons INSERT
- Zero-UUID actor in audit_log + p_created_by impersonation via lesson.created_by = partial forensic recoverability (s47 magnitude-not-bracket precedent)
- F-04-001 silent-query-error → empty-state masquerade class watchpoint NEGATIVE (function continues iterating; returns explicit 'conflicts' count)

**Severity reasoning (PLAN.md §4)**: CRITICAL verbatim — "security exposure" (anon-callable financial-state-mutation RPC bypassing RLS) + "financial loss" (lp.rate_minor canonical unit_price_minor → create_invoice_with_items downstream). Class-consistency: parameter-spoofing class (F-08-001 anchor) + financial-falsification class (F-02-005 + F-07-003 anchors); same shape — anon callable, no body auth, cross-tenant state mutation. Bracket CAPS at CRITICAL per class-consistency.

**Phase C sprint candidate**: **S-29** (clustered with F-02-005 + F-07-003 + F-08-001 anchor fixes; SECDEF parameter-spoofing codemod).
**Decision needed**: No (mechanical fix; same shape as F-02-005/F-07-003/F-08-001).

### §6.2 HIGH (4)

#### F-09-006 — `create-continuation-run/index.ts:1029 + :1226` undeclared `supabase` ReferenceError on email-send path

- **Severity**: **High** (no bracket-shift event; new finding starting at HIGH per F-03-002 impact-profile match)
- **Area**: Edge function call-site / silent-failure-modes class
- **Phase surfaced**: 2 (edge fn body audit)
- **Class anchor**: F-03-002 closed batch-03 HIGH (corsHeaders ReferenceError; happy-path impact-profile match) + silent-failure-modes PLAN.md §4 anchor + operational-correctness CAPS-at-HIGH chain (events #2/#5/#6/#7/#8/#10/#11)
- **Severity rubric**: PLAN.md §4 HIGH — "feature works in degraded way" (entire term-continuation email-send broken when RESEND key configured) + "silent failure modes" (FE displays aggregated count but discards individual error details)

**Evidence**:

- L1029 (handleSend): `body: JSON.stringify(await transformEmailForShadow({...}, { orgId: orgId, supabase: supabase })),`
- L1226 (handleSendReminders): same shape
- `grep -nE "(^|[^a-zA-Z_])supabase($|[^a-zA-Z_])" supabase/functions/create-continuation-run/index.ts` returns 3 matches: L1 import module path (NOT identifier), L1029, L1226. **No `const supabase = ...` declaration in scope.**

**Behaviour** (ES modules → strict mode → bare reference throws ReferenceError):
1. JS engine evaluates `{ orgId, supabase: supabase }` object literal
2. Lookup `supabase` in scope → undeclared → **ReferenceError thrown**
3. Caught at inner try-catch L1058 (`catch (e: any)` for fetch errors)
4. `failed.push({ guardian_name, email, error: e.message })` — error captured as "supabase is not defined"
5. `sentCount` stays 0
6. Run status update at L1077-1081 sets `status = 'failed'`
7. Edge fn returns 200 with `{ sent_count: 0, failed: [...], status: 'failed' }`

**Impact**: Term continuation email-send is **100% broken** when `RESEND_API_KEY` is configured (production likely). Both handleSend (initial term-continuation email batch) AND handleSendReminders (reminder emails) hit identical bug.

**FE surfacing** ([useTermContinuation.ts:363-373](src/hooks/useTermContinuation.ts:363)):
```typescript
const failedCount = data.failed?.length || 0;
if (failedCount === 0) {
  toast({ title: `Notifications sent to ${data.sent_count} families` });
} else {
  toast({
    title: `Sent to ${data.sent_count} families, ${failedCount} failed`,
    variant: 'destructive',
  });
}
```

Operator sees "Sent to 0 families, N failed" destructive toast — failure visible BUT root-cause ("supabase is not defined") discarded by hook. Magnitude factor MIDDLE-strength: operator-semi-blind diagnosis (NOT bracket modifier per s47 F-08-001 zero-UUID-actor precedent — magnitude-not-bracket).

**Mitigation references**:
- Cron-mode email-send not exercised (the bug is in handleSend + handleSendReminders, not cron deadline path L1339-1394)
- Sentry-instrumented via `wrapEdgeFn` at L408 (CC-19 #10 POSITIVE) — outer try-catch at L513 captures the ReferenceError via inner-handler-propagation; Sentry breadcrumbs may surface for production diagnosis

**Severity reasoning (PLAN.md §4)**: HIGH per "feature works in degraded way" (every email send 100% fails) + "silent failure modes" (FE-side aggregation masks root cause). Class anchor F-03-002 (corsHeaders happy-path impact-profile match — both are ReferenceErrors on reachable code paths). F-05-008 was MEDIUM with "near-impossible code path" qualifier — F-09-006 is the OPPOSITE (happy-path always-reached); operational-correctness CAPS-at-HIGH chain applies.

**Phase C sprint candidate**: **S-34** (one-line fix: replace `supabase: supabase` with `supabase: client` at L1029 + L1226; pattern usage discipline preserved).
**Decision needed**: No (trivial typo fix).

#### F-09-007 — PI-13 `process-term-adjustment` timezone-drift (event #12 CRITICAL ↓ HIGH)

- **Severity**: **High** (severity-adjustment event #12; CRITICAL ↓ HIGH at Phase 5; class-precedent reassessment driver)
- **Area**: Edge function body / timezone-drift operational-correctness class
- **Phase surfaced**: 2 (edge fn body audit); confirmed Phase 3 (FE walk)
- **Class anchor**: PI-17 class shape (batch-08 → batch-19 carry; UTC-based time arithmetic ignoring org timezone) + operational-correctness CAPS-at-HIGH chain (events #2/#5/#6/#7/#8/#10/#11 kinship)
- **Severity rubric**: PLAN.md §4 HIGH — "feature works in degraded way" (non-UTC orgs get lessons scheduled at wrong-by-N-hours where N = UTC offset; UK orgs in BST get +1h drift)

**Evidence** (Phase 2 + Phase 3):

- **Edge fn anchor**: [process-term-adjustment/index.ts:735](supabase/functions/process-term-adjustment/index.ts:735) `startAt.setUTCHours(hours, minutes, 0, 0)` — ignores `origRecurrence?.timezone` fetched at L622 (`const timezone = origRecurrence?.timezone || "Europe/London";` — variable assigned but NEVER USED in date construction at L733-736)
- **Surrounding context** (L703-707): parse `adjustment.new_time` "HH:MM" → `hours, minutes` integers; L733-736 constructs lesson startAt by setting UTC hours directly on midnight-UTC parse of date string
- **6+ adjacent timezone-naive surfaces in same fn**: L209 (90-day projection via UTC ms arithmetic), L235-236 (UTC-based date-range filter), L575 (same in confirm flow), L601 (UTC-based dayBefore), L840-841 (issue_date + due_date via `new Date().toISOString().split("T")[0]`)
- **FE input evidence**: [TermAdjustmentWizard.tsx:343-349](src/components/term-adjustments/TermAdjustmentWizard.tsx:343) plain `<Input type="time">` — browser-local "HH:MM" interpretation; **no timezone display affordance** in wizard
- **FE output evidence**: [PortalContinuation.tsx:337](src/pages/portal/PortalContinuation.tsx:337) `{lesson.day}s at {lesson.time}` — `lesson.time` originated from `firstLesson.start_at.substring(11, 16)` in create-continuation-run:253 (UTC ISO substring); **no timezone label**

**Boundary case example** (org in Europe/London during BST):
- Operator sets `new_time = "14:30"` intending 2:30pm London
- L733-735: `startAt = new Date("2026-04-15T00:00:00Z"); startAt.setUTCHours(14, 30, 0, 0);` → `2026-04-15T14:30:00Z`
- That's 14:30 UTC = **15:30 BST in London** (1h late)
- During GMT (winter), `14:30 UTC = 14:30 GMT` — correct local time. Drift surfaces only during BST.

**Composition probe (CRITICAL gate)**:
- Wrong-time lessons can shift across day-boundary near midnight (e.g., 23:30 local → next-day UTC date) — potentially mis-classifying which billing period the lesson belongs to
- Edge case only; primary impact is "lessons at wrong-time-of-day" visible to staff/students/parents
- **No financial-falsification CRITICAL composition path** beyond edge-case day-boundary mis-classification (Phase 2 + Phase 3 confirmed bounded)

**Severity reasoning (PLAN.md §4)**: HIGH per "feature works in degraded way" + class-consistency with PI-17 anchor (operational-correctness CAPS-at-HIGH; same UTC-based time arithmetic ignoring org timezone shape). **Severity-adjustment event #12**: pre-tag CRITICAL via PI-13 (Phase 2 tag) ↓ HIGH (Phase 5 class-precedent reassessment). Class-precedent reassessment kinship to s44 events #5-#7 PI-02/03/04 Critical ↓ HIGH chain. Driver type: class-precedent reassessment (NOT composition-driven).

**Closes PI-13** — PI-13 CRITICAL Active → CLOSED-fully via F-09-007 HIGH at batch-09 (event #12).

**Phase C sprint candidate**: **S-32-timezone-correctness-process-term-adjustment** (replace `setUTCHours` pattern with `fromZonedTime(...)` from date-fns-tz using `origRecurrence.timezone`; audit other UTC-arithmetic surfaces in same fn).
**Decision needed**: No (timezone library swap; pattern-driven fix).

#### F-09-008 — PI-15 multi-step-write-rollback discipline gap (process-term-adjustment handleConfirm)

- **Severity**: **High** (no severity-adjustment event; HIGH selected from {MEDIUM, HIGH} ambiguous Phase 2 pre-tag = adjudication per §18)
- **Area**: Edge function body / Pattern #20 multi-step-write-rollback class
- **Phase surfaced**: 2 (edge fn body audit); FE magnitude factor confirmed Phase 3
- **Class anchor**: Pattern #20 multi-step-write-rollback discipline class (~20 cumulative active surfaces post-s48) + F-04-003 + F-05-002 cascade-completeness-asymmetry class neighbouring + operational-correctness CAPS-at-HIGH chain + PI-15 inherited HIGH severity (creation surface owns PI-15 closure)
- **Severity rubric**: PLAN.md §4 HIGH — "feature works in degraded way" (retry-amplification produces duplicates) + "missing UI surfaces for tracked DB state" (partial-commit state invisible to operator)

**Evidence** (Phase 2 §3.1 + Phase 3 §4.7):

[process-term-adjustment/index.ts:777-940](supabase/functions/process-term-adjustment/index.ts:777) handleConfirm has 10+ sequential DB operations with NO transaction wrap:

| Step | Operations | Idempotency on retry |
|---|---|---|
| 1. Fetch draft adjustment (L549-557) | SELECT term_adjustments WHERE status='draft' | Idempotent |
| 2. Cancel + delete + cap (L569-608) | 3 ops: UPDATE lessons SET status='cancelled' WHERE status='scheduled' + DELETE attendance_records + UPDATE recurrence_rules SET end_date | **Idempotent** (status='scheduled' filter prevents re-cancellation; lesson_id IN cancelledIds prevents re-delete) |
| 3. Create new series (L614-775; day_change only) | 3 ops: INSERT recurrence_rules + INSERT lessons (multiple rows) + INSERT lesson_participants | **NOT idempotent** — retry produces duplicate recurrence + duplicate lessons + duplicate participants |
| 4. Create credit/supplementary invoice (L777-904) | 2 ops: INSERT invoices + INSERT invoice_items | **NOT idempotent** — retry produces duplicate credit-note invoice |
| 5. UPDATE term_adjustments status='confirmed' (L906-924) | 1 op | Idempotent |
| 6. Audit log INSERT (L927-940) | 1 op | Idempotent on retry (different audit row each time, but trace preserved) |
| 7. Waitlist match (L946-966) | Wrapped in try-catch (non-fatal) | N/A |

**Failure modes**:
- Step 3 fails after step 2 succeeds → lessons cancelled but no new series. Operator retry: step 2 no-op (cancelled), step 3 re-attempts → DUPLICATE recurrence_rule + DUPLICATE lessons
- Step 4 fails after step 3 succeeds → new lessons + recurrence exist + no credit-note. Operator retry: step 2 no-op, step 3 re-runs → MORE DUPLICATE lessons; step 4 INSERTs another credit-note invoice → DUPLICATE CREDIT NOTE
- Step 5 fails after step 4 succeeds → invoice exists but term_adjustments.credit_note_invoice_id NULL. On retry: L555 fetch sees status='draft' still → entire flow re-runs → DUPLICATE everything

**FE magnitude factor** (Phase 3 §4.7):
- [TermAdjustmentWizard.tsx:482-505](src/components/term-adjustments/TermAdjustmentWizard.tsx:482) step='complete' renders binary success counts; on partial-fail returns to step='preview' with generic "Adjustment failed" toast
- NO UI affordance for partial-commit DB state; operator cannot see WHICH step failed or what was committed
- Magnitude factor: retry-amplification + UI blindness = silent-DB-state failure mode (NOT bracket modifier per s47 magnitude-not-bracket precedent; supports HIGH within bracket)

**Mitigation references**:
- Step 2 idempotency provides partial protection (cancel + delete + cap don't compound on retry)
- audit_log captures each retry attempt at step 6 → forensic recoverability of retry-amplification pattern
- Phase C sprint candidate S-33 wraps the entire handleConfirm body in `BEGIN ... COMMIT` transaction (or moves to RPC body wrapped in PL/pgSQL transaction)

**Severity reasoning (PLAN.md §4)**: HIGH per "feature works in degraded way" + "missing UI surfaces for tracked DB state" + operational-correctness CAPS-at-HIGH chain. Class-consistency with Pattern #20 ~20 surfaces (POSITIVE pattern WHEN PRESENT; F-09-008 is NEGATIVE-instance). Distinguished from F-09-010 UI-side gap (retain-split per Phase 5 + Phase 8 adjudication).

**Closes PI-15** — PI-15 HIGH partial → CLOSED fully-resolved via F-09-008 at batch-09. Canonical creation surface confirmed sole at L847 `is_credit_note: isCreditNote` per Phase 2 codebase-wide grep (1 write site, 4 read filters, 8 display sites). Closure-class concern = Pattern #20 multi-step-rollback gap; NOT a severity-adjustment event (HIGH from {MEDIUM, HIGH} ambiguous pre-tag).

**Phase C sprint candidate**: **S-33-process-term-adjustment-transaction-wrap** (wrap handleConfirm body in transaction OR move to RPC body with PL/pgSQL BEGIN...COMMIT; idempotency keys on step-3 + step-4 INSERTs).
**Decision needed**: Architectural — single transaction vs distributed-saga vs idempotency-key approach. Phase C sprint design.

#### F-09-011 — `term_continuation_runs` missing `audit_*` trigger

- **Severity**: **High** (no severity-adjustment event; HIGH selected from {MEDIUM, HIGH} ambiguous Phase 4 pre-tag = adjudication per §18)
- **Area**: DB schema / audit_log INSERT integrity class
- **Phase surfaced**: 4 (RLS + trigger audit)
- **Class anchor**: CC-19 #3 audit_log INSERT integrity gap + F-08-005 silent-swallow class neighbouring + operational-correctness CAPS-at-HIGH chain (events #2/#5/#6/#7/#8/#10/#11) + class-asymmetry with 3 sibling batch-09 tables having `audit_*` AFTER triggers
- **Severity rubric**: PLAN.md §4 HIGH — "missing UI surfaces for tracked DB state" (state-machine transitions not in audit_log) + operational-correctness CAPS-at-HIGH

**Evidence** (DB-verified via `pg_trigger` at HEAD `e9cffe8f...`):

`SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.term_continuation_runs'::regclass AND NOT tgisinternal;` returns **1 row only**:
- `set_tcr_updated_at` BEFORE UPDATE → `update_updated_at_column()` (for `updated_at` column maintenance)

**NO `audit_term_continuation_runs` AFTER INSERT OR DELETE OR UPDATE trigger.**

**Class-asymmetry comparison** (3 sibling batch-09 tables ALL have audit_* triggers):
- `terms`: `audit_terms` AFTER I/U/D → `log_audit_event_singular('term')` ✓
- `term_adjustments`: `audit_term_adjustments` AFTER I/U/D → `log_audit_event_singular('term_adjustment')` ✓
- `term_continuation_responses`: `audit_term_continuation_responses` AFTER I/U/D → `log_audit_event_singular('term_continuation_response')` ✓
- **`term_continuation_runs`: MISSING** ✗

**State-machine transition coverage** (per `term_continuation_runs.status` CHECK enum {draft, sent, partial, failed, reminding, deadline_passed, completed}):

| Transition | Trigger location | audit_log coverage |
|---|---|---|
| `draft → sent` | create-continuation-run/index.ts:1077 UPDATE | **UNAUDITED** ✗ |
| `sent → reminding` | create-continuation-run/index.ts:1254 UPDATE | **UNAUDITED** ✗ |
| `sent/reminding → partial/failed` | create-continuation-run/index.ts:1077 UPDATE | **UNAUDITED** ✗ |
| `sent/reminding → deadline_passed` | create-continuation-run/index.ts:1311-1316 UPDATE + manual audit_log INSERT at L1321-1332 + L1381-1388 | covered (manual) ✓ |
| `deadline_passed → completed` | bulk-process-continuation/index.ts:427-433 UPDATE | **UNAUDITED** (partial mitigation via L437-450 `continuation_run.processed` manual audit_log INSERT, but `status=completed` transition itself not audit-cited) |
| `created` (INSERT) | create-continuation-run/index.ts:206-220 INSERT + manual audit_log L339-350 | covered (manual) ✓ |

**Net: 3 of 7 state transitions audited via complementary mechanisms; 4 of 7 unaudited.**

**Forensic impact**:
- Which admin sent the run (status='sent' UPDATE): not in audit_log
- When and how reminding cadence advanced (status='reminding' UPDATE): not in audit_log
- Failure mode classification (status='partial'/'failed' UPDATE): not in audit_log
- Completion timing (status='completed' UPDATE in bulk-process): partially recoverable via `continuation_run.processed` action but not direct status-transition citation

**Mitigation references**:
- Partial-cron mitigation via manual audit_log INSERTs covers 3 transitions
- F-04-005 lesson_notes missing audit MEDIUM precedent diverges on mitigation completeness (F-04-005 had content-recoverable SECDEF accessor; F-09-011 has partial state-recoverable manual audits only)

**Severity reasoning (PLAN.md §4)**: HIGH per "missing UI surfaces for tracked DB state" + operational-correctness CAPS-at-HIGH chain + class-asymmetry with 3 sibling batch-09 tables (clear design intent to audit term-family tables; one is missing). 4-of-7 transition coverage gap = significant forensic blind spot. F-04-005 MEDIUM precedent diverges on mitigation completeness.

(Remediation observations relocated to §11 audit-method appendix per Phase 5 framing precision note.)

**Phase C sprint candidate**: **S-35-audit-term-continuation-runs-trigger** (add `CREATE TRIGGER audit_term_continuation_runs AFTER INSERT OR DELETE OR UPDATE ON term_continuation_runs FOR EACH ROW EXECUTE FUNCTION log_audit_event_singular('term_continuation_run')`; class-consistency restoration with 3 sibling tables).
**Decision needed**: No (class-consistency restoration; no design ambiguity).

### §6.3 MEDIUM (1)

#### F-09-009 — useCan unimplementation cohort (13 batch-09 mutation hooks)

- **Severity**: **Medium** (cohort presentation per Phase 5 + Phase 8 adjudication)
- **Area**: Frontend hook layer / FE-side permission gate class
- **Phase surfaced**: 3 (frontend surface audit)
- **Class anchor**: CC-19 useCan unimplementation class precedent (cumulative ≥198 post-s47 → ≥211 post-s48); class-consistency with batch-04 useCan instances tagged MEDIUM defence-in-depth
- **Severity rubric**: PLAN.md §4 MEDIUM — "minor UX dead-ends" (FE-layer permission gate missing; relies on RLS server-side)

**Evidence** (Phase 3 §4.8 — 13 mutation hooks WITHOUT useCan check):

| Hook | File:line | Mutation surface |
|---|---|---|
| useCreateTerm | [src/hooks/useTerms.ts:50](src/hooks/useTerms.ts:50) | INSERT terms |
| useUpdateTerm | [src/hooks/useTerms.ts:83](src/hooks/useTerms.ts:83) | UPDATE terms |
| useDeleteTerm | [src/hooks/useTerms.ts:110](src/hooks/useTerms.ts:110) | DELETE terms |
| useCreateContinuationRun | [src/hooks/useTermContinuation.ts:291](src/hooks/useTermContinuation.ts:291) | invoke create-continuation-run |
| useSendContinuationRun | [src/hooks/useTermContinuation.ts:334](src/hooks/useTermContinuation.ts:334) | invoke create-continuation-run (action=send) |
| useSendContinuationReminders | [src/hooks/useTermContinuation.ts:385](src/hooks/useTermContinuation.ts:385) | invoke create-continuation-run (action=send_reminders) |
| useProcessDeadline | [src/hooks/useTermContinuation.ts:426](src/hooks/useTermContinuation.ts:426) | invoke create-continuation-run (action=process_deadline) |
| useRespondToContinuation | [src/hooks/useTermContinuation.ts:469](src/hooks/useTermContinuation.ts:469) | UPDATE term_continuation_responses (admin override) + recalc_continuation_summary RPC |
| useBulkProcessContinuation | [src/hooks/useTermContinuation.ts:520](src/hooks/useTermContinuation.ts:520) | invoke bulk-process-continuation |
| useDeleteContinuationRun | [src/hooks/useTermContinuation.ts:743](src/hooks/useTermContinuation.ts:743) | DELETE term_continuation_runs |
| useUpdateContinuationResponse | [src/hooks/useTermContinuation.ts:779](src/hooks/useTermContinuation.ts:779) | UPDATE term_continuation_responses + recalc + manual logAudit |
| useTermAdjustmentPreview | [src/hooks/useTermAdjustment.ts:70](src/hooks/useTermAdjustment.ts:70) | invoke process-term-adjustment (action=preview) |
| useTermAdjustmentConfirm | [src/hooks/useTermAdjustment.ts:96](src/hooks/useTermAdjustment.ts:96) | invoke process-term-adjustment (action=confirm) |

**Compensating control** (Phase 4 RLS audit + Phase 2 edge fn audit):
- term_adjustments INSERT WITH CHECK `is_org_admin` + UPDATE USING `is_org_admin` (F-01-017 USING-only batch-19 carry)
- term_continuation_runs INSERT WITH CHECK + UPDATE USING + DELETE USING all `is_org_admin` (F-01-017 USING-only batch-19 carry)
- terms cmd=ALL `is_org_admin` (SAFE per PG inheritance)
- term_continuation_responses cmd=ALL `is_org_admin` (SAFE per PG inheritance)
- Edge fns: process-term-adjustment, bulk-process-continuation, create-continuation-run all gate role-IN(owner/admin) via org_memberships before invoking RPCs

**Severity reasoning (PLAN.md §4)**: MEDIUM per "minor UX dead-ends" — without useCan client-side gate, FE renders the mutation control (e.g., Delete button) even when the user lacks permission; the server-side RLS / edge-fn role-check rejects the mutation. User experience: button appears clickable but operation fails with "Not authorised" toast. RLS load-bearing for the security boundary; useCan is defence-in-depth UX hint.

**Magnitude factors**: RLS + edge-fn role-check = 2-layer compensating control (no exploit path; class-consistent with batch-04 useCan MEDIUM precedent).

**Phase C sprint candidate**: **S-12-usecan-cohort-batch-09** (add `useCan('terms:write')` / `useCan('continuation:write')` etc. gates to 13 mutation hook sites; conditional rendering of mutation UI in components).
**Decision needed**: No (mechanical; permission-name conventions already established in codebase).

### §6.4 LOW (4)

#### F-09-002 — `recalc_continuation_summary` anon-EXECUTE-grant-with-body-gate (CC-19 #1 hygiene)

- **Severity**: **Low** (CC-19 #1 hygiene class CAPS-at-LOW per precedent)
- **Area**: SECDEF RPC EXECUTE grants
- **Phase surfaced**: 1 (RPC body audit)
- **Class anchor**: CC-19 #1 helper-fn EXECUTE-grant hygiene
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift" + "minor docstring/API inconsistency"

**Evidence**:
- `routine_privileges` query returns 5 grants: PUBLIC + anon + authenticated + postgres + service_role
- Body L5-7 contains correct gate: `IF NOT is_org_staff(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Access denied'`
- Anon → `auth.uid()=NULL` → `is_org_staff(NULL, _org_id) = false` → exception ✓

**Class consistency**: anon EXECUTE grant + body-gate mitigation is hygiene-class drift (grant is negligent; exploit blocked by gate). Class CAPS-at-LOW per CC-19 #1 hygiene class precedent.

**Positive observation**: body-auth-gate canonical anon-block pattern (RPC layer) → **Pattern #36 ratified §8** (Phase 8 promotion; class kin to Pattern #10 dual-mode auth with explicit anon-reject branch).

**Phase C sprint candidate**: **S-36-grant-hygiene-sweep** (REVOKE EXECUTE ON FUNCTION recalc_continuation_summary FROM PUBLIC, anon; keep authenticated + service_role). Co-fix with F-09-003 helpers.
**Decision needed**: No.

#### F-09-003 — `continuation_run_org_id` + `user_has_continuation_response_in_run` info-disclosure INCIDENTAL (merged)

- **Severity**: **Low** (information-disclosure bounded INCIDENTAL per Phase 2 + Phase 5 adjudication)
- **Area**: SECDEF RPC EXECUTE grants on RLS helper functions
- **Phase surfaced**: 1 (RPC body audit); Phase 2 INCIDENTAL adjudication
- **Class anchor**: F-02-020 + F-05-007 + F-08-002 information-disclosure cross-tenant enumeration class
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift"

**MERGE rationale** (Phase 5 §5.3 decision): shared class shape (information-disclosure bounded), shared anchor (F-02-020 + F-05-007 + F-08-002), shared severity (LOW), shared remediation (REVOKE anon EXECUTE). Single finding F-09-003 covers both helpers; F-09-004 ID RELEASED (no batch-09 finding with that ID).

**Evidence**:

*`continuation_run_org_id(_run_id uuid)`*:
- SECDEF + STABLE + search_path=public; 1-line body: `SELECT org_id FROM public.term_continuation_runs WHERE id = _run_id;`
- EXECUTE grants: anon + authenticated + postgres + service_role
- Returns 1 UUID (org_id) given any run_id UUID; no PII

*`user_has_continuation_response_in_run(_user_id uuid, _run_id uuid)`*:
- SECDEF + STABLE + search_path=public; 7-line body: `SELECT EXISTS (SELECT 1 FROM term_continuation_responses tcr JOIN guardians g ON g.id = tcr.guardian_id WHERE tcr.run_id = _run_id AND g.user_id = _user_id);`
- EXECUTE grants: anon + authenticated + postgres + service_role
- Caller-parameterised `_user_id` (NOT auth.uid binding in body); returns 1 boolean per call

**Phase 2 structural-necessity adjudication (Phase 2 §3.4 + Phase 3 §4.6)**:
- Token-write path: continuation-respond:100 service-role adminClient bypasses RLS entirely; helpers NEVER invoked on write path
- Portal-read path: useParentContinuationPending uses authenticated supabase client → RLS policy invokes helper under authenticated role; anon EXECUTE grant NOT exercised
- Verdict: **INCIDENTAL** — anon EXECUTE grants are negligent hygiene; zero functional impact from REVOKE

**Magnitude factor**: bounded — 1 UUID OR 1 boolean per call; no PII; UUID brute-force infeasible.

**Class consistency**: information-disclosure bounded class (F-02-020 + F-05-007 + F-08-002 anchors); 4 anchors post-s48. Sub-class introduction (SELECT-list vs storage-path vs helper-RPC vs enumeration-via-helper) DEFERRED to batch-19 cohesion sweep §11.

**Phase C sprint candidate**: **S-36-grant-hygiene-sweep** (REVOKE EXECUTE ON FUNCTION continuation_run_org_id, user_has_continuation_response_in_run FROM anon). Co-fix with F-09-002.
**Decision needed**: No.

#### F-09-010 — TermAdjustmentWizard binary-state UI partial-failure invisibility (Pattern #20 UI-side gap)

- **Severity**: **Low** (Pattern #20 UI-side sub-class; magnitude factor for F-09-008)
- **Area**: Frontend wizard component / UI-side partial-failure surfacing
- **Phase surfaced**: 3 (frontend surface audit)
- **Class anchor**: Pattern #20 multi-step-write-rollback discipline UI-side sub-class; magnitude factor for F-09-008
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift" + "minor UX dead-ends"

**Evidence** (Phase 3 §4.7):

[TermAdjustmentWizard.tsx:482-505](src/components/term-adjustments/TermAdjustmentWizard.tsx:482) step='complete':
```tsx
{step === 'complete' && confirmResult && (
  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
    <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
    <p className="mt-2 font-medium text-primary">Adjustment confirmed!</p>
    <p className="text-sm text-muted-foreground mt-1">
      {confirmResult.cancelled_count > 0 && `${confirmResult.cancelled_count} lesson${...} cancelled`}
      {confirmResult.cancelled_count > 0 && confirmResult.created_count > 0 && ' · '}
      {confirmResult.created_count > 0 && `${confirmResult.created_count} new lesson${...} created`}
    </p>
    {confirmResult.credit_note_invoice_id && previewData && (...)}
  </div>
)}
```

Binary success/failure states only:
- **Success**: step advances to 'complete', shows counts + credit_note_invoice_id presence
- **Failure**: step stays at 'preview', generic toast "Adjustment failed" from hook onError (useTermAdjustment.ts:137-143)

**RETAIN-SPLIT rationale** (Phase 5 + Phase 8 adjudication): UI-side gap (TermAdjustmentWizard binary state) and edge-fn-side gap (process-term-adjustment 10+ sequential ops no transaction) have distinct remediation paths — UI changes vs server transaction wrap. Fix-sprint visibility benefits from explicit enumeration; reviewing-Claude Phase 3 + Phase 5 position accepted.

**Class consistency**: Pattern #20 UI-side observation; magnitude factor reinforces F-09-008 retry-amplification concern.

**Phase C sprint candidate**: **S-37-termadjustmentwizard-partial-failure-ui** (add partial-commit state to wizard; surface `failedStep` info from edge fn response; "Lessons cancelled but credit-note creation failed — retry safely?" guidance). Co-design with S-33 edge-fn transaction wrap.
**Decision needed**: UX design call (what message to show operator; recover-or-rollback path).

#### F-09-012 — financial-amount CHECK constraint cohort (4 columns; CC-19 #11)

- **Severity**: **Low** (CC-19 #11 cohort class CAPS-at-LOW per precedent)
- **Area**: DB schema / financial-column CHECK constraint hygiene
- **Phase surfaced**: 4 (RLS + trigger audit)
- **Class anchor**: CC-19 #11 financial-amount CHECK constraint cohort precedent (7 entries pre-s48: 5 negative batches 06+07 + 2 positive batches 05+08)
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift"

**Evidence** (Phase 4 §5.5 — `pg_constraint contype='c'` query at HEAD):

| Table.column | Expected CHECK | Status |
|---|---|---|
| term_adjustments.lesson_rate_minor | `> 0` (lesson rate can't be ≤ 0 business-semantically) | MISSING |
| term_adjustments.original_lessons_remaining | `>= 0` (count can't be negative) | MISSING |
| term_adjustments.new_lessons_count | `>= 0` when not null | MISSING |
| term_continuation_responses.next_term_fee_minor | `>= 0` when not null | MISSING |

**Exclusions from cohort** (appropriate semantics):
- term_adjustments.adjustment_amount_minor: ANY integer (positive=credit, negative=supplementary)
- term_adjustments.lessons_difference: ANY integer (positive=added, negative=removed)
- term_continuation_responses.reminder_count: bounded by app code (default 0; ambiguous business semantic)

**Class consistency**: CC-19 #11 cohort post-s48: 11 entries (9 negative + 2 positive). Defence-in-depth code-hygiene class; no exploitable impact when app code paths enforce invariants.

**Phase C sprint candidate**: **S-38-ci-positive-amount-check-batch-09** (ADD CHECK constraints on 4 columns; co-bundled with batch-06 + batch-07 cohort fixes via CI-enforced linting per CC-19 #11 declaration).
**Decision needed**: No.

---

## §7 Cross-batch reach

### §7.1 F-08-001 cross-batch reach LEGITIMATE at bulk-process-continuation:394

**Verdict**: LEGITIMATE caller hygiene. F-08-001 standalone CRITICAL stands (closed-batch immutability); NOT amplified by this caller.

**Evidence**: [bulk-process-continuation/index.ts:392-399](supabase/functions/bulk-process-continuation/index.ts:392):
```typescript
if (anyWithdrawalSucceeded) {
  await adminClient.rpc('cleanup_withdrawal_credits', {
    _student_id: resp.student_id,
    _org_id: body.org_id,
    _effective_date: body.next_term_start_date,
  });
}
```

**Caller hygiene 5-layer defence-in-depth**:
1. L64-67 bearer auth required
2. L77-88 userClient.auth.getUser(token) explicit JWT verification
3. L117-124 role-IN(owner/admin) check via org_memberships
4. L135-138 rate limit
5. L141-150 run-belongs-to-org verification

**Param validation**:
- `_student_id`: from validated responses rowset (L164-170 already scoped to body.run_id + body.org_id)
- `_org_id`: validated against user's org_memberships at L117-124
- `_effective_date`: server-side date input

**Gate before invocation**: `if (anyWithdrawalSucceeded)` at L393 — only fires after per-iteration process-term-adjustment success (which internally re-validates).

**POSITIVE caller-hygiene observation** → Pattern #31 ratified §8 (5-layer defence-in-depth pattern).

### §7.2 F-09-001 cross-batch reach LEGITIMATE at bulk-process-continuation:262-273

**Verdict**: LEGITIMATE caller hygiene. F-09-001 standalone CRITICAL stands (via direct anon invocation); NOT amplified by this caller.

**Evidence**: [bulk-process-continuation/index.ts:262-273](supabase/functions/bulk-process-continuation/index.ts:262):
```typescript
const { data: matResult, error: matError } = await adminClient.rpc(
  "materialise_continuation_lessons",
  {
    p_org_id: body.org_id,
    p_recurrence_id: lesson.recurrence_id,
    p_student_id: resp.student_id,
    p_from_date: oldEndDate,
    p_to_date: body.next_term_end_date,
    p_rate_minor: lesson.rate_minor ?? null,
    p_created_by: userId,
  }
);
```

**Caller hygiene**:
- Client = `adminClient` (service-role at L114)
- All params server-derived from validated context (`resp` + `lesson` from validated rowset; `userId` from validated user)
- Same 5-layer defence-in-depth gates as §7.1

**POSITIVE caller-hygiene observation** — F-09-001 magnitude NOT amplified by this caller; the exploit path is direct anon-rpc invocation, bypassing this caller entirely.

---

## §8 Positive Pattern catalog additions

### §8.1 Pattern catalog table post-s48

| # | Title | Status post-s48 | Anchor evidence | Class kinship |
|---|---|---|---|---|
| #1-#25 | (existing placed patterns; verbatim from prior batches per closed-batch immutability) | **placed** | (verbatim) | (verbatim) |
| **#26** | log-shape table protection cohort | **candidate** (deferred to batch-19) | s46 candidate; batch-08 NEGATIVE sweep; +0 batch-09 evidence | TBD batch-19 full-schema sweep |
| **#27** | hook-mediated supabase access discipline | **placed** (ratified s48; sub-class A authenticated + sub-class B unauth-token architectural-exception) | s47 candidate + batch-09 reinforcement (Continuation.tsx + 8 hooks delegate via abstractions); NEGATIVE-instance at PortalContinuation.tsx:71 reclassed as sub-class B architectural-exception (unauth token flow) | discipline-of-consistency class |
| **#28** | shadow-mode interception (Lauren Shadow programme) | **placed** (ratified s48) | s47 candidate + batch-09 reinforcement (`transformEmailForShadow` called at create-continuation-run:1024 + :1221; usage discipline correct independent of F-09-006 typo) | shadow-programme operational-correctness POSITIVE; batch-19 full-codebase enumeration target |
| **#29** | caller-RLS-respecting view `security_invoker=on` | **candidate** (deferred to batch-19) | s47 candidate; +0 batch-09 evidence | TBD batch-19 full-schema view sweep |
| **#30** | Trigger-level structurally-complete daterange-overlap exclusion | **placed** (ratified s48) | `check_term_overlap` body Phase 4 §5.2 (SECDEF + search_path + `daterange(start, end, '[]') &&` operator complete coverage + self-row exclusion + user-friendly error message) | class kin to Pattern #14 trigger-level guard; structurally distinct from F-03-004 partial-coverage class |
| **#31** | 5-layer defence-in-depth before sensitive cross-batch RPC invocation | **placed** (ratified s48) | bulk-process-continuation/index.ts:64-150 (bearer + getUser + role-IN + rate-limit + entity-scope-verification before cleanup_withdrawal_credits at :394) | class kin to Pattern #24 finance-team-gated SECDEF stacking + Pattern #9 dual-mode auth |
| **#32** | Dual-surfacing of operational-correctness signals | **placed** (ratified s48) | Continuation.tsx:713-725 pre-process preview dialog (`bulkPreview.conflicts` list in AlertDialog) + useTermContinuation.ts:585-593 post-process destructive toast | class-novel; operator-visible defence-in-depth surfacing pattern |
| **#33** | Realtime channel + invalidation discipline | **placed** (ratified s48) | useTermContinuation.ts:183-207 postgres_changes subscription + queryClient.invalidateQueries on event | class-novel; staff-sees-parent-event-immediately operational-correctness POSITIVE |
| **#34** | 42P01 graceful-degradation pattern | **candidate** (deferred post-launch; tech-debt-borderline) | useTermContinuation.ts 4 sites (L133-138, L164-167, L231-233, L275-278) `if (error.code === '42P01') return [];` | class-novel; deploy-window resilience; revisit post-launch when migrations stabilise |
| **#35** | Explicit `=== Bearer ${serviceRoleKey}` cron equality | **placed** (ratified s48) | create-continuation-run:432 `if (authHeader !== \`Bearer ${serviceRoleKey}\`)` | distinct sub-shape B of CC-19 #14 misnaming class; intended POSITIVE at edge-fn layer (vs sub-shape A `auth.uid() IS NOT NULL` negative-in-practice) |
| **#36** | RPC body-auth-gate canonical anon-block | **placed** (ratified s48) | recalc_continuation_summary RPC body L5-7 `IF NOT is_org_staff(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Access denied'` | class kin to Pattern #10 dual-mode auth with explicit anon-reject branch (RPC-layer extension) |

### §8.2 Counts post-Phase-8

- **Placed Patterns: 33** (25 pre-s48 + 2 s47 ratified [#27 + #28] + 6 s48 ratified [#30, #31, #32, #33, #35, #36])
- **Candidate Patterns: 3** (#26 batch-19 carry + #29 batch-19 carry + #34 post-launch revisit)
- **NEGATIVE-instance sub-class flag: 1** (Pattern #27 sub-class B at PortalContinuation:71 architectural-exception)
- **Sub-class introduction deferrals: 2** (Information-disclosure 4-anchor + TS-bypass-cast Sub-pattern C; both batch-19 flagged)

---

## §9 PI status

### §9.1 PI closures at batch-09

#### PI-13 CRITICAL → CLOSED-fully via F-09-007 HIGH (event #12)

- **Owning batch**: 09-term-continuation (canonical) + 19-cross-cutting (residual class sweep, NOT PI continuation)
- **Canonical surface**: [process-term-adjustment/index.ts:735](supabase/functions/process-term-adjustment/index.ts:735) `setUTCHours(hours, minutes, 0, 0)` ignoring `origRecurrence?.timezone` fetched at L622 (line position drifted from s38 PI-13 cite L720 → L735 at HEAD `e9cffe8f...`)
- **Closure finding**: F-09-007 HIGH
- **Severity-adjustment event**: #12 (CRITICAL pre-tag via PI-13 → HIGH adjudicated; class-precedent reassessment driver type)
- **Class-precedent anchor**: PI-17 class shape (UTC-based time arithmetic ignoring org timezone) + operational-correctness CAPS-at-HIGH chain (kinship to events #2/#5/#6/#7/#8/#10/#11)
- **FE confirmation**: TermAdjustmentWizard:343-349 input no-TZ-affordance + PortalContinuation:337 output UTC-substring no-TZ-label = end-to-end timezone-naive pipeline
- **Composition probe**: No path to financial-falsification CRITICAL bracket (Phase 2 + Phase 3 confirmed bounded to edge-case day-boundary mis-classification)
- **Residual**: Cross-cutting timezone class sweep at batch-19 per snapshot §12 "batch 09 + 19" notation — batch-19 side is class-sweep work, NOT continuation of PI-13. PI-13 itself closes at this batch.
- **PI register transition**: Active → CLOSED-fully

#### PI-15 HIGH (partial) → CLOSED fully-resolved via F-09-008 HIGH

- **Owning batch**: 09-term-continuation (canonical)
- **Canonical surface**: [process-term-adjustment/index.ts:847](supabase/functions/process-term-adjustment/index.ts:847) `is_credit_note: isCreditNote` — sole site for `is_credit_note=true` invoice creation (Phase 2 codebase-wide `grep -nrE "is_credit_note" supabase/functions/ src/` verification: 1 write site, 4 read filters, 8 display sites)
- **Closure finding**: F-09-008 HIGH
- **Closure-class concern**: Pattern #20 multi-step-write-rollback gap (handleConfirm 10+ sequential ops no transaction wrap; retry-amplification produces duplicates on step-3/step-4 failure)
- **Severity-adjustment event**: None (F-09-008 HIGH selected from {MEDIUM, HIGH} ambiguous Phase 2 pre-tag = adjudication per §18 methodology, NOT event)
- **Class-precedent anchor**: Pattern #20 ~20 cumulative active surfaces post-s48 + F-04-003 + F-05-002 cascade-completeness-asymmetry class neighbouring + operational-correctness CAPS-at-HIGH chain + PI-15 inherited HIGH severity
- **Prior-batch closure track**: batch-03 side closed s42 (cancel flow no credit-note invocation); batch-05 side closed s44 (rendering-only); batch-09 canonical closure
- **PI register transition**: Active-partial → CLOSED-fully

### §9.2 PI carry-forwards (Active, unchanged)

| PI | Severity | Owning batch | Pre-s48 | Post-s48 | Carry-forward note |
|---|---|---|---|---|---|
| PI-01 | CRITICAL | 10 (reports-analytics-payroll) | Active | Active | Batch-10 owns; no batch-09 touch |
| PI-09 | HIGH | 19 (cross-cutting) | Active — cohort enriched s47 via F-08-003 phantom-RPC sub-class | Active | **No batch-09 cohort enrichment** — F-09-005 hypotheses (a) phantom + (b) helper + (c) absent-CENSUS ALL refuted at Phase 2 (`generate_credit_note` = HTTP request body BOOLEAN at L25+L779). Batch-19 owns sweep |
| PI-10 | HIGH | 15 + 18 (calendar-sync + settings-tabs; Zoom sub-deferred) | Active | Active | Batches 15+18 own |
| PI-12 | CRITICAL | 17 (loopassist) | Active | Active | Batch-17 owns |
| PI-16 | HIGH | 17 (loopassist) | Active | Active | Batch-17 owns |
| PI-17 | MEDIUM | 08 + 19 (partial) | Active — batch-19 carry | Active | Cross-cutting timezone class carry to batch-19 is class-consistency continuation, NOT PI re-opening |

### §9.3 Cohort transition

**Pre-s48**: 8 (3C/4H/1M/0L) — PI-01 + PI-12 + PI-13 (Critical) + PI-09 + PI-10 + PI-15-partial + PI-16 (High) + PI-17 (Medium)

**Post-s48**: **6 (2C/3H/1M/0L)** — PI-01 + PI-12 (Critical) + PI-09 + PI-10 + PI-16 (High) + PI-17 (Medium)

**Delta**: -2; -1C/-1H/0M/0L. Arithmetic verified: 8-2=6 ✓; per-bracket 3C-1=2C ✓, 4H-1=3H ✓, 1M+0L unchanged ✓.

### §9.4 STATUS.md PI register update projection (Phase 10 commits)

PI-13 row update (Phase 10 STATUS.md commit; PI-13 STATUS.md Severity field preservation per Phase 7 EXIT review):

| Field | Proposed |
|---|---|
| ID | PI-13 |
| Severity | **Critical** (preserved per PI-11 → F-03-004 precedent; re-classification in Status only) |
| One-liner | `process-term-adjustment/index.ts:720` parses `new_time` with `setUTCHours()` — no `fromZonedTime` (verbatim) |
| Evidence | (verbatim from original entry) |
| Target batch | 09-term-continuation + 19-cross-cutting-timezones |
| Status | **RESOLVED — re-classified as F-09-007 HIGH in batch 09. Severity adjusted Critical → HIGH on class-precedent reassessment (PLAN.md §4 anchor: PI-17 class shape match — UTC-based time arithmetic ignoring org timezone — + operational-correctness class CAPS-at-HIGH; s44 events #5-#7 + s45 event #8 + s46 event #10 + s47 event #11 precedent chain). Severity-adjustment event #12. Phase 2 RPC body audit confirms process-term-adjustment:735 setUTCHours ignores origRecurrence.timezone fetched at L622 (line position drifted s38 L720 → HEAD L735); Phase 3 FE walk confirms TermAdjustmentWizard:343-349 input no-TZ-affordance + PortalContinuation:337 output UTC-substring no-TZ-label = end-to-end timezone-naive pipeline. Composition probe ruled out financial-falsification CRITICAL bracket (bounded to edge-case day-boundary mis-classification only). Cross-cutting timezone class sweep at batch-19 is class-consistency continuation NOT PI re-opening. Phase C sprint candidate: S-32-timezone-correctness-process-term-adjustment.** |
| Re-verification session | s48 |

PI-15 row update (Phase 10 STATUS.md commit):

| Field | Proposed |
|---|---|
| ID | PI-15 |
| Severity | High (unchanged) |
| One-liner | (verbatim) |
| Evidence | (verbatim) |
| Target batch | 03-calendar-core + 05-billing-invoicing → **09-term-continuation** |
| Status | **RESOLVED — fully-resolved at batch-09 s48 via F-09-008 HIGH. Severity unchanged HIGH. Canonical creation surface confirmed sole at process-term-adjustment:847 `is_credit_note: isCreditNote` per Phase 2 codebase-wide grep verification (1 write site, 4 read filters, 8 display sites). Closure-class concern is Pattern #20 multi-step-write-rollback gap: handleConfirm 10+ sequential ops no transaction wrap; retry-amplification produces duplicate invoices/lessons on step-3 (recurrence + lessons + participants INSERT) or step-4 (invoices + invoice_items INSERT) failure (no idempotency check; step 2 cancel/delete/cap is idempotent). NOT a severity-adjustment event (F-09-008 HIGH selected from {MEDIUM, HIGH} ambiguous pre-tag per §18 methodology). Batch-03 side closed s42 (cancel flow no credit-note invocation); batch-05 side closed s44 (rendering-only); batch-09 canonical closure. Phase C sprint candidate: S-33-process-term-adjustment-transaction-wrap.** |
| Re-verification session | s48 (batch-09 canonical closure) |

---

## §10 Class-pattern contributions + class-consistency notes

### §10.1 Class-pattern register refresh (24 rows)

| Class | Pre-s48 status | + batch-09 | Post-s48 |
|---|---|---|---|
| Parameter-spoofing / CC-19 #6 | ~48 instances | +1 (materialise via F-09-001) | ~49 instances |
| PERMISSIVE-intended-as-RESTRICTIVE / CC-19 #13 | 5 instances bifurcated | +0 | 5; POSITIVE batch-09 |
| Multi-step-write-rollback / Pattern #20 | ~18 active | +2 (F-09-008 + F-09-010) | ~20 active |
| TS-bypass-cast Sub-A literal / CC-19 #7 | ≥352 raw | +24 (6 edge fn + 18 FE) | ≥376 raw |
| TS-bypass-cast Sub-A Sub-pattern C | (subset) | +6 (create-continuation-run nested-join) | batch-19 cohesion flag |
| TS-bypass-cast Sub-D1 helper-param | (snapshot count; 8 _shared/ counted prior) | +0 | unchanged |
| TS-bypass-cast Sub-D2 + Sub-D3 | (snapshot count) | +0 | unchanged |
| useCan unimplementation / CC-19 useCan | ≥198 sites | +13 (F-09-009 cohort) | ≥211 sites |
| Single-trigger-incomplete-DiD | (snapshot count) | +0 | unchanged |
| Fire-and-forget-by-design | ~18 instances | +0 | unchanged |
| audit_log INSERT integrity gap / CC-19 #3 | post-s47 positive carry | **+1 negative** (F-09-011) | mixed-with-negative-instance |
| Generated-types pipeline drift / CC-19 #7 | post-s47 +1 STALE | +0 (F-09-005 closed as request-body-boolean) | unchanged |
| E2E fixture hygiene / CC-19 #8 | 5 failed / 3 unhandled rejections | +0 (delta 0) | unchanged batch-19 carry |
| Column-level-privacy-bypass | 2 anchors | +0 | unchanged |
| Cascade-completeness-asymmetry | 1 anchor + 1 escalation + 1 POSITIVE sub-class C | +0 (F-04-003 re-confirmation only) | unchanged |
| Silent-query-error → empty-state masquerade | ≥59 sites | +0 (42P01 class-distinct) | unchanged |
| Information-disclosure cross-tenant enumeration | 3 anchors | +1 (F-09-003 merged) | 4 anchors |
| Sentry edge-fn instrumentation gap / CC-19 #10 | ~8 instances | +0 (POSITIVE 4/4 wrapped) | unchanged; POSITIVE observation |
| Schema column constraint hygiene / CC-19 #11 | Cohort 7 entries (5 neg + 2 pos) | +4 negative (F-09-012) | Cohort 11 (9 neg + 2 pos) |
| Claimed-service-role-gate misnaming / CC-19 #14 | 2 anchors | +0 (POSITIVE Pattern #35 distinct sub-shape B) | unchanged; class-distinct positive observation |
| Dead-code SECDEF + orphan trigger fns / CC-19 #15 | 4 instances | +0 | unchanged |
| Silent-swallow / silent-failure-modes anchor | 8 chain instances | +1 (F-09-006) | 9 chain instances |
| Phantom-RPC migration-replay-drift / s47 sub-class | 1 anchor (F-08-003) | +0 (F-09-005 hypotheses refuted) | unchanged |
| F-01-017 UPDATE-policy-no-explicit-WITH-CHECK | (batch-19 sweep target) | +2 batch-19 carry (term_adjustments + term_continuation_runs UPDATE) | +2 batch-19 instances |
| F-07-003 NULL-actor / zero-UUID magnitude | (snapshot count) | +1 class-consistency note | +1 note (no finding) |

### §10.2 Class-consistency notes (no findings)

**1. F-01-017 UPDATE-policy-no-explicit-WITH-CHECK** (+2 batch-09 instances; batch-19 carry):
- `term_adjustments.UPDATE` policy "Admins can update term adjustments" — polcmd='w', USING `is_org_admin(...)`, polwithcheck=NULL (Phase 4 §5.1)
- `term_continuation_runs.UPDATE` policy "Org admins can update continuation runs" — polcmd='w', USING `is_org_admin(...)`, polwithcheck=NULL (Phase 4 §5.1)
- `terms` cmd=ALL "Admin can manage terms" policy NOT F-01-017 class (cmd=ALL inherits USING per PG semantics; SAFE shape)
- Batch-19 owning per closed-batch immutability + batch-19 cohesion sweep target.

**2. F-07-003 NULL-actor magnitude class-consistency**:
- continuation-respond/index.ts:100 service-role adminClient → AFTER trigger `audit_term_continuation_responses` fires with `auth.uid()=NULL` → `log_audit_event_singular` records `actor_user_id = COALESCE(NULL, '00000000-0000-0000-0000-000000000000')` zero-UUID
- Pre-launch 0 rows in audit_log for `entity_type='term_continuation_responses'`; structural concern stands
- Partial forensic recoverability via `guardian_id` + `response_token` columns
- Class-consistency carry per s47 F-07-003 magnitude-not-bracket precedent; no new finding.

**3. F-04-003 dedup-ABSENT re-confirmation at HEAD `e9cffe8f...`**:
- `materialise_continuation_lessons` body L98-127: lessons INSERT has no ON CONFLICT
- `lessons_pkey UNIQUE(id)` only; unique_violation arm L124-126 DEAD CODE for lessons INSERT
- lesson_participants has ON CONFLICT (lesson_id, student_id) DO NOTHING (idempotency for retries)
- Closed-batch immutability holds; class-consistency note only.

**4. F-08-001 cross-batch reach LEGITIMATE** (§7.1):
- bulk-process-continuation/index.ts:394 invokes cleanup_withdrawal_credits via adminClient service-role with 5-layer defence-in-depth caller-validated params
- F-08-001 standalone CRITICAL stands; NOT amplified.

**5. F-09-001 cross-batch reach LEGITIMATE** (§7.2):
- bulk-process-continuation/index.ts:262-273 invokes materialise_continuation_lessons via adminClient service-role with all-server-derived params
- F-09-001 standalone CRITICAL via direct anon invocation stands; NOT amplified.

**6. `terms` updated_at column/trigger asymmetry**:
- 3 sibling batch-09 tables (term_adjustments + term_continuation_responses + term_continuation_runs) have `updated_at` column + `set_*_updated_at` BEFORE UPDATE triggers
- `terms` table has no updated_at column or trigger
- Time-of-last-modification recoverable via `audit_terms` AFTER UPDATE trigger; not a strict gap
- Class-consistency observation only.

**7. `terms` start_date<=end_date implicit-via-daterange**:
- No explicit CHECK constraint on terms.start_date <= terms.end_date
- Implicitly prevented at trigger level via `daterange(start_date, end_date, '[]')` constructor in `check_term_overlap` body, which raises PG SQLSTATE 22000 on inverse ranges
- Generic PG range error message ("range lower bound must be less than or equal to range upper bound") surfaces via useTerms.ts:73-75 onError raw `error.message` — NOT user-friendly "start date must be before end date"
- UX-class observation; data invariant IS enforced (just with generic error message).

### §10.3 CC-19 cross-cutting carries entering batch-10

9 active carries with batch-09 contributions:

| CC-19 # | Description | Batch-09 contribution | Status |
|---|---|---|---|
| #1 | Helper-fn EXECUTE-grant hygiene | +1 (F-09-002 anon+PUBLIC grant despite body-gate) | active |
| #3 | audit_log INSERT integrity gap | +1 negative (F-09-011) | active |
| #6 | Org-context spoofing systematic sweep | +1 (F-09-001); cumulative ~49 | active |
| #7 | Generated-types pipeline drift CI gate | +0 (F-09-005 closed as boolean) | active |
| #8 | E2E fixture hygiene | +0 (delta 0) | active |
| #10 | Sentry edge-fn instrumentation gap | +0 (POSITIVE 4/4 wrapped) | active |
| #11 | CI-enforced positive-amount CHECK | +4 negative (F-09-012) → cohort 11 | active |
| #14 | claimed-service-role-gate misnaming | +0 (POSITIVE Pattern #35 sub-shape B) | active |
| #15 | dead-code SECDEF + orphan trigger fns | +0 | active |

---

## §11 Audit-method appendix

### §11.1 Severity-adjustment events through s48 (12 cumulative)

| # | Event | Direction | Reasoning |
|---|---|---|---|
| 1 | PI-08 → F-02-005 (s41) | HIGH ↑ CRITICAL | No `auth.uid()` in record_stripe_payment; financial-falsification class |
| 2 | PI-11 → F-03-004 (s42) | Critical ↓ HIGH | Operational-correctness CAPS-at-HIGH; check_lesson_conflicts 2-of-7 |
| 3 | F-04-002 (s43) | HIGH unchanged | Regression-class support; no customer-facing marketing anchor |
| 4 | F-04-004 (s43) | HIGH unchanged | Intent-ambiguity; closed-batch immutability holds |
| 5 | PI-02 → F-05-003 (s44) | Critical ↓ HIGH | "Missing UI for tracked DB state"; operational-correctness CAPS |
| 6 | PI-03 → F-05-004 (s44) | Critical ↓ HIGH | "Silent failure modes"; cached-value drift recoverable |
| 7 | PI-04 → F-05-005 (s44) | Critical ↓ HIGH | "Silent failure modes"; banner-surface partial mitigation |
| 8 | PI-05 → F-06-005 (s45) | Critical ↓ HIGH | "Missing UI for tracked DB state" + operational-correctness CAPS |
| 9 | F-06-001 mid-session (s45) | (Phase 3 MEDIUM/HIGH) ↑ CRITICAL (Phase 5) | F-06-003 composition discovery shifted bracket via composition chain |
| 10 | F-07-003 mid-session (s46) | (Phase 3 HIGH operational) ↑ CRITICAL (Phase 3 composition) | Composition chain with F-02-005 + F-07-001 anchors |
| 11 | F-08-003 mid-session Phase 5 (s47) | (Phase 2 CRITICAL tag) ↓ HIGH (Phase 5 class-precedent reassessment) | F-01-001 anchor REFUTED via 6-dimension class-shape comparison → class-divergent; PI-09 HIGH anchor adopted; operational-correctness CAPS chain; class-precedent reassessment driver type |
| **12** | **F-09-007 (s48) PI-13** | **(Phase 2 CRITICAL pre-tag via PI-13) ↓ HIGH (Phase 5 class-precedent reassessment)** | **PI-17 class shape match (UTC-based time arithmetic ignoring org timezone, end-to-end at edge-fn:735 + FE input + FE output); operational-correctness CAPS-at-HIGH chain (kinship to events #2/#5/#6/#7/#8/#10/#11); no composition path to financial-falsification CRITICAL per Phase 2 composition probe + Phase 3 FE evidence (timezone-naive end-to-end pipeline, no financial cross-period mis-classification beyond edge-case day-boundary). Driver type: class-precedent reassessment (kinship to s44 events #5-#7 PI-02/03/04 Critical ↓ HIGH chain).** |

### §11.2 Non-events (within-bracket adjudications) for transparency

- F-09-008 HIGH selected from {MEDIUM, HIGH} ambiguous Phase 2 pre-tag = adjudication NOT event
- F-09-011 HIGH selected from {MEDIUM, HIGH} ambiguous Phase 4 pre-tag = adjudication NOT event
- F-09-006 HIGH new finding starting + adjudicated within bracket = adjudication
- F-09-009 MEDIUM + F-09-010 LOW + F-09-012 LOW within-bracket adjudications

### §11.3 Cumulative methodology entries through s48: 28

Per s47-close snapshot + Phase 0 ratification of drifts #25 + #26: **26 Category 1 reviewing-Claude origin drifts + 1 Category 2 environment caveat + 1 Category 3 CC-origin drift = 28 total**.

s48 Phase 0 ratified:
- **#25 Phase 10 commit pattern**: SHA-embed-via-amend (s47 refinement of s46 placeholder precedent) broke at s47 close; revert to s46 placeholder pattern. Operator MUST leave literal `<sNN Phase 10 commit SHA>` placeholders in handover snapshot §2/§4/§21 + record actual post-commit SHA externally. Evidence: s47-close handover snapshot §2/§4/§21 embed orphan `daa360f0...` while actual post-amend HEAD is `e9cffe8f...`.
- **#26 Placeholder count discipline**: before substitution operations, run `grep -c "<sNN Phase 10 commit SHA>"` on snapshot file; verify count matches reviewing-Claude's stated N; halt on mismatch.

No new s48-origin methodology drifts logged across Phases 1-9.

### §11.4 F-09-011 remediation-class note (relocated from §6 per Phase 5 framing precision)

F-09-011 HIGH bracket is anchored by load-bearing pieces: 4-of-7 transitions unaudited + class-asymmetry with 3 sibling batch-09 tables having `audit_*` triggers + operational-correctness CAPS-at-HIGH chain.

**Remediation observation** (not part of severity adjudication; relocated here per Phase 5 EXIT review): the fix-class is class-consistency restoration via one-line migration adding `CREATE TRIGGER audit_term_continuation_runs AFTER INSERT OR DELETE OR UPDATE ON term_continuation_runs FOR EACH ROW EXECUTE FUNCTION log_audit_event_singular('term_continuation_run')`. Phase C sprint S-35.

### §11.5 Class-pattern register methodology

Per s47 process refinement: pattern catalog promotions / sub-class introductions surface at the prior phase's EXIT for paste-back review BEFORE doc-write phase. CC's Phase 8 EXIT report enumerates 11 candidate adjudications (4 s47 + 7 s48) with reviewing-Claude concurrence on all. Doc-09 §8 incorporates the final pattern catalog table verbatim.

### §11.6 Baseline test delta (Phase 0)

- Pre-s48 baseline: 5 failed / 3 unhandled rejections (E2E fixture hygiene class; CC-19 #8 carry to batch-19)
- Post-s48 baseline: same 5 failed / 3 unhandled rejections
- **Delta: 0**. CC-19 #8 carry preserved.

### §11.7 Hard-rule compliance summary

- `apply_migration` calls Phase B 100% cumulative: **0** at s48
- Secret echo / log: **0** instances across all phases
- Closed-batch immutability (findings 01-08 + prior placed Patterns #1-#25 + prior PI entries): **0 modifications**
- Severity adjudications locked at Phase 5: yes (Phase 6-9 did NOT re-open)
- Pattern catalog locked at Phase 8: yes (Phase 9 incorporates Phase 8 table verbatim)
- Drift #25 placeholder pattern: applied at §12 EXIT marker (literal placeholder; SHA recorded externally Phase 10)
- Drift #26 placeholder count discipline: applied Phase 10 dispatch

---

## §12 EXIT certification

**Batch 09 — Term Continuation: CLOSED at s48 (2026-05-14).**

| Field | Value |
|---|---|
| HEAD pin | `<s48 Phase 10 commit SHA>` |
| Total findings landed | **10** (1C/4H/1M/4L) |
| Finding IDs | F-09-001, F-09-002, F-09-003 (merged), F-09-006, F-09-007, F-09-008, F-09-009, F-09-010, F-09-011, F-09-012 |
| Released IDs (not issued) | F-09-004 (merged into F-09-003), F-09-005 (verification-only, no finding) |
| PI closures | PI-13 CRITICAL → F-09-007 HIGH (event #12); PI-15 HIGH partial → F-09-008 HIGH (canonical) |
| PI cohort transition | 8 → 6 (-1C / -1H / 0M / 0L) |
| Cumulative tally projection | 126 → **134** (18C / 40H / 25M / 51L); arithmetic verified per drift #27 cumulative-tally-arithmetic-at-PI-closures correction (PI cohort -2 brackets PI-13 CRITICAL + PI-15 HIGH closures; batch-09 +10 findings; net +8 by bracket 0C/+3H/+1M/+4L) |
| Methodology drifts (s48-origin) | Drift #27 candidate: cumulative tally arithmetic at PI closures (kin to s45 drift #7); pending s49 Phase 0 ratification → cumulative methodology 28 → 29 |
| Class-pattern register | 33 placed Patterns + 3 candidates (#26, #29, #34) + 1 NEGATIVE-instance sub-class flag (Pattern #27 sub-class B) |
| Severity-adjustment events cumulative | **12** (s48 +1 event #12 F-09-007 PI-13 CRITICAL ↓ HIGH) |
| Methodology entries cumulative | **28** (26 Cat 1 + 1 Cat 2 + 1 Cat 3; s48 ratified #25 + #26 at Phase 0; no new s48-origin drifts) |
| Baseline test delta | **0** (5 failed / 3 unhandled rejections — CC-19 #8 carry to batch-19) |
| CC-19 cross-cutting carries entering batch-10 | 9 active (#1, #3, #6, #7, #8, #10, #11, #14, #15) |
| Audit-only mode | preserved throughout 10 phases |
| Banner | AUDIT IN PROGRESS — DO NOT FIX YET |

**Doc structural completeness**: §1 Surface inventory through §12 EXIT certification — 12 sections verified.

**Confidence (overall)**: **High** across all 10 phases (DB-evidence coverage High; filesystem coverage High; class-precedent rigour High; framing precision items applied per Phase 5 + Phase 7 EXIT review).

---

*Closed-batch immutability now applies: finding IDs F-09-001..F-09-012, severities, batch attributions, and Phase 8 pattern catalog ratifications are immutable post-Phase-10 commit.*
