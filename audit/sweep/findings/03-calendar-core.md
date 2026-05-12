# Batch 03 — Calendar Core — Findings

> **AUDIT IN PROGRESS — DO NOT FIX YET**

| Field | Value |
|---|---|
| Batch | 03-calendar-core |
| Phase | B (Systematic Audit) |
| Authoring session | s42 (2026-05-12) |
| HEAD pin | `9c44f39efcec27e562c3f21a507831780643da01` (2026-05-12 06:52 BST, s41 close) |
| Findings | 5 total (0 Critical / 4 High / 1 Medium / 0 Low) |
| Cumulative grand total active (PI active + batch 01 + batch 02 + batch 03) | **91 finding-instances (15 Critical / 24 High / 20 Medium / 32 Low)** — see §10 + §12.7 for PI-11 + PI-14 resolution reconciliation. PI cohort retains PI-11 + PI-14 as historical entries tagged RESOLVED (17 total PI ledger, 14 active) |
| Status | Phase B EXIT; awaiting Phase 10 commit |

---

## 1. Audit basis

**Surface coverage.** 24 CENSUS batch-03 entries (2 pages: `Dashboard.tsx`, `CalendarPage.tsx`; 10 calendar hooks; 5 RPC fns cross-linked from batch 02; 5 in-scope trigger fns on lessons + lesson_participants + availability_blocks; 1 RLS table not in CENSUS row table — `external_busy_blocks` surfaced via Phase 5 `information_schema` verification). **44 RLS policies** across 8 tables (`lessons`, `lesson_participants`, `lesson_notes`, `attendance_records`, `recurrence_rules`, `availability_blocks`, `closure_dates`, `external_busy_blocks`). **12 trigger fns** body-audited (incl. `check_lesson_conflicts` from pre-investigation + 8 fns Phase 4 + 2 trigger SECDEF fns Phase 3 + the 2 attendance_records triggers initially mis-marked vestigial). **4 calendar edge fns** in scope (`calendar-sync-lesson`, `recurring-billing-scheduler`, `send-lesson-reminders`, `send-recurring-billing-alert`).

**Zoom sub-deferral declaration** (per PLAN.md §3 AUDIT SCOPE COMPLETENESS rule 3): the Zoom-specific surface (`zoom-sync-lesson` edge fn; `useExternalBusyBlocks` only insofar as it touches Zoom-mapped calendars; any Zoom-specific code paths in batch-03 surface) is **deferred pending external Zoom authorization/verification** — out of audit scope for THIS batch only, not shelved. All non-Zoom batch-03 surface audited fully. Calendar-sync surface in this batch is Google Calendar only (`calendar-sync-lesson` was confirmed Google-only at line 192 `eq('provider', 'google')`; Zoom-side sync is `zoom-sync-lesson` and falls outside scope).

**Enumeration completeness.** Phase 5 `information_schema.tables` verification confirmed 8 batch-03 tables (anti-pre-investigation-drift discipline; see §12.6 honest limitations). Phase 6 enumerated all 7 conflict-check fns in `useConflictDetection.ts` with file:line precision (2 DB-trigger-covered + 5 app-layer-only). Phase 7 traced PI-14 cancel-cascade across 7 fire-and-forget steps in `LessonDetailPanel.tsx`.

**DiD methodology.** For trigger-class fns: per-table `pg_trigger` inventory (timing / events / WHEN clause / TG_ARGV) + body-side `auth.uid()` / `current_setting('role')` / RAISE-on-condition pattern check. For multi-step write fns: PL/pgSQL transaction-rollback model (Phase 4 batch-02 self-correction model) — function body forms a single implicit transaction; partial failure rolls back all preceding writes. **Single-trigger-incomplete-DiD refinement (NEW, §8):** the CC-19-?#5 single-trigger-DiD class from batch 02 has a *coverage dimension*, not just present/absent. PI-11 is the canonical example — a single trigger (`check_lesson_conflicts`) provides DiD for an invariant class but covers only 2 of 7 instances.

**Class FAIL ratios.**
- Batch 03 surface: **5 findings / 24 surface items = 21% FAIL.** Comparable to batch-02 entity-context-class FAIL rate (24%).
- Comparison to batch 02: similar order; batch-03 findings are mostly *operational-correctness* class (cancel-cascade, conflict-check, mapping-orphan) rather than *security/safeguarding* class (batch-02 dominated by parameter-spoofing).

**Sample-first methodology + decision gates.** Phase 6 PI-11 enumeration: 5 missing checks fully enumerated; bypass surface mapping confirmed 8 paths with 4 production-relevant. Phase 7 PI-14 cascade: full 7-step trace; per-step class assignment (fire-and-forget-by-design vs multi-step-rollback). No escalation gates fired (no Critical-class instances; severity-grading consistent with rubric).

**Honest limitations.**
- **Pre-investigation table-name drift (3 instances):** acknowledged throughout audit. Phase 4 (`lesson_attendance` vs actual `attendance_records`), Phase 5 (4-table scope incomplete; actual 8), Phase 5 (`busy_blocks` vs `external_busy_blocks`). Methodology fix documented in §12.6 — pre-investigation table-list queries must verify against `information_schema.tables` before constructing IN-list filters.
- **Test coverage gap:** `useConflictDetection.ts` has unit tests on result-shaping helpers only (severity tags, time-overlap math). The actual DB-querying fns (`checkClosureDates`, `checkStudentConflicts`, `checkTeacherAvailability`, `checkTeacherTimeOff`, `checkExternalBusyBlocks`) are NOT exercised by integration tests. If a DB query returned wrong data, tests would not catch it (Phase 6 §5).
- **`useCan` drift count:** 188 sites batch-02 baseline holds; no batch-03 re-enumeration. Calendar role-checks visible across pages + hooks but counted under existing batch-02 F-02-027 LOW (batch-02 §12.6 honest-limitations carry).

**Severity rubric anchor.** All severity assignments cite `audit/sweep/PLAN.md` §4 + §6. Critical = financial loss / data loss / security exposure / marketed-feature-fundamentally-broken / first-encounter trust erosion. High = degraded-but-working / silent-failure / surprising / missing-UI-for-tracked-DB-state. Medium = cosmetic-visible / timezone-edge / non-critical race / minor UX dead-end. Low = code-hygiene / stale comment / minor docstring / legacy artefact. **Class-consistency principle (PI-08 + PI-11 methodology, §12.7):** safeguarding/security/destructive/financial classes anchor at CRITICAL ceiling; operational-correctness anchors at HIGH ceiling.

---

## 2. Findings index

| ID | Sev | Phase | One-liner |
|---|---|---|---|
| F-03-001 | High | 1 | `useCalendarActions` reschedule-this-and-future cascade multi-step-write-rollback gap (class extension to 10 surfaces) |
| F-03-002 | High | 2 | `send-recurring-billing-alert` ReferenceError at line 232 (`data.org_id`); silent failure of partial/failed run alert email |
| F-03-003 | Medium | 2 | `calendar-sync-lesson` local mapping INSERT error not checked after Google Calendar POST; orphan-event drift class |
| F-03-004 | High | 6 | PI-11 RESOLVED — `check_lesson_conflicts` DB trigger enforces only 2 of 7 promised conflict checks; 5 app-layer-only and bypassable via ≥4 production-relevant non-FE paths. Severity adjusted Critical → HIGH on body re-audit |
| F-03-005 | High | 7 | PI-14 RESOLVED — cancel-this-and-future cascade mixed-class failure modes: step 2 `recurrence_rules` end_date cap silent failure → next cron call regenerates cancelled lessons via F-02-013 consequence chain |

---

## 3. Critical findings

**No Critical findings in batch 03.** Batch-03 surface is operational-correctness class (cancel-cascade, conflict-check, mapping-orphan); safeguarding/security/financial CRITICAL anchors do not apply.

---

## 4. High findings

### F-03-001 — `useCalendarActions` reschedule-this-and-future cascade multi-step-write-rollback gap

- **Severity:** High
- **Area:** FE hook / multi-step-write
- **Phase surfaced:** 1
- **Class:** multi-step-write-rollback-discipline (class extension to 10 surfaces — see §8)
- **Evidence:**
  - [`src/hooks/useCalendarActions.tsx:209-228`](../../src/hooks/useCalendarActions.tsx) reschedule flow excerpt:
    ```ts
    if (mode === 'this_and_future' && lesson.recurrence_id) {
      const offset = newStart.getTime() - new Date(utcStartAt).getTime();
      const newDuration = newEnd.getTime() - newStart.getTime();
      const originalDuration = new Date(utcEndAt).getTime() - new Date(utcStartAt).getTime();

      // Step 1: UPDATE current lesson directly (awaited, error checked)
      const { error: firstError } = await supabase
        .from('lessons')
        .update({
          start_at: newStart.toISOString(),
          end_at: newEnd.toISOString(),
        })
        .eq('id', lesson.id);
      if (firstError) throw firstError;

      // Step 2: shift_recurring_lesson_times RPC — no error check; not in compensating block
      if (offset !== 0 || newDuration !== originalDuration) {
        await supabase.rpc('shift_recurring_lesson_times', {
          p_recurrence_id: lesson.recurrence_id,
          p_after_start_at: utcStartAt,
          p_offset_ms: offset,
          p_new_duration_ms: newDuration,
          p_exclude_lesson_id: lesson.id,
        });
      }
    }
    ```
  - Step 1 awaits an UPDATE on the current lesson with `firstError` check.
  - Step 2 awaits the `shift_recurring_lesson_times` RPC without destructuring or checking `error`. If the RPC throws, the outer `try/catch` (line 202) catches but Step 1's UPDATE is already committed.
  - The undo affordance (line 257-294) is a 5-second `ToastAction` callback that performs the reverse UPDATE + reverse RPC. If the user dismisses the toast before clicking, partial state persists. If undo itself fails (line 287-289 catch), the user is told to "edit the lesson manually".
  - Cross-references: TS-bypass-cast at line 267 (`(supabase.rpc as any)` in the undo branch) already counted in F-02-033 30-site class.

