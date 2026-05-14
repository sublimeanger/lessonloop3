# Batch 08 — Attendance + Make-Up Credits + Waitlists

**Session**: s47
**Date**: 2026-05-14
**HEAD pin**: 7bdea67e
**Status**: CLOSED
**Findings allocated**: 10 (2C / 3H / 0M / 5L)

---

## §1 Allocation summary

| ID | Severity | Surface | Class anchor | Rubric anchor | Composition / mitigation notes |
|---|---|---|---|---|---|
| F-08-001 | **CRITICAL** | `public.cleanup_withdrawal_credits` SECDEF + zero body auth + anon EXECUTE — mass-voids credits + cancels waitlist for `(_student_id, _org_id, _effective_date)` parameters | F-02-005 closed batch-02 CRITICAL anchor (parameter-spoofing class) + F-07-003 closed batch-07 CRITICAL anchor (financial-falsification 2-fn composition class) | PLAN.md §4 CRITICAL: "security exposure" + "financial loss" (credit-voiding = removal of legitimate financial liability from org books) | Standalone CRITICAL — no composition needed. `audit_log` INSERT compensates with zero-UUID actor fallback per `COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000')`; partial forensic recoverability; class bracket unchanged per s46 F-07-003 class-consistency precedent (audit_invoice_installments AFTER ROW trigger forensic visibility did NOT downgrade CRITICAL). Side-channel disclosure of `_student_id` UUID is primary realistic vector. The exploit-path does not traverse RLS at all (SECDEF bypass); Phase 3 read-side robustness does not mitigate. |
| F-08-002 | **CRITICAL** | `public.find_waitlist_matches` SECDEF + zero body auth + anon EXECUTE — returns child + guardian PII (student_name + guardian_name + guardian_email + missed_lesson_title + missed_lesson_date) for any `(_lesson_id, _absent_student_id, _org_id)` triple | F-02-002 closed batch-02 CRITICAL anchor (cross-tenant child-PII exfiltration; GDPR Art 9 + Art 33 ICO-notifiable under Lauren shadow volume) | PLAN.md §4 CRITICAL: "security exposure" + "data loss" (PII exfiltration) | Standalone CRITICAL — same class as F-02-002 anchor. Bounded `LIMIT 10` + `_lesson_id`-required scope is magnitude factor (paginates attack), NOT class-modifier; bracket unchanged per s44 events #2-#7 + F-02-002 class-consistency precedent. Side-channel disclosure of `_lesson_id` UUID is primary realistic vector (UUID brute-force infeasible). SECDEF bypasses RLS by definition; Phase 3 read-side robustness does not mitigate. |
| F-08-003 | **HIGH** (event #11 ↓) | `public.void_make_up_credit` phantom RPC: types.ts:7418 + `useMakeUpCredits.ts:163` FE callsite via `(supabase.rpc as any)` cast + migration `20260316260000_fix_voided_credits_audit.sql:203-206` CREATE labelled "CRD-C4 CRITICAL" + NO DROP migration + **NOT in pg_proc** | PI-09 HIGH anchor (migration-replay-safety class; migration history doesn't match live schema) + operational-correctness CAPS-at-HIGH chain (s44 events #5-#7 + s45 event #8 precedent) | PLAN.md §4 HIGH: "feature works in degraded way" + "silent failure modes" (operator-side toast surfaces no underlying cause) + "missing UI for tracked DB state" (voided_at column exists; admin can't write via FE) | **Severity-adjustment event #11**: pre-class CRITICAL (F-01-001 anchor candidate; Phase 2 tag) ↓ HIGH (Phase 5 class-precedent reassessment). F-01-001 REFUTED via 6-dimension class-shape comparison — F-01-001 end-user-facing + silent + marketed-feature + parameter-mismatch vs F-08-003 admin-utility + loud-failure + admin-utility + phantom-via-migration-drift → class-divergent. Driver type: class-precedent reassessment (kinship to s44 events #5-#7 PI-02/03/04 Critical ↓ HIGH chain). PI-09 cross-cutting class kinship — this finding contributes to PI-09 cohort (batch-19 owned). |
| F-08-004 | **HIGH** | `supabase/functions/credit-expiry/index.ts:86-87` silent-swallow on `make_up_waitlist` cascade UPDATE error | F-05-005 closed batch-05 + F-07-001 closed batch-07 silent-swallow class chain (operational-correctness CAPS chain extends to 8 instances: F-05-003 + F-05-004 + F-05-005 + F-06-005 + F-06-007 + F-07-001 + F-08-004 + F-08-005) | PLAN.md §4 HIGH: "silent failure modes" + operational-correctness CAPS-at-HIGH | No bracket-shift event. Cron returns `success=true` with potentially-incorrect `waitlist_expired_count`. Strictly-less-mitigated than F-05-005 anchor (no banner, no recalc-retry helper). State-machine transition `waiting → expired` idempotent on next-day re-run (DB-state-gated by `expired_at IS NULL` filter); audit_log compensated via batch-19-owned `audit_make_up_waitlist` AFTER I/U/D trigger. |
| F-08-005 | **HIGH** | `supabase/functions/waitlist-expiry/index.ts:25 + :48 + :65` — 3 internal silent-swallow paths on state-machine transitions (initial expire + deadline-return + fallback-return) | F-05-005 + F-07-001 silent-swallow class chain (same as F-08-004) | PLAN.md §4 HIGH: "silent failure modes" + operational-correctness CAPS-at-HIGH | 3 internal paths BUNDLED per F-05-005 anchor precedent (single finding, multi-path evidence per closed-batch shape; NOT three separate findings). Cron returns `success=true` regardless of partial-failure across all 3 paths. Strictly-less-mitigated than F-05-005 anchor. State-machine transitions idempotent on next-day re-run. |
| F-08-006 | LOW | TS-bypass-cast Sub-A cohort: 7 instances of `as any` literal across batch-08 file set (4 RPC-name-not-in-types gratuitous casts + 3 misc payload/state/relation casts) | F-02-033 closed batch-02 + CC-19 #7 (Generated-types pipeline drift class) | PLAN.md §4 LOW: "minor docstring/API inconsistency" + "code-hygiene drift" | Aggregate class CAPS-at-LOW per batches 02-07 precedent. 4 of 7 gratuitous (`(supabase.rpc as any)` on RPCs that ARE in types.ts) — F-01-001 root-cause shape. Sub-A literal-pattern grep applied per s47 drift #24 mitigation (initial `\bas any\b` grep -E ERE returned 0; corrected literal grep returned 7). Class total post-s47: ≥338 → ≥345. |
| F-08-007 | LOW | `supabase/functions/notify-makeup-match/index.ts:9` bare `Deno.serve(async (req) => {` — no `wrapEdgeFn` Sentry instrumentation | CC-19 #10 Sentry edge-fn instrumentation gap (F-07-002 closed batch-07 anchor + F-04-006 cohort) | PLAN.md §4 LOW: "code-hygiene drift" + "legacy artefacts" | Class CAPS-at-LOW per F-07-002 anchor precedent. Custom Bearer service-role auth check at [:18-19](supabase/functions/notify-makeup-match/index.ts:18) is sound (POSITIVE auth pattern); handler-level error paths all return responses (no silent-swallow). Instance-aggravation NOT triggered (no audit_log INSERT paths without instrumentation; in-app notification via internal_messages table). |
| F-08-008 | LOW | `src/pages/DailyRegister.tsx:81-87` inline `supabase.from('teachers').select(...)` inside `useQuery` — direct-read bypassing hook abstraction | F-05-009 closed batch-05 LOW anchor (`RecurringRunDetail` inline `.from()` + vestigial PII select) | PLAN.md §4 LOW: "code-hygiene drift" | Class CAPS-at-LOW per F-05-009 class precedent. Class-divergent from Pattern #27 candidate (hook-mediated supabase access discipline; 11/11 batch-08 components delegate via hooks; DailyRegister is a PAGE not a component, scope separate). |
| F-08-009 | LOW | `public.auto_issue_credit_on_absence` SECDEF + `proconfig=NULL` (no `SET search_path` clause) | CC-19 #6 sub-shape A (NULL proconfig negative) | PLAN.md §4 LOW: "code-hygiene drift" | Class CAPS-at-LOW per CC-19 #6 sub-shape A precedent chain (s45 + s46 reinforcement). Body is well-formed: sophisticated 4-fallback rate calculation (invoice_item → student rate_card → org rate_card → lesson_participant snapshot) + cap-enforcement + 4 compensated audit_log INSERT paths (`credit_voided_attendance_reversal` + `credit_skipped_makeup_lesson` + `credit_cap_reached` + `credit_issued`). F-07-001 silent-swallow class watchpoint NEGATIVE (explicit guard clauses, no exception swallowing). |
| F-08-010 | LOW | `public.confirm_makeup_booking` SECDEF + `proconfig=NULL` | CC-19 #6 sub-shape A | PLAN.md §4 LOW: "code-hygiene drift" | Class CAPS-at-LOW. Body is well-gated via `is_org_staff(auth.uid(), _org_id)` L6 + lesson-org cross-bind + capacity check + schedule-conflict check + audit_log INSERT. NULL proconfig is sole defect. |

**Severity composition**: 2C + 3H + 0M + 5L = 10 findings ✓

---

## §2 Surface inventory (CENSUS row 08 line 1218 anchored)

**5 Edge functions** (per CC-3 reclassification: waitlist-respond moved to batch-14; see §9.5 batch-14 carry-forward):
- `credit-expiry` (98L; cron jobid 94 @ `0 2 * * *`)
- `credit-expiry-warning` (271L; cron jobid 98 @ `0 8 * * *`; emails via Resend; **shadow-mode interception POSITIVE** — Pattern #28 candidate)
- `notify-makeup-match` (164L; bare Deno.serve at :9; **F-08-007**; pg_net-triggered from `trg_notify_makeup_match`; inserts to `internal_messages` table — in-app channel)
- `notify-makeup-offer` (304L; hybrid auth Bearer-JWT-or-SERVICE_ROLE; pg_net-triggered from `offer_makeup_slot` RPC; emails via Resend; **shadow-mode interception POSITIVE**)
- `waitlist-expiry` (76L; cron jobid 113 @ `30 4 * * *`; **F-08-005**)

**11 user-facing RPCs** (CENSUS §4.5 lines 558-567 + void_make_up_credit phantom; per Phase 1 dispatch promotion):
- `issue_make_up_credit` — PASS clean (is_org_staff + org-active + value>0 + student-org cross-bind + audit_log)
- `redeem_make_up_credit` — PASS clean (is_org_staff + audit_log)
- `void_make_up_credit` — **F-08-003 phantom** (CENSUS §4.5 missing per launching-prompt promotion; not in pg_proc)
- `find_waitlist_matches` — **F-08-002 CRITICAL** (anon-callable cross-tenant child-PII)
- `confirm_makeup_booking` — PASS body but **F-08-010 NULL proconfig**
- `offer_makeup_slot` — PASS clean (is_org_staff + audit_log + pg_net fire-and-forget to notify-makeup-offer)
- `respond_to_makeup_offer` — PASS clean (auth.uid() + guardian-org cross-bind)
- `cancel_booked_makeup` — PASS clean (auth.uid() + guardian-org cross-bind + audit_log)
- `dismiss_makeup_match` — PASS clean (is_org_staff + audit_log)
- `cleanup_withdrawal_credits` — **F-08-001 CRITICAL** (anon-callable mass-void; called legitimately from `bulk-process-continuation/index.ts:394` via service-role adminClient)
- `seed_make_up_policies` — PASS clean (`current_setting('role') = 'service_role' OR is_org_admin`)

**9 trigger functions** (CENSUS §5.2 + §5.3 + §5.7 + §5.11):
- `auto_issue_credit_on_absence` — PASS body (4 compensated audit_log paths; F-07-001 silent-swallow class watchpoint NEGATIVE) but **F-08-009 NULL proconfig**
- `auto_add_to_waitlist` — PASS clean
- `on_makeup_participant_removed` — PASS clean (audit_log `makeup_credit_restored`)
- `check_attendance_not_future` — PASS clean (NON-SECDEF; NULL proconfig mitigated by non-SECDEF caller-role execution)
- `on_slot_released` — PASS clean (cross-listed batch-04 trigger on attendance_records; calls `find_waitlist_matches` as legitimate internal path with NEW.org_id from RLS-gated attendance INSERT)
- `validate_attendance_participant` — PASS clean (NON-SECDEF; validation-only)
- `void_credits_on_student_delete` — **PASS POSITIVE** cascade-completeness-asymmetry POSITIVE (data-direction A + safety-direction B both preserved)
- `notify_makeup_match_webhook` — PASS clean (SECDEF; pg_net fire-and-forget to notify-makeup-match edge fn; intent-acknowledged)
- `validate_waitlist_credit_ownership` — **PASS POSITIVE** Pattern #25-adjacent value-integrity validation (cross-binds credit.student_id + credit.org_id to waitlist row)

**3 Cron jobs** (CENSUS §7 lines 883, 887, 902): credit-expiry-daily #94, credit-expiry-warning-daily #98, waitlist-expiry-daily #113

**4 Tables**: `attendance_records`, `make_up_credits`, `make_up_policies`, `make_up_waitlist`

**1 View**: `available_credits` — **POSITIVE OBSERVATION** (`reloptions=["security_invoker=on"]` DB-verified Phase 3; RLS-bypass class candidate REFUTED; caller's RLS on make_up_credits applies via view)

**5 Hooks** (per CC-1 §11.A correction 6 → 5; CENSUS §9.5 lines 1035-1040):
- `useRegisterData.ts` (659L; 5 hook exports + 4 type/interface exports)
- `useAvailableCredits.ts` (100L; 2 hook exports)
- `useMakeUpCredits.ts` (273L; 2 hook exports incl. `voidCredit` mutation → F-08-003 phantom callsite at :163)
- `useMakeUpPolicies.ts` (134L; 2 hook exports)
- `useMakeUpWaitlist.ts` (350L; 7 hook exports)

**11 Components** (Phase 1.3): makeups/×4 (AddToWaitlistDialog + MakeUpStatsCards + NeedsActionSection + WaitlistTable) + register/×4 (AbsenceReasonPicker + RegisterRow + StudentNotesPopover + UnmarkedBacklogView) + students/×3 (CreditBalanceBadge + IssueCreditModal + MakeUpCreditsPanel) — 11/11 delegate via hooks (Pattern #27 candidate; zero direct supabase calls)

**3 Routes** (CENSUS §1.4): `/register` + `/batch-attendance` + `/make-ups` per [`src/config/routes.ts:55-58 + 133/135/154`](../../src/config/routes.ts:55)

**Cross-batch-affecting RPCs** (batch-08 surface touches; bodies CLOSED immutable):
- `record_stripe_payment` (F-02-005 batch-02 CRITICAL anchor) — composition target for F-08-001 (parameter-spoofing class kinship; cleanup_withdrawal_credits has same anon-callable zero-gate shape)
- 10 cross-batch reach SECDEF RPCs observed Phase 2 §B (anonymise_student / cleanup_attendance_on_cancel / complete_onboarding / create_invoice_with_items / delete_billing_run / generate_invoices_from_template / get_unmarked_lesson_count / retry_failed_recipients / undo_student_import / update_invoice_with_items / void_invoice) — closed-batch immutable; body-integrity observation only

**Out-of-scope** (CENSUS classification corrections + closed-batch immutability):
- `enrolment_waitlist` + `enrolment_waitlist_activity` tables + 5 enrolment RPCs (`add_to_enrolment_waitlist` + `convert_waitlist_to_student` + `withdraw_from_enrolment_waitlist` + `respond_to_enrolment_offer` + `convert_lead`) — batch-14 owned per CENSUS §4.6 lines 573-577 + §3.12 lines 362-363
- **`waitlist-respond` edge fn** — batch-14 owned per Phase 4 body audit (body operates on enrolment_waitlist + respond_to_enrolment_offer); CC-3 Phase 10 CENSUS Category C edit reclassifies §3.10 line 347 from `08-attendance-credits-waitlists` → `14-bookings-leads-enrolment`; body audit observation preserved §9.5

---

## §3 Findings — CRITICAL (2)

### F-08-001 — `cleanup_withdrawal_credits` anon-callable SECDEF (parameter-spoofing + financial-falsification)

- **Severity**: **Critical** (no bracket-shift event; standalone class-anchor stack)
- **Area**: SECDEF RPC body / parameter-spoofing class / financial-falsification class
- **Phase surfaced**: 2 (RPC body audit)
- **Class anchor**: F-02-005 closed batch-02 CRITICAL anchor (`record_stripe_payment` anon-callable + zero body auth — parameter-spoofing class) + F-07-003 closed batch-07 CRITICAL anchor (`record_installment_payment` composition CRITICAL via F-02-005 — financial-falsification class)
- **Severity rubric**: PLAN.md §4 CRITICAL — "security exposure" (anon-callable financial-state-mutation RPC) + "financial loss" (credit-voiding = removal of legitimate financial liability from org books)

- **Evidence** (DB-verified via `pg_get_functiondef('public.cleanup_withdrawal_credits'::regproc::oid)`):

```sql
CREATE OR REPLACE FUNCTION public.cleanup_withdrawal_credits(
  _student_id uuid, _org_id uuid, _effective_date date
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _voided_count INTEGER := 0;
  _waitlist_count INTEGER := 0;
BEGIN
  -- 1. Void unredeemed credits for lessons AFTER the effective date
  UPDATE make_up_credits
  SET voided_at = NOW(), voided_by = auth.uid()
  WHERE student_id = _student_id
    AND org_id = _org_id
    AND redeemed_at IS NULL
    AND expired_at IS NULL
    AND voided_at IS NULL
    AND issued_for_lesson_id IN (
      SELECT id FROM lessons
      WHERE start_at >= _effective_date::timestamp
    );
  GET DIAGNOSTICS _voided_count = ROW_COUNT;

  -- 2. Cancel active waitlist entries
  UPDATE make_up_waitlist
  SET status = 'expired', updated_at = NOW()
  WHERE student_id = _student_id
    AND org_id = _org_id
    AND status IN ('waiting', 'matched', 'offered');
  GET DIAGNOSTICS _waitlist_count = ROW_COUNT;

  -- 3. Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    'withdrawal_cleanup', 'student', _student_id,
    jsonb_build_object(
      'credits_voided', _voided_count,
      'waitlist_entries_cancelled', _waitlist_count,
      'effective_date', _effective_date
    ));

  RETURN json_build_object(
    'credits_voided', _voided_count,
    'waitlist_entries_cancelled', _waitlist_count
  );
END;
$function$
```

- **Critical defects (DB-verified)**:
  - `prosecdef=true`, `proconfig=[search_path=public]`
  - `proacl={postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — **anon EXECUTE confirmed**
  - **ZERO `auth.uid()` body gate** — no `IF auth.uid() IS NULL THEN RAISE` check
  - **ZERO `is_org_*()` gates** — no org membership verification
  - `audit_log` INSERT uses zero-UUID actor fallback per `COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000')` — anon callers leave traceable zero-UUID actor in audit trail (partial forensic recoverability)
  - SECDEF execution mode bypasses RLS

- **Attack flow** (3-step):
  1. **Step A**: anon caller obtains `(_student_id, _org_id)` UUID pair via side-channel (parent forwarding withdrawal email, invoice URL history, screenshot, inbox compromise — same threat model as F-07-003)
  2. **Step B**: anon calls `cleanup_withdrawal_credits(_student_id, _org_id, _effective_date)` with arbitrary `_effective_date` — body voids ALL unredeemed credits for lessons after that date + cancels ALL active waitlist entries for that student in that org
  3. **Step C**: parent has lost financial liability — credits voided (no GBP recovery), waitlist cancelled (no offer paths). Operator-trusted UI shows credits voided; reconciliation against attendance + waitlist state may reveal anomaly post-hoc via batch-19-owned `audit_make_up_credits` AFTER I/U/D trigger (`actor_user_id=NULL` or zero-UUID indicates anomalous call)

- **Real-world exploitability vectors**:
  1. **Direct SELECT leak via RLS**: NOT POSSIBLE per Phase 3 RLS audit (make_up_credits SELECT policies properly tenant-bound via inline org_id subquery or parent guardian chain)
  2. **Authenticated-cross-org-user knowledge**: a user with legitimate own-org access can extract own-org student_ids; SECDEF bypass means cross-org replay possible if attacker obtains victim org's student_ids from any source
  3. **Side-channel disclosure** (PRIMARY realistic vector): withdrawal/cancellation emails routinely forwarded; parent shares notification with spouse/friend/family
  4. **Cross-tenant authenticated probing**: malicious LessonLoop account enumerates `cleanup_withdrawal_credits` with student_ids from side-channel sources; UUID brute-force infeasible (`gen_random_uuid` 2^122)

- **Real-world exposure profile**:
  - RLS-side READ leak: **BLOCKED** (Phase 3 evidence)
  - SECDEF-side WRITE: **OPEN** (Phase 2 anchor)
  - Side-channel disclosure: **primary realistic vector**
  - Insider threat (own-org staff replaying side-channel-leaked cross-org student_ids): **secondary vector**
  - Anon-only attack (no student_id source): **NOT VIABLE**

- **Legitimate caller hygiene** (cross-batch reach observation):
  - `supabase/functions/bulk-process-continuation/index.ts:394` — `await adminClient.rpc('cleanup_withdrawal_credits', { ... })` — uses service-role adminClient (legitimate caller path)
  - The anon-direct-call bypass is the defect; the SECDEF + anon EXECUTE shape doesn't distinguish legitimate service-role callers from anon callers at the RPC entry

- **Forensic recoverability** (Phase 5 magnitude vs bracket):
  - `audit_log` INSERT body L29-37 captures `actor_user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000')` + `action='withdrawal_cleanup'` + `entity_type='student'` + `entity_id=_student_id`
  - Anomalous zero-UUID actor or NULL `auth.uid()` in pg_audit log indicates anon call
  - **Partial forensic recoverability**; class bracket unchanged per s46 F-07-003 class-consistency precedent (audit_invoice_installments AFTER ROW trigger forensic visibility did NOT downgrade CRITICAL)

- **Severity reasoning (PLAN.md §4)**: Critical anchors verbatim — "security exposure" (anon-callable financial-state-mutation RPC) + "financial loss" (credit-voiding removes real GBP liability from org's books). Parameter-spoofing class (F-02-005 anchor) + financial-falsification class (F-07-003 anchor); same shape — anon callable, no body auth, financial-state mutation. The exploit-path does not traverse RLS at all; Phase 3 read-side robustness does not mitigate. Bracket CAPS at CRITICAL per class-consistency.

- **Anchor fix surface (Phase C reference)**: add explicit body gate (`IF NOT is_org_staff(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;`) OR REVOKE EXECUTE from anon + authenticated (preserves service-role for `bulk-process-continuation` legitimate caller).

- **Phase C sprint candidate**: **S-29** (clustered with F-02-005 + F-07-003 anchor fixes; SECDEF parameter-spoofing codemod).
- **Decision needed**: No (mechanical fix; same shape as F-02-005 + F-07-003).
- **Target sprint**: Phase C **S-29**.
- **Closure**: (open)

---

### F-08-002 — `find_waitlist_matches` anon-callable SECDEF (cross-tenant child-PII exfiltration)

- **Severity**: **Critical** (no bracket-shift event; standalone class-anchor stack)
- **Area**: SECDEF RPC body / information-disclosure class / cross-tenant PII exfiltration
- **Phase surfaced**: 2 (RPC body audit)
- **Class anchor**: F-02-002 closed batch-02 CRITICAL anchor (`get_students_for_org` anon cross-tenant child-PII exfiltration; GDPR Art 9 + Art 33 ICO-notifiable under Lauren shadow volume)
- **Severity rubric**: PLAN.md §4 CRITICAL — "security exposure" + "data loss" (PII exfiltration)

- **Evidence** (DB-verified via `pg_get_functiondef('public.find_waitlist_matches'::regproc::oid)`):

```sql
CREATE OR REPLACE FUNCTION public.find_waitlist_matches(
  _lesson_id uuid, _absent_student_id uuid, _org_id uuid
)
 RETURNS TABLE(waitlist_id uuid, student_id uuid, student_name text,
   guardian_name text, guardian_email text, missed_lesson_title text,
   missed_lesson_date date, waiting_since timestamp with time zone, match_quality text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _lesson RECORD; _duration INTEGER; _day_name TEXT;
        _lesson_time TIME; _participant_count INTEGER; _tz TEXT;
BEGIN
  SELECT * INTO _lesson FROM lessons WHERE id = _lesson_id AND org_id = _org_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- [Capacity check + timezone resolution elided for brevity]

  RETURN QUERY
  SELECT w.id, w.student_id,
    (s.first_name || ' ' || s.last_name)::TEXT,
    g.full_name::TEXT, g.email::TEXT,
    w.lesson_title, w.missed_lesson_date, w.created_at,
    CASE [...] END AS match_quality
  FROM make_up_waitlist w
  JOIN students s ON s.id = w.student_id
  LEFT JOIN guardians g ON g.id = w.guardian_id
  WHERE w.org_id = _org_id AND w.status = 'waiting'
    AND w.student_id != _absent_student_id
    AND [match criteria elided]
  ORDER BY [match quality + created_at]
  FOR UPDATE OF w SKIP LOCKED
  LIMIT 10;
END;
$function$
```

- **Critical defects (DB-verified)**:
  - `prosecdef=true`, `proconfig=[search_path=public]`
  - **anon EXECUTE confirmed**
  - **ZERO `auth.uid()` / `is_org_*()` / membership gate** of any kind
  - Read-only operation (no audit_log INSERT — appropriate for read-only)
  - SECDEF execution mode bypasses RLS on `make_up_waitlist` + `students` + `guardians` + `lessons` + `lesson_participants`

- **PII exfiltration profile** (returned columns):
  - `student_name` — CHILD NAME (PII; GDPR Art 9 special category if child data)
  - `guardian_name` — parent name (PII)
  - `guardian_email` — parent email (PII)
  - `missed_lesson_title` — lesson context
  - `missed_lesson_date` — temporal context
  - `waiting_since` — temporal context
  - `student_id` + `waitlist_id` — internal UUIDs (not directly PII but UUID-leak enables onward enumeration)
  - `match_quality` — relational categorisation (`exact`/`same_teacher`/`same_duration`/`partial`)

- **Attack flow** (2-step):
  1. **Step A**: anon caller obtains `_lesson_id` UUID for victim org via side-channel (lesson invitation URLs, calendar exports, screenshot, inbox compromise) + corresponding `_org_id` (organisation URL slugs)
  2. **Step B**: anon calls `find_waitlist_matches(_lesson_id, gen_random_uuid()::uuid, _org_id)` — body returns up to 10 waitlist matches with child + parent PII for that org
  3. **Pagination**: attacker iterates `_lesson_id` across multiple lessons in victim org for broader exfiltration

- **Bounded blast radius** (Phase 5 magnitude vs bracket):
  - `LIMIT 10` per call (vs F-02-002 unbounded org-wide return)
  - `_lesson_id` must exist in `_org_id` (else `RETURN` empty per L4)
  - `_absent_student_id` is exclusion filter (caller-supplied; attacker can pass random UUID)
  - **Magnitude factor** — paginates attack but does NOT alter class anchor (cross-tenant child-PII)
  - Class bracket unchanged per s44 events #2-#7 + F-02-002 class-consistency precedent

- **Real-world exposure profile**:
  - RLS-side READ leak: **BLOCKED** (Phase 3 evidence — make_up_waitlist SELECT policies properly tenant-bound)
  - SECDEF-side READ: **OPEN** (Phase 2 anchor)
  - Side-channel disclosure: **primary realistic vector**
  - UUID brute-force: infeasible (`gen_random_uuid` 2^122 search space)
  - Cross-tenant authenticated probing: malicious LessonLoop account iterates `find_waitlist_matches` with lesson_ids from side-channel sources

- **Severity reasoning (PLAN.md §4)**: Critical anchors verbatim — "security exposure" + "data loss" (child + guardian PII cross-tenant exfiltration). Same class shape as F-02-002 closed batch-02 anchor (anon-callable SECDEF returning org-scoped student+guardian data). The exploit-path does not traverse RLS at all (SECDEF bypass by definition); Phase 3 read-side robustness does not mitigate. Bracket CAPS at CRITICAL per class-consistency.

- **GDPR dimension**: returning child names + parent emails to an anon caller without org membership is a personal data disclosure under UK GDPR Art 5(1)(a) lawfulness + Art 9 (child data potentially special category) + Art 33 ICO-notifiable if breach realised at Lauren-shadow-or-launch volume.

- **Legitimate caller** (cross-batch reach observation): `on_slot_released` trigger function calls `find_waitlist_matches(NEW.lesson_id, NEW.student_id, NEW.org_id)` per attendance_records UPDATE — internal use is legitimate (NEW.org_id derived from RLS-gated attendance INSERT, so caller-context is tenant-bound at the attendance entry point). Trigger-internal use is fine; anon-direct-call bypass is the defect.

- **Anchor fix surface (Phase C reference)**: add explicit body gate (`IF NOT is_org_member(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;` — `is_org_member` is correct because both staff + parents need to call this surface; parents read for their own children's match candidates) OR REVOKE EXECUTE from anon (preserves authenticated + service-role; trigger context uses service-role implicitly).

- **Phase C sprint candidate**: **S-29** (clustered with F-08-001 + F-02-005 + F-07-003).
- **Decision needed**: No.
- **Target sprint**: Phase C **S-29**.
- **Closure**: (open)

---

## §4 Findings — HIGH (3)

### F-08-003 — `void_make_up_credit` phantom RPC (event #11 bracket-shift CRITICAL → HIGH)

- **Severity**: **High** (severity-adjustment event #11; bracket-shifted from CRITICAL Phase 2 tentative-tag to HIGH Phase 5 class-precedent reassessment)
- **Area**: SECDEF RPC / FE callsite / migration-replay-safety / silent-broken-feature
- **Phase surfaced**: 2 (RPC body audit — discovered when retrieving 11 user-facing RPC bodies; 10 of 11 returned; void_make_up_credit absent)
- **Class anchor**: F-01-001 candidate REFUTED via 6-dimension class-shape comparison (Phase 5 §F-01-001 class precedent citation) → **PI-09 HIGH anchor adopted** (migration-replay-safety class — migration history doesn't match live schema) + operational-correctness CAPS-at-HIGH chain (s44 events #5-#7 + s45 event #8 precedent)
- **Severity rubric**: PLAN.md §4 HIGH — "feature works in degraded way" + "silent failure modes" (operator-side toast surfaces no underlying cause) + "missing UI for tracked DB state" (`voided_at` column exists; admin can't write via FE)

- **Evidence (multi-source)**:

  **(1) FE callsite** [`src/hooks/useMakeUpCredits.ts:159-179`](../../src/hooks/useMakeUpCredits.ts:159):
  ```typescript
  159	  // Void a credit (admin only — preserves audit trail, CRD-C4 FIX)
  160	  const voidCredit = useMutation({
  161	    mutationFn: async (creditId: string) => {
  162	      if (!currentOrg?.id) throw new Error('No org');
  163	      const { data, error } = await (supabase.rpc as any)('void_make_up_credit', {
  164	        _credit_id: creditId,
  165	        _org_id: currentOrg.id,
  166	      });
  167
  168	      if (error) throw error;
  169	      return data;
  170	    },
  171	    onSuccess: () => {
  172	      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
  173	      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
  174	      toast({ title: 'Credit voided' });
  175	    },
  176	    onError: (error: Error) => {
  177	      toast({ title: 'Error voiding credit', description: error.message, variant: 'destructive' });
  178	    },
  179	  });
  ```

  **(2) Generated types entry** [`src/integrations/supabase/types.ts:7418-7421`](../../src/integrations/supabase/types.ts:7418):
  ```typescript
  void_make_up_credit: {
    Args: { _credit_id: string; _org_id: string }
    Returns: Json
  }
  ```

  **(3) Migration archaeology** ([`supabase/migrations/20260316260000_fix_voided_credits_audit.sql:203-206`](../../supabase/migrations/20260316260000_fix_voided_credits_audit.sql:203)):
  ```sql
  -- CRD-C4 CRITICAL: Create void_make_up_credit RPC
  -- ...
  CREATE OR REPLACE FUNCTION public.void_make_up_credit(_credit_id uuid, _org_id uuid)
  ```
  Plus comment at L265: `-- Credits should never be hard-deleted; use void_make_up_credit() instead.`
  No subsequent migration DROPs the function (full-tree `grep -rln "DROP FUNCTION" supabase/migrations/` returned 3 unrelated files).

  **(4) Live DB absence** (DB-verified Phase 2 via `pg_proc` LEFT JOIN):
  ```sql
  SELECT proname, n.nspname AS schema FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'void_make_up_credit';
  -- Returns: zero rows
  ```

- **Class-shape comparison vs F-01-001 anchor candidate** (Phase 5 §F-01-001 class precedent — 6-dimension table):

  | Dimension | F-01-001 (`useParentLessonNotes`) | F-08-003 (`void_make_up_credit`) |
  |---|---|---|
  | User surface | END-USER (parents) | ADMIN (org owner/admin issuing voids) |
  | Error visibility | **SILENT** (no toast, no Sentry, React Query swallows error) | **LOUD** (`onError: toast({ title: 'Error voiding credit', description: error.message, variant: 'destructive' })`) |
  | RPC state | EXISTS with parameter mismatch (`p_student_id` vs `p_student_ids`) | DOES NOT EXIST (phantom in pg_proc; types.ts stale; migration created + never dropped) |
  | Marketed feature? | YES — "see your child's lesson notes from teachers" (marketing-promised parent-facing feature) | NO — void-credit is admin-utility; customer-facing make-up credit feature (issue/redeem/expire) DOES work |
  | First-encounter trust erosion? | YES — parents' first login sees nothing | NO — admin uses app daily; sees destructive-toast on void attempt; workaround paths exist (await natural expiry; manual SQL) |
  | Root cause | Type-cast bypassed param-name check | Migration history doesn't match live schema (PI-09 class) |

  **Class-divergence verdict**: F-01-001 (end-user-facing + silent + marketed-feature + parameter-mismatch) is **CLASS-DIVERGENT** from F-08-003 (admin-utility + loud-failure + admin-utility + phantom-via-migration-drift). F-08-003 is NOT anchored by F-01-001; instead anchored by **PI-09 HIGH** (migration-replay-safety) + operational-correctness CAPS-at-HIGH chain.

- **Hypothesis on migration drift**: 
  - Migration `20260316260000_fix_voided_credits_audit.sql` (2026-03-16) created the function labelled "CRD-C4 CRITICAL"
  - NO subsequent migration drops it (full-tree grep confirmed)
  - Live DB pg_proc lacks the function
  - Possibilities: (a) supabase dashboard manual drop outside migration tracking; (b) migration was applied + rolled back without record; (c) migration was never applied to this DB (less likely given other 20260316* migrations applied)
  - Class-consistent with **PI-09 migration-replay-safety** (live schema diverged from migration history; PI-09 HIGH anchor per STATUS.md §5.1 line 104: "7+ migration files reference pre-s36 `rate_amount` column; live functions use `rate_amount_minor`")

- **Operator-side impact**:
  - Admin clicks "Void Credit" in `MakeUpCreditsPanel.tsx` → mutation fires → PG error "function public.void_make_up_credit does not exist" → React Query error handler → destructive toast surfaces
  - Admin sees LOUD failure (no silent corruption)
  - Workaround paths exist: (a) wait for natural credit expiry per `credit-expiry-daily` cron; (b) DB admin can manually UPDATE `make_up_credits SET voided_at = NOW(), voided_by = '<admin user_id>' WHERE id = ...`
  - **NOT first-encounter trust erosion** (admin uses app daily; trust already established)
  - **NOT marketed-feature-broken** (customer-facing credit features work; admin-utility-broken; class-divergent from F-01-001)

- **Severity-adjustment event #11** (Phase 5 ratification per PLAN.md §4.1):
  - Direction: ↓ (CRITICAL → HIGH)
  - Driver type: **Class-precedent reassessment** (kinship to s44 events #5-#7 PI-02/03/04 Critical ↓ HIGH chain; not composition-driven like s45 event #9 or s46 event #10)
  - Class-anchor stack change: F-01-001 anchor REFUTED → PI-09 HIGH anchor adopted
  - Rubric §4 bracket change: CRITICAL ("marketed feature fundamentally broken" + "first-encounter trust erosion") → HIGH ("silent failure modes" + "missing UI for tracked DB state" + operational-correctness CAPS-at-HIGH)
  - Closed-batch anchor citation: PI-09 HIGH + s44 events #5-#7 operational-correctness CAPS precedent chain
  - Counted as event per PLAN.md §4.1: **YES** (bracket boundary crossed; CRITICAL → HIGH)
  - Cumulative severity-adjustment events: 10 (post-s46) → **11** (post-s47)

- **Severity reasoning (PLAN.md §4)**: High anchors verbatim — "silent failure modes" (operator-side toast surfaces no underlying cause: admin clicks Void, sees generic error, no indication that the function doesn't exist) + "missing UI surfaces for tracked DB state" (`voided_at` column exists; admin can't write via FE; auto-issued voids via `auto_issue_credit_on_absence` trigger reversal path still work since trigger is internal) + operational-correctness CAPS-at-HIGH per class-consistency.

- **PI-09 cross-cutting class kinship**: this finding contributes to **PI-09 cohort** (batch-19 owned). PI-09 records migration-replay-safety drift class. F-08-003 is a NEW instance: migration `20260316260000` references function not present in pg_proc; migration replay would re-create it. Carry to batch-19 for systematic migration-vs-live-schema audit.

- **Anchor fix surface (Phase C reference)**: 2 options:
  - **(a) Re-apply migration**: extract `CREATE OR REPLACE FUNCTION` block from `20260316260000_fix_voided_credits_audit.sql` and apply to live DB. Restores the function. Low risk if FE expectations match the migration's body.
  - **(b) Remove FE callsite**: delete the `voidCredit` mutation from `useMakeUpCredits.ts:159-179` + delete consumer UI in `MakeUpCreditsPanel.tsx` if not load-bearing; remove `void_make_up_credit` entry from types.ts. Eliminates the dead callsite.
  - **Recommend (a)** since the migration was labelled CRD-C4 CRITICAL — voided-credit audit-trail-preserving behavior was deliberately designed and FE callers depend on it.

- **PI-09 class-consistency follow-up**: batch-19 sweep should also enumerate other potential migration-vs-live-schema drift instances; this finding is a concrete anchor for the class.

- **Phase C sprint candidate**: **S-30** (clustered with PI-09 migration-replay-safety sweep).
- **Decision needed**: Yes — pick (a) re-apply or (b) remove callsite; recommend (a).
- **Target sprint**: Phase C **S-30**.
- **Closure**: (open)

---

### F-08-004 — `credit-expiry:86-87` silent-swallow on waitlist cascade UPDATE error

- **Severity**: High (no bracket-shift event; class CAPS-at-HIGH)
- **Area**: Edge fn caller error handling / cron silent-swallow / state-machine cascade
- **Phase surfaced**: 4 (edge fn body audit)
- **Class anchor**: F-05-005 closed batch-05 silent-swallow class anchor + F-07-001 closed batch-07 silent-swallow class anchor (operational-correctness CAPS chain extending to 8 instances total: F-05-003 + F-05-004 + F-05-005 + F-06-005 + F-06-007 + F-07-001 + F-08-004 + F-08-005)
- **Severity rubric**: PLAN.md §4 HIGH — "silent failure modes"; operational-correctness CAPS-at-HIGH per class-consistency precedent chain.

- **Evidence (verbatim Phase 4 §3)** [`supabase/functions/credit-expiry/index.ts:75-92`](../../supabase/functions/credit-expiry/index.ts:75):

```typescript
75	  // Expire waitlist entries linked to the now-expired credits (1.7)
76	  let waitlistExpiredCount = 0;
77	  if (count > 0) {
78	    const creditIds = (expired ?? []).map((c: { id: string }) => c.id);
79	    const { data: expiredWaitlist, error: wlError } = await supabase
80	      .from("make_up_waitlist")
81	      .update({ status: "expired" })
82	      .in("credit_id", creditIds)
83	      .eq("status", "waiting")
84	      .select("id");
85
86	    if (wlError) {
87	      console.error("Waitlist expiry error:", wlError.message);
88	    } else {
89	      waitlistExpiredCount = expiredWaitlist?.length || 0;
90	      console.log(`Credit expiry: ${waitlistExpiredCount} waitlist entries expired`);
91	    }
92	  }
```

- **Silent-swallow class shape confirmed verbatim** (per F-05-005 + F-07-001 anchor pattern):
  - `console.error(...)` only at L87 — no operator-visible surface beyond Deno log
  - **NO `audit_log` INSERT** for the cascade failure
  - **NO `throw`** — exception swallowed; cron returns success regardless
  - **NO banner-surface path** (F-05-005 closed-batch anchor's mitigation `RecalcFailureBanner` is NOT relevant here — different state-machine; no analogous banner exists for waitlist-cascade-failure)
  - Cron returns `success: true, expired_count, protected_count, waitlist_expired_count` at L94-97; `waitlist_expired_count = 0` on cascade failure misrepresents partial-failure as success

- **State-machine cascade context**: when `credit-expiry` cron at `0 2 * * *` UTC marks credits as `expired_at = NOW()`, the body's L75-92 cascade UPDATEs linked waitlist entries from `status='waiting'` to `status='expired'`. The CRD-C1 race-condition fix (L39-57) already prevents protected credits (linked to active waitlist) from being expired. But if the cascade UPDATE itself fails after the credit-expire UPDATE succeeds, you end up with:
  - Credits marked `expired_at` (correctly)
  - Waitlist entries still `status='waiting'` (out of sync)
  - On the next day's cron run, the same condition is re-evaluated and the cascade may succeed — so **state-machine self-heals on next-day re-run**, but no operator visibility during the gap

- **Strictly-less-mitigated than F-05-005 anchor**: closed-batch F-05-005 mitigation via `recalcWithRetry` helper writes `audit_log` row → `useInvoiceRecalcFailure` query → `RecalcFailureBanner` renders on InvoiceDetail → operator sees banner. The cron at credit-expiry has no banner-surface equivalent; only Deno log visibility.

- **Severity reasoning (PLAN.md §4)**: High anchors verbatim — "silent failure modes" (cron-direct path catches + log-only) + "broken edge cases" (waitlist cascade out-of-sync on transient DB failure; self-heals on next-day re-run). Class-consistent operational-correctness CAPS-at-HIGH per 8-instance precedent chain.

- **Composition observation**: Compose with F-08-005 silent-swallow class within batch-08; cumulative-impact composition does not bracket-shift (operational-correctness CAPS-at-HIGH per s42 PI-11 + s44 PI-02/03/04 + s45 PI-05/PI-07 + s46 F-07-001 precedent chain).

- **Anchor fix surface (Phase C reference)**: same 3-layered options as F-05-005:
  - **(a)** Wrap cron caller in `recalcWithRetry`-style helper (smallest change; closes silent path; gains audit-trail + retry visibility)
  - **(b)** Surface failure to response status: change cron return to `success: !wlError, expired_count, waitlist_expired_count, waitlist_cascade_failed: !!wlError` — pg_cron records HTTP status, operator-queryable via cron_job_run_details
  - **(c)** Self-audit row INSERT on `wlError !== null` before continuing
  - Recommend (b) + (c) combined (least invasive; surfaces failure operator-side without architectural change).

- **Phase C sprint candidate**: **S-31-cron-silent-swallow-resolution** clustered with F-05-005 + F-06-007 + F-07-001 closed-batch carries.
- **Decision needed**: Yes — same family decision as F-05-005/F-07-001 (caller-side fix vs response-surface fix vs self-audit hardening).
- **Target sprint**: Phase C **S-31**.
- **Closure**: (open)

---

### F-08-005 — `waitlist-expiry:25 + :48 + :65` silent-swallow on state-machine transitions (3 internal paths bundled)

- **Severity**: High (no bracket-shift event; class CAPS-at-HIGH; 3 internal paths bundled per F-05-005 anchor precedent — single finding, multi-path evidence per closed-batch shape)
- **Area**: Edge fn caller error handling / cron silent-swallow / state-machine transitions
- **Phase surfaced**: 4 (edge fn body audit)
- **Class anchor**: F-05-005 + F-07-001 silent-swallow class chain (same as F-08-004)
- **Severity rubric**: PLAN.md §4 HIGH — "silent failure modes" + operational-correctness CAPS-at-HIGH

- **Evidence (verbatim Phase 4 §3)** [`supabase/functions/waitlist-expiry/index.ts:18-76`](../../supabase/functions/waitlist-expiry/index.ts:18):

```typescript
17	  // 1. Expire waiting/matched entries past expires_at
18	  const { data: expired, error: expireError } = await supabase
19	    .from("make_up_waitlist")
20	    .update({ status: "expired", updated_at: now })
21	    .in("status", ["waiting", "matched"])
22	    .lt("expires_at", now)
23	    .select("id");
24
25	  if (expireError) console.error("Expire error:", expireError.message);
26
27	  // 2. WL-M5 FIX: Return stale offered entries back to waiting.
28	  // [...]
29	  // 2a. Entries WITH offer_expires_at — use the per-entry deadline
30	  const { data: returnedByDeadline, error: deadlineError } = await supabase
31	    .from("make_up_waitlist")
32	    .update({ /* ... */ })
33	    .eq("status", "offered")
34	    .not("offer_expires_at", "is", null)
35	    .lt("offer_expires_at", now)
36	    .select("id");
37
38	  // ...
46	  if (deadlineError) console.error("Deadline return-to-waiting error:", deadlineError.message);
47
48	  // 2b. Legacy entries WITHOUT offer_expires_at — fallback to 48h from offered_at
49	  const { data: returnedByFallback, error: fallbackError } = await supabase
50	    .from("make_up_waitlist")
51	    .update({ /* ... */ })
52	    .eq("status", "offered")
53	    .is("offer_expires_at", null)
54	    .lt("offered_at", fortyEightHoursAgo)
55	    .select("id");
56
57	  if (fallbackError) console.error("Fallback return-to-waiting error:", fallbackError.message);
58
59	  // [final return]
67	  return new Response(
68	    JSON.stringify({ success: true, expired: expiredCount, returned_to_waiting: returnedCount }),
69	    { status: 200, headers: { "Content-Type": "application/json" } }
70	  );
```

- **3 silent-swallow class instances** (all class-consistent with F-05-005 + F-07-001 anchor):
  - **L25**: `if (expireError) console.error("Expire error:", expireError.message);` — silent-swallow on initial expire path (waiting/matched → expired)
  - **L48**: `if (deadlineError) console.error("Deadline return-to-waiting error:", deadlineError.message);` — silent-swallow on deadline-return path (offered → waiting via per-entry offer_expires_at)
  - **L65** (actually L57 per literal grep): `if (fallbackError) console.error("Fallback return-to-waiting error:", fallbackError.message);` — silent-swallow on legacy fallback path (offered → waiting via 48h-after-offered_at)
  - Cron returns `success: true, expired: expiredCount, returned_to_waiting: returnedCount` regardless of partial failures across all 3 paths

- **F-05-005 anchor precedent for multi-path bundling**: closed batch-05 F-05-005 was a single finding for `invoice-overdue-check/index.ts:125` even though the body had multiple silent-swallow paths internally. Same bundling discipline applies here — F-08-005 is one finding with 3 internal-path evidence; NOT three separate findings.

- **State-machine cascade context**: the 3 paths transition different state subsets of `make_up_waitlist`. Self-healing on next-day re-run: state-machine transitions are idempotent (DB-state-gated by status + expires_at filters); failed-transition on day N retries on day N+1.

- **Strictly-less-mitigated than F-05-005 anchor**: no banner-surface equivalent; only Deno log visibility for the 3 internal paths.

- **Severity reasoning (PLAN.md §4)**: same as F-08-004 — "silent failure modes" + operational-correctness CAPS-at-HIGH per class-consistency.

- **Composition observation**: same class as F-08-004 within batch-08; cumulative-impact does not bracket-shift.

- **Anchor fix surface (Phase C reference)**: same 3-layered options as F-08-004 (caller-side fix vs response-surface fix vs self-audit hardening). Recommend uniform fix across credit-expiry + waitlist-expiry + invoice-overdue-check + installment-overdue-check class — a shared `cronStateMachineWithErrorSurface` helper that records partial-failure state in response JSON + audit_log + cron_job_run_details.

- **Phase C sprint candidate**: **S-31** clustered with F-08-004 + F-05-005 + F-07-001.
- **Decision needed**: Yes (same family as F-08-004).
- **Target sprint**: Phase C **S-31**.
- **Closure**: (open)

---

## §5 Findings — MEDIUM (0)

No medium-severity findings allocated at batch-08. PI-17 (MEDIUM; credit-expiry UTC date timezone-off-by-±12h for non-UTC orgs) remains active + partial pending batch-19 cross-cutting timezone sweep — not closed at batch-08 (none of batch-08's 2C/3H/0M/5L matches MEDIUM bracket per Phase 6 §3 PI register implications).

---

## §6 Findings — LOW (5)

### F-08-006 — TS-bypass-cast Sub-A cohort (7 instances; aggregate batch-08)

- **Severity**: Low (aggregate class CAPS-at-LOW per F-02-033 + CC-19 #7 precedent)
- **Area**: TypeScript bypass-cast / generated-types pipeline drift
- **Phase surfaced**: 1 (TS-bypass-cast sub-pattern sweep) — initial `\bas any\b` grep -E ERE returned 0 (drift #24 root cause); corrected literal-pattern grep returned 7
- **Class anchor**: F-02-033 closed batch-02 anchor (TS-bypass-cast cumulative class) + CC-19 #7 (Generated-types pipeline drift)
- **Severity rubric**: PLAN.md §4 LOW — "minor docstring/API inconsistency" + "code-hygiene drift"

- **Evidence** (7 instances by literal `as any` pattern):

  **4 hook-level gratuitous `(supabase.rpc as any)` casts on RPCs that ARE in types.ts** (F-01-001 root-cause shape):
  | File:line | Pattern | RPC name | types.ts presence |
  |---|---|---|---|
  | [useMakeUpCredits.ts:115](../../src/hooks/useMakeUpCredits.ts:115) | `(supabase.rpc as any)('issue_make_up_credit', ...)` | issue_make_up_credit | YES |
  | [useMakeUpCredits.ts:163](../../src/hooks/useMakeUpCredits.ts:163) | `(supabase.rpc as any)('void_make_up_credit', ...)` | void_make_up_credit | YES at L7418 (STALE per F-08-003) |
  | [useMakeUpWaitlist.ts:141](../../src/hooks/useMakeUpWaitlist.ts:141) | `(supabase.rpc as any)('offer_makeup_slot', ...)` | offer_makeup_slot | YES |
  | [useMakeUpWaitlist.ts:177](../../src/hooks/useMakeUpWaitlist.ts:177) | `(supabase.rpc as any)('dismiss_makeup_match', ...)` | dismiss_makeup_match | YES |

  **3 misc payload/state/relation casts**:
  | File:line | Pattern | Shape |
  |---|---|---|
  | [UnmarkedBacklogView.tsx:158](../../src/components/register/UnmarkedBacklogView.tsx:158) | `(att?.attendance_status as any)` | Query-result destructure cast |
  | [MakeUpCreditsPanel.tsx:39](../../src/components/students/MakeUpCreditsPanel.tsx:39) | `(currentOrg as any)?.max_credits_per_term` | Org-context property access cast (suspect: `max_credits_per_term` missing from Org type) |
  | [credit-expiry-warning/index.ts:93](../../supabase/functions/credit-expiry-warning/index.ts:93) | `(credit.students as any) as { id: string; first_name: string; last_name: string; email: string \| null } \| null` | Supabase query-relation double-cast |

- **Sub-A literal-pattern grep result** (drift #24 mitigation): initial `\bas any\b` grep -E ERE returned 0 (grep -E does NOT support `\b` word boundary; vendor extension only); corrected literal `as any` grep returned 7 matches. Phase 1 EXIT logged the drift as CC-origin candidate; Phase 2 dispatch reclassified to Cat 1 (reviewing-Claude origin instance #24).

- **TS-bypass-cast 4-sub-pattern sweep batch-08** (Phase 1.5 + Phase 4 verification):
  - Sub-A `as any`: **7 instances** (cohort above)
  - Sub-B `<any>`: 0
  - Sub-C `// @ts-`: 0
  - Sub-D `supabase: any` helper-param: 0 (Phase 1 + Phase 4 explicit grep CONFIRMED EXECUTED BEFORE EXIT per s46 CC-origin drift #5 mitigation)
  - Sub-D-adjacent observations (not exact Sub-D shape): 3 (notify-makeup-match:33 `let payload: any;` + notify-makeup-offer:36 `let __body: any;` + credit-expiry-warning:61 `(c: any) =>`) — batch-19 catalog refinement carry (Sub-D2 + Sub-D3 sub-classification)

- **Class total post-s47 projection** (direct post-state per s45 drift #7): ≥338 (post-s46) + 7 (batch-08 Sub-A) = **≥345**

- **Cross-batch reach (NOT counted in batch-08 ledger; deferred to owning batch)**:
  - [PortalHome.tsx:94/137/171/196](../../src/pages/portal/PortalHome.tsx:94) — 4× `(supabase.rpc as any)` for `respond_to_makeup_offer` (×3) + `cancel_booked_makeup` (×1). Allocate to batch-11 parent-portal when audited. Class-total carry only.

- **Severity reasoning (PLAN.md §4)**: Low anchors verbatim — "minor docstring/API inconsistency" + "code-hygiene drift". Class-consistent CAPS at LOW per batches 02-07 precedent (aggregate class).

- **Anchor fix surface (Phase C reference)**: remove gratuitous `(supabase.rpc as any)` casts (4 hook callsites) — `issue_make_up_credit`, `offer_makeup_slot`, `dismiss_makeup_match` are in types.ts and don't need the cast. `void_make_up_credit` cast is moot after F-08-003 resolution. Misc casts (3 sites) require types.ts regeneration or proper Supabase type narrowing patterns.

- **Phase C sprint candidate**: **S-32-ts-bypass-cast-cleanup** (clustered with F-02-033 closed-batch carries; codemod ≥345 sites class-wide).
- **Decision needed**: No.
- **Target sprint**: Phase C **S-32**.
- **Closure**: (open)

---

### F-08-007 — `notify-makeup-match/index.ts:9` bare `Deno.serve()` no `wrapEdgeFn` (CC-19 #10)

- **Severity**: Low (class CAPS-at-LOW per F-07-002 anchor precedent)
- **Area**: Edge fn Sentry instrumentation gap
- **Phase surfaced**: 1 (edge fn signature head audit)
- **Class anchor**: CC-19 #10 Sentry edge-fn instrumentation gap (F-07-002 closed batch-07 anchor + F-04-006 cohort)
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift" + "legacy artefacts"

- **Evidence** [`supabase/functions/notify-makeup-match/index.ts:1-31`](../../supabase/functions/notify-makeup-match/index.ts:1):

```typescript
1	import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
2
3	const corsHeaders = { /* ... */ };
4
5	// (no wrapEdgeFn import)
6
7	// [...]
8
9	Deno.serve(async (req) => {
10	  if (req.method === "OPTIONS") {
11	    return new Response(null, { headers: corsHeaders });
12	  }
13
14	  // WL-H2 FIX: This function is called by pg_net with service role Bearer token,
15	  // not by cron with x-cron-secret. Validate the Authorization header matches
16	  // the service role key.
17	  const authHeader = req.headers.get("Authorization");
18	  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
19	  if (!authHeader || !serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
20	    console.error("Unauthorized notify-makeup-match call");
21	    return new Response(
22	      JSON.stringify({ error: "Unauthorized" }),
23	      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
24	    );
25	  }
26	  // [...]
```

- **Class shape**: bare `Deno.serve(async (req) => {` without `wrapEdgeFn` wrapper. Uncaught exceptions in the handler bypass Sentry capture. 5/6 batch-08-listed edge fns properly wrap (Phase 4 §3 evidence); only notify-makeup-match bare.

- **Body-level health observations** (instance-aggravation check):
  - Custom Bearer service-role check at L17-19 is sound (POSITIVE auth pattern; different from cron-fn validateCronAuth because called via pg_net from `trg_notify_makeup_match` trigger, not cron)
  - Handler-level error paths all return responses ([:21-24](supabase/functions/notify-makeup-match/index.ts:21) 401, [:36-40](supabase/functions/notify-makeup-match/index.ts:36) 400, [:62-67](supabase/functions/notify-makeup-match/index.ts:62) 404, [:118-122](supabase/functions/notify-makeup-match/index.ts:118) skipped, [:145-150](supabase/functions/notify-makeup-match/index.ts:145) 500, [:157-162](supabase/functions/notify-makeup-match/index.ts:157) outer-catch 500) — no silent-swallow class match
  - Function does NOT send email (inserts to `internal_messages` table — in-app channel); shadow-mode N/A
  - NO new audit_log INSERT paths that would need Sentry observability gap — instance-aggravation NOT triggered
  - Class-consistent with F-07-002 anchor (which had stripe-auto-pay-installment 544L + 4 INSERT paths + Stripe-integration complexity but severity CAPS-at-LOW per class precedent)

- **Severity reasoning (PLAN.md §4)**: Low anchors verbatim — "code-hygiene drift" + "legacy artefacts". Class CAPS at LOW per CC-19 #10 class precedent.

- **Anchor fix surface (Phase C reference)**:
  ```typescript
  import { wrapEdgeFn } from "../_shared/sentry.ts";
  Deno.serve(wrapEdgeFn("notify-makeup-match", async (req) => {
    // [existing body]
  }));
  ```
  Mechanical 2-line change matching the pattern in 5/6 sibling batch-08 edge fns.

- **Phase C sprint candidate**: **S-33-sentry-edge-fn-coverage** (clustered with F-07-002 + F-04-006 + CC-19 #10 sweep targets).
- **Decision needed**: No.
- **Target sprint**: Phase C **S-33**.
- **Closure**: (open)

---

### F-08-008 — `DailyRegister.tsx:81-87` inline `supabase.from('teachers')` direct-read (F-05-009 class)

- **Severity**: Low (class CAPS-at-LOW per F-05-009 precedent)
- **Area**: Page-layer direct-read bypassing hook abstraction
- **Phase surfaced**: 1 (page walk)
- **Class anchor**: F-05-009 closed batch-05 LOW anchor (`RecurringRunDetail` inline `.from()` + vestigial PII select)
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift"

- **Evidence** [`src/pages/DailyRegister.tsx:76-90`](../../src/pages/DailyRegister.tsx:76):

```typescript
76	  // Fetch teachers list for the filter dropdown (owners/admins only)
77	  const { data: teachers = [] } = useQuery({
78	    queryKey: ['register-teachers', currentOrg?.id],
79	    queryFn: async () => {
80	      if (!currentOrg) return [];
81	      const { data } = await supabase
82	        .from('teachers')
83	        .select('id, display_name')
84	        .eq('org_id', currentOrg.id)
85	        .eq('status', 'active')
86	        .order('status', 'active');
87	        .order('display_name');
88	      return data || [];
89	    },
90	    enabled: !!currentOrg?.id && currentRole !== 'teacher',
91	  });
```

- **Class shape**: direct `supabase.from('teachers')` query inside page-level `useQuery` rather than via a dedicated hook (e.g., `useTeachers()` from `useTeachers.ts`). Bypasses the hook-discipline abstraction layer (Pattern #27 candidate).

- **Cross-batch reach**: `teachers` table is batch-04 (lessons-scheduling-deep, closed s43) owned; cross-tenant binding via `org_id` filter is correct; no PII leak (only `id` + `display_name` selected; `teachers.email` + other PII not selected). Class-divergent from F-05-009 anchor (which had vestigial PII select); this instance is hygiene-only.

- **Pattern #27 candidate scope clarification**: Pattern #27 candidate (hook-mediated supabase access discipline) applies to **components** (11/11 batch-08-owned components delegate via hooks per Phase 1.3). DailyRegister is a **page**, NOT a component; scope separate. This finding is class-divergent from Pattern #27 — pages may legitimately call `supabase.from()` directly if no domain-specific hook exists. F-08-008 logs the specific instance per F-05-009 class precedent; broader page-layer review deferred to batch-10 + batch-11 + batch-19.

- **Severity reasoning (PLAN.md §4)**: Low anchors verbatim — "code-hygiene drift". Class CAPS at LOW per F-05-009 precedent.

- **Anchor fix surface (Phase C reference)**:
  - **(a)** Extract to dedicated `useTeachers()` hook (idiomatic; reusable across batch-04/10/11 surfaces)
  - **(b)** Leave inline since single-use (less idiomatic but not load-bearing)
  - Recommend (a) for batch-04 hygiene; defer to batch-04 reviewer for canonical placement decision.

- **Phase C sprint candidate**: **S-34-page-layer-hook-extraction** (clustered with F-05-009 closed-batch carry).
- **Decision needed**: No.
- **Target sprint**: Phase C **S-34**.
- **Closure**: (open)

---

### F-08-009 — `auto_issue_credit_on_absence` NULL `proconfig` (CC-19 #6 sub-shape A)

- **Severity**: Low (class CAPS-at-LOW per CC-19 #6 sub-shape A precedent chain)
- **Area**: SECDEF trigger fn / search_path proconfig hygiene
- **Phase surfaced**: 2 (RPC body audit; one of 3 Tier 1 NULL proconfig batch-08-owned fns)
- **Class anchor**: CC-19 #6 sub-shape A (NULL proconfig negative; s45 + s46 reinforcement)
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift"

- **Evidence** (DB-verified Phase 2 via `pg_get_functiondef('public.auto_issue_credit_on_absence'::regproc::oid)` + `proconfig` column):
  - `prosecdef=true`, **`proconfig=NULL`** (no `SET search_path` clause)
  - `proacl={postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — anon EXECUTE granted (trigger-context)
  - Function body lacks the `SET search_path TO 'public'` clause that 14/16 batch-08-owned SECDEF fns have

- **Body-level health observations** (NULL proconfig is the SOLE defect):
  - Auto-issue logic is sophisticated with 4-fallback rate calculation (L57-79 invoice_item.unit_price_minor → student.default_rate_card_id → org default rate_card → lesson_participant.rate_minor)
  - Cap-enforcement (L82-106 max_credits_per_term + term_start lookup)
  - 4 compensated `audit_log` INSERT paths:
    - L18-22: `credit_voided_attendance_reversal` (attendance UPDATE reversal path)
    - L45-49: `credit_skipped_makeup_lesson` (makeup-loop prevention)
    - L101-104: `credit_cap_reached` (cap hit, no credit issued)
    - L122-125: `credit_issued` (auto-issued credit success)
  - **F-07-001 silent-swallow class watchpoint NEGATIVE**: explicit guard clauses (e.g., L14 `IF NEW.attendance_status NOT IN (...) THEN RETURN NEW; END IF;`); no `EXCEPTION WHEN OTHERS THEN RETURN;` patterns; all state-changing paths compensated

- **CC-19 #6 sub-shape A class context**:
  - Sub-shape A: SECDEF fn with NULL `proconfig` → relies on caller's `search_path` setting; if caller manipulates `search_path`, schema-injection class becomes possible
  - Sub-shape B: SECDEF fn with explicit `proconfig=[search_path=public]` → schema-injection blocked
  - Mitigation: explicit `SET search_path TO 'public'` clause; 14/16 batch-08-owned SECDEF fns already have this

- **Severity reasoning (PLAN.md §4)**: Low anchors verbatim — "code-hygiene drift". Class CAPS at LOW per CC-19 #6 sub-shape A precedent (s45 + s46 reinforcement chain). Body is well-formed otherwise — NULL proconfig is hygiene-only defect.

- **Anchor fix surface (Phase C reference)**: add `SET search_path TO 'public'` clause to function definition; mechanical 1-line change.

- **Phase C sprint candidate**: **S-35-secdef-search-path-hygiene** (clustered with F-08-010 + CC-19 #6 sub-shape A batch-19 enumeration).
- **Decision needed**: No.
- **Target sprint**: Phase C **S-35**.
- **Closure**: (open)

---

### F-08-010 — `confirm_makeup_booking` NULL `proconfig` (CC-19 #6 sub-shape A)

- **Severity**: Low (class CAPS-at-LOW per CC-19 #6 sub-shape A precedent chain; same as F-08-009)
- **Area**: SECDEF RPC body / search_path proconfig hygiene
- **Phase surfaced**: 2 (RPC body audit; one of 3 Tier 1 NULL proconfig batch-08-owned fns)
- **Class anchor**: CC-19 #6 sub-shape A
- **Severity rubric**: PLAN.md §4 LOW — "code-hygiene drift"

- **Evidence** (DB-verified Phase 2):
  - `prosecdef=true`, **`proconfig=NULL`**
  - Body is well-gated otherwise: `is_org_staff(auth.uid(), _org_id)` L6 + lesson-org cross-bind + capacity check + schedule-conflict check + audit_log INSERT `'makeup_booked'` L83
  - NULL proconfig is the SOLE defect

- **Severity reasoning (PLAN.md §4)**: Low anchors verbatim — same as F-08-009.

- **Anchor fix surface (Phase C reference)**: add `SET search_path TO 'public'`; mechanical 1-line change.

- **Phase C sprint candidate**: **S-35** (clustered with F-08-009 + CC-19 #6 sub-shape A batch-19 enumeration).
- **Decision needed**: No.
- **Target sprint**: Phase C **S-35**.
- **Closure**: (open)

---

## §7 Positive Pattern catalog additions

### Pattern #25 — Defensive-narrowing-via-roles in PERMISSIVE RLS policies (batch-08 reinforcement)

**Anchor**: s46 anchor at `auto_pay_attempts` "Org staff can view auto_pay_attempts" policy (batch-07 owned).

**Batch-08 reinforcement instances** (2 new):
- `attendance_records` "Staff can create attendance records" INSERT — `roles={authenticated}` (NOT Supabase-default `{public}`); `with_check=(can_edit_lesson(auth.uid(), lesson_id) OR is_org_admin(auth.uid(), org_id))`
- `attendance_records` "Staff can update attendance records" UPDATE — `roles={authenticated}`; `qual=(can_edit_lesson OR is_org_admin)`

**Class total post-s47**: 1 (s46) + 2 (s47) = **3 instances** for batch-19 enumeration.

**Batch-08 observation**: 15/17 batch-08-owned RLS policies use `roles={public}` (Supabase-default) and rely on predicate-gate fn body to anon-exclude; only 2 (attendance_records INSERT + UPDATE) defensively narrow to `roles={authenticated}`. Pattern #25 batch-19 sweep should target the 15 {public} instances for systemic defense-in-depth uplift.

NOT a new pattern (#25 is placed s46). Batch-08 reinforcement.

---

### Pattern #21 — Column-restricted state-machine guard (batch-08 reinforcement)

**Anchor**: s44 anchor — column-restricted state-machine guards via WITH CHECK clauses with status enum constraints.

**Batch-08 reinforcement instance** (1 new):
- `make_up_waitlist` "Parents can respond to waitlist offers" UPDATE — `qual=(guardian_id IN (SELECT g.id FROM guardians WHERE g.user_id=auth.uid()))`; **explicit `with_check=(guardian_id IN (...) AND status IN ('accepted', 'declined', 'waiting'))`** — guardian-ownership binding + state-machine constraint on status transitions to specific values

NOT a new pattern (#21 is placed s44). Batch-08 reinforcement.

---

### Pattern #20 — Per-element compensating rollback (batch-08 reinforcement)

**Anchor**: s44 anchor — per-element compensating rollback with audit-trail status capture.

**Batch-08 reinforcement instance** (1 new):
- `credit-expiry-warning/index.ts:91-262` per-credit loop with try/catch + `message_log` INSERT compensation at L244-257 (captures `status='sent' | 'failed'` per credit-iteration; J8-F15 FIX dedup on status='sent' allows retry on transient Resend outage)

NOT a new pattern (#20 is placed s44). Batch-08 reinforcement.

---

### available_credits VIEW security_invoker=on (POSITIVE observation; not yet pattern-numbered)

**Anchor**: s47 first instance in audited surface set.

**Defining property**: Postgres 15+ `security_invoker=on` view setting — caller's RLS applies via view (instead of OWNER's permissions bypassing RLS).

**Evidence** (DB-verified Phase 3 §1 via `pg_class.reloptions`):
- `relname=available_credits`, `relkind=v`, `owner=postgres`, `reloptions=["security_invoker=on"]`
- View definition: pure SELECT projection from `make_up_credits` with computed `credit_status` text column (`CASE WHEN redeemed_at IS NOT NULL THEN 'redeemed' WHEN expired_at IS NOT NULL THEN 'expired' WHEN expires_at < now() THEN 'expired' ELSE 'available' END`)
- No joins / aggregations / column filtering — pass-through with derived field
- Underlying `make_up_credits` RLS fully applies to view queries

**Class dimension**: RLS-bypass class candidate REFUTED. View opts into caller-RLS via explicit `security_invoker=on` reloption (Postgres 15+ opt-in; safer-than-default-OWNER-permissions setting).

**Cross-batch observation**: FIRST instance of `security_invoker=on` view setting in audited surface set (batches 01-08). Pattern catalog candidate: **#29 candidate — Caller-RLS-respecting view (security_invoker=on)**; defer ratification to batch-19 catalog refinement pass.

---

### Pattern #27 candidate — Hook-mediated supabase access discipline (NEW s47)

**Status**: PLACED AS CANDIDATE — final ratification at batch-19 catalog refinement pass.

**Defining property**: components delegate ALL Supabase access (.from/.rpc/.functions.invoke) via hooks; ZERO direct supabase calls in component files.

**Batch-08 evidence**: 11/11 batch-08-owned components delegate via hooks (Phase 1.3 enumeration):
- `src/components/makeups/×4` (AddToWaitlistDialog + MakeUpStatsCards + NeedsActionSection + WaitlistTable) — consume `useMakeUpPolicies` + `useMakeUpWaitlist` hooks; zero direct supabase calls
- `src/components/register/×4` (AbsenceReasonPicker + RegisterRow + StudentNotesPopover + UnmarkedBacklogView) — consume `useRegisterData` hook variants; zero direct supabase calls
- `src/components/students/×3` (CreditBalanceBadge + IssueCreditModal + MakeUpCreditsPanel) — consume `useMakeUpCredits` hook; zero direct supabase calls

**Distinguishes from**: `src/pages/DailyRegister.tsx:81-87` inline `supabase.from('teachers')` (F-08-008 LOW) — DailyRegister is a PAGE, not a component; pages may legitimately call supabase directly per page-layer convention. Pattern #27 scope is **components only**, not pages.

**Kinship**: Pattern #18 (per-row trigger on bulk-path UPDATE preserves audit; closed batch-04) extended at component layer.

**Cross-batch observation**: Pattern #27 evidence at batch-08 11/11; batch-19 sweep target — enumerate all components across batches; identify systemic gaps where direct supabase calls in components break the hook abstraction.

**Batch-19 deliverable**: ratify Pattern #27 catalog entry; cross-reference against batches 01-08 component sets; identify pattern-divergent component instances.

---

### Pattern #28 candidate — Shadow-mode interception via Lauren Shadow programme (NEW s47)

**Status**: PLACED AS CANDIDATE — final ratification at batch-19 catalog refinement pass.

**Defining property**: email-sending edge fns wrap Resend payload via `_shared/shadow-email.ts:transformEmailForShadow` interceptor; org with `shadow_mode=true` routes emails to SHADOW_RECIPIENTS instead of real recipients.

**Batch-08 evidence** (2/2 email-sending fns; Phase 4 §3):
- `credit-expiry-warning/index.ts:19 + :217-227` — imports + wraps Resend payload via transformEmailForShadow
- `notify-makeup-offer/index.ts:8 + :247-256` — imports + wraps Resend payload via transformEmailForShadow

**Shadow-email.ts implementation** ([`supabase/functions/_shared/shadow-email.ts`](../../supabase/functions/_shared/shadow-email.ts)):
- Default pass-through on any error (L72 orgId null → pass; L73 SHADOW_RECIPIENTS empty → pass; L83 DB query catch → pass-through) — SAFETY: bug in lookup must NOT silently route real org's emails to shadow recipients
- `organisations.shadow_mode` column DB-verified present (boolean DEFAULT false; Phase 4 §3 DB query)
- SHADOW_RECIPIENTS env-configurable; pass-through if unset (no email blackhole)
- Marks Sentry request as shadow on interception (L91 markRequestAsShadow)

**Cross-batch observation**: Pattern #28 candidate is a programme-wide infrastructure pattern. All email-sending edge fns should adopt it for Lauren Shadow term integrity. Batch-19 sweep target — enumerate all email-sending edge fns across batches; identify those NOT using transformEmailForShadow (outcome (b) per Phase 4 §3 three-outcome adjudication framing).

**Batch-19 deliverable**: ratify Pattern #28 catalog entry; cross-reference against all email-sending edge fns batches 01-08; identify pattern-divergent fns.

---

### Pattern #29 candidate — Caller-RLS-respecting view (security_invoker=on) (NEW s47)

**Status**: PLACED AS CANDIDATE — see "available_credits VIEW" entry above. Final ratification at batch-19 catalog refinement pass.

---

**Positive Pattern catalog total post-batch-08**: 25 placed + 4 candidates (#26 s46 + #27 NEW s47 + #28 NEW s47 + #29 NEW s47) = **29 entries** (was 26 placed+candidate pre-s47).

---

## §8 Class-consistency observations (non-allocation)

### §8.1 `void_credits_on_student_delete` cascade-completeness POSITIVE

Phase 2 §3 trigger fn body audit: `public.void_credits_on_student_delete` AFTER UPDATE on `students` fires when student is soft-deleted (`deleted_at IS NOT NULL`) or marked inactive (`status='inactive'`). Body voids all unredeemed credits via UPDATE setting `voided_at = NOW()` + `voided_by = auth.uid()` + appends `'Voided: student deleted'` to notes.

**Cascade-shape**: 
- Data-direction A (forensic completeness): voids preserved via `voided_at` + `voided_by` + notes append — full audit trail
- Safety-direction B (orphan prevention): prevents orphan unredeemed credits when student gone — no orphan risk
- **Both directions preserved**

**Class observation (not a finding)**: cascade-completeness-asymmetry POSITIVE instance — distinguishes from F-04-003 + F-05-002 data-loss-direction class anchors (which preserve safety only, NOT data). Compensated via batch-19-owned `audit_make_up_credits` AFTER I/U/D trigger captures the UPDATE.

Batch-19 sub-classification observation: sub-class A data-loss-direction (F-04-003 + F-05-002 anchors) vs sub-class B safety-direction (batch-06 payment_id + batch-07 invoice_installments.payment_id observation) vs **sub-class C both-directions-preserved (batch-08 void_credits_on_student_delete POSITIVE)**.

### §8.2 `validate_waitlist_credit_ownership` value-integrity validation POSITIVE

Phase 2 §3 trigger fn body audit: `public.validate_waitlist_credit_ownership` BEFORE I/U on `make_up_waitlist`. If `NEW.credit_id IS NOT NULL`, validates that `make_up_credits` row WHERE `id=NEW.credit_id AND student_id=NEW.student_id AND org_id=NEW.org_id` exists; RAISE EXCEPTION otherwise.

**Class observation**: Pattern #25-adjacent value-integrity validation (cross-binds credit.student_id + credit.org_id to waitlist row; rejects cross-tenant credit linkage). Kinship to s46 Pattern #23 (non-SECDEF row-lock validation trigger). Carry to Phase 7 as positive instance.

### §8.3 `auto_issue_credit_on_absence` 4-fallback rate calculation POSITIVE

Phase 2 §3 trigger fn body audit (NULL proconfig F-08-009 noted): sophisticated 4-fallback rate calculation for credit value:
- Fallback 1 (L57-61): `invoice_items.unit_price_minor` for the lesson + student (highest precedence)
- Fallback 2 (L64-69): `students.default_rate_card_id → rate_cards.rate_amount_minor` (student-specific rate)
- Fallback 3 (L72-77): `rate_cards.rate_amount_minor` WHERE `org_id=NEW.org_id AND is_default=true` (org default)
- Fallback 4 (L80-86): `lesson_participants.rate_minor` snapshot at participant insert (CRD-H2 FIX)
- Final guard L94: `IF COALESCE(_credit_value, 0) <= 0 THEN RETURN NEW;` — no credit issued if all fallbacks fail (positive guard; not silent-swallow because no error to swallow — config absence is config state, not error)

**Class observation**: defense-in-depth fallback chain. Multi-source authoritative-data resolution. Not a new pattern; class-consistent with multi-layer guard patterns. Carry to batch-19.

### §8.4 Generated-types pipeline drift mixed observation

Phase 1.5 + Phase 2 cross-check: 10/10 CENSUS-listed batch-08 RPCs aligned DB ↔ types.ts (POSITIVE); +1 STALE entry (`void_make_up_credit` in types.ts:7418 missing from pg_proc — F-08-003 evidence).

| RPC | types.ts presence | DB pg_proc presence |
|---|---|---|
| `issue_make_up_credit` | YES | YES |
| `redeem_make_up_credit` | YES | YES |
| `void_make_up_credit` | YES | **NO (phantom)** |
| `find_waitlist_matches` | YES | YES |
| `confirm_makeup_booking` | YES | YES |
| `offer_makeup_slot` | YES | YES |
| `respond_to_makeup_offer` | YES | YES |
| `cancel_booked_makeup` | YES | YES |
| `dismiss_makeup_match` | YES | YES |
| `cleanup_withdrawal_credits` | YES | YES |
| `seed_make_up_policies` | YES | YES |

CC-19 #7 generated-types-pipeline-drift class: mixed batch-08 observation (positive 10/10 alignment + 1 negative stale entry). Stale entries indicate migration-replay drift — batch-19 PI-09 sweep target.

### §8.5 useCan unimplementation positive observation

Phase 1.3 + Phase 2 component audit: all 11 batch-08-owned components are role-check-free (no `useCan` / `role === 'admin'` / `app_metadata.role` checks). Server-side delegation via SECDEF RPCs with `is_org_staff` / `is_org_admin` body gates.

Class-consistent with batch-06 + batch-07 hook role-check-free pattern (continues server-side delegation pattern across batches 06-08).

### §8.6 Hook-discipline positive observation (Pattern #27 candidate evidence)

11/11 batch-08-owned components delegate via hooks (Phase 1.3 evidence). See §7 Pattern #27 candidate.

### §8.7 Shadow-mode interception positive observation (Pattern #28 candidate evidence)

2/2 email-sending batch-08 edge fns route via `transformEmailForShadow` (Phase 4 §3 evidence). See §7 Pattern #28 candidate.

---

## §9 Cross-batch carries

### §9.1 F-05-005 + F-07-001 class-consistency carry → F-08-004 + F-08-005 (Phase 4 allocation)

F-05-005 closed batch-05 + F-07-001 closed batch-07 silent-swallow class chain extends to batch-08 surface at:
- `credit-expiry/index.ts:86-87` (F-08-004 single instance)
- `waitlist-expiry/index.ts:25 + :48 + :65` (F-08-005 3 internal paths bundled per F-05-005 anchor precedent)

Operational-correctness CAPS-at-HIGH class chain post-s47: F-05-003 + F-05-004 + F-05-005 + F-06-005 + F-06-007 + F-07-001 + **F-08-004** + **F-08-005** = **8 instances**.

### §9.2 F-02-005 + F-07-003 composition chain → F-08-001 (Phase 2 allocation)

F-02-005 closed batch-02 CRITICAL anchor (`record_stripe_payment` anon-callable SECDEF + zero body auth) + F-07-003 closed batch-07 CRITICAL anchor (`record_installment_payment` composition CRITICAL via F-02-005) class anchor stack extends to batch-08 surface at `cleanup_withdrawal_credits` (F-08-001 standalone CRITICAL via parameter-spoofing + financial-falsification class shape — same anchor stack, no composition needed; bracket CAPS at CRITICAL per class-consistency).

### §9.3 F-02-002 class-consistency carry → F-08-002 (Phase 2 allocation)

F-02-002 closed batch-02 CRITICAL anchor (`get_students_for_org` anon-callable SECDEF + cross-tenant child-PII exfiltration) class extends to batch-08 surface at `find_waitlist_matches` (F-08-002 standalone CRITICAL via cross-tenant child-PII class shape; bounded `LIMIT 10` is magnitude factor, not class-modifier).

### §9.4 PI-09 cross-cutting class → F-08-003 (Phase 5 event #11)

PI-09 HIGH anchor (migration-replay-safety class; "migration files reference pre-s36 `rate_amount` column; live functions use `rate_amount_minor`") class extends to batch-08 surface at `void_make_up_credit` phantom (F-08-003 HIGH via class-precedent reassessment from F-01-001 candidate; event #11 bracket-shift). PI-09 cohort enriched by F-08-003; PI-09 status unchanged active.

### §9.5 waitlist-respond batch-14 carry-forward (CC-3 CENSUS reclassification)

**CENSUS misclassification observation (Phase 4)**: `supabase/functions/waitlist-respond/index.ts` was tagged in CENSUS §3.10 line 347 as `08-attendance-credits-waitlists` but body operates ENTIRELY on batch-14 surface (`enrolment_waitlist` table at L87-91 + `respond_to_enrolment_offer` RPC at L115-122, both batch-14-owned per CENSUS §4.6 line 576). CENSUS Phase 10 Category C edit **CC-3** reclassifies this fn to batch-14 ownership.

**Body audit observations for batch-14 reference** (Phase 4 §1 evidence):
- JWT verification via `jose` v5.2.0 + `WAITLIST_JWT_SECRET` env (HS256 HMAC signature)
- Standard `jose.jwtVerify(token, secret)` with try/catch fallback to "Link Expired" HTML page (does not leak verify-error details)
- Claims include `waitlist_id` + `org_id`; both validated before use (L73-81)
- Row fetch uses compound key `(id, org_id)` at L86-91
- State-machine check enforces one-shot consumption: if `entry.status !== "offered"`, returns "Already Responded" HTML page (L100-112; replay prevention via DB state)
- State transition via atomic RPC `respond_to_enrolment_offer` (WL-H5 race-condition fix per inline comment at L114)
- No `jti` claim or token-revocation table — replay prevention solely via DB state-machine (one-shot semantics)

**Verdict**: JWT verification SOUND. No CRITICAL JWT-class defect at this fn body. **Batch-14 audit at s53+ may reference this prior body audit; closed-batch immutability per PLAN.md §6 protects this observation.**

### §9.6 Cross-batch reach observation table (Phase 2 + Phase 4 evidence)

| Surface | Owning batch | Action |
|---|---|---|
| `respond_to_makeup_offer` × 3 + `cancel_booked_makeup` × 1 callsites at [PortalHome.tsx:94/137/171/196](../../src/pages/portal/PortalHome.tsx:94) | batch-11 parent-portal | 4× Sub-A class-carry to batch-11 when audited (s51+) |
| `cleanup_withdrawal_credits` invocation at [bulk-process-continuation/index.ts:394](../../supabase/functions/bulk-process-continuation/index.ts:394) | batch-09 term-continuation | Service-role adminClient legitimate caller path; full caller audit at batch-09 (s48 NEXT) |
| `offer_makeup_slot` comment-trace at notify-makeup-offer/index.ts:24 + waitlist-expiry/index.ts:28 | batch-08 internal | Phase 4 body audit; intent-acknowledged |
| `on_slot_released` trigger calls `find_waitlist_matches` | batch-04 closed s43 | Internal trigger context legitimate (NEW.org_id from RLS-gated attendance INSERT) |

### §9.7 9 batch-19 sweep targets (Phase 7 Task 7.4 enumeration; carry from s46 + s47 contributions)

1. **CC-19 #11 CI-enforced positive-amount CHECK** on financial-table amount_minor columns — batch-08 contributes 1 positive instance (`make_up_credits.credit_value_minor CHECK > 0`); cohort: 5 negative (batches 06+07) + 2 positive (recurring_template_items batch-05 + credit_value_minor batch-08) = **7 entries**
2. **CC-19 #14 claimed-service-role-gate misnaming sub-shape sweep** — batch-08 **0 instances** (DB-verified Phase 7 Q2); class total **2 anchors (unchanged)**
3. **CC-19 #15 dead-code SECDEF RPCs + orphan trigger fns sweep** — batch-08 **0 instances** (DB-verified Phase 7 Q3 orphan check + Phase 1+2 dead-code check); class total **4 instances (unchanged)**. NOTE: F-08-003 phantom is INVERSE shape (different class — callers exist + function missing vs function exists + callers absent)
4. **Pattern #6 catalog refinement** — batch-08 contributes 2 sub-shape data-model-integrity-reliance observations (make_up_credits + make_up_waitlist parent SELECT policies without explicit org_id qual; rely on student_id/guardian_id chain global-uniqueness)
5. **Cascade-completeness-asymmetry sub-classification** — batch-08 contributes 1 sub-class C BOTH-DIRECTIONS-PRESERVED POSITIVE instance (void_credits_on_student_delete; §8.1)
6. **Pattern #25 defensive-narrowing-via-roles enumeration** — batch-08 contributes 2 instances (attendance_records INSERT + UPDATE roles={authenticated}); class total **3 instances** (1 s46 + 2 s47)
7. **Pattern #26 candidate ratification** — batch-08 contributes 0 instances matching log-shape cohort (4 batch-08-owned tables all have mutation policies; NEGATIVE for batch-08)
8. **CC-19 #8 E2E fixture hygiene** — Supabase auth-js storage mock unhandled rejections baseline carry (carried s45; no advancement s47 — baseline test delta 0 vs Phase 0)
9. **CC-19 #1 EXECUTE-grant hygiene** — batch-08 contributes 26 anon-EXECUTE-granted SECDEF instances (16 batch-08-owned + 10 cross-batch reach); systematic REVOKE sweep target

### §9.8 Batch-19 catalog refinement carries (post-s47)

- **Pattern #6 sub-shape** (data-model-integrity reliance; parent-policy without explicit org_id qual): +2 instances (make_up_credits SELECT parent + make_up_waitlist SELECT parent)
- **F-01-017 class** (UPDATE policy lacks explicit WITH CHECK; default-to-qual semantics): +2 instances (attendance_records UPDATE + make_up_credits UPDATE)
- **TS-bypass-cast Sub-D sub-classification** (NEW s47): Sub-D1 helper-param `supabase: any` (s46 anchor); Sub-D2 variable annotation `let X: any` (+2 s47: notify-makeup-match:33, notify-makeup-offer:36); Sub-D3 inline-arrow param `(X: any) =>` (+1 s47: credit-expiry-warning:61)
- **Pattern #25 enumeration scope expansion** (s46 anchor): 15 {public} + 2 {authenticated} across 17 batch-08 policies; class total 1 → 3
- **Pattern #26 candidate ratification result**: 0 batch-08 instances (sweep result negative for batch-08; defer ratification)
- **Pattern #27 candidate** (NEW s47): hook-mediated supabase access discipline (11/11 batch-08 components)
- **Pattern #28 candidate** (NEW s47): shadow-mode interception (2/2 batch-08 email-sending fns)
- **Pattern #29 candidate** (NEW s47): caller-RLS-respecting view (security_invoker=on; 1 batch-08 instance at available_credits)

---

## §10 PI register

**Batch-08 PI seed**: PI-17 MEDIUM (credit-expiry UTC date for non-UTC orgs off by ±12h) — **NOT closed at batch-08** (none of batch-08's 2C/3H/0M/5L matches MEDIUM bracket; class-consistent with timezone-cross-cutting batch-19 sweep). PI-17 carries to batch-19 as PI-17 + batch-19 partial ownership unchanged.

**Cohort unchanged at 8 active+partial / 3C / 4H / 1M / 0L**:

| # | PI | Severity | Owning batch | Status |
|---|---|---|---|---|
| 1 | PI-01 | CRITICAL | 10 (reports-analytics-payroll) | Active |
| 2 | PI-12 | CRITICAL | 17 (loopassist) | Active |
| 3 | PI-13 | CRITICAL | 09 + 19 | Active |
| 4 | PI-09 | HIGH | 19 | Active (cohort enriched by F-08-003 cross-cutting class instance) |
| 5 | PI-10 | HIGH | 15 + 18 | Active |
| 6 | PI-15 | HIGH (partial) | 09 canonical | Partially-resolved |
| 7 | PI-16 | HIGH | 17 (loopassist) | Active |
| 8 | PI-17 | MEDIUM | 08 + 19 | Active (NOT closed at batch-08; carries to batch-19) |

**No new PIs surfaced s47.** **No PI closures s47.**

---

## §11 Audit-method appendix

### §11.1 Severity-adjustment events (11 cumulative; +1 from s46)

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
| 10 | F-07-003 mid-session (s46 Phase 3) | (Phase 3 HIGH operational pre-class) ↑ CRITICAL (Phase 3 composition) | Pre-class HIGH per operational-correctness CAPS class consistency; bracket-shifted to CRITICAL via composition chain with F-02-005 closed-batch CRITICAL anchor (anon-callable financial-falsification). Anchored by F-06-001+F-06-003 s45 event #9 precedent. Class: parameter-spoofing + financial-falsification 2-fn class. |
| **11** | **F-08-003 mid-session (s47 Phase 5)** | **(Phase 2 CRITICAL tag) ↓ HIGH (Phase 5 class-precedent reassessment)** | **F-01-001 anchor REFUTED via 6-dimension class-shape comparison (F-01-001 end-user-facing + silent + marketed-feature + parameter-mismatch vs F-08-003 admin-utility + loud + admin-utility + phantom-via-migration-drift) → class-divergent. PI-09 HIGH anchor adopted; operational-correctness CAPS-at-HIGH chain (s44 events #5-#7 + s45 event #8 precedent). Driver type: class-precedent reassessment (not composition-driven), kinship to s44 events #5-#7. Class: phantom-RPC + migration-replay-drift sub-class chain.** |

**Methodology principles** (carry from s45 + PLAN.md §4.1):
- Pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments
- Mid-session adjustments are EVENTS when severity class bracket shifts
- Pre-class refinements WITHIN a bracket are NOT events
- Class-consistency precedent is primary anchor for adjudication

### §11.2 Class-consistency anchors used (s47)

- **F-02-002** cross-tenant child-PII exfiltration anchor → F-08-002 class-instance allocation
- **F-02-005 + F-07-003** parameter-spoofing + financial-falsification composition anchor → F-08-001 class-instance allocation
- **F-01-001** anchor candidate REFUTED via 6-dim comparison → F-08-003 class-precedent reassessment to PI-09 HIGH anchor (event #11)
- **F-05-005 + F-07-001** silent-swallow class chain → F-08-004 + F-08-005 class-instance allocations
- **F-02-033 / CC-19 #7** TS-bypass-cast aggregate anchor → F-08-006 class-instance allocation
- **CC-19 #10** Sentry edge-fn gap anchor → F-08-007 class-instance allocation
- **F-05-009** inline `.from()` direct-read class anchor → F-08-008 class-instance allocation
- **CC-19 #6 sub-shape A** NULL proconfig anchor → F-08-009 + F-08-010 class-instance allocations

### §11.3 Methodology-discipline ledger (3-category)

#### Category 1 — Reviewing-Claude origin pre-investigation drifts: cumulative count 24

| Session | Count | Drifts + mitigations |
|---|---|---|
| s42 | 3 | table-name guesses (lesson_attendance vs attendance_records; 4-vs-8 RLS table count; busy_blocks vs external_busy_blocks). Mitigation: `information_schema.tables` regex-match BEFORE IN-list construction |
| s43 | 3 | trigger-event CASE WHEN first-match decode bug; TS-bypass-cast grep undercount; bun→npm assumption. Mitigation: bit-decode CTE, 4-sub-pattern enumeration, package-manager auto-detect |
| s44 | 5 | column-name guess; column-value guess; Sub-pattern C grep matches JS comments; Sub-pattern D regex misses default-value annotation; refunds.status unconstrained-text framing wrong. Mitigation: `pg_constraint contype='c'`, `pg_enum`, `pg_get_functiondef` body filter |
| s45 | 7 | RPC regex narrow; auto-pay-installment batch over-attribution; tally check format brittle; hallucinated Connect-onboarding fn names; trigger count 14 vs 15; partial UNIQUE INDEX shape missed; cumulative-tally projection arithmetic error. Mitigations: pg_proc × CENSUS cross-check; filesystem-first edge fn enumeration; CENSUS owning-batch verbatim cite; DB-verified counts canonical; `pg_indexes WHERE indexdef` alongside `pg_constraint`; direct post-state cohort projection |
| s46 Phase 0 | 3 | auto-pay-upcoming-reminder + auto-pay-final-reminder batch-06 over-attribution (recurrence of s45 #2 class); recurring_* batch-14 misattribution; src/ over-broad scope (CENSUS row 07 = 0R/0P). Mitigations: CENSUS verbatim-cite (recurrence-mitigation); CENSUS row R/P verification before src/ scope claims |
| **s47** | **3** | **#22 Phase 0**: PG POSIX regex word-boundary `\bas any\b` returned 0 rows; PG POSIX flavour uses `\y` or `[[:<:]]`/`[[:>:]]`, NOT Perl `\b`. Mitigation: prefer `position()` literal substring match for table/fn name predicates. **#23 Phase 0**: bun-not-installed despite bun.lockb present; auto-detect script assumed lockfile-presence implies tool-availability. Mitigation: verify implied tool on $PATH via `command -v <tool>` BEFORE invoking install; fall back to alternative tool when missing. **#24 Phase 1**: `\bas any\b` grep -E ERE regex returned 0 matches when 7 instances existed; grep -E ERE `\b` is UNSUPPORTED (vendor extension only); buggy regex came from reviewing-Claude Phase 1 paste-back §1.5. Consolidated mitigation: word-boundary regex flavor discipline across PG POSIX + grep variants — PG POSIX `\y`/`[[:<:]]`/`[[:>:]]`; grep -P PCRE `\b` supported; grep -E ERE `\b` UNSUPPORTED; always counter-test (anchored ≤ unanchored; zero-against-non-empty-unanchored = anchor wrong). Cross-class theme: drifts #22 + #24 share word-boundary regex flavor assumption root cause. |

#### Category 2 — Environment caveats discovered s46: cumulative 1 (unchanged through s47)

- **Git object database corruption with partial blob unreadability** for some HEAD-pinned blobs (e.g., `stripe-auto-pay-installment/index.ts` blob `49213e0f...` unreadable via `git show`; reflog corruption + broken historical objects from `git fsck` output)
- **s46 Phase 10 sub-class extension**: tree-build requires valid blob refs for ALL HEAD-tree files, not just touched files; recovery via fresh-clone + local-fetch from /tmp/lessonloop3-deploy of s45 commit objects
- **Mitigation**: filesystem Read with `git diff HEAD -- <path>` pre-verification of working-tree cleanliness vs HEAD; /tmp/lessonloop3-deploy is SUPERSEDED post-s46; **/tmp/lessonloop3-fresh is canonical post-s46**
- **Generalization**: technique applicable to future sessions with corrupted git state

#### Category 3 — CC-origin methodology drifts s46: cumulative 1 (unchanged through s47)

- **Drift #5 (Phase 2 CC-origin)**: Sub-pattern D undercount at Phase 2 EXIT; missed 2 `supabase: any` helper signature instances at `stripe-auto-pay-installment/index.ts:10` (`async function incrementAndCheckPause(supabase: any, ...)`) + `:60` (`async function invokeFailureNotification(supabase: any, ...)`)
- **Mitigation rule** (logged for future Phase 2 audits): run explicit `grep -nrE "supabase:\s*any"` on all edge fn helper signatures BEFORE Phase 2 EXIT
- **Class anchor**: s44 4-sub-pattern enumeration Sub-pattern D (`supabase: any` parameter annotation in handler/helper signatures); s45 reinforcement
- **Class total correction**: ≥336 (Phase 2 EXIT claim) → ≥338 (Phase 6 corrected count); +2 reattributed to batch-07 edge-fn surface

#### §11.4 Cumulative total

**24 (Cat 1) + 1 (Cat 2) + 1 (Cat 3) = 26 entries** entering s48.

**Counter distinction maintained** (PLAN.md §4.1 + audit-method appendix §11 discipline):
- Severity-adjustment events (handover §9 table): 11 cumulative through s47
- Methodology drift ledger (this §11 audit-method appendix): 26 cumulative through s47
- Counters DISTINCT per PLAN.md §4.1 + s46 Phase 6 pushback resolution

#### §11.5 Sub-D sub-classification (NEW s47; batch-19 catalog refinement carry)

NOT a methodology drift; sub-classification of existing class (TS-bypass-cast Sub-D):

| Sub-shape | Description | Anchor | Batch-08 count |
|---|---|---|---|
| Sub-D1 | Helper-function parameter `supabase: any` | s46 anchor at stripe-auto-pay-installment:10 + :60 | 0 batch-08 |
| Sub-D2 | Variable annotation `let X: any` | s47 first declaration | 2 (notify-makeup-match:33 + notify-makeup-offer:36) |
| Sub-D3 | Inline-arrow parameter `(X: any) =>` | s47 first declaration | 1 (credit-expiry-warning:61) |

Cumulative-ledger entry NOT incremented (sub-classification, not drift). Batch-19 catalog refinement target.

---

## §12 Cohort tally (post-batch-08)

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active+partial | 8 | 3 | 4 | 1 | 0 |
| Batch 01 (closed s40) | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (closed s41) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (closed s42) | 5 | 0 | 4 | 1 | 0 |
| Batch 04 (closed s43) | 5 | 0 | 3 | 2 | 0 |
| Batch 05 (closed s44) | 11 | 2 | 5 | 1 | 3 |
| Batch 06 (closed s45) | 8 | 2 | 3 | 0 | 3 |
| Batch 07 (closed s46) | 7 | 1 | 1 | 1 | 4 |
| **Batch 08 (closed s47)** | **10** | **2** | **3** | **0** | **5** |
| **GRAND ACTIVE** | **126** | **18** | **37** | **24** | **47** |

**Arithmetic verification** (s45 drift #7 mitigation — direct post-state cohort projection):
- Row sum: 8+36+36+5+5+11+8+7+10 = **126** ✓
- C: 3+3+5+0+0+2+2+1+2 = **18** ✓
- H: 4+4+10+4+3+5+3+1+3 = **37** ✓
- M: 1+10+8+1+2+1+0+1+0 = **24** ✓
- L: 0+19+13+0+0+3+3+4+5 = **47** ✓
- Column sum check: 18+37+24+47 = **126** ✓

**Net delta from 116 (16C/34H/24M/42L)**: +2C / +3H / 0M / +5L = +10 active findings (batch-08 contribution). PI cohort delta: 0 (no PI closures; PI-17 + PI-09 cohort enriched).
