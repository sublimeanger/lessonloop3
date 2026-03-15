# Audit Report — Feature 7: Lessons & Calendar

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Lessons table, lesson_participants, recurrence_rules, calendar views, lesson form, lesson lifecycle, recurring lessons, closure dates, edge functions, RLS policies

---

## 1. Files Audited

### Database Migrations
| File | Content |
|------|---------|
| `supabase/migrations/20260119233145_*.sql` | CREATE TABLE lessons, lesson_participants, attendance_records, recurrence_rules, availability_blocks, time_off_blocks; initial RLS |
| `supabase/migrations/20260120002039_*.sql` | Audit trigger on lessons |
| `supabase/migrations/20260120215818_*.sql` | Updated RLS for lessons, lesson_participants, attendance_records (role-based) |
| `supabase/migrations/20260120215924_*.sql` | Updated RLS for recurrence_rules, closure_dates, rooms, locations |
| `supabase/migrations/20260128083806_*.sql` | Add cancellation_reason, cancelled_by, cancelled_at, is_series_exception, exception_dates columns |
| `supabase/migrations/20260130162532_*.sql` | Add teacher_id FK (ON DELETE SET NULL) to lessons |
| `supabase/migrations/20260220005744_*.sql` | get_unbilled_lesson_ids() RPC |
| `supabase/migrations/20260220013340_*.sql` | block_expired_trial_lesson_insert policy |
| `supabase/migrations/20260222200941_*.sql` | check_lesson_conflicts() trigger (teacher + room double-booking prevention) |
| `supabase/migrations/20260222202120_*.sql` | shift_recurring_lesson_times() SECURITY DEFINER RPC |
| `supabase/migrations/20260222214908_*.sql` | Finance can view all lessons policy |
| `supabase/migrations/20260222220714_*.sql` | enforce_subscription_active_lessons trigger |
| `supabase/migrations/20260222233741_*.sql` | Add max_participants column; enforce_max_participants() trigger |
| `supabase/migrations/20260224200000_*.sql` | Add recap_url column; zoom_meeting_mappings table |
| `supabase/migrations/20260315083032_*.sql` | Add rate_minor to lesson_participants |
| `supabase/migrations/20260315100200_*.sql` | Trigger to clear is_open_slot on participant add |
| `supabase/migrations/20260315220010_*.sql` | CHECK(end_at > start_at) on time_off_blocks |

### Frontend — Hooks
| File | Purpose |
|------|---------|
| `src/components/calendar/useLessonForm.ts` | Main lesson create/edit hook (803 lines) |
| `src/hooks/useCalendarData.ts` | Calendar data fetching with org-local timezone conversion |
| `src/hooks/useCalendarActions.ts` | Drag-to-reschedule, resize, lesson click handlers |
| `src/hooks/useConflictDetection.ts` | 7-way conflict detection (closure, availability, time-off, teacher, room, student, external calendar) |
| `src/hooks/useBulkLessonActions.ts` | Bulk edit/cancel with role checks |
| `src/hooks/useCalendarSync.ts` | Google Calendar sync |
| `src/hooks/useZoomSync.ts` | Zoom meeting sync |
| `src/hooks/useLessonNotes.ts` | Lesson notes CRUD |
| `src/hooks/useTodayLessons.ts` | Today's lessons query |
| `src/hooks/useStudentTermLessons.ts` | Student term lessons |
| `src/hooks/useClosurePatternCheck.ts` | Closure date pattern checking for recurring creation |