- **Impact:**
  - Calendar drift out of recurrence-rule sync. Current lesson sits at the new time; future lessons stay at the old time; the recurrence rule itself is unchanged at the row level.
  - User-visible inconsistency in the calendar grid (current-occurrence-at-new-time + future-occurrences-at-old-time pattern).
  - Recovery requires the 5-second undo affordance (auto-dismisses) OR manual per-lesson edit.

- **Severity reasoning (PLAN.md §4):**
  - **HIGH** — silent failure mode + class consistency with the 7 prior multi-step-write-rollback surfaces (batch-01 F-01-002, F-01-004, F-01-006, F-01-030; batch-02 F-02-006, F-02-026; Phase 2 calendar-sync mapping orphan F-03-003).
  - Not Critical: divergence is user-visible (calendar grid shows the drift); undo path provides a 5-second window for recovery; no financial/PII/safeguarding impact.

- **Anchor fix surface:** wrap Step 1 + Step 2 in a single Edge Function RPC (`update_lesson_and_future_lessons`) running server-side as a PL/pgSQL block (transactional). Same pattern as recommendation for the 7 prior surfaces. Cluster in Phase C `S-06-write-rollback-discipline` sprint.

- **Decision needed:** No.
- **Target sprint:** Phase C — `S-06-write-rollback-discipline` (extends from 7 to 10 surfaces).
- **Closure:** (empty)

### F-03-002 — `send-recurring-billing-alert` ReferenceError at line 232; silent failure of partial/failed run alert

- **Severity:** High
- **Area:** Edge fn / silent-failure / safety-net path
- **Phase surfaced:** 2
- **Class:** silent-failure on safety-net path + TypeScript-typed-error-undetected
- **Evidence:**
  - [`supabase/functions/send-recurring-billing-alert/index.ts:220-240`](../../supabase/functions/send-recurring-billing-alert/index.ts) Resend send block:
    ```ts
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { /* ... */ },
          body: JSON.stringify(await transformEmailForShadow({
            from: `${sanitiseFromName(org?.name || "LessonLoop")} <billing@lessonloop.net>`,
            to: recipients.map((r) => r.email),
            subject,
            html: emailHtml,
          }, { orgId: data.org_id, supabase: supabase })),  // ← ReferenceError: data is not defined
        });
        sentOk = emailResponse.ok;
        // ...
      } catch (err) {
        console.error("Resend send failed:", err);  // ← swallows the ReferenceError
      }
    }
    ```
  - The fn destructures `body` into local consts at line 51-63 (including `org_id` directly). At line 232, the code passes `{ orgId: data.org_id, supabase: supabase }` as the 2nd arg to `transformEmailForShadow`. **`data` is not declared anywhere in the function scope.** All other `data` references in the file are destructuring aliases (`const { data: existingSent }` at line 76, `const { data: org }` at line 94, etc.) — none of those create a `data` binding.

- **Failure path:**
  - When `RESEND_API_KEY` is set (production) AND recipients are resolved (recurring billing run had `outcome IN ('partial', 'failed')`), execution reaches line 232.
  - `data.org_id` throws `ReferenceError: data is not defined`.
  - Caught by the line 238-240 catch → logs `"Resend send failed: ReferenceError..."`.
  - `sentOk` stays `false`. message_log row inserted at line 246-262 with `status='failed'`.

- **Impact:**
  - **Every partial-or-failed recurring billing alert email silently fails to send.** Admins/finance-team do not receive the safety-net notification.
  - Visible only in Supabase edge fn logs (`console.error`) + `message_log` rows with `status='failed'` (no UI surface — cross-link to F-02-010 audit-log integrity gap, batch 02).

- **F-03-002 alternative-observability verification (Phase 7 deliverable):** 3 FE surfaces independently expose partial/failed run outcomes — confirms email is one channel among multiple; HIGH HOLDS (not escalated to CRITICAL). FE backup paths:
  1. **Recurring billing run-detail page** surfaces `outcome` field on the `recurring_template_runs` table with status badge (verified Phase 7).
  2. **Run-errors detail table** (`recurring_template_run_errors`) surfaces per-recipient error codes + messages in the UI.
  3. **Scheduler response payload** (cron caller) includes `alerts_triggered` counter; ops observability via cron-job-status dashboard if monitored.

- **Severity reasoning (PLAN.md §4):**
  - **HIGH** — silent failure mode + missing UI surface for tracked DB state (failed message_log rows accumulate with no visibility) + class-pattern with batch-02 send-* fire-and-forget cluster.
  - **Not Critical** per alternative-observability verification (Phase 7): FE provides 3 independent channels for run-outcome visibility. The alert email is a safety-net for "admin hasn't checked the app"; loss of that channel is degradation, not flow-broken.
  - Not Medium because the alert flow is explicitly marketed safety-net for ops; silent loss is degradation of a tracked deliverable.

- **Anchor fix:** one-line typo correction at line 232 — replace `data.org_id` with `org_id`. No other body changes needed. Can land independently of any sprint as a micro-PR.

- **Decision needed:** No (mechanical typo fix).
- **Target sprint:** Phase C — micro-PR independent of sprints; can also cluster with `S-07-invite-flow-status-fidelity` (batch 02) if grouping send-* fixes.
- **Closure:** (empty)

### F-03-004 — PI-11 RESOLVED — `check_lesson_conflicts` DB trigger enforces only 2 of 7 promised conflict checks

