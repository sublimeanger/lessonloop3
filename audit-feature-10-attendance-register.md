# Audit Report — Feature 10: Attendance & Register

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Attendance marking, register view, statuses, timezone handling, future lesson guard, lifecycle, bulk attendance, reporting

---

## 1. Files Audited

### Pages & Components
| File | Purpose |
|------|---------|
| `src/pages/DailyRegister.tsx` | Daily register page — date nav, teacher filter, stats cards, lesson list |
| `src/pages/BatchAttendance.tsx` | Batch attendance — mark all students across multiple lessons at once |
| `src/components/register/RegisterRow.tsx` | Individual lesson row with per-student attendance buttons |
| `src/components/register/AbsenceReasonPicker.tsx` | Absence reason selector + notified-at date picker |
| `src/components/register/StudentNotesPopover.tsx` | Quick-view student notes from register |
| `src/components/calendar/LessonDetailPanel.tsx` | Lesson detail sheet — inline attendance marking |
| `src/components/calendar/LessonDetailSidePanel.tsx` | Calendar side panel — inline attendance marking |
| `src/components/calendar/MarkDayCompleteButton.tsx` | Bulk "Mark Day Complete" with auto-present backfill |
| `src/pages/portal/PortalSchedule.tsx` | Parent portal — read-only attendance view + summary stats |

### Hooks & Utilities
| File | Purpose |
|------|---------|
| `src/hooks/useRegisterData.ts` | Core hook: `useRegisterData()`, `useUpdateAttendance()`, `useMarkLessonComplete()`, `useBatchAttendanceLessons()`, `useSaveBatchAttendance()` |
| `src/lib/attendance-utils.ts` | `mergeAttendance()`, `filterByTeacher()` utility functions |
| `src/hooks/useParentPortal.ts` | `useParentLessons()` — parent attendance query |

### Database Migrations
| File | Purpose |
|------|---------|
| `supabase/migrations/20260119233145_*.sql` | Creates `attendance_records`, `lesson_participants`, `lessons` tables + initial RLS |
| `supabase/migrations/20260120215727_*.sql` | Creates `is_lesson_teacher()` helper function |
| `supabase/migrations/20260120215818_*.sql` | Refined RLS: role-specific SELECT/INSERT/UPDATE/DELETE on attendance_records |
| `supabase/migrations/20260222163838_*.sql` | Adds `absence_reason` enum, `absence_reason_category` & `absence_notified_at` columns, `make_up_policies` table |
| `supabase/migrations/20260222164414_*.sql` | `auto_add_to_waitlist()` trigger on attendance_records |
| `supabase/migrations/20260222164435_*.sql` | `auto_issue_credit_on_absence()` trigger on attendance_records |
| `supabase/migrations/20260222164529_*.sql` | `on_slot_released()` trigger on attendance_records |
| `supabase/migrations/20260222202654_*.sql` | Further restricts INSERT/UPDATE to `can_edit_lesson()` or `is_org_admin()` |
| `supabase/migrations/20260222203320_*.sql` | `cleanup_attendance_on_cancel()` trigger — deletes attendance when lesson cancelled |
| `supabase/migrations/20260315220004_*.sql` | Creates `trg_attendance_not_future` trigger |
| `supabase/migrations/20260315220008_*.sql` | **Drops** `trg_attendance_not_future` — moved guard to client |
| `supabase/migrations/20260315200000_*.sql` | Fixes infinite credit loop for make-up absences |

### Tests
| File | Purpose |
|------|---------|
| `src/test/register/Attendance.test.ts` | Unit tests for attendance utilities |
| `tests/e2e/register-attendance.spec.ts` | E2E register attendance flow |
| `tests/e2e/workflows/crud-attendance.spec.ts` | CRUD operations |
| `tests/e2e/workflows/batch-attendance.spec.ts` | Batch attendance workflow |
| `tests/e2e/workflows/system-test/03-attendance.spec.ts` | System-level attendance test |
| `tests/e2e/student-notes-attendance.spec.ts` | Student notes in attendance context |

### Types
| File | Purpose |
|------|---------|
| `src/integrations/supabase/types.ts` | Generated types for `attendance_status` enum, `attendance_records` table |

---

## 2. Schema: `attendance_records` Table