### Frontend — Components
| File | Purpose |
|------|---------|
| `src/pages/CalendarPage.tsx` | Main calendar page with view switching |
| `src/components/calendar/CalendarDesktopLayout.tsx` | Desktop calendar layout |
| `src/components/calendar/CalendarMobileLayout.tsx` | Mobile calendar layout |
| `src/components/calendar/CalendarFiltersBar.tsx` | Filter bar |
| `src/components/calendar/LessonModal.tsx` | Lesson create/edit modal |
| `src/components/calendar/LessonDetailPanel.tsx` | Lesson detail drawer |
| `src/components/calendar/LessonDetailSidePanel.tsx` | Desktop side panel |
| `src/components/calendar/LessonCard.tsx` | Lesson card component |
| `src/components/calendar/MobileLessonSheet.tsx` | Mobile lesson sheet |
| `src/components/calendar/LessonNotesForm.tsx` | Notes editor |
| `src/components/calendar/lesson-form/LessonFormBody.tsx` | Form body |
| `src/components/calendar/useResizeLesson.ts` | Drag-resize handler |
| `src/components/calendar/useDragLesson.ts` | Drag-move handler |
| `src/components/calendar/types.ts` | TypeScript types |
| `src/components/calendar/RecurringEditDialog.tsx` | "This only / This and future" dialog |
| `src/components/calendar/RecurringActionDialog.tsx` | Recurring action dialog |
| `src/components/calendar/BulkSelectBar.tsx` | Bulk selection bar |
| `src/components/calendar/BulkSelectionContext.tsx` | Bulk selection context |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/calendar-sync-lesson/index.ts` | Google Calendar sync |
| `supabase/functions/zoom-sync-lesson/index.ts` | Zoom meeting sync |
| `supabase/functions/calendar-disconnect/index.ts` | Calendar disconnect |
| `supabase/functions/calendar-fetch-busy/index.ts` | Fetch external busy blocks |
| `supabase/functions/calendar-refresh-busy/index.ts` | Cron: refresh busy blocks |
| `supabase/functions/calendar-ical-feed/index.ts` | Public iCal feed |
| `supabase/functions/send-cancellation-notification/index.ts` | Cancellation emails |
| `supabase/functions/booking-get-slots/index.ts` | Public booking availability |
| `supabase/functions/process-term-adjustment/index.ts` | Term day/time changes |
| `supabase/functions/create-billing-run/index.ts` | Invoice generation from lessons |

### Tests
| File | Purpose |
|------|---------|
| `src/test/calendar/LessonCreation.test.ts` | Unit test for lesson creation |
| `src/test/performance/CalendarLoad.test.ts` | Calendar load performance test |

---

## 2. Schema

### `lessons` Table
| Column | Type | Nullable | Default | FK / Constraint |
|--------|------|----------|---------|-----------------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| org_id | uuid | NOT NULL | — | FK → organisations(id) ON DELETE CASCADE |
| start_at | timestamptz | NOT NULL | — | — |
| end_at | timestamptz | NOT NULL | — | — |
| lesson_type | lesson_type enum | NOT NULL | 'private' | — |
| status | lesson_status enum | NOT NULL | 'scheduled' | — |
| teacher_user_id | uuid | NULL (was NOT NULL) | — | No FK constraint (legacy) |
| teacher_id | uuid | NULL | — | FK → teachers(id) ON DELETE SET NULL |
| location_id | uuid | NULL | — | FK → locations(id) ON DELETE SET NULL |
| room_id | uuid | NULL | — | FK → rooms(id) ON DELETE SET NULL |
| online_meeting_url | text | NULL | — | — |
| recurrence_id | uuid | NULL | — | FK → recurrence_rules(id) ON DELETE SET NULL |
| title | text | NOT NULL | — | — |
| notes_private | text | NULL | — | — |
| notes_shared | text | NULL | — | — |
| recap_url | text | NULL | — | — |
| created_by | uuid | NOT NULL | — | — |
| created_at | timestamptz | NOT NULL | now() | — |
| updated_at | timestamptz | NOT NULL | now() | Auto-updated via trigger |
| cancellation_reason | text | NULL | — | — |
| cancelled_by | uuid | NULL | — | — |
| cancelled_at | timestamptz | NULL | — | — |
| is_series_exception | boolean | NOT NULL | false | — |
| is_open_slot | boolean | NOT NULL | false | Auto-cleared on participant add |
| is_online | boolean | NOT NULL | false | — |
| max_participants | integer | NULL | — | Enforced by trigger |

### `lesson_participants` Table
| Column | Type | Nullable | Default | FK / Constraint |
|--------|------|----------|---------|-----------------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| org_id | uuid | NOT NULL | — | FK → organisations(id) ON DELETE CASCADE |
| lesson_id | uuid | NOT NULL | — | FK → lessons(id) ON DELETE CASCADE |
| student_id | uuid | NOT NULL | — | FK → students(id) ON DELETE CASCADE |
| rate_minor | integer | NULL | — | Rate snapshot at creation time (pence/cents) |
| created_at | timestamptz | NOT NULL | now() | — |
| — | — | — | — | UNIQUE(lesson_id, student_id) |

### `recurrence_rules` Table
| Column | Type | Nullable | Default | FK / Constraint |
|--------|------|----------|---------|-----------------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| org_id | uuid | NOT NULL | — | FK → organisations(id) ON DELETE CASCADE |
| pattern_type | recurrence_pattern enum | NOT NULL | 'weekly' | Only 'weekly' supported |
| days_of_week | integer[] | NOT NULL | '{}' | 0=Sunday, 6=Saturday |
| interval_weeks | integer | NOT NULL | 1 | — |
| start_date | date | NOT NULL | — | — |
| end_date | date | NULL | — | — |
| timezone | text | NOT NULL | 'Europe/London' | — |
| exception_dates | date[] | NULL | — | — |
| created_at | timestamptz | NOT NULL | now() | — |

### `closure_dates` Table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → organisations |
| date | date | The closed date |
| reason | text | Human-readable reason |
| location_id | uuid | NULL = all locations |
| applies_to_all_locations | boolean | — |

---

## 3. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| LES-01 | **CRITICAL** | `shift_recurring_lesson_times()` is SECURITY DEFINER with no `org_id` parameter. Any authenticated user who knows a `recurrence_id` can shift lessons belonging to any org. The RPC bypasses RLS entirely. | `supabase/migrations/20260222202120_*.sql` | Add `p_org_id UUID` parameter; add `AND org_id = p_org_id` to the WHERE clause; verify caller's org membership inside the function using `auth.uid()`. |
| LES-02 | **HIGH** | No CHECK constraint `end_at > start_at` on `lessons` table. A lesson with `end_at <= start_at` can be inserted, causing negative-duration display and billing bugs. The CHECK exists on `time_off_blocks` (TCH-03) but was never added to `lessons`. | `supabase/migrations/20260119233145_*.sql` | `ALTER TABLE lessons ADD CONSTRAINT chk_lesson_time_range CHECK (end_at > start_at);` |
| LES-03 | **HIGH** | No DB-level prevention of deleting lessons with linked invoice items. `invoice_items.linked_lesson_id` has `ON DELETE SET NULL`, so deleting a lesson silently orphans billing records. The handoff mentions "block deletion of invoiced lessons" as fixed, but no trigger or constraint exists. | `supabase/migrations/20260119234233_*.sql` | Add a BEFORE DELETE trigger on `lessons` that raises an exception if any `invoice_items` row references the lesson. |
| LES-04 | **HIGH** | `rate_minor` is NOT set when updating existing lesson participants (edit path). On creation, the rate is correctly snapshotted from `rate_cards`, but when a lesson is edited and participants are deleted/re-inserted (line 473-491 in `useLessonForm.ts`), the rate_minor is not included. This means editing a lesson loses the rate snapshot. | `src/components/calendar/useLessonForm.ts:473-491` | When re-inserting participants during edit, either preserve the original `rate_minor` values or re-snapshot from rate_cards (matching the create path). |
| LES-05 | **HIGH** | `send-cancellation-notification` edge function does not validate that the provided `lessonIds` belong to the caller's org. A malicious authenticated user could trigger cancellation emails for lessons in another org by guessing lesson IDs. | `supabase/functions/send-cancellation-notification/index.ts` | Add org_id validation: fetch the lesson, verify it belongs to the user's org before proceeding. |
| LES-06 | **MEDIUM** | Calendar query does not handle month view efficiently. The `useCalendarData` hook fetches by week range (startOfWeek to endOfWeek) even in day view, which is good, but there is no month-level query. The agenda view only fetches 14 days ahead. The 500-lesson page cap (`LESSONS_PAGE_SIZE`) could be hit by large academies in week view. When cap is reached, `isCapReached` is shown but lessons are silently truncated. | `src/hooks/useCalendarData.ts:24-50` | Consider: (1) add a month-view query range, (2) increase page size for unfiltered queries or implement pagination, (3) show a more prominent warning when cap is reached. |
| LES-07 | **MEDIUM** | `teacher_user_id` on `lessons` table has no FK constraint to `auth.users`. It was originally NOT NULL but was relaxed. It's documented as "legacy" on availability_blocks but NOT on lessons. The column is actively used in RLS policies (`teacher_user_id = auth.uid()`) and frontend code. | `supabase/migrations/20260119233145_*.sql` | Document as accepted tech debt. Consider adding a COMMENT. Ensure all code paths also check `teacher_id` as the canonical reference. |
| LES-08 | **MEDIUM** | Drag-to-reschedule for "this_and_future" mode in `useCalendarActions.ts` does NOT use the `shift_recurring_lesson_times` RPC. Instead it manually fetches and updates each lesson in chunks of 50 via individual UPDATE calls. This creates a non-atomic multi-statement operation vulnerable to partial failure and race conditions. | `src/hooks/useCalendarActions.ts:200-233` | Consider using the RPC for atomic bulk update (after fixing LES-01), or wrap in a DB transaction via an edge function. |
| LES-09 | **MEDIUM** | No validation that a lesson's teacher is active when creating/editing. A deactivated teacher can be assigned to new lessons. The frontend loads only active teachers in `useTeachersAndLocations`, but a direct API call could bypass this. | `src/components/calendar/useLessonForm.ts` | Add a BEFORE INSERT/UPDATE trigger on lessons that validates teacher status is 'active'. |
| LES-10 | **MEDIUM** | Lessons at archived locations display correctly (location name with `is_archived` flag is fetched), but there's no prevention of creating NEW lessons at archived locations. The frontend filters archived locations in `useTeachersAndLocations` (`.eq('is_archived', false)`), but a direct API call could bypass this. | `src/hooks/useCalendarData.ts:259` | Add a BEFORE INSERT trigger on lessons that validates the location is not archived, or add a CHECK via a helper function. |
| LES-11 | **MEDIUM** | Lesson with zero participants is valid and can be created. The frontend requires at least one student (line 330-332 in `useLessonForm.ts`), but there's no DB constraint. Zero-participant lessons could be created via direct API. This may be intentional for "open slots" (`is_open_slot=true`). | `src/components/calendar/useLessonForm.ts:330` | If intentional for open slots, document it. If not, add a trigger that requires at least one participant unless `is_open_slot=true`. |
| LES-12 | **MEDIUM** | Past lessons can be freely edited. No restriction on modifying lessons that have already occurred. The status can be changed from 'completed' back to 'scheduled'. Only bulk cancel prevents cancelling completed lessons. | `src/components/calendar/useLessonForm.ts` | Consider adding a warning in the UI when editing past lessons. Consider preventing status transitions from 'completed' → 'scheduled' at DB level. |
| LES-13 | **MEDIUM** | Student overlapping lessons are detected as `severity: 'error'` in conflict detection but are NOT enforced at DB level. The `check_lesson_conflicts()` trigger only checks teacher and room overlaps. A race condition where two concurrent requests create overlapping student lessons would succeed. | `supabase/migrations/20260222200941_*.sql` | Consider adding student overlap checking to the trigger, or accept as a UI-level-only check and document. |
| LES-14 | **LOW** | `check_lesson_conflicts()` trigger does not check for overlaps when `teacher_user_id` is set but `teacher_id` is NULL. If a lesson is created with only `teacher_user_id` (legacy path), the teacher overlap check is skipped entirely. | `supabase/migrations/20260222200941_*.sql` | Add a fallback check using `teacher_user_id` when `teacher_id` IS NULL. |
| LES-15 | **LOW** | Calendar timezone handling is correct: UTC stored in DB → converted to org-local via `toOrgLocalIso()` for display → converted back to UTC via `fromZonedTime()` for writes. The `utc_start_at` / `utc_end_at` fields preserve original UTC. DST is handled via `fromZonedTime` in recurring lesson generation. The 5 timezone fixes from the handoff appear correctly applied. | Multiple files | No action needed — timezone handling is sound. |
| LES-16 | **LOW** | Recurrence model uses `exception_dates` on `recurrence_rules` but this field is never read or written by any frontend code. The field was added in a migration but appears unused. Cancellation of single instances uses `is_series_exception=true` on the lesson itself instead. | `supabase/migrations/20260128083806_*.sql` | Remove the unused `exception_dates` column or document its intended future use. |
| LES-17 | **LOW** | `created_by` on lessons has no FK constraint to `auth.users`. If the creating user's account is deleted, the reference becomes a dangling UUID. | `supabase/migrations/20260119233145_*.sql` | Add FK with ON DELETE SET NULL, or accept as low-risk since user deletion is rare. |
| LES-18 | **LOW** | `cancelled_by` on lessons has no FK constraint. Same dangling reference risk as LES-17. | `supabase/migrations/20260128083806_*.sql` | Add FK with ON DELETE SET NULL. |
| LES-19 | **LOW** | Availability blocks conflict check in `useConflictDetection.ts` uses `format(startAt, 'HH:mm:ss')` which formats in browser timezone, not org timezone. For UK-based orgs this is usually fine, but for orgs in different timezones, the availability check could use the wrong hours. | `src/hooks/useConflictDetection.ts:221-222` | Convert to org timezone before formatting: `format(toZonedTime(startAt, orgTimezone), 'HH:mm:ss')`. |
| LES-20 | **LOW** | Calendar does not explicitly handle lessons spanning midnight. The `lessonsByDay` grouping uses `format(parseISO(lesson.start_at), 'yyyy-MM-dd')` which assigns the lesson to its start date only. A lesson from 23:00–01:00 would only appear on the start day. | `src/pages/CalendarPage.tsx:119-128` | Acceptable for music lessons (very rare to span midnight). Document as known limitation. |
| LES-21 | **INFO** | No rate limiting on lesson creation edge function (lessons are created via direct Supabase client, not an edge function). The `block_expired_trial_lesson_insert` policy prevents creation on expired trials. Conflict triggers prevent double-booking. But there's no rate limit on how many lessons a user can create per minute. | Client-side `useLessonForm.ts` | Consider adding a rate-limiting trigger or edge function wrapper for lesson creation. Low priority since authenticated users only. |

---

## 4. RLS Policy Matrix

### `lessons` Table

| Operation | Owner/Admin | Teacher | Finance | Parent |
|-----------|-------------|---------|---------|--------|
| SELECT | `is_org_admin()` | Own lessons (`teacher_user_id = auth.uid()`) | `is_org_finance_team()` | Children's lessons (via lesson_participants + is_parent_of_student) |
| INSERT | `is_org_scheduler()` + (admin OR self) | Own lessons (`teacher_user_id = auth.uid()`) | — | — |
| UPDATE | `is_org_admin()` | Own lessons (`teacher_user_id = auth.uid()`) | — | — |
| DELETE | `is_org_admin()` | — | — | — |

**Additional INSERT policy:** `block_expired_trial_lesson_insert` — requires `is_org_active(org_id)`.

### `lesson_participants` Table

| Operation | Owner/Admin | Teacher | Finance | Parent |
|-----------|-------------|---------|---------|--------|
| SELECT | `is_org_admin()` | Own lesson participants (`is_lesson_teacher()`) | — (gap) | Own children (`is_parent_of_student()`) |
| INSERT | `is_org_admin()` | Own lessons (`is_lesson_teacher()`) | — | — |
| UPDATE | `is_org_admin()` | Own lessons (`is_lesson_teacher()`) | — | — |
| DELETE | `is_org_admin()` | Own lessons (`is_lesson_teacher()`) | — | — |

**Note:** Finance role has no SELECT on `lesson_participants`. This could cause issues if billing/finance reports need participant data.

### `recurrence_rules` Table

| Operation | Owner/Admin | Teacher | Finance | Parent |
|-----------|-------------|---------|---------|--------|
| SELECT | `is_org_staff()` | `is_org_staff()` | `is_org_staff()` | — |
| INSERT | `is_org_scheduler()` | `is_org_scheduler()` | — | — |
| UPDATE | `is_org_admin()` | — | — | — |
| DELETE | `is_org_admin()` | — | — | — |

### `closure_dates` Table

| Operation | Owner/Admin | Teacher | Finance | Parent |
|-----------|-------------|---------|---------|--------|
| SELECT | `is_org_staff()` | `is_org_staff()` | `is_org_staff()` | — |
| INSERT | `is_org_admin()` | — | — | — |
| UPDATE | `is_org_admin()` | — | — | — |
| DELETE | `is_org_admin()` | — | — | — |

### `attendance_records` Table

| Operation | Owner/Admin | Teacher | Finance | Parent |
|-----------|-------------|---------|---------|--------|
| SELECT | `is_org_admin()` | Own lessons | — (gap) | Own children |
| INSERT | `is_org_admin()` | Own lessons + `recorded_by = auth.uid()` | — | — |
| UPDATE | `is_org_admin()` | Own lessons | — | — |
| DELETE | `is_org_admin()` | — | — | — |

---

## 5. Lesson Status Lifecycle

```
                    ┌─────────────┐
                    │  scheduled  │ (default on creation)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌───────────┐ ┌──────────┐ ┌──────────────┐
        │ completed │ │cancelled │ │  (re-edited  │
        └───────────┘ └──────────┘ │   stays      │
              │            │       │  scheduled)  │
              │            │       └──────────────┘
              ▼            │
        ┌───────────┐      │
        │(can be    │      │
        │ reversed  │      │
        │ to sched- │      │
        │ uled - no │      │
        │ guard)    │      │
        └───────────┘      │
                           ▼
                    ┌──────────────┐
                    │ Sets:        │
                    │ cancelled_at │
                    │ cancelled_by │
                    │ cancellation_│
                    │   reason     │
                    └──────────────┘
