# Batch 11 — Parent Portal

**Session**: s50
**Date**: 2026-05-15
**HEAD pin**: `<s50 Phase 10 commit SHA>`
**Status**: CLOSED
**Findings allocated**: 4 (1C / 1H / 0M / 2L); F-11-001 ID RELEASED

---

## §1 Batch overview

### 1.1 Surface enumeration

CENSUS attribution: **8 portal routes / 8 portal pages / 2 batch-11-canonical edge fns / 2 batch-11-canonical RPCs (CENSUS:574 + 623) + 6 cross-batch-attributed RPCs in-scope per launch prompt §7 / 0 batch-11-canonical tables (lesson_notes primary owner batch-04 closed; guardians + student_guardians + guardian_payment_preferences cross-batch consumer-side) / 12 parent/portal/guardian/student hooks**.

| Surface class | Count | Anchors |
|---|---|---|
| Routes (CENSUS §1.3 lines 42-53) | 8 | `/portal/home`, `/portal/schedule`, `/portal/practice`, `/portal/resources`, `/portal/invoices`, `/portal/messages`, `/portal/profile`, `/portal/continuation` |
| Pages (CENSUS §2.5 lines 190-201) | 8 | `PortalHome.tsx`, `PortalSchedule.tsx`, `PortalPractice.tsx`, `PortalResources.tsx`, `PortalInvoices.tsx`, `PortalMessages.tsx`, `PortalProfile.tsx`, `PortalContinuation.tsx` |
| Edge functions (CENSUS:398-399) | 2 batch-11-canonical | `send-parent-enquiry`, `send-parent-message` (both audited Phase 4 §3) |
| SECDEF RPCs batch-11-scope (Phase 1) | 8 total | 2 batch-11-canonical: `get_parent_dashboard_data` (CENSUS:623), `get_parent_lesson_notes` (CENSUS:574); 6 cross-batch-attributed in-scope per launch prompt §7: `backfill_guardian_default_pm_set` (CENSUS:559 batch-06 closed), `anonymise_guardian` (CENSUS:633 batch-01 closed), `get_guardian_ids_for_user` + `get_student_ids_for_parent` + `is_org_parent` + `is_parent_of_student` (batch-02 closed via F-02-009 + F-02-020) |
| Triggers | 0 owned | consumer-side observation: lesson_notes lacks `audit_lesson_notes` trigger (DB-verified Phase 6 §5.3; CC-19 #3 cohort) |
| Cron jobs | 0 | no batch-11 cron jobs |
| Tables | 0 owned | consumer-side audits via cross-batch tables: guardians (batch-02), student_guardians (batch-02), guardian_payment_preferences (CENSUS:1027), lesson_notes (batch-04 closed; parent-side carved out to batch-11 per batch-04 §21) |
| Hooks (CENSUS §9.4 + §10.A lines 1018+) | 12 | `useParentConversations`, `useParentCredits`, `useParentEnquiry`, `useParentInstruments`, `useParentLoopAssist` (V2 §3.3 HIDDEN cross-batch reach to batch-17), `useParentOnboardingProgress`, `useParentPortal`, `useParentReply`, `usePortalFeatures`, `usePortalLink`, `useRealtimePortalPayments`, `useRelatedStudent` |

**Cat C edits (2 scoped for Phase 10)**:
- `backfill_guardian_default_pm_set`: CENSUS:559 batch-06 → batch-11 (canonical-consumer attribution; F-06-002 closed-batch-06 audit retained per closed-batch immutability)
- `anonymise_guardian`: CENSUS:633 batch-01 → batch-11 (no prior batch-01 audit body coverage found; fresh batch-11 audit conducted Phase 1)

### 1.2 Batch close metadata

- **Session**: s50 (2026-05-15)
- **Prior session**: s49 closed batch-10 reports-analytics-payroll at HEAD `47383d97` (8 findings: 1C/1H/1M/5L)
- **HEAD pin (s50 close)**: `<s50 Phase 10 commit SHA>` (literal placeholder per drift #25; SHA recorded externally)
- **Phase timeline**: 10 phases executed (0-10) + Phase 2 §B git push hygiene sub-phase (3 outstanding s47/s48/s49 commits pushed to origin/main)

### 1.3 Finding count + severity histogram

**4 active findings + 1 RELEASED**: **1C / 1H / 0M / 2L**:
- F-11-001 RELEASED (PI-50-B → F-01-036 closed-batch-01 citation-only)
- F-11-002 LOW (CC-19 #1 helper-fn EXECUTE-grant hygiene cohort)
- F-11-003 HIGH (useParentLessonNotes RPC named-parameter mismatch always-errors at PG layer)
- F-11-004 CRITICAL (get_parent_dashboard_data NULL-conditional auth gate bypass; Pattern #40 anchor)
- F-11-005 LOW (send-parent-enquiry rate-limit bucket-key stale name; CC-19 #16 Sub-class A anchor)

### 1.4 Session phase summary (input to §11 audit-method)

| Phase | Tasks | Output highlight |
|---|---|---|
| 0 | Setup + READ-FIRST + PI-50 ratification + drift #30 surfaced | HEAD verified `47383d97`; baseline tests match s49 exactly (471/5/30/3); tally 141 (18C/41H/26M/56L) confirmed; PI cohort 5; 2 CENSUS batch-attribution observations surfaced (backfill_guardian_default_pm_set CENSUS:559 batch-06 + anonymise_guardian CENSUS:633 batch-01) |
| 1 | SECDEF RPC body + grant audit (8 RPCs) + drift #29 mandate + drift #30 + #30.A + #31 ratified | 5 of 8 RPCs already covered by closed-batch findings via extended TASK 0 grep; 3 fresh batch-11 audits (anonymise_guardian + get_parent_dashboard_data + get_parent_lesson_notes); F-11-004 candidate surfaced (PL/pgSQL NULL-conditional bypass — Phase 2A pre-tag CRITICAL); F-11-003 candidate surfaced (FE-RPC param mismatch); F-11-001 → F-01-036 citation-only |
| 2 §B | Push hygiene — 3 outstanding s47/s48/s49 audit commits pushed | fast-forward push to origin/main; pre-push 7bdea67e (s46) → post-push 47383d97 (s49 close); workflow rule s51+ Phase 0 push hygiene check registered |
| 2A | F-11-004 NULL-conditional live test (TEST 1 PG semantics + TEST 2 anon-context invocation) | F-11-004 CRITICAL CONFIRMED via SET LOCAL ROLE anon + auth.uid()=NULL + non-empty JSON children PII return; 6-dim 6/6 match vs F-02-002 anchor; Pattern #40 anchor candidate |
| 2B | RLS policy audit (4 tables; 24 policies) + drift #30.A operational scope clarification | 24 PERMISSIVE policies; F-01-017 +2 instances (guardians + student_guardians UPDATE) cohort reinforcement; PI-50-E → F-01-005 closed-batch-01 citation-only Option A; CC-19 #3 lesson_notes audit-trigger gap |
| 3 | FE consumer audit (8 portal pages + 12 hooks) | 0 direct `.rpc()`/`.from()` in portal pages; Layer 1 STRONG (RouteGuard + allowedRoles=['parent']); F-11-003 ACTIVE confirmed via PortalSchedule.tsx:124 → useParentLessonNotes(...) call chain → PG SQLSTATE 42883 verbatim error; F-11-004 FE bypass SAFE per useParentPortal.ts:111-122 session-bound cites; F-01-005 FE exploit-feasibility unchanged (0 direct `.from('lesson_notes')` in portal FE); ParentLoopAssist V2 §3.3 HIDDEN-but-wired cross-batch reach to batch-17 |
| 4 | Edge fn consumer audit (filesystem-first; 106 total) | 2 fresh batch-11 audits (send-parent-enquiry + send-parent-message) both production-grade (STRONG JWT + service-role isolation + body-level guardian check + rate-limit + Sentry wrapEdgeFn + XSS protection + message-ownership check on reply path); PI-50-A → F-06-002 closed-batch-06 citation-only confirmed via admin-backfill-default-pm L29-93 verbatim verification |
| 5 | Severity adjudication + Pattern catalog candidate review | F-11-001 → F-01-036 citation-only (drift #30.A manifestation #3); F-11-002 LOW + F-11-003 HIGH (bracket-pair adjudication) + F-11-004 CRITICAL (same-bracket confirmation) + F-11-005 LOW (Phase 5 fresh-allocation rate-limit-key-mismatch); Pattern #40 PLACED proposal + Sub-E sub-class under CC-19 #7 proposal |
| 6 | Cross-cutting CC-19 sweep + CC-19 #11 NOT-VALID variant + rate-limit-key-mismatch new sweep | Per-CC-19# consolidation table; 0 NOT-VALID variant on batch-11 tables; lesson_notes audit-trigger gap DB-verified; Sub-E 32-instance retrospective count DB-verified; CC-19 #16 NEW proposal "rate-limit-key-mismatch" with Sub-class A + Sub-class B discriminators (4 instances total: 1 batch-11 + 3 batch-12 cross-batch) |
| 7 | Late-surfacing scan + PI closure verification + drift #30.B sub-drift ratified | 0 late-surfacing findings; PI cohort 5 → 5 unchanged; 5 Pattern candidates unchanged; cross-batch reach 11-item inventory consolidated; Sub-class B 3 instances all CENSUS-verified batch-12 (CORRECTION from Phase 6 batch-03 assumption) |
| 8 | Pattern catalog promotion (formal RATIFY) + PLAN.md doc-write text generation | Pattern #40 + Sub-E + CC-19 #16 RATIFIED with verbatim ready-to-commit text blocks; Drift #30.B sub-drift ratified |
| 9 | PI candidate final adjudication + drift #27 two-line arithmetic verification | 5 PI-50 candidates resolved; F-11-001 ID RELEASED per s48 F-09-004 precedent; drift #27 two-line check clean (5−0+0=5; 141+4−0=145; 19+42+26+58=145); Corrections 1-3 from Phase 8 applied verbatim |
| 10 | Doc edits + commit + handover snapshot | This findings doc + STATUS.md + CENSUS.md (2 migrations) + PLAN.md + HANDOVER.md + reviewing-claude-s50-close.md handover snapshot per §10b mandate |

---

## §2 PI map

### 2.1 PI-50 candidate adjudications (s50 pre-investigation; 5 candidates)

**5 PI-50 candidates resolved**: 1 fresh batch-11 allocation + 4 closed-batch citation-only.

| PI-50 candidate | Final disposition | Closure target | Adjudication phase |
|---|---|---|---|
| **PI-50-A** | Citation-only to F-06-002 HIGH | batch-06 closed s45 | Phase 1 §2 + Phase 4 TASK 5 (admin-backfill-default-pm L29-93 verbatim CONFIRMED at HEAD per F-06-002 §263 framing) |
| **PI-50-B** | Citation-only to F-01-036 LOW | batch-01 closed s40 | Phase 5 §1.1 (F-01-036:661 explicitly names `get_parent_lesson_notes` in 7-function unpinned-search_path instance list; drift #30.A manifestation #3) |
| **PI-50-C** | **F-11-002 LOW** (fresh allocation) | s50 | Phase 5 §1.2 (3 anchors: anonymise_guardian + get_parent_dashboard_data + get_parent_lesson_notes; class-precedent F-09-002 + F-10-008) |
| **PI-50-D** | Citation-only to F-02-009 HIGH + F-02-020 helper class | batch-02 closed s41 | Phase 1 §2 (4 parameter-spoofing helpers: get_guardian_ids_for_user + get_student_ids_for_parent + is_org_parent + is_parent_of_student; F-02-009 anchors get_student_ids_for_parent; F-02-020 multi-RPC helper class covers other 3) |
| **PI-50-E** | Citation-only to F-01-005 HIGH | batch-01 closed s40 | Phase 2B §6.5 Option A (lesson_notes_parent_select cross-child branch covered by F-01-005 RPC<->RLS divergence; LessonNotesForm.tsx FE affordance evidence reinforces but is not a new failure mode) |

### 2.2 Pre-existing PI cohort transition

| Pre-s50 PI cohort | Post-s50 PI cohort |
|---|---|
| **5 active+partial** (1C / 3H / 1M / 0L) | **5 active+partial** (1C / 3H / 1M / 0L) — UNCHANGED |
| PI-12 CRITICAL (batch-17) | PI-12 CRITICAL (batch-17) |
| PI-09 HIGH (batch-19) | PI-09 HIGH (batch-19) |
| PI-10 HIGH (batch-15+18) | PI-10 HIGH (batch-15+18) |
| PI-16 HIGH (batch-17) | PI-16 HIGH (batch-17) |
| PI-17 MEDIUM (batch-08+19 partial) | PI-17 MEDIUM (batch-08+19 partial) |

### 2.3 Event-counter implication

**0 events** at s50. All 4 batch-11 finding adjudications follow §18 NOT-event paths:
- F-11-002 LOW pre-tag → LOW resolution (same-bracket confirmation; NOT event)
- F-11-003 bracket-pair {HIGH, LOW} → HIGH (bracket-pair adjudication per §18; NOT event)
- F-11-004 CRITICAL pre-tag → CRITICAL (same-bracket confirmation per §18; PI-01 → F-10-001 s49 precedent; NOT event)
- F-11-005 LOW (Phase 5 fresh-allocation; no pre-tag; NOT event)

**Cumulative severity-adjustment events post-s50**: **13** (unchanged from s49 close).

---

## §3 Finding inventory (4 active + 1 RELEASED)

### 3.1 F-11-001 — RELEASED (PI-50-B → F-01-036 closed-batch-01 citation-only)

| Field | Value |
|---|---|
| **ID** | F-11-001 **RELEASED** per s48 F-09-004 precedent |
| **Closure target** | F-01-036 LOW closed-batch-01 s40 |
| **Rationale** | Phase 5 §1.1 confirmed `get_parent_lesson_notes` explicitly named at [01-auth-sessions-rls.md:661](audit/sweep/findings/01-auth-sessions-rls.md:661) in F-01-036's 7-function unpinned-search_path instance list ("Phase 7 `pg_proc` query — 7 functions are `prosecdef=true` but have NULL `proconfig`: ... `get_parent_lesson_notes`, ..."). F-01-036 LOW bracket holds per class-consistency. No batch-11 allocation; cohort reinforcement evidence cited for Phase C RLS-hardening sprint bundling. |
| **Drift relevance** | Surfaced as drift #30.A manifestation #3 (extended grep at Phase 5 caught what would have been a duplicate finding). |

### 3.2 F-11-002 LOW — CC-19 #1 helper-fn EXECUTE-grant hygiene cohort (3 anchors)

| Field | Value |
|---|---|
| **ID** | F-11-002 |
| **Severity** | LOW |
| **Class** | Helper-fn EXECUTE-grant hygiene (anon=X/postgres + authenticated + service_role despite STRONG body-gate) |
| **Class-precedent** (drift #31 cite) | F-09-002 LOW (closed-batch-09; recalc_continuation_summary anon+PUBLIC EXECUTE despite body-gate) + F-10-008 LOW (closed-batch-10; get_revenue_report + get_teachers_with_pay anon EXECUTE despite body-gate) |
| **PI lineage** | PI-50-C |
| **Anchor sites** (3 batch-11 RPCs; DB-verified via `has_function_privilege()` per drift #29 mandate) | |
| 1. `anonymise_guardian(guardian_id uuid)` | oid 19369; SECDEF + search_path=public; anon EXECUTE = true; auth gate STRONG (`is_org_admin(auth.uid(), v_org_id)` RAISE) |
| 2. `get_parent_dashboard_data(_user_id uuid, _org_id uuid)` | oid 20238; SECDEF + STABLE + search_path=public; anon EXECUTE = true; auth gate STRONG-but-NULL-conditionally-bypassed (covered by F-11-004 CRITICAL; F-11-002 cohort entry concerns the EXCESS anon EXECUTE grant pattern only, separate from the gate-bypass mechanism) |
| 3. `get_parent_lesson_notes(p_org_id uuid, p_student_ids uuid[])` | oid 21965; SECDEF + LANGUAGE plpgsql; anon EXECUTE = true; auth gate STRONG 3-layer (auth.uid() IS NULL RAISE + org_memberships RAISE + student_guardians guardian-of RAISE) |
| **Evidence (Phase 1)** | `has_function_privilege('anon', oid, 'EXECUTE')` returned TRUE for all 3; bodies independently auth-gated and would reject anon caller via predicate evaluation |
| **Severity reasoning (PLAN.md §4)** | LOW per "code-hygiene drift" + "legacy artefacts" anchors. Anon EXECUTE is excess privilege but not exploited via body-gated paths. Class-consistency with F-09-002 + F-10-008 (s49 F-10-008 LOW; 8th hygiene-class reinforcement on this carry). |
| **Phase C sprint candidate** | S-NN-helper-fn-execute-grant-hygiene-batch-19-consolidation (bundle with CC-19 #1 cohort sweep; remediation pattern: `REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM anon, authenticated;` preserving postgres + service_role grants) |
| **Closure** | (empty) |

### 3.3 F-11-003 HIGH — useParentLessonNotes RPC named-parameter mismatch always-errors at PG layer

| Field | Value |
|---|---|
| **ID** | F-11-003 |
| **Severity** | HIGH |
| **Class** | Silent-failure-mode + missing-UI-for-tracked-DB-state; operational-correctness CAPS-at-HIGH |
| **Class-precedent** (drift #31 cite) | F-05-005 HIGH (closed-batch-05; admin_recalculate_invoice_paid silent-failure-with-banner-mitigation) + F-09-007 HIGH (closed-batch-09; PI-13 process-term-adjustment timezone-arithmetic operational-correctness; event #12 s48); operational-correctness CAPS-at-HIGH chain per s42 PI-11 / s44 PI-02/03/04 / s45 PI-05 / s48 PI-13 precedent |
| **Adjudication category** | **Bracket-pair adjudication per §18 methodology rule** (bracket-pair pre-tags with Phase 5 selection are normal adjudication; no prior PI precedent documented in handover for this category); Phase 1 §3.9 pre-tag bracket-pair {HIGH, LOW} ("HIGH if active-always-errors / LOW if dormant"); Phase 3 resolution HIGH via PG SQLSTATE 42883 runtime test + ACTIVE caller confirmation |
| **Evidence (Phase 3)** | |
| FE call chain | `src/pages/portal/PortalSchedule.tsx:124` → `useParentLessonNotes(selectedChildId \|\| undefined, currentOrg?.id)` |
| FE hook | `src/hooks/useLessonNotes.ts:119-122`: `const { data, error } = await (supabase.rpc as any)('get_parent_lesson_notes', { p_student_id: studentId, p_org_id: orgId });` |
| RPC signature | `get_parent_lesson_notes(p_org_id uuid, p_student_ids uuid[])` (DB-verified Phase 1 §2.5; plural `p_student_ids uuid[]` array; NOT singular `p_student_id` uuid) |
| Mismatch | FE passes `p_student_id` (singular string); RPC expects `p_student_ids` (plural uuid array) — named-parameter mismatch |
| Phase 3 PG runtime test | `SELECT * FROM get_parent_lesson_notes(p_student_id => '...'::uuid, p_org_id => '...'::uuid);` → verbatim error: `ERROR: 42883: function get_parent_lesson_notes(p_student_id => uuid, p_org_id => uuid) does not exist` (PG SQLSTATE 42883 = `undefined_function`) |
| Active caller status | confirmed via PortalSchedule.tsx:124 mount in `/portal/schedule` route (parent's lesson-history-and-notes page); used by all guardians viewing structured lesson notes |
| **Behaviour at HEAD** | Every parent who navigates to `/portal/schedule` and the structured-lesson-notes section attempts to load → React Query hook receives PG SQLSTATE 42883 error → throws → UI shows error state for parent's structured lesson notes |
| **Defeated SECDEF defense** | `get_parent_lesson_notes` RPC was designed to mitigate F-01-005 RPC<->RLS divergence by excluding `teacher_private_notes` from parent reads (server-side filter); the RPC never executes due to the param-mismatch error, so the mitigation surface is unreachable. Class-consistency POSITIVE: the `(supabase.rpc as any)` cast at L119 masks the TypeScript signature error that would have caught this. |
| **Severity reasoning (PLAN.md §4)** | HIGH per "silent failure modes" + "missing UI surfaces for tracked DB state" + operational-correctness CAPS-at-HIGH per class-consistency chain. Class-precedent F-05-005 silent-failure-with-banner-mitigation + F-09-007 operational-correctness CAPS-at-HIGH (event #12). Strictly less mitigated than F-05-005 (no banner surface for parents; UI shows error state with no operator pathway to remediation). |
| **CC-19 #7 contribution** | +1 Sub-A literal at useLessonNotes.ts:119 `(supabase.rpc as any)` — TS-bypass-cast cohort entry; masks the param-name signature mismatch |
| **Phase C sprint candidate** | S-NN-parent-portal-lesson-notes-rpc-param-fix (remediation pattern: change FE call to `{ p_student_ids: [studentId], p_org_id: orgId }` plural uuid[] array; alternatively change RPC signature to singular; FE-side is the more localised fix) |
| **Closure** | (empty) |

### 3.4 F-11-004 CRITICAL — get_parent_dashboard_data NULL-conditional auth gate bypass

| Field | Value |
|---|---|
| **ID** | F-11-004 |
| **Severity** | **CRITICAL** |
| **Class** | Anon-reachable cross-tenant child-PII dump via PG three-valued logic NULL-conditional auth gate bypass; **Pattern #40 anchor** (NEW PLACED slot s50; "NULL-conditional-auth-gate-bypass via three-valued logic"); false-confidence-at-HEAD subclass marker |
| **Class-precedent** (drift #31 cite) | F-02-002 CRITICAL closed-batch-02 (get_students_for_org cross-tenant child-PII enumeration; GDPR Art 9 + Art 33; ICO-notifiable under Lauren shadow volume) + F-08-002 CRITICAL closed-batch-08 (find_waitlist_matches anon-callable cross-tenant child-PII; mechanism-distinct but same outcome class) |
| **Adjudication category** | **Same-bracket pre-tag confirmation per §18** (PI-01 → F-10-001 s49 precedent); reviewing-Claude Phase 2 §A explicit CRITICAL pre-tag escalation pending Phase 2A confirmation; Phase 2A live-test CONFIRMED CRITICAL |
| **Evidence (Phase 2A live test)** | |
| TEST 1 PL/pgSQL NULL semantics (verbatim DB result) | Subtest A: `(NULL::uuid != gen_random_uuid())` = **NULL**; Subtest B: CASE WHEN NULL THEN → "BRANCH SKIPPED (NULL treated as FALSE)"; Subtest C: F-11-004 gate simulation → "RAISE EXCEPTION skipped (gate BYPASSED)" |
| TEST 2 Step 1 pair selected | guardians table row with `user_id IS NOT NULL AND deleted_at IS NULL` ORDER BY created_at DESC LIMIT 1; UUID-prefix only: user_id starts `81fa08c6`; org_id starts `46b20ac7` |
| TEST 2 Step 2 anon-role auth.uid() | `BEGIN; SET LOCAL ROLE anon; SELECT auth.uid();` → uid_under_anon = **null**; active_role = "anon"; session_role = "postgres" ✓ |
| TEST 2 Step 3 anon-context RPC invocation | `BEGIN; SET LOCAL ROLE anon; SELECT auth.uid() AS uid_at_call_time, get_parent_dashboard_data(<user_id>::uuid, <org_id>::uuid);` → uid_at_call_time = **null** (confirms anon context at SECDEF entry); rpc_response = **non-empty JSON** with guardian_id + children array (2 active students with first_name + last_name + status + dob field + upcoming_lesson_count + next_lesson UUID + lesson title with child name embedded + lesson schedule + outstanding_balance) + next_lesson at guardian level (with location_name) + outstanding_balance + overdue_count + oldest_unpaid_invoice_id |
| **6-dim class-shape vs F-02-002 anchor** | |
| D1 cross-tenant | YES — anon outside org boundary |
| D2 anon-reachable | YES — confirmed via SET LOCAL ROLE anon + auth.uid()=NULL + non-empty JSON return |
| D3 payload sensitivity | HIGH — children first_name + last_name + dob field + status + lesson title with child name embedded + lesson schedule + lesson location + financial balance + overdue count + oldest unpaid invoice id (D3 actually broader — F-11-004 adds financial + schedule + location dimensions to F-02-002's PII baseline) |
| D4 regulatory scope | YES — GDPR Art-8 minor data + Art-6 financial data |
| D5 trust erosion | EXTREME — first-encounter; data subject is minor child; data controller is music teaching studio with explicit parental trust relationship |
| D6 composition chain | YES — F-06-002 §250-252 composition chain documented (anon → get_guardian_ids_for_user → guardian.id enumeration via F-02-020 class); user_id enumeration via F-02-009 + F-02-020 helpers; org_id discovery from public booking pages / marketing org-handle resolution / Stripe Connect dashboard / cross-org admin contexts |
| **Verdict** | All 6 dimensions match or exceed F-02-002 anchor. Bracket CRITICAL confirmed per class-consistency. |
| **Mechanism (root cause)** | PostgreSQL three-valued logic: `NULL != anything` evaluates to NULL (DB-verified TEST 1 Subtest A); PL/pgSQL `IF NULL THEN ... ELSE ... END IF` treats NULL as FALSE (DB-verified TEST 1 Subtest B per PG docs official semantics: "A null result is treated as false in IF conditions"); RPC body line 12-14 (pg_get_functiondef Phase 1 §2.4): `IF _user_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized: user_id mismatch'; END IF;` — when anon caller supplies arbitrary `_user_id` and `auth.uid()=NULL`, comparison is NULL → IF NULL THEN does NOT execute branch → RAISE is skipped → function proceeds to guardian lookup → returns dashboard JSON for whichever guardian matches `(_user_id, _org_id)` pair. |
| **FE bypass surface status** | SAFE per Phase 3 §5: useParentPortal.ts:111-122 verbatim — `const { user } = useAuth();` (L111) + `const { currentOrg } = useOrg();` (L112) + RPC call passes `_user_id: user.id` (L120) + `_org_id: currentOrg.id` (L121); both session-bound; no URL-param / form-input / localStorage / user-controllable source. Threat surface is HTTP-direct anon-API RPC at PostgREST `/rest/v1/rpc/get_parent_dashboard_data` with crafted JSON body. |
| **Composition chain (anon-to-PII pivot path)** | Step 1: anon obtains arbitrary `_user_id` via F-02-009 `get_student_ids_for_parent(_user_id)` brute-force OR via leaked context (Stripe webhooks; CSV exports; URL parameters in public booking pages; org admin cross-tenant leakage). Step 2: anon obtains `_org_id` from public booking pages, marketing site org-handle resolution, Stripe Connect dashboard linkages. Step 3: anon invokes `supabase.rpc('get_parent_dashboard_data', {_user_id, _org_id})` → receives full guardian dashboard JSON with child PII + financial state. |
| **Realised exploit feasibility** | Pre-launch (zero real users), magnitude is bounded; post-launch with any (user_id, org_id) leak, realised exploit yields child-PII + financial-state dump per affected guardian. Class-consistency POSITIVE F-02-002 is the canonical CRITICAL anchor for this class shape. |
| **Severity reasoning (PLAN.md §4)** | CRITICAL per "security exposure" + "data loss" (child PII exfiltration; GDPR Art-8 minor data + Art-6 financial data) + first-encounter trust erosion anchor. Sub-class (Pattern #40) introduced because mechanism is distinct from F-02-002 (no gate), F-02-005 (no caller-context validation), F-06-002 (no auth check + anon EXECUTE), F-01-005 (RPC<->RLS divergence). |
| **Comparison to F-10-001 most-recent CRITICAL** | F-10-001 = payroll percentage 100× error CRITICAL requires authenticated admin access; bounded to org-scope; recoverable per row. F-11-004 = anon dashboard PII dump CRITICAL requires no authentication at all; cross-tenant; data subject is minor; non-recoverable (PII exposure one-way). F-11-004 strictly more severe along authentication-required + cross-tenant + minor-subject + non-recoverability axes; same bracket per CAPS rule but anchors a new sub-class. |
| **Phase C sprint candidate** | **HEAD OF CRITICAL QUEUE per reviewing-Claude Phase 2A note** (most rigorously-evidenced CRITICAL to date; empirically proven exploitable against live DB). Remediation pattern: replace `_user_id != auth.uid()` with `auth.uid() IS DISTINCT FROM _user_id` (NULL-safe operator; PG semantics: `IS DISTINCT FROM` treats NULL as a distinct value rather than three-valued NULL) OR add `IF auth.uid() IS NOT NULL` precondition. Fix is small; protocol stays audit-then-fix. |
| **Pre-launch / launch gating note** | If F-11-004 ever sat in production it would be GDPR Art-33 breach-notifiable under Art-8 special category minors. Pre-launch with zero real users, it goes into Phase C queue at head of CRITICAL list. Lauren Shadow Term gates production-cutover; F-11-004's fix gates start of Phase E (reviewing-Claude Phase 2A note for Jamie). |
| **Pattern #40 anchor evidence** | RATIFIED Phase 5+8 PLACED slot. Class shape, discrimination criteria, false-confidence-at-HEAD marker, and remediation pattern documented in PLAN.md §4.1 entry (verbatim text generated Phase 8 §1; applied Phase 10 §C). |
| **Closure** | (empty) |

### 3.5 F-11-005 LOW — send-parent-enquiry rate-limit bucket-key stale name

| Field | Value |
|---|---|
| **ID** | F-11-005 |
| **Severity** | LOW |
| **Class** | **CC-19 #16 Sub-class A anchor** ("wrong-but-extant key with similar-purpose bucket-share"); rate-limit-registry-vs-call-site key mismatch with BOUNDED effect; hygiene class family / legacy-artifact / copy-paste-residue |
| **Class-precedent** (drift #31 cite) | F-09-002 LOW (closed-batch-09 hygiene class anchor) + batch-02 §1276 cited "defensive parity with other RPC hooks" copy-paste-residue precedent |
| **Adjudication category** | First-encounter Phase 5 adjudication; no pre-tag; LOW per Sub-class A bounded-effect framing (Phase 5 §B + Phase 6 §A refinement) |
| **Evidence (Phase 5 §1.5 + Phase 6 §3)** | |
| Registry entry | `supabase/functions/_shared/rate-limit.ts:19`: `"send-parent-enquiry": { maxRequests: 10, windowMinutes: 60 }` ← DISTINCT key intentionally tighter than reply (10/hr vs 20/hr) |
| Call site (WRONG KEY) | `supabase/functions/send-parent-enquiry/index.ts:42`: `const rateLimitResult = await checkRateLimit(user.id, "send-parent-reply");` ← uses "send-parent-reply" (20/hr) instead of intended "send-parent-enquiry" (10/hr) |
| Cross-fn comparison verification | `supabase/functions/send-parent-message/index.ts:56` uses correct `"send-parent-message"` key (20/hr; matches registry L20) |
| Registry-side dead-code | `supabase/functions/_shared/rate-limit.ts:18`: `"send-parent-reply": { maxRequests: 20, windowMinutes: 60 }` is dead-code on TWO axes: (1) NO `send-parent-reply` edge fn directory exists (filesystem verified Phase 5 + Phase 6); (2) only caller is F-11-005 incorrectly. CC-19 #15 dead-code sub-shape adjacency observation. |
| **Realised impact** | (a) Parent enquiries get 20/hr rate limit (the reply-bucket limit) instead of intended 10/hr (the enquiry-bucket limit) — 2× looser anti-spam; (b) Parent enquiries share bucket with parent replies — exhausting one bucket reduces the other's available counter; (c) The intentionally-defined `send-parent-enquiry: 10/hr` registry entry is unused (dead code). |
| **Severity reasoning (PLAN.md §4)** | LOW per "code-hygiene drift" + "stale comments" + "legacy artefacts" anchors. Anti-spam still functional (just at 2× intended rate); not a security exposure. Sub-class A "wrong-but-extant key with similar-purpose bucket-share" → bounded-effect (within reasonable order-of-magnitude; 2× looser; similar-purpose-class bucket-share where both ends are parent→teacher messaging class at similar rate intent) → LOW. Discrimination criterion: future similar findings inherit LOW IF bounded-effect; UNBOUNDED-effect cases (missing bucket entirely → fallback to default; bucket-share leakage to unrelated function) escalate to HIGH per silent-failure-of-security-control class (F-05-005 anchor; see Sub-class B in CC-19 #16). |
| **CC-19 #16 cohort** | This finding is the Sub-class A anchor (1 instance). Sub-class B cohort (3 instances, all batch-12-future) carries to batch-19 sweep target #16 consolidation. |
| **Phase C sprint candidate** | S-NN-rate-limit-key-mismatch-batch-19-consolidation (remediation pattern: change L42 to `checkRateLimit(user.id, "send-parent-enquiry")`; remove dead-code `"send-parent-reply"` registry entry; batch-12 Sub-class B fixes per fresh allocations at batch-12 audit) |
| **Closure** | (empty) |

---

## §4 Class-precedent matrix (drift #31 finding-ID requirements)

| Finding | Class-precedent finding-IDs (verbatim cite) | Class anchor mechanism |
|---|---|---|
| F-11-001 RELEASED | F-01-036 LOW (batch-01:661 instance list) | Unpinned search_path on SECDEF function (defence-in-depth gap; not practically exploitable in Supabase permission model) |
| F-11-002 | F-09-002 LOW + F-10-008 LOW | Helper-fn EXECUTE-grant hygiene (anon EXECUTE despite body-gate); CC-19 #1 cohort |
| F-11-003 | F-05-005 HIGH + F-09-007 HIGH | Silent-failure-mode + missing-UI-for-tracked-DB-state; operational-correctness CAPS-at-HIGH |
| F-11-004 | F-02-002 CRITICAL + F-08-002 CRITICAL | Cross-tenant child-PII anon-callable SECDEF; GDPR Art-8 minor data + Art-6 financial data; sub-class mechanism (Pattern #40) distinct from F-02-002 (no gate) / F-02-005 (no caller-context validation) / F-06-002 (no auth check) / F-01-005 (RPC<->RLS divergence) |
| F-11-005 | F-09-002 LOW + batch-02 §1276 copy-paste-residue precedent | Rate-limit registry-vs-call-site key mismatch with bounded effect; hygiene class family |

**Citation-only references (closed-batch immutable; no batch-11 allocation)**:
| Citation | Closed batch | Reference reason |
|---|---|---|
| F-06-002 HIGH | 06 (s45) | PI-50-A → backfill_guardian_default_pm_set anon EXECUTE; admin-backfill-default-pm consumer verified service-role-only at HEAD |
| F-01-036 LOW | 01 (s40) | F-11-001 RELEASED; get_parent_lesson_notes named in 7-fn instance list |
| F-02-009 HIGH | 02 (s41) | PI-50-D → get_student_ids_for_parent cross-user student-set enumeration |
| F-02-020 helper class | 02 (s41) | PI-50-D → get_guardian_ids_for_user + is_org_parent + is_parent_of_student multi-RPC class |
| F-01-005 HIGH | 01 (s40) | PI-50-E → lesson_notes_parent_select RPC<->RLS divergence on group-lesson notes; LessonNotesForm.tsx FE affordance evidence reinforces |
| F-04-002 HIGH | 04 (s43) | lesson_notes_staff_select column-level-privacy-bypass; consumer-side observation only |
| F-04-005 | 04 (s43) | F-11-002 class-precedent reference (lesson_notes missing audit trigger CC-19 #3 anchor; supports observation only) |
| F-01-017 LOW | 01 (s40) | +2 instances batch-11 (guardians UPDATE + student_guardians UPDATE); reinforcement-only LOW per class-consistency (s42/s43/s44/s46/s47/s48 reinforcement chain; cohort ≥19 → ≥21); batch-19 sweep target #16 captures |

---

## §5 Pattern carry matrix

### 5.1 Pattern catalog state transition

| State | Pre-s50 | Post-s50 |
|---|---|---|
| Placed patterns | 34 | **35** (+1 Pattern #40) |
| Candidates | 5 (#26 batch-19, #29 batch-19, #34 post-launch, #37 batch-19 NEW s49, #39 batch-19 NEW s49) | 5 (unchanged; no batch-11 enrichments) |
| NEGATIVE-instance sub-class flags | 1 (Pattern #27 sub-B PortalContinuation:71) | 1 (reconfirmed Phase 7 §5; sole anchor; no batch-11 siblings) |
| Sub-class introductions under existing carries | 3 (POS-4 / NOT-VALID / Orphan MV) | **4** (+1 Sub-E catch-block `: any` hygiene under CC-19 #7) |

### 5.2 Pattern #40 RATIFIED — "NULL-conditional-auth-gate-bypass via three-valued logic"

- **Slot**: PLACED s50 (next sequential after #38 s49 RATIFIED placed; #37 + #39 remain candidates)
- **Anchor**: F-11-004 (`get_parent_dashboard_data` SECDEF body `IF _user_id != auth.uid()` gate at the function's auth-gate prologue; Phase 2A live-test confirmed via SET LOCAL ROLE anon + auth.uid()=NULL + non-empty JSON children PII return)
- **Class shape**: SECDEF RPC with `IF <caller-context> != <param> THEN RAISE EXCEPTION` gate where `<caller-context>` is `auth.uid()` (NULL for anon caller) → PG three-valued logic treats `NULL != anything` as NULL → `IF NULL THEN ...` evaluated FALSE per PG docs official semantics → gate bypassed; structurally appears correct in code review; requires DB-layer test to detect
- **Class-distinct from**:
  - F-02-002 (no gate at all)
  - F-02-005 (no caller-context validation)
  - F-06-002 (no auth check + anon EXECUTE — Stripe-side validation narrowed)
  - F-01-005 (RPC<->RLS divergence; SECDEF under-returns vs RLS over-permits)
- **False-confidence-at-HEAD subclass marker**: distinctive feature; bypasses via PG documented semantics
- **Remediation pattern**: replace `_user_id != auth.uid()` with `auth.uid() IS DISTINCT FROM _user_id` (NULL-safe operator) OR add `IF auth.uid() IS NOT NULL` precondition

### 5.3 Sub-E sub-class RATIFIED — "catch-block `: any` hygiene" under CC-19 #7

- **Class-shape**: TypeScript catch defaults to `unknown` in strict mode (`useUnknownInCatchVariables=true`); explicit `catch (errorName: any)` is a deliberate annotation bypass
- **Distinct from**:
  - Sub-A literal `(supabase.rpc as any)('fn', ...)` — RPC cast bypass
  - Sub-D `supabase: any` helper-signature undercount (s46 origin)
  - Sub-D2 callback signature `: any` parameter (s49 origin)
- **Batch-11 anchor sites (4)**:
  - `send-parent-enquiry/index.ts:195` `catch (emailError: any)`
  - `send-parent-enquiry/index.ts:223` `catch (error: any)`
  - `send-parent-message/index.ts:320` `catch (emailError: any)`
  - `send-parent-message/index.ts:349` `catch (error: any)`
- **Cumulative cohort**: **32 instances cumulative** DB-verified Phase 6 §4 via `grep -rEn "catch \([a-zA-Z_]+: any\)" supabase/functions/*/index.ts | wc -l`
- **Per-fn distribution captured Phase 6 §4 table**: batch-11 4 + create-billing-run 3 + stripe-auto-pay-installment 2 + send-message 2 + send-bulk-message 2 + notify-internal-message 2 + installment-upcoming-reminder 2 + create-continuation-run 2 + 10 fns × 1 each
- **Carry**: batch-19 sweep target #4 alongside Sub-A/D/D2

### 5.4 Pattern #27 sub-B reconfirmation

PortalContinuation.tsx:71 sole NEGATIVE-instance anchor confirmed at Phase 3 §2.6; reconfirmed Phase 7 §5 (no batch-11 sibling). Architectural exception (unauth-token-via-URL pattern; token IS the auth credential; bypasses normal three-layer defence) — batch-08 §72 declaration unchanged.

### 5.5 5 Pattern candidates entering Phase B post-s50

| Candidate | Scope | Batch-11 enrichment |
|---|---|---|
| Pattern #26 "Log-shape table protection cohort" | batch-19 full-schema sweep | 0 — not log-shape tables in batch-11 |
| Pattern #29 "Caller-RLS-respecting view (security_invoker=on)" | batch-19 full-schema view sweep | 0 — no view audit in batch-11 |
| Pattern #34 "42P01 graceful-degradation" | post-launch revisit | 0 — batch-11 had no 42P01 instances |
| Pattern #37 "Read-only-report-RPC FE-invocation discipline" (NEW s49) | batch-19 cross-batch sweep | 0 — batch-11 had no report RPCs |
| Pattern #39 "Defensive `?? 0` fallback on RPC json-shape return" (NEW s49) | batch-19 cross-batch sweep | 0 — batch-11 hooks cast via TypeScript type-narrow not `?? 0` defensive-clamp |

---

## §6 Cross-batch reach inventory (11 items)

Consolidated per Phase 7 §6:

| # | Item | Owning batch | Status | Carry path |
|---|---|---|---|---|
| (a) | ParentLoopAssist V2 §3.3 HIDDEN-but-wired discrepancy | batch-17 (LoopAssist whole-batch deferred) | observation; PortalLayout.tsx:14/55/74 + LoopAssistContext.tsx + ParentLoopAssist.tsx + useParentLoopAssist.ts verbatim cites | batch-17 inherits |
| (b) | F-01-017 +2 instances (guardians UPDATE + student_guardians UPDATE) | batch-02 closed s41 (table primary) | reinforcement-only LOW per class-consistency | batch-19 sweep target #16 |
| (c) | CC-19 #3 lesson_notes audit-trigger gap (DB-verified pg_trigger; absent) | batch-04 closed s43 (table primary) | observation; CC-19 #3 cohort +1 | batch-19 sweep target #3 |
| (d) | Pattern #27 sub-B NEGATIVE-instance PortalContinuation:71 | batch-08 §72 declaration / batch-09 closed s48 (continuation-respond edge fn) | observation; sole anchor confirmed | no allocation; documented |
| (e) | F-01-005 RPC<->RLS divergence reinforcement (LessonNotesForm.tsx) | batch-01 closed s40 (HIGH) | citation-only via PI-50-E adjudication Option A | Phase C sprint bundle with F-01-005 RLS-hardening |
| (f) | F-01-036 unpinned search_path on `get_parent_lesson_notes` | batch-01 closed s40 (LOW) | citation-only; explicitly named at batch-01:661 instance list | Phase C RLS-hardening sprint bundle |
| (g) | F-06-002 backfill_guardian_default_pm_set anon EXECUTE | batch-06 closed s45 (HIGH) | citation-only via PI-50-A adjudication | Cat C CENSUS:559 migration 06→11 at Phase 10 per PI-06 precedent |
| (h) | F-02-009 + F-02-020 parameter-spoofing helper class | batch-02 closed s41 (HIGH + helper class) | citation-only via PI-50-D adjudication (4 helpers) | Cat C consideration: 4 helper RPCs CENSUS-attributed batch-02; batch-11 doc cross-references |
| (i) | Sub-class B rate-limit-key-mismatch (3 cross-batch instances; CC-19 #16 cohort) | batch-12 future (all 3 CENSUS-verified Phase 7 §4) | observations; HIGH per Sub-class B F-05-005 anchor when batch-12 audits | batch-12 fresh F-12-NNN allocation + batch-19 sweep target CC-19 #16 cohort consolidation; instances: send-cancellation-notification:53 (CENSUS:289), send-notes-notification:58 (CENSUS:397), send-contact-message:38-39 (CENSUS:395) |
| (j) | Sub-E catch-block `: any` hygiene 28 cross-batch instances | distributed (batch-02/03/05/06/07/09/12/seed) | observation; cohort to be consolidated | batch-19 sweep target #4 (TS-bypass-cast Sub-E carry) |
| (k) | `"send-parent-reply"` registry dead-key entry (sub-shape candidate under CC-19 #15) | batch-19 (CC-19 #15 cross-cutting carry) | observation; sub-shape candidate noted | batch-19 sweep target #9 |

All 11 items carry verbatim CENSUS line, finding-ID, or DB cite per drift #30/#30.A/#30.B + drift #31 discipline.

---

## §7 CC-19 cohort deltas

Per Phase 6 §1 + Phase 7 corrections:

| CC-19 # | Description | Pre-s50 cohort | Batch-11 delta | Post-s50 cohort | Notes |
|---|---|---|---|---|---|
| **#1** | Helper-fn EXECUTE-grant hygiene | ~3 (F-09-002 + F-10-008) | **+3** (F-11-002: 3 anchors) | **~6** | Drift #29 mandate operationally applied |
| **#3** | audit_log INSERT integrity gap | ACTIVE mixed | +1 observation (lesson_notes lacks audit trigger; DB-verified) | ACTIVE mixed +1 | batch-19 sweep target #3 |
| **#6** | Org-context spoofing | ~49 | +0 fresh | ~49 unchanged | All 4 helpers closed-batch-02 |
| **#7** | TS-bypass-cast pipeline drift | ~389 | **+11** (5 Sub-A + 2 Sub-D2 + 4 Sub-E) | **~400** | Sub-E NEW sub-class RATIFIED Phase 8 |
| **#8** | E2E fixture hygiene | 471/5/30/3 baseline | delta 0 | unchanged | Phase 0 §1 baseline carries |
| **#10** | Sentry edge-fn instrumentation | ~8 | +0 fresh | ~8 unchanged | send-parent-enquiry + send-parent-message BOTH wrapped |
| **#11** | Schema column constraint cohort | 14 (12 negative + 2 positive) | **+0** | unchanged | Only 1 CHECK on 4 batch-11 tables (engagement_rating range; convalidated=true); 0 NOT-VALID variants |
| **#13** | PERMISSIVE-as-RESTRICTIVE | 5 bifurcated | +0 | unchanged | 24 batch-11 policies all PERMISSIVE; intended OR semantics |
| **#14** | Claimed-service-role-gate misnaming | 2 anchors | +0 | unchanged | Naming consistent in fresh-audit fns |
| **#15** | Dead-code SECDEF + orphan triggers | 4 instances + 1 sub-class (Orphan MV s49) | +1 sub-shape candidate observation (rate-limit registry dead-key) | 4 + 2 sub-shapes (observation only for sub-shape #2) | "send-parent-reply" registry entry dead-code; no formal sub-class introduction |
| **NEW #16** | rate-limit-key-mismatch | n/a | **F-11-005 Sub-class A anchor + 3 cross-batch Sub-class B observations** | **NEW RATIFIED** | Sub-class A LOW (bounded-effect) + Sub-class B HIGH (unbounded-effect; F-05-005 anchor); cohort 4 (1 batch-11 + 3 batch-12-future); batch-19 sweep target consolidation |

---

## §8 PI register delta

**0 closures + 0 enrichments at batch-11.** PI cohort 5 (1C/3H/1M/0L) unchanged.

PI-50 cohort (s50-specific pre-investigation candidates; not added to s38 historical PI register): 5 resolved (1 fresh allocation F-11-002 + 4 closed-batch citation-only).

---

## §9 Cumulative tally projection (drift #27 two-line check)

### 9.1 Two-line arithmetic

**(a) PI cohort math**: `pre − closures + enrichments = post`
- Pre: 5 (1C/3H/1M/0L)
- Closures: 0
- Enrichments: 0
- Post: **5 (1C/3H/1M/0L)** ✓

**(b) Grand active math**: `pre + batch findings delta + PI cohort bracket delta = post`
- Pre: 141 (18C/41H/26M/56L)
- Batch-11 findings delta: +4 (F-11-002 LOW + F-11-003 HIGH + F-11-004 CRITICAL + F-11-005 LOW)
- PI cohort bracket delta: 0
- Post: 141 + 4 − 0 = **145** ✓

### 9.2 Per-bracket cross-verification

| Bracket | Pre | F-11-NNN allocations | PI closure | Post |
|---|---|---|---|---|
| Critical | 18 | +1 (F-11-004) | 0 | **19** |
| High | 41 | +1 (F-11-003) | 0 | **42** |
| Medium | 26 | 0 | 0 | **26** |
| Low | 56 | +2 (F-11-002 + F-11-005) | 0 | **58** |
| **Sum** | 141 | +4 | 0 | **145** ✓ |

Cross-verified: 19 + 42 + 26 + 58 = **145** ✓ matches §9.1 grand active.

**Net delta s49 → s50**: +1C / +1H / 0M / +2L = **+4 net** by bracket.

---

## §10 Audit-method process refinements

### 10.1 F-11-005 class-anchor framing for Sub-class A (LOW) vs Sub-class B (HIGH)

For future class-consistency precedent:
- **Sub-class A**: "wrong-but-extant key with similar-purpose bucket-share" → BOUNDED → LOW (F-11-005 anchor); hygiene class family
- **Sub-class B**: "missing-registry-entry fallback-to-default" → UNBOUNDED → HIGH (F-05-005 silent-failure class anchor)
- **Discrimination criterion**: future similar findings inherit LOW IF effect remains bounded (within reasonable order-of-magnitude — e.g. 2× looser, 5× looser within reasonable range); UNBOUNDED-effect cases (missing bucket entirely → no rate limit at all; bucket-share leakage to unrelated function → cross-function counter exhaustion) escalate to HIGH per silent-failure-of-security-control class

### 10.2 Workflow rule s51+ Phase 0 push hygiene check

Phase 0 verification adds explicit check: `git rev-parse origin/<branch>` MUST equal `git rev-parse HEAD` BEFORE Phase 1 dispatch. If divergence detected in either direction, surface as workflow anomaly for reviewing-Claude clarification. Do NOT normalise. Do NOT invent conventions. Recorded in PLAN.md §10 hard-rules.

**Origin**: s50 Phase 0 §1 surfaced 3-commit divergence (origin/main at 7bdea67e s46 vs local HEAD 47383d97 s49); 3 audit commits (s47/s48/s49) unpushed for 3 sessions. Phase 2 §B push closed durability gap.

### 10.3 4-element magnitude-factor rubric disposition

N/A for s50. The 4-element magnitude-factor rubric (per s49 origin, F-10-002 anchor) is applicable to aggregate-financial cross-tenant findings. Batch-11 has no aggregate-financial cross-tenant findings.

---

## §11 Audit-method appendix

### 11.1 Drift ratifications during s50

**5 ratifications + 2 sub-drifts** (cumulative methodology entries 31 → 34):

| # | Phase | Category | Origin | Title | Mitigation rule |
|---|---|---|---|---|---|
| **#30** | Phase 0 | Cat 1 | reviewing-Claude | Launching-prompt §7 SCOPE skipped CENSUS owning-batch verbatim-cite cross-check | Every §7 SCOPE entry requires verbatim CENSUS line cite; closed-batch attribution mismatches surface as "consumer-attribution migration candidate" in §6 pre-investigation per PI-06 s44 precedent |
| **#30.A** | Phase 1 | sub-drift to #30 (no increment) | CC | TASK 0 closed-batch coverage grep scope | Unrestricted findings/*.md grep applies at ANY phase where closed-batch coverage is relevant (not just Phase 1 TASK 0); 3 manifestations confirmed s50 (PI-50-E → F-01-005 Phase 2B; F-11-001 → F-01-036 Phase 5; F-02-009 + F-02-020 helpers Phase 1) |
| **#30.B** | Phase 7 | sub-drift to #30 (no increment) | reviewing-Claude | Batch-attribution claims at ANY phase require verbatim CENSUS line cite | Reviewing-Claude Phase 6 §A propagated CC's unverified batch-03 assertion for send-cancellation-notification; CC Phase 7 TASK 4 CENSUS:289 cite corrected to batch-12 owner; rule extends to cross-batch reach + severity adjudication + sweep-target framing |
| **#31** | Phase 1 | Cat 1 | reviewing-Claude | Launch-prompt §6 class-precedent citations name-mapped without DB-verified anchor | Every class-precedent citation in launching-prompt §6 requires finding-ID + verbatim cite from finding doc; generic Pattern # / CC-19 # references without DB-verified anchor forbidden; PI-50-B mismap (Pattern #4 ≠ search-path-injection; CC-19 #2 ≠ search-path-injection; actual anchor F-01-036) |
| **#32** | Phase 10 Step 2 | Cat 1 | reviewing-Claude | Message B handover snapshot placeholder-token misuse in cross-reference language | Detected via CC drift #26 grep -c verification at Phase 10 Step 2 returning 4 placeholders instead of expected 3 (reviewing-Claude's Message B included `<s50 Phase 10 commit SHA>` token inside §2 verification-list bullet at line 31 cross-referencing §4 canonical pin). Mitigation: when composing Message B handover snapshots, the placeholder token `<sNN Phase 10 commit SHA>` appears exactly 3 times at §2 immediate-state opening sentence + §4 project-IDs table value + §21 first-action HEAD reference; all other references to the canonical pin must use descriptive cross-reference language ("§4 canonical pin", "the HEAD recorded at project-IDs", etc.); pre-Message-B reviewing-Claude self-check counts placeholder occurrences in draft before sending. Detection precedent: drift #26 grep -c mechanism caught the error at the right gate (exactly its design purpose). |

**Post-s50 cumulative methodology-drift entries: 34** (31 Cat 1 + 1 Cat 2 + 2 Cat 3).

### 11.2 Severity-adjustment events during s50

**0 events** (cumulative events 13 → 13 unchanged):

| Finding | Pre-tag | Final bracket | Methodology category | Event? |
|---|---|---|---|---|
| F-11-001 → F-01-036 | (citation-only; not a new finding) | LOW class via citation | n/a | N/A |
| F-11-002 | LOW (Phase 1 §3.9) | LOW (Phase 5 §1.2) | Same-bracket pre-tag confirmation | NOT event |
| F-11-003 | Bracket-pair {HIGH, LOW} (Phase 1 §3.9; "HIGH if active-always-errors / LOW if dormant") | HIGH (Phase 3 PG SQLSTATE 42883 confirmed) | **Bracket-pair adjudication per §18 methodology rule** (bracket-pair pre-tags with Phase 5 selection are normal adjudication; no prior PI precedent documented in handover for this category) | NOT event |
| F-11-004 | CRITICAL (reviewing-Claude Phase 2 §A escalation) | CRITICAL (Phase 2A live-test confirmed) | **Same-bracket pre-tag confirmation per §18** (PI-01 → F-10-001 s49 precedent) | NOT event |
| F-11-005 | (Phase 5 fresh-allocation; no pre-tag) | LOW | First-encounter Phase 5 adjudication | NOT event |

**Cumulative severity-adjustment events: 13** (unchanged from s49 close).

### 11.3 Pattern catalog updates during s50

| Action | Slot/Class | Status | Anchor |
|---|---|---|---|
| **NEW PLACED Pattern slot** | **Pattern #40 "NULL-conditional-auth-gate-bypass via three-valued logic"** | RATIFIED Phase 5 + Phase 8 | F-11-004 |
| **NEW sub-class introduction** | **Sub-E "catch-block `: any` hygiene"** under CC-19 #7 TS-bypass-cast | RATIFIED Phase 5 + Phase 8 | 4 batch-11 + 28 cross-batch = 32 cumulative |

**Pattern catalog state**:
- Pre-s50: 34 placed + 5 candidates + 1 NEGATIVE-instance + 3 sub-class introductions
- Post-s50: **35 placed** + 5 candidates + 1 NEGATIVE-instance + **4 sub-class introductions**

### 11.4 Cross-cutting (CC-19) carries during s50

| Action | # | Status | Anchor |
|---|---|---|---|
| **NEW CC-19 carry** | **#16 rate-limit-key-mismatch** with Sub-class A (LOW; F-11-005 anchor) + Sub-class B (HIGH; F-05-005 anchor; 3 batch-12-future instances) | RATIFIED Phase 6 + Phase 8 | F-11-005 + 3 batch-12 cross-batch observed |

**CC-19 # carries state**: pre-s50: 15 → post-s50: **16**.

### 11.5 F-11-005 class-anchor framing (for class-consistency precedent)

Established at Phase 5 §B + refined at Phase 6 §A:

- **Sub-class A "wrong-but-extant key with similar-purpose bucket-share"** → BOUNDED → LOW
  - Anchor: F-11-005 (send-parent-enquiry:42 uses `"send-parent-reply"`; bucket-shared with related-purpose parent→teacher messaging path; realised 2× looser 20/hr vs intended 10/hr)
  - Discrimination: registry entry EXISTS; effect within reasonable order-of-magnitude (≤10× looser)
- **Sub-class B "missing-registry-entry fallback-to-default"** → UNBOUNDED → HIGH
  - Class anchor: F-05-005 silent-failure-with-banner-mitigation HIGH precedent
  - Discrimination: registry entry MISSING; falls to default 100/min = 6000/hr; effect 100-1000× looser than messaging-class intent
  - 3 batch-12-future instances enumerated: send-cancellation-notification:53 (CENSUS:289), send-notes-notification:58 (CENSUS:397), send-contact-message:38-39 (CENSUS:395)
  - account-delete:51 inline-override pattern is EXEMPT (gdpr-delete L47 precedent)

Future similar findings inherit LOW (Sub-class A) or HIGH (Sub-class B) per this discrimination criterion.

### 11.6 Workflow rule s51+ (Phase 0 push hygiene check)

**Workflow rule** (not methodology drift):
- Phase 0 verification adds explicit `git rev-parse origin/<branch>` == `git rev-parse HEAD` check BEFORE Phase 1 dispatch
- Triggered s50 Phase 2 §B push of 3 outstanding audit commits (s47/s48/s49); pre-push origin/main at 7bdea67e (s46) vs local HEAD 47383d97 → 3-commit durability gap
- Mitigation rule: surface divergence as workflow anomaly for reviewing-Claude clarification; do NOT normalise; do NOT invent conventions
- Recorded in PLAN.md §10 hard-rules (workflow hygiene; not §4.1 methodology drifts)

---

*End of `audit/sweep/findings/11-parent-portal.md`. Status flips from In Progress → Complete at Phase 10 commit.*