```sql
CREATE TABLE public.attendance_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  lesson_id        uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_status attendance_status NOT NULL DEFAULT 'present',
  recorded_by      uuid NOT NULL,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  cancellation_reason text,
  -- Added later:
  absence_reason_category absence_reason,      -- enum: sick, school_commitment, family_emergency, holiday, teacher_cancelled, weather_closure, no_show, other
  absence_notified_at     timestamptz,
  UNIQUE(lesson_id, student_id)
);
```

### `attendance_status` Enum
```sql
CREATE TYPE attendance_status AS ENUM (
  'present', 'absent', 'late', 'cancelled_by_teacher', 'cancelled_by_student'
);
```

### `absence_reason` Enum
```sql
CREATE TYPE absence_reason AS ENUM (
  'sick', 'school_commitment', 'family_emergency', 'holiday',
  'teacher_cancelled', 'weather_closure', 'no_show', 'other'
);
```

### Key Constraints
- **Unique constraint:** `UNIQUE(lesson_id, student_id)` — prevents duplicate attendance records
- **org_id:** Direct column on attendance_records (not derived via lesson FK)
- **FK cascades:** `ON DELETE CASCADE` for org_id, lesson_id, student_id
- **recorded_by:** NOT NULL but has **no FK to auth.users** (see findings)

### Indexes
```sql
CREATE INDEX idx_attendance_records_lesson_id ON attendance_records(lesson_id);
```
No index on `student_id` or `org_id` for this table (see findings).

### Related Triggers
| Trigger | Event | Function |
|---------|-------|----------|
| `trg_cleanup_attendance_on_cancel` | AFTER UPDATE (status→cancelled) on lessons | Deletes all attendance_records for that lesson |
| `trg_auto_waitlist` | AFTER INSERT OR UPDATE on attendance_records | Auto-adds absent students to make-up waitlist |
| `trg_auto_credit` | AFTER INSERT OR UPDATE on attendance_records | Auto-issues make-up credit based on policy |
| `trg_slot_released` | AFTER INSERT OR UPDATE on attendance_records | Matches waitlist entries when slots open |
| ~~`trg_attendance_not_future`~~ | ~~BEFORE INSERT OR UPDATE~~ | **DROPPED** — moved to client-side guard |

---

