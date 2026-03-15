# Audit — Feature 08: Slot Generator

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Handoff Rating:** SOLID

---

## 1. Files Audited

| # | File | Role |
|---|------|------|
| 1 | `src/hooks/useSlotGenerator.ts` | Core hook: slot computation, conflict checking, batch insert mutation |
| 2 | `src/components/calendar/SlotGeneratorWizard.tsx` | 3-step wizard UI (Date/Time → Details → Preview) |
| 3 | `src/components/calendar/SlotPreviewTimeline.tsx` | Preview UI: slot list with toggle and conflict display |
| 4 | `src/components/calendar/CalendarDesktopLayout.tsx` | Desktop entry point: dropdown menu with `isOrgAdmin` guard |
| 5 | `src/components/calendar/CalendarMobileLayout.tsx` | Mobile entry point: dropdown menu with `isOrgAdmin` guard |
| 6 | `supabase/migrations/20260305173228_*.sql` | `is_open_slot` column + partial index |
| 7 | `supabase/migrations/20260315100200_fix_clear_open_slot_on_participant.sql` | Trigger: auto-clear `is_open_slot` when participant added |
| 8 | `supabase/migrations/20260222200941_*.sql` | DB trigger: `check_lesson_conflicts()` — teacher + room double-booking |
| 9 | `supabase/migrations/20260119233145_*.sql` | `lessons` table creation, RLS policies (original) |
| 10 | `supabase/migrations/20260120215818_*.sql` | Refined RLS: `is_org_scheduler` INSERT policy |
| 11 | `supabase/migrations/20260120215727_*.sql` | `is_org_scheduler()` function definition |
| 12 | `supabase/migrations/20260315220012_*.sql` | `chk_lesson_time_range` CHECK constraint (end_at > start_at) |
| 13 | `supabase/functions/booking-get-slots/index.ts` | Public booking slot calculator (separate feature — not the admin generator) |
| 14 | `src/integrations/supabase/types.ts` | Generated DB types (confirmed `is_open_slot` field) |
| 15 | `src/contexts/OrgContext.tsx` | `isOrgAdmin` definition (owner or admin) |
| 16 | `tests/e2e/workflows/slot-generator.spec.ts` | E2E tests for slot generator wizard |
| 17 | `tests/e2e/workflows/system-test/08-bulk-operations.spec.ts` | System test covering bulk operations |

---

## 2. Architecture Summary

The slot generator is **entirely client-side** logic that builds an array of lesson rows and batch-inserts them into the `lessons` table via the Supabase JS client (`supabase.from('lessons').insert()`).

**Flow:**
1. User opens wizard from calendar dropdown (admin/owner only via `isOrgAdmin` UI guard)
2. Step 1: Configure date, time range, duration, break interval
3. Step 2: Select teacher, location, room, lesson type, max participants
4. Step 3: Preview computed slots, conflict-check against existing lessons, toggle individual slots
5. Confirm: Batch insert all non-excluded slots as `is_open_slot: true` lessons

**There is no edge function or RPC** for slot generation — it's a direct client → PostgREST → PostgreSQL INSERT.

---