```

**Status values:** `scheduled`, `completed`, `cancelled` (enum)

**Transition rules enforced:**
- Bulk cancel prevents cancelling `completed` lessons (frontend only, useBulkLessonActions.ts)
- No DB-level transition guard (completed → scheduled is allowed)
- Cancellation sets `cancelled_at`, `cancelled_by`, `cancellation_reason` (frontend writes these)
- Cancelled lessons are excluded from conflict checks (`status != 'cancelled'`)
- Cancelled lessons can be hidden via calendar filter (`hide_cancelled`)

**Gaps:**
- No DB trigger preventing `completed → scheduled` reversal
- No DB trigger ensuring `cancelled_at`/`cancelled_by` are set when status changes to `cancelled`

---

## 6. Recurrence Model Assessment

### Architecture
- **Pattern stored, instances pre-generated.** On recurring lesson creation, all individual lesson rows are created upfront (up to 200 cap or 90-day default range).
- Each lesson row stores `recurrence_id` FK to `recurrence_rules`.
- `recurrence_rules` stores: `pattern_type` (only 'weekly'), `days_of_week`, `interval_weeks`, `start_date`, `end_date`, `timezone`.

### Edit Modes
| Mode | Behaviour |
|------|-----------|
| **This only** | Updates single lesson; sets `recurrence_id = null` (detaches from series); sets `is_series_exception = true` for drag operations |
| **This and future** | Updates current lesson directly; batch-updates future lessons for teacher/location/room/title; uses `shift_recurring_lesson_times` RPC for time changes |

### Cancel Single Instance
- Status set to `cancelled` on the individual lesson row
- The lesson remains linked to the recurrence (recurrence_id preserved)
- `cancelled_at`, `cancelled_by`, `cancellation_reason` set

### Cancel Entire Series
- Bulk cancel via `useBulkLessonActions` or manual multi-select
- No dedicated "cancel series" function — relies on filtering by recurrence_id

### Strengths
- DST handling: Recurring lessons generated in org timezone using `fromZonedTime()` per-instance, ensuring wall-clock times are preserved across DST transitions
- Closure date filtering during creation: Lessons on closure dates are automatically skipped
- 200-lesson cap prevents runaway series

### Weaknesses
- `exception_dates` on `recurrence_rules` is unused (dead column)
- No "edit all" mode — only "this only" and "this and future"
- When teacher is removed/deactivated, existing future recurring lessons retain the teacher_id (ON DELETE SET NULL will clear it). No automatic notification or cleanup.
- When location is archived, existing future recurring lessons retain the location_id (ON DELETE SET NULL will clear it). Frontend still shows the lesson with archived location flag.
- `shift_recurring_lesson_times` RPC has critical security flaw (LES-01)

---

## 7. Calendar Performance Assessment

### Query Strategy
- **Week view:** Fetches `startOfWeek` to `endOfWeek` (7 days)
- **Day view:** Also fetches full week range (good for swipe navigation)
- **Agenda view:** Fetches 14 days ahead
- **No month view query** — month is handled as week view

### N+1 Prevention
The calendar query is well-designed to prevent N+1:
1. Fetches all lessons in date range (single query, limit 500/1000)
2. Collects all unique lesson IDs and teacher IDs
3. Runs 4 parallel queries: teachers, participants, attendance, makeup waitlist
4. Joins in memory via Maps

**This is efficient.** The 4 parallel queries are batched using `Promise.all()`.

### Page Size Limits
| Scenario | Limit | Risk |
|----------|-------|------|
| Unfiltered | 500 lessons | Medium academy could hit this in busy week |
| Filtered | 1000 lessons | Adequate |
| Students dropdown | 2000 students | Adequate (raised from 500) |

### Realtime
- Subscribes to `postgres_changes` on `lessons` table filtered by `org_id`
- Invalidates entire query cache on any change
- **TODO noted (PERF-M5):** Unbounded at scale; could be narrowed by teacher

### Caching
- `STALE_VOLATILE` for lesson data (short stale time, frequent refetch)
- `STALE_STABLE` for teachers/locations (long stale time)
- Optimistic updates for drag-to-reschedule with rollback on error

### Verdict
Calendar performance is **adequate for current scale**. The 500-lesson cap per week and lack of month-view pagination are the main risks for larger academies.

---

## 8. Edge Function Security Summary

| Function | Auth | Org Check | Rate Limit | Issues |
|----------|------|-----------|------------|--------|
| calendar-sync-lesson | JWT | Membership check | No | Minor: blind delete possible |
| zoom-sync-lesson | JWT | Membership check | No | Token handling in DB |
| calendar-disconnect | JWT | Ownership check | No | No API rate limit |
| send-cancellation-notification | JWT | **Missing** | Yes | **LES-05: No org validation on lessonIds** |
| booking-get-slots | IP-based | Via slug | 20/min | Public endpoint, acceptable |
| calendar-fetch-busy | JWT | User-scoped | No | No pagination on Google API |
| calendar-refresh-busy | Cron secret | N/A | 200ms delay | No org isolation (acceptable for cron) |
| calendar-ical-feed | Token+expiry | Guardian/user scoped | No | Token in URL (iCal standard) |
| process-term-adjustment | JWT | Role check | Indirect | Complex function, race condition risk |
| create-billing-run | JWT | Role check | 3/5min | No idempotency check |

---

## 9. Verdict

### **PRODUCTION READY** — All blocking findings resolved

#### Resolved (migration `20260315220012_fix_lessons_calendar_audit_findings.sql`)
| ID | Severity | Summary | Fix |
|----|----------|---------|-----|
| **LES-01** | CRITICAL | `shift_recurring_lesson_times` RPC had no org_id guard | Added org membership check (owner/admin/teacher) via `auth.uid()` at top of function |
| **LES-02** | HIGH | No `CHECK(end_at > start_at)` on lessons table | Added `chk_lesson_time_range` constraint |
| **LES-03** | HIGH | No block on deleting lessons with linked invoice items | Added `prevent_invoiced_lesson_delete` BEFORE DELETE trigger |
| **LES-04** | HIGH | Rate snapshot (`rate_minor`) lost on lesson edit | Fixed `useLessonForm.ts` edit path to preserve existing `rate_minor` and snapshot for new participants |
| **LES-05** | HIGH | `send-cancellation-notification` missing org validation | Added org membership check and lesson-org ownership verification |

#### Should Fix (Medium Priority)
| Count | Items |
|-------|-------|
| 9 | LES-06 through LES-14 — calendar cap, teacher_user_id legacy, non-atomic batch updates, archived/deactivated entity validation, zero-participant lessons, past lesson editing, student overlap not DB-enforced |

#### Low Priority / Informational
| Count | Items |
|-------|-------|
| 8 | LES-15 through LES-21 — timezone handling (sound), unused exception_dates column, missing FKs on created_by/cancelled_by, availability timezone edge case, midnight-spanning lessons, no rate limit |

---

*End of audit report.*