## 3. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| ATT-01 | **HIGH** | **`is_lesson_teacher()` only checks `teacher_user_id`, not `teacher_id`.** The lessons table has both `teacher_user_id` (UUID of auth user) and `teacher_id` (FK to teachers table, added later). The RLS helper `is_lesson_teacher()` only checks `WHERE teacher_user_id = _user_id`. If a lesson is assigned via `teacher_id` but `teacher_user_id` is not set (or differs), the teacher cannot view/update attendance at the DB level. The app-side hook (`useUpdateAttendance`) works around this by doing its own lookup, but the RLS policy has a gap. | `supabase/migrations/20260120215727_*.sql:77-90` | Update `is_lesson_teacher()` to also join through `teachers` table: `OR EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = _user_id AND t.id = l.teacher_id)` |
| ATT-02 | **HIGH** | **`can_edit_lesson()` only checks `teacher_user_id`, same gap as ATT-01.** This function is used in the latest INSERT/UPDATE RLS policies for attendance_records. Same fix needed. | `supabase/migrations/20260119233145_*.sql:95-110` | Update `can_edit_lesson()` to also check via `teacher_id` → `teachers.user_id` |
| ATT-03 | **HIGH** | **Future lesson guard is client-only — no DB enforcement.** The `trg_attendance_not_future` trigger was created then dropped because it broke "Mark Complete". The guard now exists only in `useUpdateAttendance()` (`if (new Date(lesson.start_at) > new Date())`). Batch attendance has no client guard for individual records — only a UI disable for future dates. A malicious API call can bypass both. | `useRegisterData.ts:248`, `supabase/migrations/20260315220008_*.sql` | Create a smarter DB trigger that only blocks future attendance when `lesson.status != 'completed'` — allowing "Mark Complete" to backfill attendance while still preventing direct future marking. |
| ATT-04 | **MEDIUM** | **Duplicate RLS policies on attendance_records.** Migration `20260120215818` creates specific teacher/admin INSERT/UPDATE policies. Then `20260222202654` creates additional `Staff can create/update attendance records` policies using `can_edit_lesson()`. The older policies (`Teacher can record attendance for own lessons`, etc.) were never dropped. This means duplicate policy evaluation, potentially conflicting semantics. | `supabase/migrations/20260120215818_*.sql:166-193`, `supabase/migrations/20260222202654_*.sql` | Drop the older specific policies (`Admin can create attendance`, `Teacher can record attendance for own lessons`, `Admin can update attendance`, `Teacher can update attendance for own lessons`) since the newer `Staff can create/update` policies supersede them. |
| ATT-05 | **MEDIUM** | **`recorded_by` has no FK constraint.** The `recorded_by` column stores the user ID who recorded attendance, but there's no FK to `auth.users`. If a user is deleted, `recorded_by` becomes a dangling reference. | `supabase/migrations/20260119233145_*.sql:59` | Add `REFERENCES auth.users(id) ON DELETE SET NULL` — but this requires making the column nullable. Alternatively, accept the dangling reference since it's just metadata. LOW priority. |
| ATT-06 | **MEDIUM** | **`cleanup_attendance_on_cancel` trigger + manual deletion in LessonDetailPanel = double delete.** When cancelling a lesson, `LessonDetailPanel.performCancel()` manually deletes attendance records (line 313), then sets status to 'cancelled', which fires the `trg_cleanup_attendance_on_cancel` trigger that also deletes. The second delete is harmless but wasteful. | `LessonDetailPanel.tsx:311-317`, `supabase/migrations/20260222203320_*.sql` | Remove the manual `DELETE FROM attendance_records` in `LessonDetailPanel.performCancel()` — the trigger handles it. |
| ATT-07 | **MEDIUM** | **No index on `attendance_records.student_id`.** The parent RLS policy `is_parent_of_student(auth.uid(), student_id)` does a lookup on `student_id` every query. Without an index, this becomes a sequential scan on large tables. | `supabase/migrations/20260119233145_*.sql` | Add `CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);` |
| ATT-08 | **MEDIUM** | **Batch attendance has no server-side auth guard.** `useSaveBatchAttendance()` directly upserts into `attendance_records` without the teacher-check/admin-check logic that `useUpdateAttendance()` has. It relies solely on RLS. While RLS should enforce this, the inconsistency means batch mode lacks the explicit "you must be the assigned teacher or admin" error message. | `useRegisterData.ts:512-631` | Acceptable given RLS enforcement, but consider adding the same explicit auth check as `useUpdateAttendance()` for consistent error messaging. |
| ATT-09 | **LOW** | **`MarkDayCompleteButton` uses `endOfDay(currentDate)` without timezone conversion.** The eligible lessons filter compares `lessonEnd` to `endOfDay(currentDate)` using browser timezone, not org timezone. If the user is in a different timezone than the org, edge-case lessons near midnight could be incorrectly included/excluded. | `MarkDayCompleteButton.tsx:29-38` | Use `fromZonedTime(endOfDay(toZonedTime(currentDate, tz)), tz)` for org-timezone-aware boundary. |
| ATT-10 | **LOW** | **`useUpdateAttendance` future guard uses `new Date()` (browser time).** The comparison `new Date(lesson.start_at) > new Date()` compares UTC start_at against browser local time. Since `start_at` is timestamptz and `new Date()` also produces UTC, this is technically correct for most cases but could have edge issues during DST transitions. | `useRegisterData.ts:248` | This is functionally correct since both sides are UTC. No action needed. |
| ATT-11 | **LOW** | **No attendance locking mechanism.** There's no time window after which attendance becomes immutable. A teacher can change last month's attendance at any time. | Architectural | Consider adding an `attendance_locked_at` column or policy that prevents changes after N days. Post-beta enhancement. |
| ATT-12 | **INFO** | **Attendance for removed students.** If a student is removed from `lesson_participants` after attendance was recorded, the attendance_record persists (no cascade from participants → attendance). This is by design — there's no FK from attendance_records to lesson_participants. The attendance record's `student_id` FK to `students` handles cleanup on student deletion. | Schema design | Acceptable — orphaned attendance records for removed participants are legitimate historical data. |
| ATT-13 | **INFO** | **Parent cannot see other students' attendance in group lessons.** RLS policy uses `is_parent_of_student(auth.uid(), student_id)`, which restricts parents to only their own children's records. This is correct privacy behavior. | `supabase/migrations/20260120215818_*.sql:158-164` | No action needed — correct by design. |

---

## 4. RLS Policy Matrix for `attendance_records`

The final effective policies after all migrations are applied:

| Operation | Owner | Admin | Teacher (own lesson) | Teacher (other's lesson) | Finance | Parent |
|-----------|-------|-------|---------------------|-------------------------|---------|--------|
| **SELECT** | via `is_org_admin` | via `is_org_admin` | via `is_lesson_teacher` | DENIED | DENIED | Own children only via `is_parent_of_student` |
| **INSERT** | via `is_org_admin` or `can_edit_lesson` | via `is_org_admin` or `can_edit_lesson` | via `can_edit_lesson` (own lesson) | DENIED | DENIED | DENIED |
| **UPDATE** | via `is_org_admin` or `can_edit_lesson` | via `is_org_admin` or `can_edit_lesson` | via `can_edit_lesson` (own lesson) | DENIED | DENIED | DENIED |
| **DELETE** | via `is_org_admin` | via `is_org_admin` | DENIED | DENIED | DENIED | DENIED |

### Key Security Observations
- **Finance role has NO attendance access** — neither read nor write
- **Parents are read-only** and scoped to their own children
- **Teachers cannot mark attendance for other teachers' lessons** at RLS level (assuming `teacher_user_id` is correct — see ATT-01/ATT-02)
- **Only admins/owners can DELETE attendance records**
- **`can_edit_lesson()` is SECURITY DEFINER** — bypasses caller's RLS to check lesson ownership
- **`is_lesson_teacher()` is SECURITY DEFINER** — same pattern
- The app-level `useUpdateAttendance()` has an additional explicit auth check (line 252-267) that mirrors the RLS logic

### Note on Duplicate Policies (ATT-04)
The migration sequence creates overlapping policies:
1. `Teacher can record attendance for own lessons` (from migration `20260120215818`)
2. `Staff can create attendance records` (from migration `20260222202654`)

Both allow teacher INSERT. PostgreSQL evaluates all policies with OR semantics — if ANY policy passes, access is granted. The duplication is not a security risk but adds unnecessary complexity.

---

## 5. Register Timezone Assessment

**STATUS: FIXED**

The handoff flagged "register date filtering uses browser timezone" as a known bug. This has been **properly fixed**.

### Evidence

**`useRegisterData()` (lines 80-83):**
```typescript
const tz = currentOrg.timezone || 'Europe/London';
const dayInOrgTz = toZonedTime(date, tz);
const dayStart = fromZonedTime(startOfDay(dayInOrgTz), tz).toISOString();
const dayEnd = fromZonedTime(endOfDay(dayInOrgTz), tz).toISOString();
```

**`useBatchAttendanceLessons()` (lines 438-441):**
```typescript
const tz = currentOrg.timezone || 'Europe/London';
const dayInOrgTz = toZonedTime(date, tz);
const dayStart = fromZonedTime(startOfDay(dayInOrgTz), tz).toISOString();
const dayEnd = fromZonedTime(endOfDay(dayInOrgTz), tz).toISOString();
```

Both hooks:
1. Read `currentOrg.timezone` (defaults to `'Europe/London'`)
2. Convert the selected date to the org timezone using `toZonedTime()`
3. Compute start/end of day boundaries in org timezone
4. Convert back to UTC ISO strings using `fromZonedTime()` for Supabase queries

This correctly handles the scenario where the browser is in a different timezone than the org.

### Remaining Minor Timezone Issues
- **ATT-09:** `MarkDayCompleteButton` uses `endOfDay()` without timezone conversion (LOW severity)
- **ATT-10:** `useUpdateAttendance()` future guard uses `new Date()` — technically correct since both sides are UTC

---

## 6. Attendance Status Lifecycle

### Status Flow
```
(no record) → present / absent / late / cancelled_by_teacher / cancelled_by_student
     ↕                    ↕
  Any status can be changed to any other status (no state machine)
```

### Entry Points for Attendance Marking

| Surface | Method | Bulk? | Future Guard? |
|---------|--------|-------|---------------|
| Daily Register → RegisterRow | `useUpdateAttendance()` single click | No | Client: `lesson.start_at > new Date()` |
| Batch Attendance page | `useSaveBatchAttendance()` upsert all | Yes | Client: `isFuture(startOfDay(selectedDate))` disables UI |
| Calendar → LessonDetailPanel | `useUpdateAttendance()` single click | No | Client: `lesson.start_at > new Date()` |
| Calendar → LessonDetailSidePanel | `useUpdateAttendance()` single click | No | Client: `lesson.start_at > new Date()` |
| Mark Day Complete button | `useMarkLessonComplete()` auto-present | Bulk per lesson | Only past lessons (checks `isBefore(lessonEnd, now)`) |
| Mark Day Complete (DailyRegister) | `MarkDayCompleteButton` auto-present | Bulk all lessons | Only past lessons (checks `isBefore(lessonEnd, now)`) |

### Status Side Effects (DB Triggers)

| Status Set | Trigger | Effect |
|------------|---------|--------|
| `absent` + absence_reason with `automatic` policy | `trg_auto_credit` | Auto-issues make-up credit |
| `cancelled_by_student` + absence_reason with `automatic` policy | `trg_auto_credit` | Auto-issues make-up credit |
| `cancelled_by_teacher` + absence_reason `teacher_cancelled` with `automatic` policy | `trg_auto_credit` | Auto-issues make-up credit |
| `absent` / `cancelled_by_student` + `waitlist` policy | `trg_auto_waitlist` | Adds student to make-up waitlist |
| Any status that "releases slot" per policy | `trg_slot_released` | Matches waitlist entries to open slots |

### Lesson Cancellation Effect on Attendance
When lesson status → `cancelled`:
1. **DB trigger `trg_cleanup_attendance_on_cancel`:** Deletes ALL attendance_records for that lesson
2. **App code (LessonDetailPanel):** Also manually deletes (redundant — see ATT-06)
3. **Result:** Attendance records are always cleaned up on cancellation

### Attendance Can Be Changed After Initial Marking
- **Yes** — any status can be overwritten by clicking a different button
- **Undo toast** shown in RegisterRow when overwriting (5 second window)
- **No time lock** — changes allowed indefinitely (see ATT-11)

---

## 7. Edge Case Assessment

| Scenario | Behavior | Status |
|----------|----------|--------|
| Lesson with no students (open slots) | Register shows "No students assigned" message | OK |
| Student removed from lesson after attendance recorded | Attendance record persists (no cascade from participants) | OK — historical data preserved |
| Lesson spanning midnight | `start_at` determines which day it appears on; both register hooks use `start_at` for date filtering | OK |
| Retroactive attendance (marking yesterday's lessons today) | Allowed — date picker lets user navigate to past dates | OK |
| No lessons for selected date range | EmptyState component shown with helpful message | OK |
| Marking attendance for future lesson via API bypass | No DB guard — client-only check. RLS allows it. | **ATT-03 (HIGH)** |
| Duplicate attendance for same student+lesson | Prevented by `UNIQUE(lesson_id, student_id)` + upsert `onConflict` | OK |
| Teacher marking another teacher's lesson | RLS prevents at DB level (via `is_lesson_teacher` / `can_edit_lesson`); app hook also checks | OK (with ATT-01/02 caveat) |
| Parent modifying attendance via API | RLS denies — no INSERT/UPDATE policies for parent role | OK |
| Finance role viewing attendance | RLS denies — no SELECT policy for finance role | OK (intentional) |

---

## 8. Verdict

### **NOT PRODUCTION READY — 3 HIGH findings require fixes**

| Finding | Fix Effort | Blocker? |
|---------|-----------|----------|
| **ATT-01** `is_lesson_teacher()` doesn't check `teacher_id` | 10 min SQL migration | Yes — breaks teacher RLS for lessons assigned via teacher_id |
| **ATT-02** `can_edit_lesson()` doesn't check `teacher_id` | 10 min SQL migration | Yes — same root cause |
| **ATT-03** No DB guard on future attendance | 20 min SQL migration | Yes — security gap, bypassable via API |
| ATT-04 Duplicate RLS policies | 10 min cleanup migration | No |
| ATT-06 Double delete on cancellation | 5 min code change | No |
| ATT-07 Missing student_id index | 5 min migration | No |
| ATT-09 MarkDayComplete timezone | 10 min code change | No |

### What's Working Well
- **Timezone handling in register queries** — properly fixed using org timezone
- **RLS security model** — comprehensive role-based access (parent read-only, teacher own-lessons-only, admin full)
- **Unique constraint** prevents duplicate attendance records
- **Cascade deletes** properly clean up when lessons/students/orgs are deleted
- **Trigger cleanup** on lesson cancellation removes attendance records
- **Absence reason system** with make-up credit automation
- **Infinite credit loop prevention** for make-up absences
- **Optimistic updates** with rollback on error in all mutation hooks
- **Bulk attendance** with auto-complete for fully marked lessons
- **Keyboard shortcuts** (P/A/L/T/S) in RegisterRow for fast marking
- **Parent portal** shows attendance summary and per-lesson badges (read-only)
- **Comprehensive E2E test coverage** (5 spec files)