## 3. Findings

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| SG-01 | **MEDIUM** | **Conflict check misses room double-booking.** `checkSlotConflicts()` only checks teacher conflicts (same `teacher_id` on same day). Room conflicts are NOT pre-checked in the preview. The DB trigger (`check_lesson_conflicts`) will catch room conflicts at INSERT time, but the user gets no preview warning — they see "no conflicts" and then get a cryptic PostgREST error on confirm. | `useSlotGenerator.ts:68-106` | Add room conflict check to `checkSlotConflicts()` when `roomId` is set. Query lessons matching the same `room_id` in the time range. |
| SG-02 | **MEDIUM** | **Conflict check misses closure dates.** The `checkSlotConflicts()` function does not query `closure_dates` to warn the user. Slot generation on a closure date will succeed (no DB constraint prevents it), creating lessons on a day the academy is closed. | `useSlotGenerator.ts:68-106` | Query `closure_dates` for the selected date and warn/block if the date is a closure. |
| SG-03 | **MEDIUM** | **Conflict check misses teacher time-off.** `checkSlotConflicts()` does not query `time_off_blocks`. Slots can be generated during a teacher's approved time off. No DB constraint prevents this. | `useSlotGenerator.ts:68-106` | Query `time_off_blocks` for the selected teacher/date range and mark overlapping slots as conflicting. |
| SG-04 | **MEDIUM** | **Conflict check misses teacher availability blocks.** The function does not verify the teacher has availability blocks covering the proposed time range. Slots can be generated outside the teacher's configured working hours. | `useSlotGenerator.ts:68-106` | Optionally warn (not block) when slots fall outside availability blocks. |
| SG-05 | **MEDIUM** | **TOCTOU race between preview and insert.** Conflict check runs at preview time (Step 3). Between preview and confirm, another user could create a conflicting lesson. The DB trigger (`check_lesson_conflicts`) catches teacher and room conflicts, but the batch insert is **not atomic** — if slot N conflicts, Supabase returns an error and slots 1..N-1 may or may not have been committed depending on PostgREST batch behavior. | `useSlotGenerator.ts:114-188` | Wrap the insert in an RPC that performs conflict check + insert inside a single transaction. This ensures atomicity and eliminates TOCTOU. |
| SG-06 | **LOW** | **Batch insert is not a single DB transaction.** The Supabase JS `insert(allSlotRows)` call sends a single HTTP request to PostgREST which by default wraps it in a transaction. However, if the `check_lesson_conflicts` trigger fires an exception on any row, the **entire batch is rolled back** — which is actually correct behavior. But the error message surfaced to the user is the raw PostgreSQL exception text (`CONFLICT:TEACHER:...`), not a user-friendly message. | `useSlotGenerator.ts:162-167` | Parse the `CONFLICT:TEACHER:` / `CONFLICT:ROOM:` prefix from the error message and display a user-friendly toast identifying which slot conflicted. |
| SG-07 | **LOW** | **No student overlap check.** The generator creates "open slots" with no assigned students, so student overlap is inherently not applicable at generation time. This is correct behavior — no fix needed. | — | N/A — by design |
| SG-08 | **LOW** | **Safety cap is 50 slots, not 200.** The hook enforces `activeSlots.length > 50` as the maximum. `computeSlots()` also has an `i > 50` safety break. The question about a "200-slot cap" from the calendar audit does not apply here; 50 is the correct cap for single-day generation. | `useSlotGenerator.ts:61,119` | Acceptable as-is. Document the 50-slot cap. |
| SG-09 | **LOW** | **Past date guard is client-side only.** The past date check at line 122-129 compares `utcStart < now` where `now = new Date()` — this uses the browser's local clock. The DB has no constraint preventing past-date inserts. A user with a misconfigured clock or a crafted API call could insert past-date slots. | `useSlotGenerator.ts:121-129` | Add a server-side check (either an RPC wrapper or a DB trigger on `lessons` that rejects `start_at < now()` for new `is_open_slot = true` rows). |
| SG-10 | **INFO** | **No multi-day / recurrence support.** The wizard generates slots for a single date only. No saved templates or recurrence patterns. This is a deliberate feature scope limitation and is fine for v1. | `SlotGeneratorWizard.tsx` | Future enhancement — not a defect. |
| SG-11 | **INFO** | **Generated slots are distinguishable.** `is_open_slot: true` is set on all generated slots. The `clear_open_slot_on_participant` trigger auto-clears this flag when a student is assigned. This is clean. | `useSlotGenerator.ts:156`, migration | Good design — no action needed. |
| SG-12 | **INFO** | **RLS INSERT policy allows teachers to self-assign.** The `Scheduler can create lessons` policy allows teachers (`is_org_scheduler`) to insert lessons where `teacher_user_id = auth.uid()`. But the slot generator sets `teacher_user_id` from the wizard form (which could be a different teacher). An admin can set any teacher. A teacher calling this mutation for a different teacher_user_id would be blocked by RLS — which is correct. | Migration `20260120215818_*` | No fix needed — RLS correctly restricts. |
| SG-13 | **INFO** | **Audit logging is present.** `logAudit()` is called with `generate_lesson_slots` action, recording count, date, teacher_id, and all created lesson IDs. | `useSlotGenerator.ts:171-186` | Good — no action needed. |

---

## 4. Conflict Detection Coverage Matrix

| Conflict Type | Preview Check? | DB-Level Guard? | User Feedback? | Assessment |
|--------------|---------------|-----------------|----------------|------------|
| Teacher double-booking | **YES** — `checkSlotConflicts()` queries `lessons` by `teacher_id` | **YES** — `check_lesson_conflicts` trigger | Preview: "Conflicts with existing lesson". Insert error: raw exception | **COVERED** (preview + DB) |
| Room double-booking | **NO** | **YES** — `check_lesson_conflicts` trigger | Insert error only (raw exception) | **PARTIALLY COVERED** — DB catches it, but no preview warning |
| Student overlap | **N/A** — open slots have no students | **N/A** | N/A | **N/A** — correct by design |
| Closure dates | **NO** | **NO** — no DB constraint | No warning or error | **NOT COVERED** |
| Teacher time-off | **NO** | **NO** — no DB constraint | No warning or error | **NOT COVERED** |
| Teacher availability | **NO** | **NO** — no DB constraint | No warning or error | **NOT COVERED** (advisory only) |
| Past date | Client-side only | **NO** — no DB constraint | Client toast if browser clock correct | **WEAK** — client-only guard |

