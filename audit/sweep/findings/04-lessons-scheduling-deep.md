# Batch 04 — Lessons / Scheduling Deep — Findings

> **AUDIT IN PROGRESS — DO NOT FIX YET**

| Field | Value |
|---|---|
| Batch | 04-lessons-scheduling-deep |
| Phase | B (Systematic Audit) |
| Authoring session | s43 (2026-05-12) |
| HEAD pin | `1d0d52275779708ddc283da0c61bd7796e2fb1db` (2026-05-12, s42 close) |
| Findings | 5 total (0 Critical / 3 High / 2 Medium / 0 Low) |
| Cumulative grand total active (PI active + batches 01 + 02 + 03 + 04) | **96 finding-instances (15 Critical / 27 High / 22 Medium / 32 Low)** — see §10. PI cohort unchanged (17 historical, 14 active, 3 RESOLVED). |
| Status | Phase B EXIT; awaiting Phase 10 commit |

---

## 1. Audit basis

**Surface coverage.** 10 CENSUS batch-04 entries (1 route `/notes`; 1 page `NotesExplorer.tsx`; 5 hooks `useNotesExplorer`, `useBulkLessonActions`, `useLessonNotes`, `usePreviousLessonNotes`, `useStudentQuickNotes`; 3 SECDEF RPCs `bulk_update_lessons`, `bulk_cancel_lessons`, `materialise_continuation_lessons` — the latter cross-linked from batch 02 F-02-013 consequence chain). **5 RLS policies** body-audited on `lesson_notes` plus **9 RLS policies** cross-referenced on `lessons` (already audited at the schema-shape level in batch 03; column-level posture re-examined this batch). **9 triggers** on `lessons` enumerated (incl. `trg_cleanup_attendance_on_cancel` re-confirmed as canonical Pattern #14 instance; `audit_lessons` re-confirmed AFTER INSERT/UPDATE/DELETE per-row). **27 audit-trigger-bearing tables** enumerated for CC-19 #3 audit_log integrity rollup. Total lines audited ≈ 1,400 (FE hooks + page) plus 11k chars of SECDEF + trigger bodies.

**AUDIT SCOPE COMPLETENESS declaration** (per PLAN.md §3 rule 3): the Zoom carve-out is **N/A** for batch 04 — no Zoom-touching surface in scope. The LoopAssist `bulk_complete_lessons` RPC is **batch 17 IN-SWEEP** per s41 discipline correction; cross-referenced from the bulk-actions surface (`useBulkLessonActions.ts`) but not audited here. The parent-portal `lesson_notes_parent_select` RLS policy is **batch 11 owned**; its body is referenced for class-pattern context (legitimate-complexity dual-case inline subquery) but not body-audited here. Edge-fn instrumentation enumeration is **batch 19 owned**. All non-deferred batch-04 surface is audited fully.

**Cross-batch surface reach annotations.** Where batch-04 audit traversed surfaces owned by closed batches, the closed-batch audit verdicts hold by reference; this doc cross-references but does not re-audit:
- `students` RLS / `teachers` RLS — batch 02 already-audited; reach is via FK joins from `lesson_participants` and `lessons.teacher_id`.
- `parent-portal` lesson_notes path — batch 11 owned; `useLessonNotes.ts:119-122` F-01-001 reinforcement counted under batch 01.
- `lessons` table RLS policies — batch 03 already-audited (Phase 5); column-level GRANT posture inspected this batch for F-04-004.
- `audit_lessons` trigger — batch 03 already-audited (Phase 4); per-row-on-bulk-path confirmation cited here for F-04-003 cascade narrative correction.

**DiD methodology.** For SECDEF RPCs: per-element org-check predicate audit (Pattern #8); body transactional integrity (atomic UPDATE / single-statement chain); cap-discipline (MAX_BULK 100 at DB + FE layers). For RLS policies: USING + WITH CHECK expression dissection per role; column-level vs row-level discrimination check; column GRANT layer as independent defence stratum. For consumer hooks: TanStack React Query error-surface destructure inspection (`{ data, isLoading, error }`); `(supabase.rpc as any)` cast prevalence (CC-19 #7 class).

**Class FAIL ratios.**
- Batch 04 surface: **5 findings / 10 surface items = 50% FAIL.** Higher than batch 03 (21%) and batch 02 (24%); driven by the column-level-privacy-bypass class accounting twice (F-04-002 + F-04-004) and by the silent-query-error class-finding aggregating 6 surfaces under F-04-001.
- Comparison to batch 02: batch-04 mix is **safeguarding/privacy class** (column-level-privacy-bypass 2-anchor) + **operational-correctness class** (cascade-completeness-asymmetry, silent-query-error, audit-trigger-absence). No financial-falsification CRITICAL anchors realised at Phase B; F-04-003 carries a financial-falsification escalation hook to batch 05.

**Sample-first methodology + decision gates.** Phase 2 walked all 4 batch-04 hooks (full file reads) and promoted F-04-001 from singleton to class-finding via 6-surface cross-batch enumeration. Phase 3 body-audited the `bulk_cancel_lessons` → `bulk_update_lessons` → `audit_lessons` + `trg_cleanup_attendance_on_cancel` cascade with Pattern #8 and #14 HOLDS re-verification. Phase 5 inspected all 5 `lesson_notes` RLS expressions plus column GRANT layer. Phase 6 verified `materialise_continuation_lessons` dedup mechanism empirically (concrete duplicate-slot blast-radius for F-04-003), enumerated CC-19 #3 audit-trigger inventory (27 tables; lesson_notes absent → F-04-005), and identified the second column-level-privacy-bypass anchor (`lessons.notes_private`).

**Honest limitations.**
- **Phase 0 methodology bug, self-corrected**: the initial pre-investigation `pg_trigger` query used CASE WHEN on `tgtype` which returned only the first-matching event, mis-marking `audit_lessons` as INSERT-only. Phase 3 §7 produced a contingent audit_log gap claim that was subsequently retracted on Phase 6 re-verification (correct decoding: INSERT+DELETE+UPDATE per-row). F-04-003 body in §4 reflects the post-retraction narrative; the audit_log claim has been removed. F-04-005 (lesson_notes missing audit trigger) is the actual audit-trigger gap, surfaced by Phase 6 27-table enumeration not the retracted Phase 3 query.
- **TS-bypass-cast count under-estimate, self-corrected**: Phase 2 estimated 7 batch-04 instances; Phase 6 enumeration confirmed 14 (Sub-pattern A 7 + Sub-pattern B 4 + Sub-pattern C 3). F-02-033 class total ≥44 sites now.
- **F-04-001 class-promotion cross-batch annotation discipline**: 5 of 6 surfaces lie in closed batches. Per PLAN.md §6 immutability, those 5 are enumerated here for class-finding context only; their closed-batch findings docs are NOT amended. F-04-001 batch attribution = batch 04 (the anchor surface at `NotesExplorer.tsx:53-54`).
- **Parent-portal lesson_notes parent-select policy reach**: the policy's dual-case inline subquery (per-student match OR whole-lesson EXISTS lesson_participants) was confirmed in Phase 5 to be a legitimate-complexity instance — inline subquery is the right shape when per-student match AND whole-lesson EXISTS must be evaluated together. F-01-031 batch-01 policy-style class is reinforced as contextual, not always wrong.

**Severity rubric anchor.** All severity assignments cite `audit/sweep/PLAN.md` §4 + §6. CRITICAL = financial loss / data loss / security exposure / marketed-feature-fundamentally-broken / first-encounter trust erosion. HIGH = degraded-but-working / silent-failure / surprising / missing-UI-for-tracked-DB-state. MEDIUM = cosmetic-visible / timezone-edge / non-critical race / minor UX dead-end. LOW = code-hygiene / stale comment / minor docstring / legacy artefact. **Class-consistency principle (PI-08 + PI-11 methodology):** safeguarding/security/destructive/financial classes anchor at CRITICAL ceiling; operational-correctness anchors at HIGH ceiling.

---

## 2. Findings index

| ID | Sev | Phase | One-liner |
|---|---|---|---|
| F-04-001 | Medium | 1+2 | `useNotesExplorer` + `useNotesStats` and 5 cross-batch consumer hooks destructure `{ data, isLoading }` without `error`; silent-query-error → empty-state masquerade class-finding (6 surfaces total) |
| F-04-002 | High | 5 | `lesson_notes.teacher_private_notes` exposed to non-author staff via `lesson_notes_staff_select` RLS expression with no column-level filter; column GRANT layer absent; column-level-privacy-bypass class anchor |
| F-04-003 | High | 3+6 | `bulk_update_lessons` cancel-path is cascade-completeness-asymmetry vs single-row cancel-this-and-future cascade — steps 5-7 (recurrence end_date cap + fire-and-forget invoice/notify) omitted on bulk path; `materialise_continuation_lessons` dedup empirically ABSENT (no UNIQUE on `(recurrence_id, start_at)`) → bulk-cancelled slots regenerate as duplicates on next continuation tick |
| F-04-004 | High | 6 | `lessons.notes_private` exposed via "Parent can view children lessons" RLS row policy with no column-level filter; 3 unconditional staff-context render surfaces; schema comment "teacher/admin only" intent documented but not enforced at DB or column GRANT layers; column-level-privacy-bypass class co-anchor |
| F-04-005 | Medium | 6 | `lesson_notes` table has no audit trigger; INSERT/UPDATE/DELETE of lesson notes (incl. `teacher_private_notes` mutations and parent-visible `content_md` mutations) is unaudited; CC-19 #3 carry anchor in batch 04 |

---

## 3. Critical findings

**No Critical findings in batch 04.** Batch-04 surface is column-level-privacy-bypass class + operational-correctness class. F-04-004 was evaluated against the CRITICAL escalation matrix (Phase 8 §3.4 severity verification subtask); the documented intent evidence ("teacher/admin only" schema comment in migration `20260119233145_8eb74306-4158-4451-8b9a-8ba11a2c3b75.sql:34`; "author or admin/owner" code comment at `usePreviousLessonNotes.ts:98`) is internal-developer-facing not customer-facing-marketing — the PLAN.md §4 "marketed feature fundamentally broken" CRITICAL anchor is not triggered. Realised default-UI exposure to parent role is ABSENT (the 3 unconditional-render surfaces live on `/calendar` which has `allowedRoles: ['owner', 'admin', 'teacher']` per `src/config/routes.ts:134`; SECDEF RPC `get_parent_lesson_notes` per migration `20260315100100_fix_lesson_notes_private_access.sql:5` already excludes `teacher_private_notes` from its return shape). The bypass-realisation path is hand-crafted client query against `.from('lessons').select('notes_private')` from parent-authenticated context — analogous to the F-04-002 class-consistency anchor. HIGH stands. F-04-003 carries a **financial-falsification CRITICAL escalation hook to batch 05** — see F-04-003 body §4 for the cross-batch carry.

---

## 4. High findings

### F-04-002 — `lesson_notes.teacher_private_notes` exposed via parent-context RLS with no column-level filter

- **Severity:** High
- **Area:** RLS policy / column-level privacy
- **Phase surfaced:** 5
- **Class:** column-level-privacy-bypass (NEW class, 2 anchors — see §8.1). **Regression-class evidence:** the team identified this exact problem in a prior remediation cycle and implemented a server-side fix; the FE consumer in `usePreviousLessonNotes.ts:55-74` ships with a direct `.from('lesson_notes')` query that defeats the fix at the consumer layer.
- **Evidence:**
  - **Documented intent (primary evidence; regression-class framing).** Migration `supabase/migrations/20260315100100_fix_lesson_notes_private_access.sql:1-8` opens with explicit problem statement and intended remediation:
    ```sql
    -- FIX 3: Parent can read teacher_private_notes via RLS
    -- FIX 4: Teachers can read other teachers' private notes
    --
    -- Postgres RLS is row-level, not column-level. The parent SELECT policy
    -- returns ALL columns including teacher_private_notes when parent_visible = true.
    -- Similarly, the staff SELECT policy exposes teacher_private_notes to all staff.
    --
    -- Solution: Create RPC functions that control which columns are returned.
    ```
    The migration's solution is server-side: SECDEF RPCs (`get_lesson_notes_for_staff` with CASE-WHEN column filter; `get_parent_lesson_notes` excluding the private column from its TABLE return shape) provide the column-level discrimination the RLS layer cannot. **Regression-class framing:** the fix is correctly implemented at the RPC layer; F-04-002 anchors the *consumer-layer regression* — `src/hooks/usePreviousLessonNotes.ts:55-74` ships with a direct `.from('lesson_notes').select(...teacher_private_notes...)` query that bypasses the SECDEF accessor entirely, reading `teacher_private_notes` straight from the table. The L99 client-side filter is cosmetic; the column has already crossed the wire. The team's own fix is defeated by a consumer that didn't migrate to the accessor.
  - Five `lesson_notes` RLS policies enumerated via `pg_policy`:
    | Policy | Cmd | USING | WITH CHECK |
    |---|---|---|---|
    | `lesson_notes_admin_delete` | DELETE | `is_org_admin(auth.uid(), org_id)` | — |
    | `lesson_notes_parent_select` | SELECT | dual-case: per-student match OR whole-lesson EXISTS lesson_participants | — |
    | `lesson_notes_staff_insert` | INSERT | — | `is_org_staff(auth.uid(), org_id)` |
    | `lesson_notes_staff_select` | SELECT | `is_org_staff(auth.uid(), org_id)` | — |
    | `lesson_notes_staff_update` | UPDATE | `is_org_admin OR teacher_id = get_teacher_id_for_user(...)` | NULL (F-01-017 instance, cross-reference only) |
  - The `lesson_notes_staff_select` policy's USING expression is **row-level only** — any staff member (`is_org_staff` predicate: teacher, admin, finance, scheduler) can SELECT every column of every row in their org, including `teacher_private_notes`. There is no column-level discrimination; teachers can read each other's private notes.
  - Column GRANT layer on `lesson_notes` (full enumeration via `information_schema.column_privileges`): all 10 columns including `teacher_private_notes` have identical `INSERT/REFERENCES/SELECT/UPDATE` grants to `anon`, `authenticated`, `postgres`, `service_role`. No column-level GRANT discrimination to compensate for the row-level-only RLS.
  - Cross-link to parent side (supporting class evidence, NOT a separate finding): the `lesson_notes_parent_select` policy's dual-case USING expression includes the whole-lesson Case B (`student_id IS NULL AND EXISTS lesson_participants ...`); parents reading whole-lesson notes via this policy also receive `teacher_private_notes` if the column is non-null. The SECDEF RPC `get_parent_lesson_notes` mitigates by explicitly excluding `teacher_private_notes` from its return shape (per migration `20260315100100_fix_lesson_notes_private_access.sql:31-35` and `:68,82`), but a hand-crafted client query against `.from('lesson_notes').select('teacher_private_notes')` from parent-authenticated context bypasses the SECDEF defence — RLS permits the row read.
- **Exploit shape:** any staff role with `is_org_staff` predicate (teacher / scheduler / finance / admin) can read any other staff member's private notes via direct table query in the Supabase JS client. Realisation does not require dev-tools; any existing query path that selects `*` from `lesson_notes` returns the column to the wire. From parent context, the realisation path requires a hand-crafted client query (parent-portal UI uses the SECDEF RPC which is correctly filtered).
- **Severity reasoning (PLAN.md §4):** HIGH per class-consistency principle + silent-failure-class anchor ("intended access discrimination silently absent at the enforcement layer"). The bypass is privacy-of-record but not first-encounter-trust-erosion (not marketed to customers as protected-from-other-staff); customer-facing-marketing CRITICAL anchor not triggered. The regression-class framing materially strengthens the evidence chain (team identified, fixed server-side, consumer regressed) but does not by itself escalate severity — the consumer regression is a discrete defence layer drift, not a marketed-feature-fundamentally-broken instance. Same severity bracket as `students.dob` exposure-class precedent in batch 02.
- **DiD posture:** ZERO defensive layers between row-level RLS and column read. Schema names imply intent (`teacher_private_notes`); no enforcement matches the name. Defence-in-depth options enumerated in §8.1 remediation strategies.
- **Anchor fix surface (Phase C reference):** column-level GRANT revoke on `teacher_private_notes` from `anon` + `authenticated`, plus a SECDEF accessor RPC for the legitimate teacher/admin paths; OR generated masked view exposing `teacher_private_notes` only to row-author + admin role; OR additive WITH CHECK predicate on staff_select policy gating column read via subquery on `teacher_id = get_teacher_id_for_user(auth.uid(), org_id)`. Phase C sprint candidate: **S-13-column-level-privacy-enforcement** (class-level fix shared with F-04-004).
- **Decision needed:** No — class-level fix strategy is clear; tactical choice between GRANT revoke vs masked view vs additive WITH CHECK is Phase C tradeoff.
- **Target sprint:** Phase C **S-13-column-level-privacy-enforcement**.
- **Closure:** (open)

---

### F-04-003 — `bulk_update_lessons` cancel-path cascade-completeness-asymmetry; `materialise_continuation_lessons` dedup empirically ABSENT

- **Severity:** High
- **Area:** SECDEF RPC / cascade discipline / dedup-mechanism integrity
- **Phase surfaced:** 3 + 6
- **Class:** cascade-completeness-asymmetry (NEW class, 1 anchor — see §8.2)
- **Evidence:**
  - `bulk_cancel_lessons` body (`pg_get_functiondef`, 289 chars) is a pure-delegating wrapper:
    ```sql
    BEGIN
      RETURN public.bulk_update_lessons(p_lesson_ids, '{"status": "cancelled"}'::jsonb);
    END;
    ```
    Cascade-asymmetry analysis is therefore against `bulk_update_lessons`'s transactional body (≈6,000 chars), which compares against the single-row cancel-this-and-future cascade in `src/components/calendar/LessonDetailPanel.tsx:218-346` (F-03-005 anchor).
  - Single-row cancel-this-and-future cascade (F-03-005 enumeration, batch 03 §10 PI-14 closure): 7 steps comprising (1) lesson UPDATE, (2) `recurrence_rules.end_date` cap, (3) draft invoice-items check, (4) active invoice-items check, (5) fire-and-forget invoice-notify, (6) fire-and-forget parent-notify, (7) Google Calendar sync.
  - `bulk_update_lessons` cancel-path executes ONLY step (1) (atomic UPDATE with per-row trigger guarantees) plus a hard-fail invoice-link check (L78-82 of body — Pattern #8 cancel-path canonical), within a single PL/pgSQL transaction. Steps (2) recurrence end_date cap, (5) invoice-notify, (6) parent-notify, (7) calendar sync are NOT invoked on the bulk path. The cascade-divergence is silent at the call site (`useBulkLessonActions.ts:176`).
  - `materialise_continuation_lessons` body (`pg_get_functiondef`, 5,068 chars) verified for dedup mechanism:
    - No ON CONFLICT clause on the `INSERT INTO lessons` statement.
    - No pre-INSERT EXISTS guard against an existing lesson at `(recurrence_id, start_at)`.
    - The `EXCEPTION WHEN unique_violation THEN _skipped_count := _skipped_count + 1;` arm relies on a unique constraint covering `(recurrence_id, start_at)`. Per `pg_indexes` for `public.lessons`: only `lessons_pkey CREATE UNIQUE INDEX ... ON public.lessons USING btree (id)` and non-unique `idx_lessons_recurrence_id CREATE INDEX ... ON public.lessons USING btree (recurrence_id)`. **No covering UNIQUE constraint exists; the `unique_violation` arm is dead code for the lessons INSERT.**
    - Template-search filter and 200-cap query both EXCLUDE cancelled lessons (`WHERE ... AND status != 'cancelled'` at body §2 and §3). Cancelled rows do not consume cap; cancelled rows do not act as a logical tombstone against re-materialisation.
  - Concrete consequence chain (post-empirical-verification, no longer theoretical):
    1. Admin bulk-cancels 50 lessons on recurrence R via `useBulkLessonActions → bulk_cancel_lessons → bulk_update_lessons {"status":"cancelled"}`.
    2. Per-element atomic UPDATE sets `status='cancelled'` on 50 rows; `trg_cleanup_attendance_on_cancel` fires per-row (Pattern #14 canonical); `audit_lessons` fires per-row (per-row audit trail correctly preserved on bulk path).
    3. `recurrence_rules.end_date` for R is NOT capped — bulk path omits cascade step 2. R's `end_date` retains its original future value.
    4. On the next `materialise_continuation_lessons` invocation (e.g. scheduled cron or user-triggered re-materialise) covering an overlapping date range, the function iterates `p_from_date` to `p_to_date` without consulting `_rec.end_date`. For each cancelled-slot date in the recurrence pattern, the function INSERTs a fresh `status='scheduled'` row at the exact `(recurrence_id, start_at)` of the existing cancelled row. Because no UNIQUE constraint exists, both rows persist.
    5. End state: duplicate-slot rows on recurrence R — one cancelled, one fresh scheduled. The conflict-detection trigger (`check_lesson_conflicts_update` / `_insert`) does not catch this because cancelled lessons are typically excluded from teacher/room overlap predicates (and the new row is not in conflict with any non-cancelled row at the moment of INSERT).
- **Exploit shape:** not a security exploit — operational state corruption. Bulk-cancel of N lessons on a recurrence regenerates as N duplicate-slot rows on the next continuation tick. User intent ("cancel these and prevent re-creation") is silently violated. The lessons appear to come back from the dead.
- **Severity reasoning (PLAN.md §4):** HIGH per silent-failure-class anchor + degraded-but-working-class anchor. The cascade asymmetry is silent (no UI signal at the bulk-cancel call site that steps 5-7 don't fire; no UI signal that recurrence end_date wasn't capped). The dedup absence is silent (the EXCEPTION arm looks like idempotency in code review but doesn't catch anything). Class-consistency with F-03-005 (operational-correctness HIGH ceiling). **NOT escalated to CRITICAL at Phase B** despite financial-adjacency because the duplicate-slot rows don't directly produce charges; they produce visible duplicate lessons that an admin can identify and re-cancel. CRITICAL escalation depends on the downstream billing pipeline behaviour (see cross-batch carry below).
- **Cross-batch financial-falsification escalation hook to batch 05.** If duplicate-slot rows produced by `materialise_continuation_lessons` after a bulk-cancel generate duplicate `invoice_items` downstream via the billing pipeline (e.g. recurring-billing scheduler reads "scheduled" status lessons and emits invoice items per row), F-04-003 escalates from operational-correctness HIGH to financial-falsification CRITICAL via the PLAN.md §4 financial-class anchor. **Batch 05 (billing-invoicing) audit must verify the billing pipeline against duplicate-slot lesson inputs** — specifically:
  - Does the billing pipeline's lesson-to-invoice-item generation deduplicate on `(recurrence_id, start_at)` or only on `lesson_id`?
  - If on `lesson_id` only, duplicate-slot rows produce duplicate invoice items → financial falsification.
  - If deduplicated on slot, the billing layer mitigates; F-04-003 stays HIGH.
  - Severity stays HIGH at Phase B end; batch 05 cross-batch carry is recorded in §5 below.
- **DiD posture:** ZERO defensive layers. The cascade-asymmetry is undetectable without comparison of single-row vs bulk paths; the dedup absence is undetectable without empirical index inventory. The `audit_lessons` trigger correctly fires per-row on the bulk UPDATE path — bulk-cancel audit trail integrity is preserved (Phase 6 retraction note: the earlier Phase 3 §7 audit_log gap claim has been retracted; `audit_lessons` fires AFTER INSERT/UPDATE/DELETE per-row, not INSERT-only, and the bulk UPDATE path produces N audit rows for N affected lessons).
- **Anchor fix surface (Phase C reference):**
  - **DB layer:** add partial unique index `CREATE UNIQUE INDEX lessons_unique_active_slot ON public.lessons (recurrence_id, start_at) WHERE status != 'cancelled';` — closes the dedup absence and protects against future regression.
  - **OR** add pre-INSERT EXISTS guard inside `materialise_continuation_lessons` body before the lessons INSERT, checking both cancelled and scheduled rows at the slot.
  - **AND** unify the cancel cascade — either extend `bulk_update_lessons` to invoke steps 2, 5, 6, 7 (likely via per-element fire-and-forget surfaces invoked by the SECDEF body, with each surface idempotent and best-effort), OR refactor the single-row cancel cascade to call `bulk_cancel_lessons` for the N>=1 case so single and bulk paths share one implementation.
- **Decision needed:** Yes — choose between (a) unify cancel cascade at SECDEF layer (preferred; eliminates the class), (b) unify cancel cascade at FE layer (requires `useBulkLessonActions` to invoke the post-cancel cascade steps after the RPC returns, accepting the resulting non-atomicity), or (c) accept the asymmetry as intentional and add UI signal at the bulk-cancel surface explaining what the bulk-cancel does NOT do.
- **Target sprint:** Phase C **S-14-cancel-cascade-unification** clustered with **S-11-notification-retry-design** (F-03-005 steps 5-7 fire-and-forget hardening).
- **Closure:** (open)

---

### F-04-004 — `lessons.notes_private` exposed via parent-context RLS row policy with no column-level filter; staff-context UI default-renders without role gate

- **Severity:** High
- **Area:** RLS policy / column-level privacy / UI default-render gate
- **Phase surfaced:** 6
- **Class:** column-level-privacy-bypass (class co-anchor with F-04-002 — see §8.1)
- **Evidence:**
  - Documented intent evidence is **ambiguous across three citations** (the ambiguity itself is finding-relevant — see Phase C design call below):
    - **Stricter (author-or-admin contract):** `supabase/migrations/20260119233145_8eb74306-4158-4451-8b9a-8ba11a2c3b75.sql:34` — schema column comment `notes_private text, -- teacher/admin only`. Reads as "the teacher of this lesson, or an admin." Also `src/hooks/usePreviousLessonNotes.ts:98` — code comment: "Only expose private notes if the viewer is the author or an admin/owner".
    - **Looser (staff-from-parents contract):** `src/components/calendar/LessonDetailPanel.tsx:734` — literal UI label rendered to users: `<h3 className="font-semibold mb-2 text-sm">Private Notes (Staff Only)</h3>`. Reads as "any staff, but not parents/students."
    - **Parent-visibility-aware (orthogonal):** `src/components/calendar/LessonNotesForm.tsx:208` — code comment: "Warn when parent_visible is on and private notes exist" — establishes that `notes_private` is mutually exclusive with parent-visible content, but does not by itself pick between the stricter and looser intents above.
  - **Intent-ambiguity finding-relevance.** The schema comment cuts one way; the UI label cuts the other. The bypass shape changes depending on which contract is intended:
    - If author-or-admin is intended: F-04-004 anchor stands as written; the 3 unconditional-render surfaces (staff-from-parents-scope) are themselves bypass instances (teacher A reading teacher B's lesson's `notes_private` is intent-violation); class fix template (S-13) applies uniformly to F-04-002 + F-04-004.
    - If staff-from-parents is intended: F-04-004 reframes — the 3 unconditional-render surfaces ARE consistent with the intent at within-staff scope, and the column-level-privacy-bypass class scope narrows to the parent-role hand-crafted-client bypass only.
    - Severity HIGH at Phase B per class consistency with F-04-002 and per silent-failure-class anchor in either intent reading — both readings have a non-zero unenforced exposure surface.
  - RLS policy evidence (`pg_policy` body audit for `public.lessons`, 9 policies enumerated):
    - "Parent can view children lessons" SELECT: `(has_org_role(auth.uid(), org_id, 'parent') AND (EXISTS (SELECT 1 FROM lesson_participants lp WHERE ((lp.lesson_id = lessons.id) AND is_parent_of_student(auth.uid(), lp.student_id)))))` — **row-level only; no column-level filter; permits SELECT of every column including `notes_private`.**
    - "Teacher can view own lessons" SELECT: `(has_org_role(auth.uid(), org_id, 'teacher') AND (teacher_user_id = auth.uid()))` — teachers only see own lessons. Within-staff scope is correct per "teacher/admin only" intent.
    - "Admin can view all lessons" / "Finance can view all lessons" SELECT: role-based. Correct per intent.
  - Column GRANT layer on `lessons.notes_private`: `anon`, `authenticated`, `postgres`, `service_role` all have `INSERT / REFERENCES / SELECT / UPDATE`. No column-level GRANT discrimination — identical to F-04-002 shape.
  - FE consumer surface enumeration (8 sites; Phase 6 Deliverable 2):
    - `src/hooks/useCalendarData.ts:40` — selects `notes_private` in calendar query.
    - `src/hooks/useRegisterData.ts:95` — selects `notes_private` in register surface.
    - `src/components/register/UnmarkedBacklogView.tsx:83,145` — selects + carries `notes_private`.
    - `src/components/calendar/useLessonForm.ts:109,418,725` — read/write `notes_private` from form state.
    - `src/components/students/StudentLessonNotes.tsx:53,69` — selects `notes_private`; client-side gates render via `isOrgAdmin` (L80, L97, L112, L120, L225). Data already crosses the wire to the client before the gate; a parent-role client that reached this hook would see `notes_private` content in the network response.
    - **`src/components/calendar/LessonDetailPanel.tsx:730-735` — renders `notes_private` UNCONDITIONALLY if truthy (no role gate).**
    - **`src/components/calendar/LessonDetailSidePanel.tsx:197-200` — renders `notes_private` UNCONDITIONALLY.**
    - **`src/components/calendar/MobileLessonSheet.tsx:148-151` — renders `notes_private` UNCONDITIONALLY.**
  - Realised-vs-latent analysis:
    - The 3 unconditional-render surfaces live on `/calendar` which has `allowedRoles: ['owner', 'admin', 'teacher']` (`src/config/routes.ts:134`). Parent role cannot reach these surfaces via UI navigation.
    - SECDEF RPC `get_parent_lesson_notes` (migration `20260315100100_fix_lesson_notes_private_access.sql:5`) explicitly excludes `teacher_private_notes` (the `lesson_notes`-table private column, a sibling concern) from its return shape; no analogous SECDEF accessor exists for `lessons.notes_private`.
    - Bypass-realisation path for parent role: hand-crafted Supabase JS query against `.from('lessons').select('notes_private')` from parent-authenticated context. The RLS "Parent can view children lessons" policy permits the row read (parent-of-student EXISTS gate); the column is not filtered out.
    - Within-staff scope: the 3 unconditional-render surfaces expose `notes_private` to any staff member who can SELECT the lesson via RLS. Teachers see only their own lessons (per RLS); admins and finance see all. **The schema intent "teacher/admin only" is interpreted at within-staff scope as "lesson-owning-teacher OR admin"; finance role inheriting `notes_private` view via the Finance RLS policy is a secondary concern** — finance does not realistically need `notes_private` content for billing reconciliation. Cross-link to F-02-* finance-role-overreach class for class-pattern context only; not folded here.
- **Exploit shape:** parent-role bypass requires hand-crafted client query (not default UI). Staff-role within-scope exposure is default UI (any teacher / admin / finance with calendar access opens a lesson → `notes_private` content rendered without role-author gate). The latter is the realised exposure.
- **Severity reasoning (PLAN.md §4):** HIGH per class-consistency with F-04-002 and the silent-failure-class anchor.
  - **CRITICAL escalation evaluated and rejected** (Phase 8 §3.4 severity verification subtask outcome): the documented intent evidence ("teacher/admin only" schema comment + "author or admin/owner" code comment + parent_visible mutual-exclusion comment) is internal-developer-facing not customer-facing-marketing. The PLAN.md §4 "marketed feature fundamentally broken" CRITICAL anchor requires customer-facing privacy promise; absent here. The bypass-to-parent-role is hand-crafted-only (not default UI exposure). The within-staff bypass is default UI but at within-staff scope (teacher reads another teacher's private notes on same org) — analogous to F-04-002's within-staff exposure; class-consistency rules HIGH.
  - **Reasoning citation:** `usePreviousLessonNotes.ts:98` shows the application code has the correct gating model in one place ("author or admin/owner") but the gate is not enforced at RLS or column GRANT layers and is not consistently applied at render layers. The gap between "code understands the intent" and "DB and UI consistently enforce the intent" is the audit finding.
- **DiD posture:** ZERO defensive layers at DB. Application-layer attempts at gating exist in `usePreviousLessonNotes.ts` and `StudentLessonNotes.tsx` (both check `isOrgAdmin` or author-context); the 3 calendar surfaces do not. Asymmetric application of the same intended access rule.
- **Anchor fix surface (Phase C reference):** class-level fix shared with F-04-002 (S-13-column-level-privacy-enforcement). Plus: add role-author gate at the 3 calendar render surfaces matching the `StudentLessonNotes.tsx:225` shape (`{isOrgAdmin && lesson.notes_private && ...}`) OR a `useIsLessonAuthor(lesson)` hook.
- **Decision needed:** **Yes — Phase C design call required to resolve the intent ambiguity surfaced in the Evidence section.** Phase C must pick between author-or-admin (matches schema comment + `usePreviousLessonNotes.ts:98`) vs staff-from-parents (matches `LessonDetailPanel.tsx:734` UI label) and align the doc + the implementation. If author-or-admin-only intent is confirmed, F-04-004 anchor stands and the class fix template applies uniformly to F-04-002 + F-04-004. If staff-from-parents-only intent is confirmed, F-04-004 reframes — the 3 unconditional-render surfaces ARE consistent with that intent + the column-level-privacy-bypass class scope narrows to parent-role hand-crafted-client bypass only. Severity HIGH at Phase B per class consistency with F-04-002; **Phase C intent resolution may reframe the finding but does not retroactively lower batch-04 severity per closed-batch immutability (PLAN.md §6).**
- **Target sprint:** Phase C **S-13-column-level-privacy-enforcement** (DB layer, shared with F-04-002) + small mechanical edits at the 3 calendar render surfaces (only if author-or-admin intent confirmed; the render-surface edits are deferred pending Phase C design call resolution).
- **Closure:** (open)

---

## 5. Medium findings

### F-04-001 — `useNotesExplorer` + 5 cross-batch hooks destructure `{ data, isLoading }` without `error`; silent-query-error → empty-state masquerade class-finding (6 surfaces)

- **Severity:** Medium
- **Area:** FE hook consumer / TanStack React Query error-surface hygiene
- **Phase surfaced:** 1 + 2 (class-promotion in Phase 2)
- **Class:** silent-query-error → empty-state masquerade (NEW class-finding, 6 surfaces — see §8.3)
- **Evidence:**
  - Six consumer surfaces destructure TanStack React Query results as `{ data, isLoading }` without binding `error`, then render an empty-state UI on `!data || data.length === 0`. If the underlying query throws, the error is silently swallowed and the user sees the empty-state UI as if no data exists, with no signal that the read failed:
    | # | File:line | Hook consumed | Surface description |
    |---|---|---|---|
    | 1 | `src/pages/NotesExplorer.tsx:53-54` (anchor, batch 04) | `useNotesExplorer` + `useNotesStats` | Notes explorer page — empty-state on filter-result-empty AND on query-error |
    | 2 | `src/components/dashboard/TodayTimeline.tsx:229` (batch 03 reach) | `useDashboardTodayTimeline` | Today timeline widget — empty-state on no-lessons AND on query-error |
    | 3 | `src/components/calendar/StudentNotesPopover.tsx:31` (batch 03 reach) | `useStudentLessonNotes` | Per-student notes popover — empty-state on no-notes AND on query-error |
    | 4 | `src/components/calendar/LessonNotesForm.tsx:72` (batch 03 reach) | `useLessonNotes` | Lesson notes form — empty-state on no-existing-notes AND on query-error |
    | 5 | `src/components/students/StudentLessonNotes.tsx:44` (batch 02 reach) | `useStudentLessonNotes` | Student profile lesson notes panel |
    | 6 | `src/pages/PortalSchedule.tsx:124` (batch 11 reach) | `useParentLessonNotes` (this hook also triggers F-01-001 CRITICAL parameter mismatch) | Parent portal schedule — empty-state on no-lessons AND on query-error AND on F-01-001 fail |
  - Cross-batch annotation discipline: surfaces 2-6 lie in closed batches. Per PLAN.md §6 immutability, those closed-batch findings docs are NOT amended. The 5 surfaces are enumerated here for class-finding context only. F-04-001 batch attribution = batch 04 (anchor surface #1).
  - Phase 1 supporting evidence at the batch-04 anchor: `NotesExplorer.tsx:40` also exhibits a silent error fallback (`get_teacher_id_for_user` effect with no `.catch`); the L53-54 destructure-no-error pattern and the L40 silent-effect-error fallback compose for compound silent-failure shape at the anchor surface.
- **Exploit shape:** not a security exploit — UX/operational-correctness gap. User triggers a notes-related view; underlying query fails (network, permission, RPC error); the UI shows an empty-state ("No notes yet") indistinguishable from a successful zero-row read. User concludes "no notes exist" when in fact the read failed. Decision-quality erosion.
- **Severity reasoning (PLAN.md §4):** MEDIUM per silent-failure-class anchor + minor-UX-dead-end anchor. NOT escalated to HIGH because the visible-but-misleading UI shape is recoverable on retry and does not cause data loss or financial impact. Class-finding aggregating 6 surfaces does not stack severity per finding-instance (single-class single-severity rule).
- **DiD posture:** TanStack React Query exposes `error` on the destructure object; the application convention should be to bind it and surface to UI. Zero defensive layers between query failure and silent empty-state.
- **Anchor fix surface (Phase C reference):** mechanical — add `error` to each destructure tuple and render an error state matching the existing `Alert variant="destructive"` shape used elsewhere in the codebase. Six file:line edits as enumerated. Cluster with a lint rule (`@tanstack/eslint-plugin-query` or custom AST check) preventing the `{ data, isLoading }`-without-`error` pattern across the codebase.
- **Decision needed:** No.
- **Target sprint:** Phase C **S-15-query-error-surface-hygiene** (class-level mechanical fix + lint rule).
- **Closure:** (open)

---

### F-04-005 — `lesson_notes` table has no audit trigger; CC-19 #3 carry anchor

- **Severity:** Medium
- **Area:** audit_log integrity / privacy-of-record trail
- **Phase surfaced:** 6
- **Class:** CC-19 #3 audit_log integrity (cross-cutting carry; standalone batch-04 anchor with elevated dimension — see §7)
- **Evidence:**
  - Phase 6 enumeration via `pg_trigger` joined to `pg_class` and `pg_namespace`, filtered by trigger-name pattern `audit_%` OR body referencing `log_audit_event`: 27 tables bear audit triggers. `lesson_notes` is **absent** from the list.
  - The 27 audited tables include: `ai_action_proposals`, `billing_runs`, `guardian_payment_preferences`, `guardians`, `internal_messages`, `invoice_installments`, `invoice_items`, `invoices`, `lesson_participants`, `lessons`, `make_up_credits`, `make_up_waitlist`, `org_memberships`, `payments`, `profiles`, `rate_cards`, `recurring_invoice_templates`, `recurring_template_items`, `recurring_template_recipients`, `refunds`, `student_guardians`, `students`, `teacher_profiles`, `teachers`, `term_adjustments`, `term_continuation_responses`, `terms`. The omission of `lesson_notes` is anomalous against the table's data-sensitivity profile.
  - Note: `student_quick_notes` is not a separate table — the `useStudentQuickNotes` hook reads `lesson_notes` rows with a quick-note-shape filter. The audit gap is a single table-shape, not multiple.
- **Exploit shape:** not a direct exploit — audit trail absence. INSERT/UPDATE/DELETE of `lesson_notes` rows (including mutations of `teacher_private_notes` and parent-visible `content_md`) produces no `audit_log` entry. Investigation of disputes ("did the teacher modify this note after the lesson?", "who deleted the private notes content?") has no DB trail.
- **Severity reasoning (PLAN.md §4):** MEDIUM per minor-UX-dead-end-class anchor + missing-UI-for-tracked-DB-state-class anchor (the inversion: missing-tracked-DB-state-for-actual-mutations). Elevated above pure carry-bucket placement because `lesson_notes` carries privacy-of-record content (`teacher_private_notes`) and parent-facing-of-record content (`content_md` visible to parents) — both dimensions warrant standalone batch-04 finding placement rather than rolling under the generic CC-19 #3 batch-19 sweep bucket.
- **DiD posture:** ZERO audit defensive layer for `lesson_notes`. All sibling sensitive-data tables in batch 02/03 working sets have the trigger.
- **Anchor fix surface (Phase C reference):** add audit trigger matching the shape of `audit_lessons` / `audit_lesson_participants`:
  ```sql
  CREATE TRIGGER audit_lesson_notes
    AFTER INSERT OR DELETE OR UPDATE ON public.lesson_notes
    FOR EACH ROW EXECUTE FUNCTION log_audit_event_singular('lesson_note');
  ```
  Single-line migration.
- **Decision needed:** No.
- **Target sprint:** Phase C **S-16-audit-trigger-completeness** (single migration for `lesson_notes` + any sibling gaps surfaced by batch-19 CC-19 #3 sweep).
- **Closure:** (open)

---

## 6. Positive patterns + HOLDS reinforcements

### 6.1 — Net-new positive observations (Phase 8 promotion decisions)

Phase 1–3 surfaced several positive observations. Following s41/s42 numbering convention (Pattern #1–#15 already established; ≤2 net-new per batch typical), three observations are promoted to numbered patterns this batch; the remainder retained as observations.

**Pattern #16 — Pure-delegating SECDEF wrapper (NEW, s43)**

`bulk_cancel_lessons` body is a 3-line BEGIN/RETURN/END that delegates entirely to `bulk_update_lessons` with a fixed `{"status": "cancelled"}` payload. No additional validation, no transaction wrapping beyond what the delegate provides, no logging. This is the canonical shape for "named convenience wrapper over a parameterised primitive": the wrapper exists for FE call-site clarity (`bulk_cancel_lessons(ids)` reads better than `bulk_update_lessons(ids, '{"status":"cancelled"}')`) without duplicating logic. Class scope: any SECDEF RPC named after a specific operation that is fully expressible as a parameterised call to a more general SECDEF. Anti-patterns: wrappers that re-implement a subset of the primitive's logic and drift over time; wrappers that add un-tested cap discipline that diverges from the primitive's cap.

**Pattern #17 — DB-layer MAX_BULK cap matching FE-layer cap (NEW, s43)**

`bulk_update_lessons` enforces `IF array_length(p_lesson_ids, 1) > 100 THEN RAISE EXCEPTION 'Max 100 lessons per batch'` at the SECDEF entry (body L26-28). FE call sites at `useBulkLessonActions.ts` enforce the same `MAX_BULK = 100` constant before invoking the RPC. **Dual-layer cap-discipline** with matching constants: FE prevents accidental overshoot; DB prevents bypass. Class scope: any bulk-mutation RPC. Anti-pattern: cap on one layer only (FE-only is bypassable via direct API call; DB-only burns a round-trip on user input).

**Pattern #18 — Per-row trigger on bulk-path UPDATE preserves audit + cascade guarantees (NEW, s43)**

`audit_lessons` and `trg_cleanup_attendance_on_cancel` are both `FOR EACH ROW` triggers; they fire per-row inside the atomic UPDATE statement issued by `bulk_update_lessons`. Bulk-cancel of N lessons produces N audit rows and N cleanup-attendance invocations. The "bulk operation" at the FE/RPC layer maps to "atomic single-statement UPDATE that the DB engine iterates per-row" at the engine layer. Class scope: any per-row trigger on a table that is the target of a bulk-mutation RPC. Anti-pattern: STATEMENT-level triggers used where per-row guarantees are assumed.

**Observations retained (not promoted to numbered patterns this batch):**
- CSV `sanitiseCSVCell` Phase 1 (notes-export injection-safe shape) — already covered by Pattern #5 helper-class precedent.
- jsPDF text-mode rendering Phase 1 — covered by Pattern #5.
- TanStack `enabled` gate Phase 1+2 — already widely used; not a net-new pattern.
- Refetch-in-finally Phase 2 — already widely used.
- Per-element rejection feedback Phase 2 — covered by Pattern #8.
- `fromZonedTime` correctness Phase 2 — covered by batch-03 §8.3 timezone class.
- Stable cache key via `.sort()` Phase 2 — observation; not load-bearing for a finding.
- Caller-controlled `enabled` gate Phase 2 — convention; not load-bearing.
- Pure-delegating wrapper observation Phase 3 — promoted to Pattern #16 above.
- MAX_BULK DB cap Phase 3 — promoted to Pattern #17 above.
- Layered invoice-protection Phase 3 — covered by Pattern #8 cancel-path canonical.
- `auth.uid()` JWT-derived caller Phase 3 — already widely used; not a net-new pattern.

### 6.2 — HOLDS reinforcement table

| Pattern | Origin | Batch-04 reach | Disposition |
|---|---|---|---|
| Pattern #3 (defence layering) | batch-02 §7 | 4 caller sites confirmed across batch-04 hooks (Phase 2/4) | HOLDS |
| Pattern #5 (helper-class purity) | batch-02 §7 | server-fn HOLDS; caller-side at `useLessonNotes.ts:119` fails (F-01-001 CRITICAL caller-side instance) | HOLDS server-side; dual-nature annotation added for caller-side |
| Pattern #8 (SECDEF per-element org-check) | batch-02 §7 | Phase 3 confirmed cancel-path; Phase 4 confirmed non-cancel-path HOLDS-by-reference | HOLDS uniformly bulk + single |
| Pattern #14 (trigger-level guards via DDL) | batch-03 §7 | `trg_cleanup_attendance_on_cancel` canonical: `AFTER UPDATE OF status WHEN (new.status='cancelled' AND old.status<>'cancelled')` | HOLDS — canonical instance |
| Pattern #15 (defensive-layering anon-block) | batch-03 §7 | No batch-04 reach — anon-context pattern; batch-04 working set is authenticated-context | N/A |
| F-02-020 helper-class (RLS-context-safe usage) | batch-02 §7 (positive bucket) | 5 `lesson_notes` policies invoke `is_org_admin` / `is_org_member` / `is_org_staff` / `get_teacher_id_for_user` RLS-context-safely | HOLDS |

---

## 7. Cross-batch carry register reinforcements

| Carry # | Class | Batch-04 disposition |
|---|---|---|
| F-02-033 | TS-bypass-cast (LOW class) | **+14 batch-04 instances** (Sub-pattern A: RPC-name-not-in-types 7 sites; Sub-pattern B: RPC-return any[] casts 4 sites; Sub-pattern C: misc payload casts 3 sites). Class total ≥44 sites across batches 02 + 03 + 04. Sub-pattern A is the F-01-001 root-cause shape (RPC parameter mismatch evaded TS check because of `(supabase.rpc as any)` cast at `useLessonNotes.ts:119`); class-level remediation is regen types.ts to include `bulk_update_lessons`, `bulk_cancel_lessons`, `get_lesson_notes_for_staff`, `get_parent_lesson_notes` then remove the `as any` casts at the 7 Sub-pattern A sites. |
| CC-19 #1 | helper EXECUTE-grant | No new batch-04 instances. HOLDS at prior enumeration. |
| CC-19 #2 | vestigial-parameter | +1 reinforcement (`get_lesson_notes_for_staff(p_user_id, p_role, ...)` vestigial parameters; folds under F-02-032 cross-reference; no double-filing). |
| CC-19 #3 | audit_log integrity | **+1 batch-04 anchor finding (F-04-005)** standalone MEDIUM with privacy-of-record + parent-content_md elevation rationale. Prior Phase 3 §7 contingent audit_log gap claim RETRACTED — `audit_lessons` correctly fires AFTER INSERT/UPDATE/DELETE per-row on bulk path. F-04-005 is the actual audit-trigger absence, on the `lesson_notes` table, surfaced by Phase 6 27-table enumeration. |
| CC-19 #5 REFINED | single-trigger-incomplete-DiD (coverage dimension, s42) | N/A trigger-class only. RLS-policy column-level-privacy-bypass class surfaced this batch is conceptually adjacent but NEW class with distinct enforcement layer (RLS row-vs-column discrimination); not folded under CC-19 #5. |
| CC-19 #7 | TS-bypass-cast | Same as F-02-033 row above; class total ≥44. |
| CC-19 #10 | Sentry edge-fn instrumentation | N/A batch 04 — no edge fns in working set. HOLDS at batch-03 enumeration (2 of 4 wrapped). Phase B batch 19 owns 80-fn sweep. |
| CC-19 #11 | schema column constraint hygiene (NOT NULL on identity-class) | Reinforcement-by-observation: `lessons.teacher_user_id` NULLABLE produces same SQL three-valued-logic pattern as `availability_blocks.teacher_id` first instance; both intentional/by-design (no-teacher-assigned ≡ no-conflict-to-detect). No new finding. Class scope holds; batch 19 owns full sweep. |
| **NEW: CC-19 #12** | **column-level-privacy-bypass systematic sweep** | **NEW carry surfaced this batch.** Scope: enumerate all RLS-protected tables; identify columns whose name signals private/internal/admin-only intent; cross-check RLS USING expressions and column GRANTs for column-level enforcement. Batch-04 anchors (F-04-002 + F-04-004) confirm 2 instances (`lesson_notes.teacher_private_notes`, `lessons.notes_private`); batch-19 sweep should enumerate complete population. Schema-name-search this batch ran via `information_schema.columns` filter `(column_name ILIKE '%private%' OR %internal% OR %admin_note% OR %staff_note% OR %confidential%)` and returned exactly these 2 columns — the schema-name signal axis is exhausted for the current schema, but the *RLS-vs-intent* axis (columns without naming signals that still carry private semantics) is not. **Phase 10 propagates this carry to STATUS.md / HANDOVER.md.** |
| F-02-013 | CRITICAL consequence chain (materialise_continuation_lessons re-materialisation after cancel) | Empirical verification this batch promoted the consequence chain from theoretical to realised at bulk-scale (Phase 6 Deliverable 1: no UNIQUE on `(recurrence_id, start_at)`; EXCEPTION-handled `unique_violation` arm is dead code). F-02-013 unchanged at batch 02 per closed-batch immutability. F-04-003 is the batch-04 bulk-scale anchor; cross-reference only. |
| F-04-003 → batch 05 | financial-falsification escalation hook (NEW cross-batch carry, s43) | **NEW carry surfaced this batch.** If duplicate-slot rows produced by `materialise_continuation_lessons` after a bulk-cancel generate duplicate `invoice_items` downstream via the billing pipeline, F-04-003 escalates from operational-correctness HIGH to financial-falsification CRITICAL via PLAN.md §4 financial-class anchor. Batch 05 (billing-invoicing) audit must verify the billing pipeline against duplicate-slot lesson inputs. Recorded in F-04-003 body §4 and propagated to STATUS.md at Phase 10. |

---

## 8. Class-pattern analysis

### 8.1 — Column-level-privacy-bypass class (NEW, 2 anchors)

**Definition.** A class of finding where an RLS policy's USING expression provides row-level access discrimination but no column-level discrimination, AND no column-level GRANT layer compensates, AND the column-by-name signals an access intent narrower than the row-level filter (e.g. `teacher_private_notes`, `notes_private` — names imply intra-staff or intra-author restriction; row-level RLS does not enforce that restriction at the column). The bypass is realised when any consumer (FE or hand-crafted client) selects the column under a role that the row-level RLS permits but the column-name-intent does not.

**Two batch-04 anchors:**
- F-04-002: `lesson_notes.teacher_private_notes`. RLS `lesson_notes_staff_select` USING `is_org_staff(...)` row-level only. Column GRANT: identical anon/authenticated/postgres/service_role grants. Mitigation surface (SECDEF RPC `get_parent_lesson_notes`) covers parent-portal default path but not hand-crafted parent client; no mitigation for within-staff scope (any staff member reads any other staff member's private notes).
- F-04-004: `lessons.notes_private`. RLS "Parent can view children lessons" USING row-level only. Column GRANT: identical grants. Three calendar render surfaces render the column unconditionally for staff roles; parent-role bypass requires hand-crafted client (no SECDEF analog).

**Class size signal.** Schema-name-search via `information_schema.columns` filtered on `private | internal | admin_note | staff_note | confidential` returned exactly these 2 columns. The schema-name signal axis is exhausted for the current schema; the broader *RLS-intent-vs-enforcement-mismatch* axis is not exhausted (columns without naming signals may still carry intended-narrower access). Batch-19 CC-19 #12 sweep (newly surfaced; see §7) owns the broader enumeration.

**Remediation strategies (class-level):**
1. **Column-level GRANT revoke** + SECDEF accessor RPC. REVOKE SELECT on `teacher_private_notes` and `notes_private` from `authenticated`; provide named accessor RPC `get_lesson_with_private_notes(...)` that returns the row including the private column only when caller passes the author-or-admin check inside the SECDEF body. Pros: cleanest defence layering. Cons: every read-path that needs the private column must shift to the accessor.
2. **Generated masked view**: create `lessons_view_for_role` with column-level filters expressed in the view's SELECT list. RLS on the view. Pros: transparent to most consumers if view substitutes the table. Cons: view-vs-table replacement is non-trivial for write paths.
3. **Additive WITH CHECK predicate on the row-level SELECT policy gating the column via subquery** on `teacher_id = get_teacher_id_for_user(auth.uid(), org_id)` plus admin OR. Pros: minimal schema change. Cons: SELECT policies traditionally use USING not WITH CHECK; pattern is unusual and may not be supported uniformly.

**Recommendation:** strategy #1 (GRANT revoke + SECDEF accessor) for both anchors. Single Phase C sprint **S-13-column-level-privacy-enforcement**.

### 8.2 — Cascade-completeness-asymmetry class (NEW, 1 anchor)

**Definition.** A class of finding where two code paths claim the same operational purpose (e.g. "cancel this lesson") but invoke different cascade-step sets after the primary mutation, AND the divergence is silent at the call site — neither path's UI/code signals which cascade steps are present or absent.

**Distinguished from sibling classes:**
- **Multi-step-write-rollback-discipline (F-03-005 anchor class):** concerns partial-failure handling within a multi-step cascade — does step N fail and leave steps 1..N-1 committed? Class focus: rollback semantics. Asymmetry-class focus: cascade-step-set divergence between paths.
- **Fire-and-forget-by-design (s42 anchor class):** concerns intentional non-awaited side-effects (notifications, sync). Class focus: deliberate side-effect non-blocking. Asymmetry-class focus: presence/absence of the side-effect entirely, not awaited-ness.

**Anchor:** F-04-003 — single-row cancel-this-and-future cascade has 7 steps; bulk-cancel cascade has 1 step (atomic UPDATE) + Pattern #8 invoice-link hard-fail. Steps 2-7 of the single-row cascade are NOT invoked on the bulk path; this is silent at `useBulkLessonActions.ts:176` and at the user-facing bulk-cancel UI.

**Remediation strategies (class-level):**
1. **UI signal at the asymmetric call site:** add a warning at the bulk-cancel surface explaining what bulk-cancel does NOT do ("Bulk cancel will NOT cap recurrence end_date or notify parents; do those steps manually after"). Pros: lowest-cost. Cons: relies on user diligence; doesn't fix the gap.
2. **Cascade unification at FE layer:** `useBulkLessonActions` invokes the post-cancel cascade steps in `.then()` after the RPC returns. Pros: matches single-row behaviour. Cons: non-atomicity (the cascade steps run outside the RPC transaction); the same fire-and-forget-by-design failure modes as F-03-005 steps 5-7 apply at scale.
3. **Cascade unification at SECDEF layer:** extend `bulk_update_lessons` (or a new `bulk_cancel_with_cascade_lessons`) to invoke steps 2 + 5 + 6 + 7 inside the body. Pros: atomic; eliminates the class. Cons: SECDEF body grows; fire-and-forget steps that today run async would need PG NOTIFY or external queue dispatch.

**Recommendation:** strategy #3 if budget allows; strategy #2 with idempotent fire-and-forget steps as fallback. Phase C sprint **S-14-cancel-cascade-unification** clustered with **S-11-notification-retry-design**.

### 8.3 — Silent-query-error → empty-state masquerade class-finding (6 surfaces)

**Definition.** Already articulated in F-04-001. Cross-batch class-finding shape per s41 precedent.

### 8.4 — Single-counted accounting (no PI reclassifications this batch)

No PI resolutions or reclassifications this batch. Cumulative grand total active = batch 03 close (91) + 5 batch-04 findings = 96. No double-counting; no PI → finding promotions; no batch-02/03 elevations.

---

## 9. Batch summary tally

**Findings:** 5 (0 Critical / 3 High / 2 Medium / 0 Low).

**Cohort breakdown:**

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active (17 historical, 3 RESOLVED: PI-08, PI-11, PI-14) | 14 | 7 | 6 | 1 | 0 |
| Batch 01 | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (incl. F-02-005 from PI-08 elevation) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (incl. F-03-004 from PI-11 + F-03-005 from PI-14) | 5 | 0 | 4 | 1 | 0 |
| Batch 04 (this batch) | 5 | 0 | 3 | 2 | 0 |
| **GRAND ACTIVE** | **96** | **15** | **27** | **22** | **32** |

**Cross-batch carry deltas tallied (Phase 10 propagates to STATUS.md):**
- F-02-033 TS-bypass-cast class: 30 → 44 sites.
- CC-19 #3 audit_log integrity: +1 batch-04 anchor (F-04-005).
- CC-19 #12 column-level-privacy-bypass systematic sweep: **NEW carry** (batch-19 owned).
- F-04-003 → batch 05 financial-falsification escalation hook: **NEW carry**.

**Net-new positive patterns:** 3 (Patterns #16 / #17 / #18).

**HOLDS reinforcements:** 6 (Patterns #3, #5 dual-nature, #8, #14, F-02-020; Pattern #15 N/A).

**Class scope updates:**
- Column-level-privacy-bypass: NEW class, 2 anchors.
- Cascade-completeness-asymmetry: NEW class, 1 anchor.
- Silent-query-error → empty-state masquerade: NEW class-finding, 6 surfaces.

---

## 10. Legacy-findings re-verification table

(Verbatim from Phase 7 §1 + §2 + §3.)

### 10.1 — Legacy findings with batch-04 reach

| Finding | Prior sev | Batch-04 reach | Disposition | Evidence anchor | Notes |
|---|---|---|---|---|---|
| F-01-001 | CRITICAL | YES | HOLDS — line-position drift recorded | `src/hooks/useLessonNotes.ts:119-122` (was `:113-129` in s40) | RPC `get_parent_lesson_notes` called with `p_student_id` (singular); RPC signature requires `p_student_ids` (plural array). Reinforcement count = 2 (s40 anchor + s43 Phase 2). Same RPC as F-01-005; both bundle in Phase C parent-portal sprint. |
| F-01-005 | RESOLVED (divergence-point precision, s42) | NO | Cross-reference only | n/a | Bundled with F-01-001 in Phase C commit (same RPC body). |
| F-01-014 | HIGH | NO | Cross-reference only | n/a | Confirmed no batch-04 reach (per handover §10 register row). |
| F-01-017 | LOW (11 batch-03 reinforcements) | YES (1 instance) | Cross-reference only | `lesson_notes_staff_update` policy USING+WITH-CHECK-NULL | Already counted in s42 batch-03 §3 11-instance reinforcement table row #5. No new batch-04 count. |
| F-02-013 | CRITICAL | YES (consequence chain) | HOLDS — see §7 row | `materialise_continuation_lessons` body Phase 6 Deliverable 1 | F-04-003 anchors bulk-scale exposure; F-02-013 unchanged at batch 02. |
| F-02-020 helper-class | n/a (positive bucket) | YES | HOLDS — RLS-context-safe usage | 5 lesson_notes policies invoking helpers (Phase 5) | All four helpers used in RLS-context-safe shape. |
| F-02-032 | LOW (vestigial-parameter) | YES | Cross-reference only | `get_lesson_notes_for_staff(p_user_id, p_role, ...)` — Phase 4 ID | Folds under F-02-032 batch-02 class entry; no double-filing. |
| F-02-033 | LOW class (TS-bypass-cast, 30 batch-02 sites) | YES | HOLDS — count corrected upward (+14) | 14 batch-04 instances enumerated in §7 | Sub-pattern A annotated as F-01-001 root-cause shape. |
| F-03-005 multi-step-rollback class | HIGH (10 surfaces) | YES (bulk-cancel chain evaluated) | HOLDS — count UNCHANGED at 10 | bulk_update_lessons atomic DB UPDATE (Phase 3) | Bulk-cancel is DB-transactional; OUTSIDE F-03-005 class. F-04-003 lives in adjacent NEW cascade-completeness-asymmetry class. |

### 10.2 — Pattern HOLDS table

| Pattern | Origin | Batch-04 reach | Disposition | Notes |
|---|---|---|---|---|
| Pattern #3 | batch-02 §7 | YES | HOLDS | 4 caller sites confirmed across batch-04 hooks (Phase 2/4). |
| Pattern #5 | batch-02 §7 | YES (dual-nature) | HOLDS server-side; FAILS caller-side at F-01-001 instance | Pattern entry annotated dual-nature. |
| Pattern #8 | batch-02 §7 | YES (cancel + non-cancel paths) | HOLDS uniformly | Per-element org-check applies uniformly bulk + single. |
| Pattern #14 | batch-03 §7 | YES (canonical instance) | HOLDS | `trg_cleanup_attendance_on_cancel` canonical: column-restricted `AFTER UPDATE OF status` + WHEN predicate. |
| Pattern #15 | batch-03 §7 | NO | N/A — confirmed no reach | Anon-context-specific; batch-04 working set is authenticated-context. |
| F-02-020 helper-class | batch-02 §7 (positive bucket) | YES | HOLDS | RLS-context-safe usage across 5 lesson_notes policies (Phase 5). |

### 10.3 — CC-19 carry batch-04 disposition

Verbatim from §7 above.

---

> **AUDIT IN PROGRESS — DO NOT FIX YET**
>
> This document is the Phase B EXIT deliverable for batch 04-lessons-scheduling-deep. Findings are not authorised for fix until Phase C is explicitly opened and sprints are defined. Banner drops at Phase C kickoff.
