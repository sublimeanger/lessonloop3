# LessonLoop Competitive Advantage Pack — Implementation Plan

Five features sourced from real competitor complaints, ordered by effort-to-impact ratio.

---

critical: Start with Phase 1 and Phase 2 only. Do not build all 5 at once. 

Commit after each phase. I'll review and approve before you move 

to the next phase.

&nbsp;

## Phase 1: Feature Request Board (30 min)

No code-heavy build. Add a "Feature Requests" card to the Help page linking to an external board (Canny/Nolt). Add a "Suggest a feature" link in the sidebar footer.

**Changes:**

- `src/pages/Help.tsx` — Add a "Feature Requests" card in the Quick Help section with link to `https://feedback.lessonloop.net`
- `src/components/layout/AppSidebar.tsx` — Add a small "Suggest a feature" link in the sidebar footer
- LoopAssist system prompt — Add instruction to suggest the feedback board when users ask for unsupported features

SSO integration deferred to Phase 2 (requires Canny account setup + secret).

---

## Phase 2: Student Notes on Attendance (1-2 days)

**New files:**

- `src/components/register/StudentNotesPopover.tsx` — Popover (desktop) / Sheet (mobile) showing student profile notes + last 3 lesson notes
- `src/hooks/useStudentQuickNotes.ts` — On-demand fetch of last 3 `lesson_notes` for a student

**Modified files:**

- `src/pages/DailyRegister.tsx` — Add `notes` to student select in the query; render StickyNote icon per student row (only if notes exist); click opens `StudentNotesPopover`
- `src/pages/BatchAttendance.tsx` — Same icon + popover pattern

**No DB changes.** Existing `students.notes` and `lesson_notes` table. Existing RLS policies cover staff read access.

---

## Phase 3: Notes Explorer (3-4 days)

**New files:**

- `src/pages/NotesExplorer.tsx` — Page with date range filter, teacher/student filters, search, grouped note cards
- `src/hooks/useNotesExplorer.ts` — Complex join query: `lesson_notes` + `lessons` + `students` + `teachers`, with pagination (50 per page)
- `src/components/notes/NoteCard.tsx` — Expandable card showing content_covered, homework, focus_areas, engagement, private notes
- `src/components/notes/NotesStatsBar.tsx` — Aggregate stats (total notes, students covered, avg engagement)
- `src/components/notes/NotesFilterBar.tsx` — Date range, teacher, student, visibility toggle, search

**Modified files:**

- `src/config/routes.ts` — Add `/notes` route, allowed roles: owner, admin, teacher
- `src/components/layout/AppSidebar.tsx` — Add "Notes" link with FileText icon

**No DB changes.** Query-only feature. CSV/PDF export reuses existing jspdf + export patterns.

---

## Phase 4: Bulk Slot Generator (3-5 days)

**DB migration:**

```sql
ALTER TABLE lessons ADD COLUMN is_open_slot BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_lessons_open_slot ON lessons (org_id, is_open_slot) WHERE is_open_slot = true;
```

**New files:**

- `src/components/calendar/SlotGeneratorWizard.tsx` — 3-step wizard (date/time range → slot details → preview/confirm)
- `src/components/calendar/SlotPreviewTimeline.tsx` — Visual timeline preview of generated slots
- `src/hooks/useSlotGenerator.ts` — Mutation hook: generates N lesson rows with `is_open_slot = true`

**Modified files:**

- `src/components/calendar/CalendarDesktopLayout.tsx` — Add "Generate Slots" option in the New Lesson dropdown
- `src/components/calendar/CalendarMobileLayout.tsx` — Same dropdown option
- Lesson card components — Render open slots with dashed border + "Open" badge
- `src/components/calendar/types.ts` — Add `is_open_slot` to `Lesson` interface
- `src/hooks/useCalendarActions.ts` — Add `generateSlots` function
- Make-up booking flow — Show open slots as available options when booking make-ups
- `useCalendarSync.ts` — Batch sync generated slots

**Edge cases:** Cap at 50 slots per batch. Skip conflicting time ranges. All times in org timezone, stored as UTC.

---

## Phase 5: Bulk Edit Lessons (5-7 days)

**New files:**

- `src/components/calendar/BulkSelectBar.tsx` — Floating action bar (bottom of screen, above bottom nav) with count + action buttons
- `src/components/calendar/BulkEditDialog.tsx` — Dialog for applying field changes (location, teacher, status, type)
- `src/hooks/useBulkLessonActions.ts` — Sequential mutation hook with progress tracking

**Modified files:**

- `src/components/calendar/CalendarFiltersBar.tsx` — Add "Select" toggle button
- `src/components/calendar/CalendarDesktopLayout.tsx` — Selection mode state, checkbox overlays on lesson cards
- `src/components/calendar/CalendarMobileLayout.tsx` — Long-press to enter selection mode
- All lesson card/tile components — Checkbox overlay in top-left when selection mode active
- `src/hooks/useCalendarActions.ts` — Add `bulkUpdateLessons` function
- `src/pages/CalendarPage.tsx` — Selection state management, Escape to exit

**Selection state:** `Set<string>` of lesson IDs, persists across view changes within the date range. Sequential updates (not parallel) to avoid RLS/rate limit issues. Single audit log entry per bulk operation.

**Conflict detection:** Run per-lesson in batch for teacher changes. Show warnings, let user override or skip conflicting lessons.

---

## Summary


| #   | Feature                     | New Files | Modified Files | DB Changes  | Effort   |
| --- | --------------------------- | --------- | -------------- | ----------- | -------- |
| 1   | Feature Request Board       | 0         | 2-3            | None        | 30 min   |
| 2   | Student Notes on Attendance | 2         | 2              | None        | 1-2 days |
| 3   | Notes Explorer              | 5         | 2              | None        | 3-4 days |
| 4   | Bulk Slot Generator         | 3         | 6+             | 1 migration | 3-5 days |
| 5   | Bulk Edit Lessons           | 3         | 6+             | None        | 5-7 days |


Total estimated effort: 13-19 days of implementation.