---

## 5. Batch Insert Transaction Assessment

| Aspect | Status | Detail |
|--------|--------|--------|
| Single HTTP request | **YES** | `supabase.from('lessons').insert(allSlotRows)` sends one PostgREST request |
| Single DB transaction | **YES** | PostgREST wraps bulk inserts in a transaction by default |
| Atomic rollback on error | **YES** | If `check_lesson_conflicts` trigger raises an exception on any row, the entire batch is rolled back — no partial inserts |
| lesson_participants created | **NO** | Open slots have no students, so no `lesson_participants` rows needed at generation time |
| Error message quality | **POOR** | Raw PostgreSQL exception text reaches the user via `error.message` |
| Max batch size | **50 slots** | Both `computeSlots()` and the mutation enforce a 50-slot cap |
| Timeout risk | **LOW** | 50 inserts with trigger checks should complete well within standard timeouts |

---

## 6. Security Assessment

| Check | Status | Detail |
|-------|--------|--------|
| UI access control | **PASS** | `isOrgAdmin` guard on both Desktop and Mobile layouts — only owner/admin see the menu item |
| RLS INSERT policy | **PASS** | `is_org_scheduler(auth.uid(), org_id)` + admin or self-teacher check prevents unauthorized inserts |
| Auth check in mutation | **PASS** | `if (!currentOrg \|\| !user) throw new Error('Not authenticated')` |
| No SECURITY DEFINER RPC | **N/A** | Feature uses direct INSERT, not an RPC. RLS handles authorization. |
| Input sanitization | **PASS** | All parameters are typed. `maxParticipants` is clamped 1-30. Duration/break from fixed option lists. Notes go to `notes_shared` (text column, no HTML rendering). |
| Cross-org isolation | **PASS** | `org_id` set from `currentOrg.id`; RLS enforces org membership on insert |
| Rate limiting | **WEAK** | No explicit rate limiting on slot generation. A malicious admin could spam the button, creating thousands of slots. The 50-slot cap per batch helps but doesn't prevent repeated batches. |

---

## 7. E2E Test Coverage Assessment

| Test | Status | Coverage |
|------|--------|----------|
| Wizard opens from dropdown | **PASS** | `slot-generator.spec.ts` — verifies dialog opens |
| Step 1 fields visible | **PASS** | Verifies date, time, duration, break, slot count |
| Slot count preview | **PASS** | Checks "This will create N slots" text |
| Step 2 teacher/details | **SKIPPED** | Marked TODO — intermittent wizard navigation failure |
| Step 3 preview + generate | **SKIPPED** | Marked TODO — intermittent multi-step navigation failure |
| Back button navigation | **SKIPPED** | Marked TODO — wizard step navigation failure |
| Conflict detection UI | **NOT TESTED** | No E2E test for conflict display |
| Actual slot creation | **NOT TESTED** | No E2E test confirms slots appear on calendar after generation |

**Assessment:** E2E coverage is weak — only Step 1 UI is verified. The critical path (Steps 2-3, actual generation, conflict handling) is untested. However, per claude.md, E2E test phase is complete and no more tests are being written until after beta.

---

## 8. Verdict

### **PRODUCTION READY — with caveats**

The handoff's "SOLID" rating is **mostly justified**. The core mechanism is well-built:

**Strengths:**
- Clean 3-step wizard UX with preview before commit
- Batch insert in a single transaction with automatic rollback on conflict
- DB-level teacher and room conflict triggers as a safety net
- Proper `is_open_slot` lifecycle (auto-cleared on student assignment)
- Admin-only access control at both UI and RLS levels
- Audit logging with full slot IDs
- 50-slot safety cap

**Weaknesses (none are launch blockers for beta):**
- Preview conflict check only covers teacher overlap — misses room, closure dates, time-off, and availability (SG-01 through SG-04). The DB trigger catches teacher/room conflicts at insert time, so data integrity is maintained, but UX is degraded.
- Past date guard is client-only (SG-09) — low real-world risk since only admins can access the feature.
- Error messages from DB trigger conflicts are not user-friendly (SG-06).
- No rate limiting on generation requests (security assessment).

**Recommended priority for post-beta:**
1. **SG-01** — Add room conflict to preview check (prevents confusing error on insert)
2. **SG-02** — Add closure date check (prevents generating slots on closed days)
3. **SG-03** — Add time-off check (prevents generating during teacher leave)
4. **SG-06** — Parse DB conflict error messages for user-friendly display
5. **SG-05** — Consider wrapping in an RPC for full atomicity (low priority — current PostgREST behavior is already transactional)
6. **SG-09** — Add server-side past date guard (very low priority — admin-only feature)