- **Severity:** **High** (severity adjusted from PI-11 pre-investigation tag of Critical; rationale in §10 + §12.7)
- **Area:** DB trigger / architectural / multi-path bypass / operational-correctness class
- **Phase surfaced:** 6 (PI-11 resolution)
- **Class:** single-trigger-incomplete-DiD (refinement of CC-19-?#5; see §8)
- **PI-11 history reconciliation:**
  - **Original PI-11 (s38 pre-investigation):** Critical | `check_lesson_conflicts` DB trigger enforces only 2 of 7 promised conflict checks.
  - **Batch 03 Phase 6 (s42, 2026-05-12):** Body re-audit confirms exactly 2 of 7 checks fire at DB trigger; 5 (student double-booking, closures, availability, time-off, busy_blocks) are app-layer only. Bypass surface enumerated (≥4 production-relevant paths). Concrete exploit demonstrated via F-02-013 `materialise_continuation_lessons`.
  - **Severity adjusted Critical → HIGH** per class-consistency rubric: operational-correctness class caps at HIGH ceiling (safeguarding/security/destructive/financial classes anchor at CRITICAL ceiling per PI-08 + PI-11 methodology). See §12.7.
  - **Inverse-direction analogue:** parallels PI-08 RESOLVED → F-02-005 elevation HIGH → CRITICAL in batch 02 Phase 7C (both adjustments evidence-based, body-audit-driven, class-consistent).

- **Evidence:**
  - **DB trigger body (pre-investigation §6.3, verbatim excerpt):**
    ```sql
    BEGIN
      IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
      -- 1. Teacher double-booking check
      IF NEW.teacher_id IS NOT NULL THEN
        SELECT id, title, start_at INTO _conflict_teacher
        FROM public.lessons
        WHERE teacher_id = NEW.teacher_id ...
          AND start_at < NEW.end_at AND end_at > NEW.start_at
        LIMIT 1;
        IF FOUND THEN RAISE EXCEPTION 'CONFLICT:TEACHER:...'; END IF;
      END IF;
      -- 2. Room double-booking check
      IF NEW.room_id IS NOT NULL THEN
        SELECT id, title, start_at INTO _conflict_room
        FROM public.lessons
        WHERE room_id = NEW.room_id ...
        IF FOUND THEN RAISE EXCEPTION 'CONFLICT:ROOM:...'; END IF;
      END IF;
      RETURN NEW; END;
    ```
    Only teacher + room checks fire at DB layer. 5 remaining checks live in [`src/hooks/useConflictDetection.ts`](../../src/hooks/useConflictDetection.ts):
    - **#1 student double-booking:** `checkStudentConflicts` at line 404 — `lesson_participants` JOIN `lessons` ±24h window; 'error' severity.
    - **#2 closures:** `checkClosureDates` at line 177 — `closure_dates` filtered by `org_id` + `date`; severity org-configurable via `block_scheduling_on_closures`.
    - **#3 availability:** `checkTeacherAvailability` at line 216 — `availability_blocks` filtered by `org_id` + `teacher_id` + `day_of_week`; 'warning' severity. **Watch item: empty-availability case (line 237) silently passes — teacher with no availability blocks can be scheduled at any time.**
    - **#4 time-off:** `checkTeacherTimeOff` at line 257 — `time_off_blocks` filtered by `org_id` + `teacher_id`; 'error' severity.
    - **#5 external busy blocks:** `checkExternalBusyBlocks` at line 468 — `external_busy_blocks` filtered by `org_id` + `user_id`; 'warning' severity.

  - **Bypass surface enumeration (Phase 6 §2 table reproduced):**

    | # | Path | Type | Bypasses (of 5) | Severity contribution |
    |---|---|---|---|---|
    | 1 | `materialise_continuation_lessons` (F-02-013 HIGH, batch 02) | SECDEF, server-side cron-fired AND anon-RPC-callable | All 5 | **CONCRETE EXPLOIT** — Phase 7C confirmed cross-tenant anonymous creation of up to 200 lessons per call; conflict-checks bypassed |
    | 2 | `bulk_update_lessons` (PASS Phase 7C) | SECDEF FE-callable RPC | All 5 (UPDATE path) | DB trigger fires on UPDATE for teacher+room; 5 remain bypassed |
    | 3 | `shift_recurring_lesson_times` (PASS Phase 7C) | SECDEF FE-callable RPC | All 5 (UPDATE path) | Reschedule path; same bypass class |
    | 4 | `bulk_cancel_lessons` (PASS Phase 7C) | SECDEF FE-callable RPC | N/A — `status='cancelled'` exits trigger early | N/A |
    | 5 | LoopAssist `executeRescheduleLessons` (PI-12 CRITICAL, batch 17 IN-SWEEP) | Agent action | All 5 (UPDATE path) | PI-12 original anchor for this bypass concern |
    | 6 | LoopAssist `bulk_complete_lessons` (PI-16 HIGH, batch 17 IN-SWEEP) | Agent action | N/A (completion doesn't change time) | N/A |
    | 7 | Direct SQL (Supabase Studio, psql, edge fn service-role) | Manual | All 5 | Operational risk; bounded by admin discipline |
    | 8 | Future RPC-callable lesson-INSERT/UPDATE paths | TBD | All 5 (by default) | Architectural exposure — any new SECDEF fn touching `lessons` inherits the bypass |

- **Severity reasoning (PLAN.md §4 + s42 prompt class-consistency analysis):**
  - **HIGH** per rubric — architectural exposure (5 of 7 critical business invariants enforced only at FE layer) + multi-path bypass (8 paths; 4 production-relevant) + concrete exploit (F-02-013 anonymous cross-tenant lesson creation bypasses all 5 checks).
  - **Not CRITICAL** per class-consistency: F-02-002 (cross-tenant child PII) is CRITICAL because it's safeguarding-class; PI-11 is operational-correctness class — silent business-invariant violation produces user-visible inconsistency (double-booked student, lesson on closed day, lesson outside teacher hours) but not security/PII/safeguarding/financial exposure.
  - First-encounter trust erosion argument considered (parent receives reminder for closure day; student finds two lessons on schedule): real impact, but sits below the safeguarding/financial bar that CRITICAL anchors at in this audit.

- **DiD posture:** **Single-trigger-incomplete-DiD** — the trigger exists but covers only 2 of 7 invariant instances. Class refinement: CC-19-?#5 from batch 02 has a *coverage dimension* (see §8). RLS layer provides ZERO conflict-class enforcement (Phase 5 confirmed). App-layer enforcement is per-call-site and bypassable by any non-FE path.

- **Anchor fix surface (architectural):** migrate the 5 app-layer-only checks to DB triggers — extend `check_lesson_conflicts` with 5 additional check clauses. Tradeoffs:
  - **Pro:** any INSERT/UPDATE path (FE/SECDEF/direct SQL) triggers the check; bypass class eliminated; trigger atomicity provides transactional safety.
  - **Pro:** removes the 5-of-8-bypass-paths class entirely.
  - **Con:** PL/pgSQL complexity for closure/availability/busy_block JOINs.
  - **Con:** error message i18n / translation lost at DB layer (English-only).
  - **Con:** false positives may need finer-grained skip logic (admin override flag).
  - **Con:** `'warning'` vs `'error'` severity distinction harder to express at trigger layer (RAISE is binary).

- **Decision needed:** **YES** — `block_scheduling_on_closures` config flag suggests org-by-org policy; trigger-migration design must preserve that. Plus `'warning'` vs `'error'` distinction (closure + availability are advisory): promote to blocking at DB layer or retain advisory-only at FE?
- **Target sprint:** Phase C — `S-09-conflict-check-db-migration` (new; clusters with `S-06-write-rollback-discipline` since both target lesson-INSERT integrity; cross-batch with batch 04 lessons-scheduling-deep).
- **Closure:** **PI-11 RESOLVED** in batch 03 (this finding). STATUS.md §5.1 row update queued for Phase 10 — see §10.

### F-03-005 — PI-14 RESOLVED — cancel-this-and-future cascade mixed-class failure modes

- **Severity:** **High** (severity unchanged from PI-14 pre-investigation tag)
- **Area:** FE component / cascade / mixed-class failure modes / multi-step-write-rollback partial + fire-and-forget-by-design partial
- **Phase surfaced:** 7 (PI-14 resolution)
- **Class:** mixed — multi-step-write-rollback (step 1-4) + fire-and-forget-by-design (step 5-7)
- **PI-14 history reconciliation:**
  - **Original PI-14 (s38 pre-investigation):** High | Cancel-this-and-future cascade is fire-and-forget (recurrence cap, invoice check, parent notify) without transaction.
  - **Batch 03 Phase 7 (s42, 2026-05-12):** Per-step audit of 7 cascade steps at [`src/components/calendar/LessonDetailPanel.tsx:218-346`](../../src/components/calendar/LessonDetailPanel.tsx). Class membership decision (per the s42 prompt §A): some steps are fire-and-forget-by-design (sync paths); others are required-but-mis-classified (invoice-state cascades that affect financial integrity).
  - **Severity unchanged HIGH;** no transition.

- **Evidence — per-step audit:**

  | Step | Line | Behaviour | Error handling | Class assignment |
  |---|---|---|---|---|
  | 1 | 249-254 | Primary UPDATE on `lessons` (atomic single-row write keyed by `recurrence_id` + `start_at` for series; OR single `id` for this-only) | `if (error) throw error` — caught by outer `try/catch` | Multi-step-rollback step (primary write) |
  | 2 | 268-274 | `recurrence_rules` end_date cap (`subDays(lesson.start_at, 1)`) | `.then()` chain with `logger.warn` on error; no surface | **Multi-step-rollback CRITICAL** — silent failure → next cron call regenerates cancelled lessons via F-02-013 `materialise_continuation_lessons` → cancelled lessons reappear (see consequence chain below) |
  | 3 | 278-303 | Draft invoice items check via `invoice_items.linked_lesson_id IN cancelledIds` filtered by `invoices.status='draft'` | `.then()` with `logger.warn` on error; toast on found-warnings; **error path falls through silently** | Multi-step-rollback (financial integrity) |
  | 4 | 306-321 | Active invoice items check (`invoices.status IN ('sent', 'overdue')`); toast on found-warnings | `.then()` with **NO error handler at all** | Multi-step-rollback (financial integrity, weakest error handling) |
  | 5 | 324-335 | `send-cancellation-notification` edge fn invoke | `.catch(err => logger.warn)` | **Fire-and-forget-by-design** — explicit non-blocking; parent notification class |
  | 6 | 339 | `syncLessons(cancelledLessonIds, 'update')` — calendar sync helper | Fire-and-forget per comment line 261 | **Fire-and-forget-by-design** — Google Calendar sync |
  | 7 | 341 | `syncZoomMeetings(cancelledLessonIds, 'delete')` — Zoom meeting deletion helper | Fire-and-forget per comment line 261 | **Fire-and-forget-by-design** — Zoom integration (Zoom sub-deferred per AUDIT SCOPE COMPLETENESS; class membership assignment retained but full audit of sync path deferred to batch 15) |

  The line 261 comment — *"Cascade side effects (fire-and-forget, non-blocking)"* — was originally read in s38 as applying to all 6 downstream steps. Phase 7 audit reveals the comment correctly describes steps 5-7 (notification + external syncs) but **mis-classifies steps 2-4** (recurrence-rule cap + invoice-state cascades) as fire-and-forget-by-design when their failure modes are actually multi-step-write-rollback class.

- **Step 2 → F-02-013 consequence chain (HEADLINE failure mode):**

  This is the most consequential failure mode of the cancel cascade. The chain:

  1. User cancels a lesson series via "cancel-this-and-future" (LessonDetailPanel cancel flow).
  2. Step 1 succeeds — all future lessons UPDATE'd to `status='cancelled'`.
  3. Step 2 silently fails — `recurrence_rules.end_date` cap UPDATE throws an error, caught by `.then()` chain, `logger.warn` invoked, no user surface.
  4. The recurrence rule's `end_date` is **unchanged** — still extends past the cancellation date.
  5. The daily `recurring-billing-scheduler` cron job (jobid 93, 04:00 UTC daily) fires.
  6. The scheduler calls `generate_invoices_from_template` and various lesson-materialisation paths.
  7. `materialise_continuation_lessons` (F-02-013 HIGH, batch 02 Phase 7C) — which uses `recurrence_rules` as input — sees the un-capped recurrence and **regenerates the cancelled lessons** with new `id`s on the dates after the cancellation.
  8. User opens the calendar the next morning: lessons they cancelled yesterday have reappeared with new IDs.
  9. The user has no idea why; the cancel UI showed success; no error toast surfaced.

  This is **first-encounter trust erosion territory** but per the operational-correctness class anchor (PI-11 methodology), severity HOLDS at HIGH rather than escalating to CRITICAL. The chain is documented prominently because:
  - It's the most user-visible failure mode of the cascade.
  - It cross-references F-02-013 (HIGH) which is itself the concrete exploit demonstration for PI-11.
  - It demonstrates that the multi-step-rollback class and the conflict-check bypass class are not isolated — failures in one cascade enable downstream exploitation in another.

  Phase 9 doc body (§9 cross-link annotations) includes bi-directional cross-links: F-02-013 ↔ PI-11 (F-03-004) ↔ PI-14 (F-03-005) form a consequence chain triangle.

- **Step 5 child-safeguarding adjacency (Phase C design-call topic):**

  Step 5 is `send-cancellation-notification` — parent-facing communication channel. If this step silently fails, parents do not receive the cancellation email and may show up for a cancelled lesson. **Child-safeguarding adjacency consideration:** in some contexts (younger children dropped off by parents/guardians), arriving for a cancelled lesson means the child is at an empty venue at the expected time.

  **Severity verdict:** **NOT escalated** to CRITICAL on safeguarding grounds. Music school operational context: cancellation notification failure is no-show class, not safeguarding-critical (parents typically still arrive WITH their child for younger pupils; older pupils have alternative communication channels). Phase C design-call topic: should the cancellation notification path have a retry/queue affordance? Documented for design without escalating PI-14 severity.

- **Class membership decision:**
  - **Steps 2-4: multi-step-write-rollback class** (10 surfaces total: 7 batch-02 + F-03-001 Phase 1 + F-03-003 Phase 2 + F-03-005 steps 2-4).
  - **Steps 5-7: fire-and-forget-by-design class** (NEW class, 4 instances total: F-03-005 steps 5-7 + send-invite-email batch 02 Medium reference). See §8 for class definition.
  - The cascade is a *mixed-class instance* — it's not cleanly one or the other. Phase 9 doc tracks both classes separately (§8).

- **Severity reasoning (PLAN.md §4):**
  - **HIGH** — silent failure across multiple cascade steps; concrete user-visible failure mode (step 2 → F-02-013 consequence chain) with first-encounter trust erosion adjacency; financial-integrity steps (3-4) with weak/absent error handling.
  - Not Critical: not safeguarding/security/financial-class per class-consistency anchor; bounded blast radius (intra-org, audit-trail-visible).

- **Anchor fix surface:**
  - **Steps 2-4 (multi-step-rollback fix):** wrap in server-side Edge Function RPC + audit-log integrity (cluster with `S-06-write-rollback-discipline` and `S-09-conflict-check-db-migration`).
  - **Steps 5-7 (fire-and-forget-by-design design call):** retry/queue affordance design question — Phase C UX decision, not mechanical fix.
  - **Step 2 specific (recurrence cap):** the recurrence-rule end_date cap should be atomic with the lessons UPDATE in Step 1 — both writes belong in the same transaction; trigger or RPC wrapper is the canonical fix.

- **Decision needed:** **YES** — Phase C design-call on Steps 5-7 retry affordance.
- **Target sprint:** Phase C — `S-06-write-rollback-discipline` (Steps 2-4) + `S-11-notification-retry-design` (Steps 5-7 design call; new sprint candidate).
- **Closure:** **PI-14 RESOLVED** in batch 03 (this finding). STATUS.md §5.1 row update queued for Phase 10 — see §10.

---

## 5. Medium findings

### F-03-003 — `calendar-sync-lesson` local mapping INSERT error not checked after Google Calendar POST

- **Severity:** Medium
- **Area:** Edge fn / multi-step-write-rollback (Google API + local DB) / orphan drift class
- **Phase surfaced:** 2
- **Class:** multi-step-write-rollback-discipline (class extension across the Google API boundary)
- **Evidence:** [`supabase/functions/calendar-sync-lesson/index.ts:349-367`](../../supabase/functions/calendar-sync-lesson/index.ts) Google Calendar event creation path:
  ```ts
  if (createResponse.ok) {
    const createdEvent = await createResponse.json();
    // No existingMapping by construction — the path above handles updates.
    await supabase
      .from('calendar_event_mappings')
      .insert({
        connection_id: connection.id,
        lesson_id: lesson_id,
        external_event_id: createdEvent.id,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      });
    // ↑ no { error } destructure; no error check
    result = { success: true, external_event_id: createdEvent.id };
  }
  ```
  The supabase-js `.insert()` call returns `{ data, error }` — does not throw on RLS / FK violations. The code does not destructure or check `error`. `result.success = true` is set unconditionally if `createResponse.ok` is truthy.

- **Failure path:**
  - Google Calendar POST succeeds → `createdEvent.id` returned.
  - Local INSERT fails silently (RLS, FK, transient DB issue).
  - Fn returns `{ success: true, external_event_id: createdEvent.id }`.
  - FE caller records success.
  - **Orphan Google event lives forever** — local mapping doesn't exist, so subsequent sync attempts find `existingMapping=null` → create ANOTHER Google event → mapping INSERT retried successfully → first Google event remains orphaned.

- **Impact:**
  - User sees multiple copies of the same lesson on their Google Calendar if the orphan recurs.
  - Single-failure mode is undetected; recurring failures become user-visible only via duplicate events.
  - No security/PII/financial impact; pure operational drift.

- **Severity reasoning (PLAN.md §4):**
  - **MEDIUM** — silent state divergence; orphan external resource; recovery requires manual user action (delete duplicates from Google Calendar).
  - Class: multi-step-write-rollback (Google API + local DB) — extends the class beyond FE/edge surfaces into the external-integration boundary.
  - Not High because orphan is bounded to single events (no cross-tenant blast radius; no PII); user-visible if it persists.

- **Anchor fix:** destructure and check `error` after the INSERT; on failure, attempt compensating Google DELETE (best-effort):
  ```ts
  const { error: mappingError } = await supabase
    .from('calendar_event_mappings')
    .insert({ /* ... */ });
  if (mappingError) {
    // Best-effort compensating delete
    await fetch(`${baseUrl}/${createdEvent.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => { /* log warning */ });
    result = { success: false, error: 'Mapping insert failed; Google event rolled back' };
  } else {
    result = { success: true, external_event_id: createdEvent.id };
  }
  ```

- **Decision needed:** No.
- **Target sprint:** Phase C — `S-06-write-rollback-discipline` extension (Google API surface — first external-integration instance in the class).
- **Closure:** (empty)

---

## 6. Low findings

**No Low findings in batch 03 as standalone entries.**

F-01-017 batch-01 LOW class receives 11-instance reinforcement on batch-03 surface (Phase 5). Most concrete reinforcement: `lessons` "Teacher can update own lessons" — teacher can mutate `teacher_user_id` to another user via direct UPDATE (intra-org grief vector). Reinforcement evidence captured in §8 class-pattern analysis as supporting material for F-01-017 LOW class continuity; **not** raised as a new batch-03 finding because severity HOLDS at LOW per class-consistency and the new instances are reinforcement, not new defects.

---

## 7. Positive-pattern catalogue

Two new patterns extending the batch-02 catalogue of 13 patterns. The two new patterns are **#14** (trigger-level guard) and **#15** (defensive-layering anon-block). Cross-link to batch-02 `audit/sweep/findings/02-org-management.md` §7 for patterns #1-13.

### Pattern #14 — Trigger-level guard pattern (column-restricted UPDATE OF + transition-WHEN clause)

**Class applicability:** triggers that need to fire only on specific state transitions (e.g., `status='cancelled'` transition); body-side conditional is unnecessary by design when trigger DDL guards are present.

**Trigger DDL (verbatim, Phase 0 verification):**
```sql
CREATE TRIGGER trg_cleanup_attendance_on_cancel
  AFTER UPDATE OF status ON public.lessons
  FOR EACH ROW
  WHEN (((new.status = 'cancelled'::lesson_status) AND (old.status <> 'cancelled'::lesson_status)))
  EXECUTE FUNCTION cleanup_attendance_on_cancel()
```

**Fn body (verbatim, intentionally minimal):**
```sql
BEGIN
  DELETE FROM public.attendance_records WHERE lesson_id = NEW.id;
  RETURN NEW;
END;
```

**Why it works (two-layer guard at trigger DDL):**
1. **`AFTER UPDATE OF status`** — fires only when the `status` column is in the UPDATE column-list. Title/time/notes UPDATEs that don't touch status will not invoke the trigger.
2. **`WHEN (new.status='cancelled' AND old.status<>'cancelled')`** — restricts execution to the transition INTO cancelled state (not re-updates of already-cancelled lessons; not transitions out of cancelled back to scheduled).

**Why body-side conditional is unnecessary:** the trigger DDL's two-layer guard makes the function body's lack of internal `IF NEW.status = 'cancelled' ...` check correct by design. Adding a body-side conditional would be defensive duplication; omitting it is the cleaner pattern when trigger DDL guards are present.

**Reference instance:** `trg_cleanup_attendance_on_cancel` on `lessons`.

**Use case:** triggers that respond to specific lifecycle transitions on entity rows. Useful any time a row state machine has clear before/after states that should drive side-effects (cancelled, completed, paid, void, etc.).

### Pattern #15 — Defensive-layering anon-block (USING=false ALL policy)

**Class applicability:** RLS-enabled tables where anon role is never intended to read/write; belt-and-braces against accidental EXEC grants.

**RLS policy DDL (verbatim, Phase 5):**
```sql
CREATE POLICY "Block anonymous access to closure_dates"
  ON public.closure_dates
  AS PERMISSIVE
  FOR ALL
  TO anon
  USING (false);
```

**Why it works:** the `USING (false)` clause unconditionally evaluates to false for the `anon` role. Combined with `FOR ALL`, every SELECT/INSERT/UPDATE/DELETE from anon is rejected at the policy layer before any other policy is evaluated. Even if the table's other policies were accidentally granted to anon via EXECUTE drift, this policy provides an explicit deny-all anchor.

**Reference instance:** `closure_dates` "Block anonymous access to closure_dates" policy.

**Use case:** tables containing org-scoped operational data (closures, internal config, audit trail) that should never be readable by anon. Defensive layering is appropriate when:
- The table contains data that has no anonymous-user use case.
- A future migration might accidentally grant EXEC to anon (Supabase platform defaults can shift).
- The cost of one extra policy row is negligible vs the cost of an accidental anon-EXEC drift.

**Note on related observation:** `lesson_notes_parent_select` (Phase 5) demonstrates a dual-case inline subquery pattern (per-student match OR whole-lesson-with-EXISTS). This is **NOT** promoted to a numbered pattern because the pattern is too situational — most policies have a single case and benefit from helper-fn extraction (F-01-031 class). The dual-case inline approach is the right choice when the cases must be evaluated together and helper-fn signatures don't fit cleanly. Cited as observation-class, supports F-01-031 cross-link (legitimate-complexity instance).

---

## 8. Class-pattern analysis

### 8.1 Parameter-spoofing class — 41 instances unchanged

No new instances in batch 03. The 4 calendar edge fns (Phase 2) operate via JWT-verified or service-role contexts. The 12 trigger fns (Phase 3-4) operate via PL/pgSQL trigger context. The 44 RLS policies (Phase 5) call helper fns in server-context (auth.uid() JWT-trusted). Batch-03 surface does not extend the parameter-spoofing class beyond the batch-02 41-instance count.

Cross-link to batch-02 `02-org-management.md` §8.1 for full class lineage.

### 8.2 Multi-step-write-rollback-discipline class — 10 surfaces

Class extends from batch-02 7 surfaces to 10 with three new batch-03 instances:

| # | Surface | Batch | Severity |
|---|---|---|---|
| 1 | F-01-002 `AcceptInvite.signUpAndAccept` orphan auth account | 01 | Critical |
| 2 | F-01-004 `account-delete` 3-step deletion no transaction | 01 | High |
| 3 | F-01-006 `invite-accept` inner-step silent errors | 01 | High |
| 4 | F-01-030 `setCurrentOrg` fire-and-forget profile UPDATE | 01 | Low |
| 5 | F-02-006 `Teachers.processRemoval` multi-step rollback (5+ writes) | 02 | High |
| 6 | F-02-026 `Locations.confirmDeleteLocation` cascade-documentation gap | 02 | Low |
| 7 | F-03-001 `useCalendarActions` reschedule-this-and-future cascade | 03 | High |
| 8 | F-03-003 `calendar-sync-lesson` local mapping INSERT no error check | 03 | Medium |
| 9 | F-03-005 cancel-this-and-future cascade (steps 2-4 only; steps 5-7 are fire-and-forget-by-design) | 03 | High (mixed-class) |
| (10) | PI-14 originally counted as class member pre-Phase-7; resolution confirms steps 2-4 only | — | — |

**Cluster in Phase C `S-06-write-rollback-discipline` sprint** (extends from 7 to 10 surfaces). Class fix recommendation per batch-02 §8: server-side Edge Function RPC wrapping the multi-step write under a single transaction.

### 8.3 Fire-and-forget-by-design class — NEW, 4 instances

**Class definition:** call sites where the design philosophy explicitly accepts failure of downstream side effects as acceptable; failure means missed-side-effect-by-design rather than partial-state-bug.

**Distinguishing from multi-step-write-rollback class:**
- **Multi-step-write-rollback:** all steps required for correct state; failure means partial-state-bug; fix is transactional wrapping.
- **Fire-and-forget-by-design:** primary write succeeds atomically; downstream notifications/syncs are best-effort; failure means missed-side-effect-by-design; fix question is retry affordance design (not transactional wrapping).

**Instances (4 total):**

| # | Surface | Batch | Severity | Comment |
|---|---|---|---|---|
| 1 | F-02-017 send-invite-email FE fire-and-forget Resend invocation | 02 | Medium | Status-fidelity gap; intentional fire-and-forget design with the status reporting back to FE not distinguishing INSERT-only from INSERT+email-sent |
| 2 | F-03-005 step 5 `send-cancellation-notification` edge fn invoke | 03 | High (part of mixed) | Parent notification class; child-safeguarding adjacency Phase C design-call topic |
| 3 | F-03-005 step 6 `syncLessons(cancelledLessonIds, 'update')` calendar sync helper | 03 | High (part of mixed) | Google Calendar sync; fire-and-forget per comment line 261 |
| 4 | F-03-005 step 7 `syncZoomMeetings(cancelledLessonIds, 'delete')` Zoom meeting deletion helper | 03 | High (part of mixed) | Zoom integration; sub-deferred per AUDIT SCOPE COMPLETENESS |

**Placement decision (per s42 prompt notation 3):** this class lives in §8 class-pattern analysis, NOT in §11 cross-cutting carries. The class is a *design-philosophy observation*, not a sweep target — there's no "find all fire-and-forget-by-design instances and sweep" deliverable; the class membership is intentional design choice per call site. Phase C design-call: should the notification/sync paths have retry/queue affordances?

### 8.4 Single-trigger-incomplete-DiD class — refinement of CC-19-?#5

**Refinement:** batch-02 CC-19-?#5 "single-trigger DiD on critical-class bypasses" identified the *presence/absence* dimension — does a single trigger provide DiD for an invariant class? Batch 03 Phase 6 PI-11 enumeration adds the *coverage dimension* — when a single trigger IS present, does it cover all instances of the invariant class or only some?

**Canonical example:** PI-11 → F-03-004. `check_lesson_conflicts` is a single trigger providing DiD for "lesson-INSERT-conflict" invariant class. The trigger covers 2 of 7 invariant instances (teacher + room). The other 5 instances (student double-booking, closures, availability, time-off, busy_blocks) are app-layer-only and bypassable.

**Class implication:** the single-trigger-DiD class has TWO failure modes:
- **Mode A (CC-19-?#5 original):** trigger absent → invariant unenforced at DB layer.
- **Mode B (NEW refinement):** trigger present but partial-coverage → some invariant instances enforced, others bypassable.

Batch 19 owns class continuity. Refined CC-19-?#5 documented for batch 19 inheritance.

### 8.5 TS-bypass-cast class (F-02-033) — 30 sites unchanged

No batch-03 add to the count. 2 calendar-surface sites (`useCalendarActions.tsx:267`, `useClosureDateSettings.ts:138`) already in the 30-site batch-02 class. Cross-link only.

### 8.6 useCan unimplementation (F-02-027) — 188 sites unchanged

No batch-03 re-enumeration. Calendar pages + hooks use role strings directly; counted under batch-02 188-site class.

### 8.7 F-01-017 LOW class — 11 batch-03 reinforcement instances

Class HOLDS at LOW with batch-03 reinforcement:

| # | Table | Policy | Mutation risk |
|---|---|---|---|
| 1 | lessons | Admin can update all lessons | Admin mutate any field; org_id covered by `prevent_org_id_change` trigger DiD |
| 2 | **lessons** | **Teacher can update own lessons** | **Most concrete reinforcement instance** — teacher can mutate `teacher_user_id` to another user via direct UPDATE; intra-org grief vector ("lesson stealing" / unwanted reassignment); no trigger covers teacher_user_id; audit-trail-visible |
| 3 | lesson_participants | Admin can update lesson participants | Admin mutate `lesson_id` (move participant between lessons) |
| 4 | lesson_participants | Teacher can update participants for own lessons | Teacher mutate `lesson_id` to another lesson they own; bounded by USING evaluation PRE-update |
| 5 | lesson_notes | lesson_notes_staff_update | Teacher mutate `student_id`/`teacher_id` to reassign authorship |
| 6 | attendance_records | Staff can update attendance records | `trg_validate_attendance_participant` enforces `(lesson_id, student_id)` membership — catches some mutations |
| 7 | availability_blocks | Teacher can update own availability blocks | Teacher reassign `teacher_user_id` away from self |
| 8 | closure_dates | Admin can update closure dates | Admin mutate any closure field; intra-org |
| 9 | recurrence_rules | Admin can update recurrence rules | Admin mutate recurrence fields; cross-link to F-02-013 |
| 10 | external_busy_blocks | Users can manage their own (ALL policy) | User mutate `user_id` to another user, transferring ownership |
| 11 | (Same row as #3, lesson_participants Admin update — counted separately as instance, not unique policy) | | |

**Phase C remediation framing (Phase 9 doc body annotation):** F-01-017 class severity HOLDS at LOW per class-consistency, but the **teacher_user_id reassignment vector on `lessons` "Teacher can update own lessons" policy** warrants Phase C prioritisation watch. Fix is straightforward — add WITH CHECK clause: `(teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id))`.

### 8.8 Phase C sprint structure recommendations

Building on batch-02 §8.4 sprint structure with batch-03 additions:

1. **`S-01-secdef-headline` (batch 02):** 5 Critical findings; unchanged.
2. **`S-02-financial-falsification` (batch 02):** F-02-004 + F-02-005; unchanged.
3. **`S-03-helper-class-track-1` (batch 02):** REVOKE EXECUTE batch; unchanged.
4. **`S-04-helper-class-track-2` (batch 02):** body-level auth.uid() for FE-consumed; unchanged.
5. **`S-05-audit-log-integrity` (batch 02):** F-02-010 BEFORE INSERT trigger; unchanged.
6. **`S-06-write-rollback-discipline` (batch 02, EXTENDS):** F-02-006 + F-01-002 + F-01-004 + F-01-006 + F-01-030 + F-02-026 + **F-03-001 + F-03-003 + F-03-005 (steps 2-4)** → 10-surface multi-step-rollback class fix sprint.
7. **`S-07-invite-flow-status-fidelity` (batch 02):** F-02-017 + F-02-018 + F-02-019; **F-03-002 typo can land independently or cluster here**.
8. **`S-08-cache-discipline` (batch 02):** F-01-015 + F-01-030 + F-02-024 + F-02-028; unchanged.
9. **`S-09-conflict-check-db-migration` (NEW, batch 03):** F-03-004 (PI-11 RESOLVED) architectural migration of 5 app-layer-only conflict checks to DB triggers. Cross-batch with batch 04 lessons-scheduling-deep.
10. **`S-10-e2e-fixture-hygiene` (batch 02):** F-02-029 + F-02-030; unchanged.
11. **`S-11-notification-retry-design` (NEW, batch 03):** F-03-005 steps 5-7 design call — should the notification/sync paths have retry/queue affordances? Phase C UX decision; child-safeguarding adjacency considered (cancellation notification path).
12. **Parent-portal Phase C sprint (cross-batch):** F-01-001 + F-01-005 bundle (parameter-name rename + RPC body Case B extension to match RLS policy).

Sprint numbering is illustrative; Jamie / Lauren assigns final sprint IDs at Phase C kickoff.

---

## 9. Cross-link annotations (11 entries)

Per Phase 8 cross-link sweep table:

### F-02-013 `materialise_continuation_lessons` (HIGH, batch 02)

**Bi-directional cross-link.** F-02-013 doc body in `02-org-management.md` adds: *"PI-11 (HIGH, batch 03 F-03-004) is the architectural pattern; F-02-013 is one concrete instance demonstrating the bypass works. PI-14 step 2 (batch 03 F-03-005) is the downstream consequence chain — silent recurrence_rules cap failure → next cron call → F-02-013 regenerates cancelled lessons."* F-03-004 + F-03-005 doc bodies in this batch include the inverse cross-references.

### F-02-027 useCan unimplementation (LOW, batch 02)

Dashboard + CalendarPage role-string checks + 3 calendar hooks (`useTodayLessons`, `useTeacherDashboard`, `useTeacherAvailability`) use `currentRole` directly. No new sites enumerated; 188-site count from batch 02 stands.

### F-02-033 TS-bypass-cast class (LOW, batch 02)

2 calendar sites confirmed in 30-site class: `useCalendarActions.tsx:267` (`shift_recurring_lesson_times` reschedule undo); `useClosureDateSettings.ts:138` (`count_lessons_on_dates` cross-tenant probe). Both already counted; no new sites. Reference instance for F-03-002 alternative-observability context: TS-bypass-cast can silence runtime errors (like the `data.org_id` ReferenceError) if used adjacent to typed call signatures.

### F-02-010 audit_log no INSERT integrity trigger (HIGH, batch 02)

Phase 4 `log_audit_event_singular` body confirmed preserves `auth.uid()` (the positive pattern); `on_makeup_participant_removed` body reinforces actor-preservation in trigger context. The F-02-010 fix recommendation (BEFORE INSERT trigger requiring `actor_user_id IS NOT NULL OR current_setting('role') IN ('service_role', 'postgres')`) would not block either batch-03 audit-write path — both preserve actor correctly.

### F-02-020 helper class (MEDIUM, batch 02)

Phase 5 confirmed RLS-context-safe usage on all 10 helpers across 44 batch-03 policies (`is_org_admin`, `is_org_staff`, `is_org_member`, `is_org_scheduler`, `is_org_finance_team`, `has_org_role`, `is_parent_of_student`, `can_edit_lesson`, `is_lesson_teacher`, `get_teacher_id_for_user`). RLS evaluation runs at query-time with `auth.uid()` JWT-trusted; F-02-020 RPC-callable-bypass concern does not apply to RLS context. Cross-link block; no new findings.

### F-02-030 `is_org_active`/`is_org_write_allowed` (LOW class, batch 02)

Phase 4 `check_subscription_active` calls `is_org_write_allowed` in trigger (server) context. Phase 5 `block_expired_trial_lesson_insert` policy uses `is_org_active` in RLS context. F-02-030's RPC-callable bypass concern does not apply to either trigger or RLS context. Cross-link only.

### PI-08 RESOLVED → F-02-005 (batch 02 elevation HIGH → CRITICAL)

No batch-03 reach. Methodology cross-reference only — see §12.7 severity-adjustment methodology note (PI-08 elevation parallels PI-11 de-escalation in opposite direction; both adjustments evidence-based, body-audit-driven, class-consistent).

### PI-12 LoopAssist `executeRescheduleLessons` (CRITICAL, batch 17 IN-SWEEP)

Bypass surface cross-link captured Phase 6 §2 table. PI-11 architectural exposure includes PI-12 path. Cross-link only; batch 17 owns full audit when its turn comes (per AUDIT SCOPE COMPLETENESS rule 3, IN-SWEEP for Phase B).

### PI-16 LoopAssist `bulk_complete_lessons` (HIGH, batch 17 IN-SWEEP)

Phase 6 bypass surface table includes PI-16 path; completion path doesn't change time so conflict-checks not applicable. Cross-link only.

### F-01-001 `useParentLessonNotes` parameter mismatch (CRITICAL, batch 01)

Phase 8 reinforces: F-01-005 divergence-point identified in the **same RPC** (`get_parent_lesson_notes`). Both fixes bundle in parent-portal Phase C sprint:
- F-01-001 fix: rename FE call parameter from `p_student_id` to `p_student_ids: [studentId]` (`useLessonNotes.ts:120`).
- F-01-005 fix: extend RPC body final WHERE to add Case B (whole-lesson notes via `student_id IS NULL AND EXISTS lesson_participants ...`).

Same RPC, same Phase C commit. Bundle annotation strengthened.

### F-01-031 policy style inconsistency (LOW, batch 01)

Phase 5 `lesson_notes_parent_select` is a concrete **legitimate-complexity** case — dual-case inline subquery is the right pattern when per-student match AND whole-lesson EXISTS must be evaluated together (no helper-fn signature fits). Reinforces F-01-031 framing: inline-subquery vs helper-fn pattern is contextual; not always wrong. Cross-link supports F-01-031 Phase C severity decision (already flagged as LOW → INFO candidate in batch-02 Phase 8).

---

## 10. PI closures

### PI-11 → F-03-004 RESOLVED (severity adjusted Critical → HIGH)

**Status:** **RESOLVED — re-classified as F-03-004 (High) in batch 03 Phase 6.**

**History reconciliation:**

| Phase | Verdict | Evidence |
|---|---|---|
| s38 pre-investigation | Critical | "Trigger body confirmed (teacher + room overlap only); student double-booking, closure dates, teacher availability, time-off, travel buffer, busy blocks are app-layer only" — tentative grade pending full audit |
| Batch 03 Phase 6 (s42, 2026-05-12) | Body re-audit | Confirmed exactly 2 of 7 fire at DB trigger; 5 app-layer-only in `useConflictDetection.ts`; ≥4 production-relevant bypass paths; F-02-013 concrete exploit |
| Batch 03 Phase 9 (this doc) | HIGH via F-03-004 | Severity adjusted Critical → HIGH on class-consistency rubric (operational-correctness class ceiling). See §12.7 |

**STATUS.md §5.2 row update text (queued for Phase 10 commit):**

```
| PI-11 | Critical → **HIGH** | check_lesson_conflicts DB trigger enforces only 2 of 7 promised checks | Trigger body confirmed (teacher + room overlap only); student double-booking, closure dates, teacher availability, time-off, travel buffer, busy blocks are app-layer only | 03-calendar-core + 04 (cross-batch architectural) | **RESOLVED — re-classified as F-03-004 HIGH in batch 03 Phase 6. Severity adjusted Critical → HIGH on body re-audit (operational-correctness class, not safeguarding/security/destructive/financial class per class-consistency analysis). 5-check bypass surface fully enumerated (≥4 production-relevant paths). Phase C sprint candidate: S-09-conflict-check-db-migration.** | s42 |
```

### PI-14 → F-03-005 RESOLVED (severity unchanged HIGH)

**Status:** **RESOLVED — re-classified as F-03-005 (High) in batch 03 Phase 7.**

**History reconciliation:**

| Phase | Verdict | Evidence |
|---|---|---|
| s38 pre-investigation | High | "Cancel-this-and-future cascade is fire-and-forget (recurrence cap, invoice check, parent notify) without transaction" |
| Batch 03 Phase 7 (s42, 2026-05-12) | Per-step audit | 7 steps at `LessonDetailPanel.tsx:218-346`; mixed-class membership (steps 2-4 multi-step-rollback; steps 5-7 fire-and-forget-by-design); step 2 → F-02-013 consequence chain headlined |
| Batch 03 Phase 9 (this doc) | HIGH via F-03-005 | Severity unchanged; class refined; consequence chain documented |

**STATUS.md §5.2 row update text (queued for Phase 10 commit):**

```
| PI-14 | High | Cancel-this-and-future cascade is fire-and-forget (recurrence cap, invoice check, parent notify) without transaction | LessonDetailPanel.tsx:265-326 — .then() chain, no try/catch, no rollback | 03-calendar-core | **RESOLVED — re-classified as F-03-005 HIGH in batch 03 Phase 7. Per-step audit (7 steps) confirms mixed-class: steps 2-4 multi-step-rollback (incl. step 2 → F-02-013 consequence chain — silent recurrence_rules cap failure regenerates cancelled lessons); steps 5-7 fire-and-forget-by-design (notification + sync paths). Phase C sprint candidates: S-06-write-rollback-discipline (steps 2-4) + S-11-notification-retry-design (steps 5-7).** | s42 |
```

### PI-15 PARTIALLY-RESOLVED (batch-03 side closed; batch-05 owns generation)

**Status:** **PARTIALLY-RESOLVED — batch-03 side closed in Phase 7; batch-05 owns credit-note generation side.**

**Batch-03-side audit (Phase 7):**
- `LessonDetailPanel.tsx:265-326` cancel-cascade does NOT reference credit-note generation. Step 3 (draft invoice items check) and step 4 (active invoice items check) only WARN via toast — neither invokes credit-note generation. The cancel UI surfaces a "Consider voiding or issuing credit notes" toast (step 4, line 318) but does not auto-trigger.
- **Confirms the gap:** the cancel-this-and-future flow does not invoke credit-note generation; user must manually invoke from the invoice UI.

**STATUS.md §5.2 row update text (queued for Phase 10 commit):**

```
| PI-15 | High | No automatic credit-note generation for paid-then-cancelled lessons | Toast warns but system doesn't generate; cancel cascade only flags via toast | 03-calendar-core + 05-billing-invoicing | **PARTIALLY-RESOLVED — batch-03 side closed in Phase 7. LessonDetailPanel cancel-cascade confirms NO credit-note invocation; user must manually invoke from invoice UI. Active invoice items check (step 4) surfaces "Consider voiding or issuing credit notes" toast advisory. Batch 05 owns credit-note generation side; HOLDS at HIGH pending batch 05 audit.** | s42 |
```

---

## 11. Cross-cutting carries — batch 19 deliverables

Two new batch-19 carry candidates plus one refinement of existing CC-19-?#5:

### CC-19-? (NEW) Schema column constraint hygiene sweep

**Class:** verify NOT NULL constraints on identity-class columns referenced in trigger predicates / overlap-check fns / join predicates. Trigger fns assume SQL three-valued logic correctly handles NULLs in predicates; absence of NOT NULL on identity columns can silently bypass invariant enforcement.

**First instance (Phase 3):** `availability_blocks.teacher_id` is NULLABLE in the schema. `check_availability_overlap` trigger's predicate `teacher_id = NEW.teacher_id` evaluates NULL on NULL teacher_id rows → EXISTS returns FALSE → overlap not detected.

**Verdict:** the trigger correctly handles NULL via SQL three-valued logic given the schema as written. The schema hygiene question is: is nullable `teacher_id` intentional (org-wide availability blocks, "any teacher" slots) or an oversight?

**Class scope (batch 19):** sweep all SECDEF + trigger fns; identify identity-class columns referenced in their predicates; verify NOT NULL constraints on those columns at table level. Phase B batch 19 owns the full sweep; candidate CI lint rule: `pg_proc` join with `pg_constraint` to flag identity-shape columns lacking NOT NULL.

### CC-19-? (NEW) Sentry edge-fn instrumentation gap

**Class:** edge fns not using `wrapEdgeFn` Sentry wrapper. Phase 2 batch 03 sweep: 2 of 4 batch-03 edge fns use the wrapper (`calendar-sync-lesson`, `send-recurring-billing-alert`); 2 use raw `serve()` (`recurring-billing-scheduler`, `send-lesson-reminders`).

**V2 plan §5 PR6 partial-implementation pattern.** Phase B batch 19 owns 80-fn sweep across `supabase/functions/`; CI lint rule rejecting raw `serve(` adjacent to a `Deno.env.get('SENTRY_*')` reference.

### CC-19-?#5 Single-trigger-incomplete-DiD (refinement)

**Refinement:** the CC-19-?#5 class from batch 02 ("single-trigger DiD on critical-class bypasses") had a presence/absence dimension only — does a single trigger provide DiD for an invariant class? Batch 03 Phase 6 PI-11 enumeration adds the *coverage dimension* — when a single trigger IS present, does it cover all instances of the invariant class or only some?

**Canonical example:** PI-11 → F-03-004. `check_lesson_conflicts` is a single trigger providing DiD for "lesson-INSERT-conflict" invariant class; covers 2 of 7 invariant instances; the other 5 are app-layer-only and bypassable.

**Refined class scope (batch 19):** sweep all triggers providing DiD on declared invariant classes; for each, enumerate the instance-set the trigger covers vs the canonical invariant set. Surface gaps.

### Fire-and-forget-by-design class — NOT a batch-19 carry

Documented in §8.3 as design-philosophy class observation. NOT a sweep target — class membership is intentional design choice per call site. Phase C design-call topic (notification path retry affordance) rather than batch-19 sweep deliverable.

---

## 12. Audit-method appendix

### 12.1 Phase-by-phase coverage summary

| Phase | Surface | Findings delta | Cumulative |
|---|---|---|---|
| 0 | Setup verify + HEAD-pin (`9c44f39`) + §6.4 SUSPECT (`trg_cleanup_attendance_on_cancel` WHEN clause REFUTED — Pattern #14 candidate captured) + CENSUS verification | 0 | 0 |
| 1 | 2 pages walk (Dashboard, CalendarPage) + 10 calendar hooks walk; PI-14 entry point noted; F-02-033 cross-link confirmed (2 sites); §6.5 scheduler-no-UPDATE watch RESOLVED as nomenclature artefact | 1 (0C/1H/0M/0L) | 1 |
| 2 | 4 calendar edge fns audited (calendar-sync-lesson JWT, recurring-billing-scheduler cron, send-lesson-reminders cron, send-recurring-billing-alert service-role-bearer); Sentry-wiring gap surfaced as cross-cutting carry candidate | 2 (0C/1H/1M/0L) | 3 |
| 3 | 2 SECDEF trigger fns audited (`check_availability_overlap` + `prevent_invoiced_lesson_delete`); both PASS; CC-19-?#5 single-trigger DiD reinforcement (canonical instances); NOT NULL constraint hygiene watch on `availability_blocks.teacher_id` | 0 | 3 |
| 4 | 8 trigger fns audited (log_audit_event_singular cross-link, check_subscription_active, cleanup_attendance_on_cancel — Pattern #14 documented, prevent_org_id_change cross-batch-19, prevent_past_open_slot, update_updated_at_column, clear_open_slot_on_participant, on_makeup_participant_removed full DiD); 2 supposedly-vestigial fns confirmed ACTIVE (correcting pre-investigation drift) | 0 | 3 |
| 5 | 44 RLS policies audited across 8 tables (anti-pre-investigation-drift: `information_schema` verification of all 8 tables); F-01-017 11 batch-03 reinforcement instances; Pattern #15 (closure_dates anon-block) documented; scheduler-no-UPDATE reconfirmed; PI-11 RLS-side context (zero RLS-layer conflict enforcement) | 0 | 3 |
| 6 | `useConflictDetection.ts` 499-line deep walk; 5 missing-check fns body-audited at file:line precision; bypass surface enumerated (8 paths, 4 production-relevant); F-02-013 concrete exploit cross-link; PI-11 RESOLVED → F-03-004 HIGH (severity adjusted Critical → HIGH); single-trigger-incomplete-DiD class refinement | 1 (0C/1H/0M/0L) | 4 |
| 7 | `LessonDetailPanel.tsx:218-346` 7-step cancel-cascade trace; mixed-class membership decision (steps 2-4 multi-step-rollback; steps 5-7 fire-and-forget-by-design); step 2 → F-02-013 consequence chain documented; F-03-002 alternative-observability verification (3 FE surfaces independently); PI-14 RESOLVED → F-03-005 HIGH; PI-15 PARTIALLY-RESOLVED (batch-03 side) | 1 (0C/1H/0M/0L) | 5 |
| 8 | F-01-005 data-divergence dimension RESOLVED at divergence-point precision (RPC body's final SELECT under-returns whole-lesson notes); F-01-014 HOLDS at HIGH (no batch-03 reach); F-01-017 HOLDS at LOW (11 batch-03 reinforcement instances); cross-link sweep 11 entries | 0 | 5 |
| 9 | This doc | 0 | 5 |

**Final ledger: 5 findings (0 Critical / 4 High / 1 Medium / 0 Low) for batch 03-calendar-core.**

### 12.2 Enumeration methodology

- **`pg_proc` body audit:** Phase 4 + Phase 8 — verbatim `pg_get_functiondef(p.oid)` for every body excerpt.
- **`pg_trigger` metadata:** Phase 0 + Phase 4 — `tgname`, `tgrelid`, timing/events bitmask decoding, `tgqual` WHEN clause, `tgnargs`, `tgargs`.
- **`pg_policies` view:** Phase 5 — `qual` (USING) + `with_check` per policy; role + permissive flags.
- **`information_schema.tables`:** Phase 5 — anti-pre-investigation-drift verification before constructing IN-list filters.
- **`cron.job`:** Phase 2 — cron schedule + invoker secret lookup.

### 12.3 DiD analysis methodology

- **Trigger-level DiD:** per-table `pg_trigger` inventory + body inspection for `auth.uid()` / `current_setting('role')` / RAISE patterns.
- **PL/pgSQL transaction-rollback model:** Phase 4 batch-02 self-correction model — function body forms a single implicit transaction; partial failure rolls back all preceding writes.
- **Single-trigger-DiD class (CC-19-?#5):** batch-02 presence/absence dimension; batch-03 adds coverage dimension via PI-11 refinement.
- **Fire-and-forget-by-design class:** NEW class observation — design-philosophy decision per call site; partial failure means missed-side-effect-by-design rather than partial-state-bug.

### 12.4 Severity rubric anchor

Per `audit/sweep/PLAN.md` §4 + §6:

- **Critical** — financial loss, data loss, security exposure, marketed-feature-fundamentally-broken, or first-encounter trust erosion. **Class-consistency anchor:** safeguarding/security/destructive/financial classes only. Operational-correctness class caps below this ceiling.
- **High** — feature works but degraded, surprising, or unsupported; silent failure modes; missing UI for tracked DB state. **Class-consistency anchor:** operational-correctness class anchors at HIGH ceiling (per PI-11 + PI-08 methodology).
- **Medium** — cosmetic but visible inconsistency; timezone-edge issues; non-critical race conditions; minor UX dead-ends.
- **Low** — code-hygiene drift; stale comments; minor docstring inconsistency; legacy artefacts.

Applied to batch 03: zero Critical (operational-correctness class throughout); 4 High (silent-failure / multi-step-rollback / architectural-exposure / mixed-class); 1 Medium (orphan-drift); zero Low standalone (F-01-017 reinforcement captured in §8 class-pattern analysis).

### 12.5 Sample-first methodology + decision gates

No escalation gates fired in batch 03. PI-11 (Phase 6) and PI-14 (Phase 7) were full-coverage audits per s42 prompt — no sampling decision required. Phase 5 RLS policy audit covered all 44 policies across 8 tables — no sampling.

### 12.6 Honest limitations

- **Pre-investigation table-name drift (3 instances):**
  1. **Phase 4:** prompt §6.2 claimed "zero non-internal triggers on attendance_records". Phase 4 found 3 active triggers (`trg_attendance_not_future`, `enforce_subscription_active_attendance_records`, `trg_validate_attendance_participant`). Root cause: pre-investigation query used `lesson_attendance` (guessed table name) instead of actual `attendance_records`.
  2. **Phase 5 (part 1):** prompt §6.5 listed 4 tables in RLS audit scope. Phase 5 `information_schema` verification found 8 tables (added `lesson_notes`, `availability_blocks`, `closure_dates`, `external_busy_blocks`).
  3. **Phase 5 (part 2):** prompt §A listed `busy_blocks` as a possibly-existing table; actual table is `external_busy_blocks`.
  **Methodology fix:** every pre-investigation table-list query must be preceded by `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ~* '<concept>'` with broad LIKE patterns. Captured in s42 HANDOVER entry + s43 prompt awareness.
- **Test coverage gap:** `useConflictDetection.ts` has unit tests on result-shaping helpers only. The DB-querying fns (`checkClosureDates`, `checkStudentConflicts`, `checkTeacherAvailability`, `checkTeacherTimeOff`, `checkExternalBusyBlocks`) are NOT exercised by integration tests. If a DB query returned wrong data, tests would not catch it.
- **`useCan` drift count:** 188 sites batch-02 baseline holds; no batch-03 re-enumeration. Calendar role-checks visible across pages + hooks but counted under existing batch-02 F-02-027 LOW (batch-02 §12.6 honest-limitations carry).
- **Zoom sub-deferral:** Zoom-specific surface (`zoom-sync-lesson` edge fn; Zoom integration code paths in batch-03 surface) deferred pending external Zoom authorization/verification. Not applicable to batch 03 directly but declared per AUDIT SCOPE COMPLETENESS rule 3.

### 12.7 PI severity-adjustment methodology note

**Two s38 pre-investigation tags adjusted in opposite directions during full audit:**

| PI ID | s38 pre-tag | Resolution direction | Final | Phase | Reasoning |
|---|---|---|---|---|---|
| PI-08 | HIGH | ↑ ESCALATED | CRITICAL | Batch 02 Phase 7C | Body re-audit revealed no caller-context validation at all — root defect broader than original `_org_id` mismatch framing. Class-consistency with financial-falsification CRITICAL anchors |
| PI-11 | Critical | ↓ DE-ESCALATED | HIGH | Batch 03 Phase 6 | Body re-audit + bypass enumeration + class-consistency analysis. Operational-correctness class (not safeguarding/security/financial) caps at HIGH per rubric. Concrete exploit (F-02-013) confirms architectural exposure but bounded blast radius |

**Methodology lesson:** s38 pre-investigation tags are **prioritisation starting points**, NOT severity commitments. Full audit (body excerpt + exploit-shape enumeration + class-consistency analysis + concrete cross-references) owns the canonical severity grade. Both directions of adjustment are evidence-based and healthy audit discipline.

### 12.8 Grand cumulative accounting (single-counted)

**Single-counted accounting (PI-08, PI-11, PI-14 resolution reconciliation):**

PI-08 RESOLVED → F-02-005 (batch 02 elevation HIGH → CRITICAL). PI-11 RESOLVED → F-03-004 (batch 03 de-escalation Critical → HIGH). PI-14 RESOLVED → F-03-005 (batch 03, severity unchanged HIGH). PI cohort retains all three as historical entries tagged RESOLVED (17 total PI ledger); active finding-instance count excludes the three duplicates (14 active PI + 3 resolved-out = 17 historical).

**Cohort breakdown:**

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active (17 historical, 3 RESOLVED: PI-08, PI-11, PI-14) | 14 | 7 | 6 | 1 | 0 |
| Batch 01 | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (incl. F-02-005 from PI-08 elevation) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (incl. F-03-004 from PI-11 + F-03-005 from PI-14) | 5 | 0 | 4 | 1 | 0 |
| **GRAND ACTIVE** | **91** | **15** | **24** | **20** | **32** |

**Verification by direct count:**
- PI Critical (active): PI-01, PI-02, PI-03, PI-04, PI-05, PI-12 (un-shelved), PI-13 = **7** (PI-11 reclassified to F-03-004)
- PI High (active): PI-06, PI-07, PI-09, PI-10, PI-15, PI-16 = **6** (PI-14 reclassified to F-03-005)
- PI Medium (active): PI-17 = **1**
- Batch-01 Critical: F-01-001, F-01-002, F-01-003 = **3**
- Batch-02 Critical: F-02-001, F-02-002, F-02-003, F-02-004, F-02-005 (PI-08 elevation) = **5**
- Batch-03 Critical: **0**
- **Total Critical: 7 + 3 + 5 + 0 = 15 ✓**

This becomes the §12.8 reconciliation table. STATUS.md §5.3 update at Phase 10 lands the same numbers.

---

> **AUDIT IN PROGRESS — DO NOT FIX YET**
>
> This document is the Phase B EXIT deliverable for batch 03-calendar-core. Findings are not authorised for fix until Phase C is explicitly opened and sprints are defined. Banner drops at Phase C kickoff.
