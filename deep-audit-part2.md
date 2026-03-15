# Deep Audit — Part 2: Slot Generator, Bulk Edit, Lesson Notes

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Sections 4–6 of feature audit
**Status:** AUDIT ONLY — no fixes applied

---

## SECTION 4: BULK SLOT GENERATOR

**Files reviewed:**
- `src/components/calendar/SlotGeneratorWizard.tsx` (363 lines)
- `src/hooks/useSlotGenerator.ts` (154 lines)
- `supabase/migrations/20260305173228_*.sql` (is_open_slot column)
- `supabase/functions/create-billing-run/index.ts` (billing run)
- `src/hooks/usePayroll.ts` (payroll report)

---

### [4.1] MEDIUM — Slots can be generated in the past

**File:** `src/components/calendar/SlotGeneratorWizard.tsx:174-179`
**Issue:** The `<Calendar>` date picker has no `disabled` prop to prevent selecting past dates. A user can pick any historical date and generate open slots for it. The `useSlotGenerator.ts` mutation also performs no date validation.
**Impact:** Open slots appearing on past dates are nonsensical — they cannot be booked and clutter the calendar. Could confuse billing/reporting if the date falls within a billing period.
**Fix:** Add `disabled={{ before: new Date() }}` to the `<Calendar>` component. Add server-side validation in the mutation (`if (config.date < startOfDay(new Date())) throw new Error('Cannot generate slots in the past')`).

---

### [4.2] LOW — Safety cap at 50 slots is client-side only (partially)

**File:** `src/hooks/useSlotGenerator.ts:61,78`
**Issue:** `computeSlots()` has a hard break at `i > 50` (line 61). The mutation also checks `activeSlots.length > 50` (line 78). However, these are both client-side checks. There is no server-side (database trigger, edge function, or RLS check) to cap the number of slots created in a single batch. An attacker could call the Supabase insert endpoint directly and bypass both limits.
**Impact:** A malicious or modified client could flood the lessons table with thousands of open slots, creating a denial-of-service condition for the calendar view.
**Fix:** Add a database function or edge function that enforces a maximum slot count per batch (e.g., 50). Alternatively, add a rate-limiting trigger on lessons inserts.

---

### [4.3] HIGH — No conflict detection with existing lessons

**File:** `src/hooks/useSlotGenerator.ts:83-116`
**Issue:** The mutation inserts slots one-by-one in a for loop (lines 83–116) with no check for overlapping lessons for the same teacher at the same time. The `GeneratedSlot` interface has a `conflictMessage` field (line 33), but it is never populated — `computeSlots()` returns all slots without querying existing lessons.
**Impact:** A teacher could end up with double-booked time slots: an existing lesson at 14:00–14:30 and a new open slot at 14:00–14:30. The calendar will show both. Parents could book the open slot, creating a genuine scheduling conflict. There is no database constraint preventing overlapping lessons for the same teacher.
**Fix:** Before generating, query existing lessons for the teacher on the selected date. In `computeSlots()`, mark conflicting slots with `conflictMessage` and `excluded: true`. Also consider a database constraint or trigger to prevent teacher time overlaps.

---

### [4.4] HIGH — Open slots not excluded from billing runs

**File:** `supabase/functions/create-billing-run/index.ts:361-397`
**Issue:** The billing run queries lessons with `status IN ('scheduled', 'completed')` but does NOT filter out `is_open_slot = true`. Open slots are regular lesson rows with `status: 'scheduled'`, meaning they will be picked up by the billing run and potentially invoiced.
**Impact:** Parents could be invoiced for open slots that have no student assigned. In `delivered` billing mode, open slots with status `completed` (if manually marked) would generate invoice line items for zero students. In `upfront` mode, scheduled open slots would be included in counts.
**Fix:** Add `.eq('is_open_slot', false)` (or `.neq('is_open_slot', true)`) to the billing run lesson query. This is the most critical fix — billing correctness is paramount.

---

### [4.5] MEDIUM — Open slots not excluded from payroll report

**File:** `src/hooks/usePayroll.ts:51-57`
**Issue:** The payroll query fetches all lessons with `status: 'completed'` for the date range, without filtering out `is_open_slot = true`. If an open slot is manually marked as completed (or if a bug sets it), it would appear in the teacher's payroll and inflate their pay calculation.
**Impact:** Overpayment to teachers for lessons that never happened. Financial reporting inaccuracy.
**Fix:** Add `.eq('is_open_slot', false)` to the payroll lessons query.

---

### [4.6] HIGH — is_open_slot never set to false when student assigned

**File:** `src/components/calendar/useLessonForm.ts:446-464` (per agent research)
**Issue:** When a student is assigned to a lesson (via lesson_participants insert), the `is_open_slot` column is never updated to `false`. The slot permanently retains `is_open_slot = true` even after it has a student. This compounds the billing issue (4.4) — even "filled" slots remain flagged as open.
**Impact:** Combined with 4.4: the slot is included in billing as an open slot (no student rate applied). Combined with 4.5: the slot appears in payroll regardless. The `is_open_slot` flag becomes meaningless after initial creation.
**Fix:** When adding participants to a lesson with `is_open_slot = true`, update the lesson to set `is_open_slot = false`. Add this to the lesson form save logic or create a database trigger: `AFTER INSERT ON lesson_participants → UPDATE lessons SET is_open_slot = false WHERE id = NEW.lesson_id AND is_open_slot = true`.

---

### [4.7] MEDIUM — No transaction wrapping for batch insert (partial failure orphans slots)

**File:** `src/hooks/useSlotGenerator.ts:83-116`
**Issue:** Slots are inserted one-by-one in a for loop using individual Supabase `.insert()` calls. If slot 25 of 40 fails (e.g., network error, RLS failure), slots 1–24 are already committed and cannot be rolled back. The error is thrown (line 115), which triggers the `onError` toast, but the user is told "Failed to generate slots" even though 24 were created.
**Impact:** Partial slot creation with misleading error message. User may retry, creating duplicate slots for the first 24. No way to identify and clean up the orphaned partial batch.
**Fix:** Use a Supabase edge function with a database transaction, or batch all inserts into a single `.insert([...array])` call. The Supabase client supports multi-row insert: `.from('lessons').insert(allSlotRows)`.

---

### [4.8] LOW — Audit log does not capture individual slot IDs

**File:** `src/hooks/useSlotGenerator.ts:120-134`
**Issue:** The audit log entry records `count`, `date`, `teacher_id`, and `duration_mins` but not the individual `createdIds`. If a partial failure occurs (4.7), the audit log says a certain count was created but doesn't identify which lessons were actually created.
**Impact:** Difficult to audit or undo a slot generation batch. In the partial failure case, the logged count (from `createdIds.length`) is accurate but the IDs are not recorded.
**Fix:** Add `lesson_ids: createdIds` to the audit log `after` payload.

---

## SECTION 5: BULK EDIT LESSONS

**Files reviewed:**
- `src/hooks/useBulkLessonActions.ts` (123 lines)
- `src/components/calendar/BulkEditDialog.tsx` (134 lines)
- `src/components/calendar/BulkSelectBar.tsx` (108 lines)

---

### [5.1] HIGH — No role check: any staff can bulk-edit any teacher's lessons

**File:** `src/hooks/useBulkLessonActions.ts:54-103`
**Issue:** The `bulkUpdate` function updates any lesson by ID with no check on the current user's role or whether they own the lesson. A teacher-role user could select and bulk-edit another teacher's lessons (change teacher, change status, etc.). The only guard is RLS on the `lessons` table — if the RLS policy allows staff to update any lesson in their org (which is typical for `is_org_staff`), then any teacher can modify any lesson.
**Impact:** A teacher could reassign another teacher's lessons to themselves, cancel another teacher's lessons, or change lesson types. This is a privilege escalation — teachers should only be able to bulk-edit their own lessons (admins should be able to edit all).
**Fix:** For teacher-role users, filter `selectedIds` to only include lessons where `teacher_id` matches the current user's teacher record. Or add a frontend guard that prevents non-admin users from entering selection mode for lessons they don't own.

---

### [5.2] HIGH — Bulk-cancel allows cancelling completed lessons

**File:** `src/components/calendar/BulkEditDialog.tsx:18-22` and `src/hooks/useBulkLessonActions.ts:105-107`
**Issue:** The status dropdown in BulkEditDialog includes `completed` and `cancelled` as options (lines 18-22). There is no validation preventing a user from selecting completed lessons and bulk-changing their status to `cancelled`. The `bulkCancel` function (lines 105-107) calls `bulkUpdate({ status: 'cancelled' })` on all selected lessons regardless of current status.
**Impact:** Completed lessons with attendance records and billing could be cancelled, breaking the audit trail. If invoices were already generated for completed lessons, the cancellation creates an inconsistency between billing and lesson status.
**Fix:** Filter out completed lessons from the `bulkCancel` selection, or validate in `bulkUpdate` that completed lessons cannot have their status changed. Add a check: `if (payload.status === 'cancelled') { filter out lessons where status === 'completed' }`.

---

### [5.3] MEDIUM — Bulk-change teacher on lessons with attendance breaks link

**File:** `src/hooks/useBulkLessonActions.ts:67-78`
**Issue:** When bulk-updating `teacher_id`, only the lessons table is updated. If any of the selected lessons have attendance records (which reference the lesson but may be contextually linked to the original teacher), the teacher change creates a data inconsistency. The `teacher_user_id` column on lessons is also not updated — only `teacher_id` is set (line 68).
**Impact:** Payroll and attendance reports show mismatched data: attendance was marked by teacher A, but the lesson now belongs to teacher B. The `teacher_user_id` field (used for calendar filtering) becomes stale.
**Fix:** When changing `teacher_id`, also update `teacher_user_id` by looking up the new teacher's `user_id`. Warn the user if selected lessons have attendance records.

---

### [5.4] LOW — No selection limit across weeks/months

**File:** `src/hooks/useBulkLessonActions.ts:28-35`
**Issue:** `selectedIds` is a `Set<string>` with no size limit. The `selectAll` function (lines 37-39) adds every visible lesson. There is no upper bound on how many lessons can be selected and bulk-edited. If a user views a month of lessons and selects all, they could attempt to update hundreds of lessons sequentially.
**Impact:** Sequential updates (one at a time) on hundreds of lessons would take a very long time, potentially timing out the browser. The progress bar helps visibility but the operation could take minutes.
**Fix:** Add a selection cap (e.g., 50 or 100 lessons) with a user-facing message. Or batch the updates into a single Supabase `.update()` with `.in('id', ids)`.

---

### [5.5] MEDIUM — Navigate away mid-bulk-update loses progress

**File:** `src/hooks/useBulkLessonActions.ts:57-101`
**Issue:** The bulk update loop is a plain `for` loop in a React state callback. If the user navigates away (clicks a link, closes the dialog, switches tabs), the component unmounts but the async loop continues. Supabase calls may still execute after unmount, but React state updates (`setBulkProgress`, `setIsBulkUpdating`) will warn or fail. The `refetch()` at line 102 may target an unmounted component.
**Impact:** Some lessons get updated, others don't, and the user has no feedback about what actually happened. No way to resume or see which lessons were updated.
**Fix:** Use an `AbortController` or `useRef` to track mount status. Cancel remaining updates on unmount. Or use a server-side batch update that completes regardless of client navigation.

---

### [5.6] INFO — Single audit log entry for bulk edit (acceptable but limited)

**File:** `src/hooks/useBulkLessonActions.ts:88-91`
**Issue:** One audit log entry is created for the entire bulk operation, recording `count`, `fields`, and `lesson_ids`. This is a design choice — individual entries would be more granular but would create audit log bloat.
**Impact:** When investigating a specific lesson's history, you'd need to find it in the bulk entry's `lesson_ids` array rather than seeing a direct audit entry. Acceptable trade-off.
**Fix:** No fix needed, but consider also logging `before` values if audit history needs to support undo.

---

### [5.7] LOW — Calendar refetch after edit is triggered correctly

**File:** `src/hooks/useBulkLessonActions.ts:101-102`
**Issue:** After bulk update completes, `exitSelectionMode()` is called (which clears selection) and `refetch()` is called. The `refetch` parameter is passed in from the parent component. This works correctly — the calendar will re-query after the edit.
**Impact:** No issue — the calendar does refetch after bulk edit. This is correctly implemented.
**Fix:** None needed.

---

## SECTION 6: LESSON NOTES SYSTEM

**Files reviewed:**
- `src/hooks/useLessonNotes.ts` (193 lines)
- `src/hooks/useStudentQuickNotes.ts` (69 lines)
- `src/hooks/useNotesExplorer.ts` (190 lines)
- `src/components/calendar/LessonNotesForm.tsx` (363 lines)
- `src/components/register/StudentNotesPopover.tsx` (166 lines)
- `src/pages/NotesExplorer.tsx` (219 lines)
- `src/components/notes/NoteCard.tsx` (126 lines)
- `src/components/notes/NotesStatsBar.tsx` (50 lines)
- `src/components/portal/LessonNoteCard.tsx` (60 lines)
- `supabase/migrations/20260225001655_*.sql` (RLS policies)

---

### DATA MODEL SUMMARY

**Table:** `lesson_notes`
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | PK | |
| lesson_id | uuid | NOT NULL | FK → lessons(id) ON DELETE CASCADE |
| student_id | uuid | nullable | FK → students(id) ON DELETE SET NULL; null = whole-lesson note |
| teacher_id | uuid | NOT NULL | FK → teachers(id) |
| org_id | uuid | NOT NULL | FK → organisations(id) |
| content_covered | text | nullable | |
| homework | text | nullable | |
| focus_areas | text | nullable | |
| engagement_rating | integer | nullable | CHECK 1–5 |
| teacher_private_notes | text | nullable | |
| parent_visible | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Key design points:**
- One note per teacher per lesson per student (or whole-lesson)
- No unique constraint on (lesson_id, student_id, teacher_id) — duplicate notes possible
- Note CAN exist without student_id (whole-lesson note) but NOT without lesson_id
- org_id is on every row ✓
- ON DELETE CASCADE on lesson_id: deleting a lesson removes all its notes
- ON DELETE SET NULL on student_id: deleting a student orphans the note (student_id → null)

---

### RLS POLICIES (from migration 20260225001655)

```sql
-- 1. Staff SELECT: any org staff can view all notes in their org
CREATE POLICY "Staff can view lesson notes in their org"
  ON public.lesson_notes FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

-- 2. Staff INSERT: any org staff can insert
CREATE POLICY "Teachers can insert lesson notes"
  ON public.lesson_notes FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));

-- 3. UPDATE: only own notes or admin
CREATE POLICY "Teachers can update own lesson notes"
  ON public.lesson_notes FOR UPDATE
  USING (
    teacher_id = public.get_teacher_id_for_user(auth.uid(), org_id)
    OR public.is_org_admin(auth.uid(), org_id)
  );

-- 4. DELETE: admin only
CREATE POLICY "Admins can delete lesson notes"
  ON public.lesson_notes FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- 5. Parent SELECT: visible notes for their children's lessons
CREATE POLICY "Parents can view visible lesson notes for their children"
  ON public.lesson_notes FOR SELECT
  USING (
    parent_visible = true
    AND EXISTS (
      SELECT 1 FROM public.lesson_participants lp
      WHERE lp.lesson_id = lesson_notes.lesson_id
        AND public.is_parent_of_student(auth.uid(), lp.student_id)
    )
  );
```

---

### [6.1] HIGH — Teacher can see ALL other teachers' private notes (including teacher_private_notes content)

**File:** `supabase/migrations/20260225001655_*.sql` — RLS policy "Staff can view lesson notes in their org"
**Issue:** The staff SELECT policy uses `is_org_staff(auth.uid(), org_id)` which grants SELECT on ALL columns of ALL notes in the org. This means Teacher A can query Teacher B's `teacher_private_notes` content via the Supabase client. The frontend hides private notes from non-admins in `NoteCard.tsx:101` (`{isAdmin && note.teacher_private_notes && ...}`), but this is UI-only — the data is already fetched and present in the response.
**Impact:** Any teacher can read another teacher's confidential observations about students by inspecting the network response or calling the Supabase API directly. This violates the expectation that `teacher_private_notes` are visible only to the authoring teacher and admins.
**Fix:** Change the RLS policy to either: (a) exclude `teacher_private_notes` from the SELECT for non-owner teachers (requires a view or column-level security), or (b) split private notes into a separate table with stricter RLS, or (c) modify the staff SELECT policy to only return `teacher_private_notes` when `teacher_id = get_teacher_id_for_user(auth.uid(), org_id) OR is_org_admin(auth.uid(), org_id)`. Since Postgres RLS is row-level not column-level, option (b) or a secure view is most practical.

---

### [6.2] MEDIUM — Teacher can EDIT another teacher's notes (UI allows, RLS blocks — but confusing)

**File:** `src/hooks/useLessonNotes.ts:127-175` and RLS UPDATE policy
**Issue:** The `useSaveLessonNote` mutation resolves the current user's `teacher_id` and always sets it on the note (line 143). When updating an existing note (line 154), it uses `.eq('id', input.id)` — but the RLS UPDATE policy requires `teacher_id = get_teacher_id_for_user(auth.uid(), org_id) OR is_org_admin`. So a teacher attempting to update another teacher's note would get a silent RLS failure (0 rows updated, no error thrown by Supabase). The frontend would show "Lesson notes saved" even though nothing was actually saved.
**Impact:** Silent data loss — teacher thinks they saved notes but the update was silently rejected. No error message to the user.
**Fix:** After update, check that `data` is returned (not null). If the update returned 0 rows, show an error: "You can only edit your own notes." Or add a frontend guard that disables editing for notes with a different `teacher_id`.

---

### [6.3] CRITICAL — Parent can see teacher_private_notes for parent_visible=true notes via RLS

**File:** `supabase/migrations/20260225001655_*.sql` — Parent SELECT policy
**Issue:** The parent SELECT policy grants access to the entire row when `parent_visible = true`. This includes the `teacher_private_notes` column. While the parent portal component (`LessonNoteCard.tsx`) does NOT display `teacher_private_notes`, the data IS returned by the database to the parent's browser. A parent could inspect the network response or call the Supabase API directly to read `teacher_private_notes`.
**Impact:** Confidential teacher observations about students (e.g., "student seems distressed", "parent is difficult", "possible learning difficulty") are exposed to parents. This is a data privacy violation and could cause serious relationship damage between the school and families.
**Fix:** Either: (a) Create a Postgres view for parent access that excludes `teacher_private_notes` and `engagement_rating` (if desired), or (b) use a server-side function (RPC) for parent note queries that omits sensitive columns, or (c) add a row-level function that nullifies `teacher_private_notes` for parent-role users (complex but possible with Postgres security policies).

---

### [6.4] MEDIUM — engagement_rating visible to parents via RLS and portal component

**File:** `src/components/portal/LessonNoteCard.tsx:52-56` and RLS parent SELECT policy
**Issue:** The parent SELECT policy returns all columns, including `engagement_rating`. The `LessonNoteCard` component explicitly displays `engagementRating` to parents (line 52-54). This is a design decision, but the rating (1-5 scale) may not be intended for parent consumption — it's a teacher's internal assessment of student engagement.
**Impact:** Parents seeing a low engagement rating (1 or 2) could be upset or confrontational. Teachers may self-censor their ratings knowing parents can see them, reducing the feature's utility for internal tracking.
**Fix:** Confirm with stakeholders whether `engagement_rating` should be parent-visible. If not, remove it from `LessonNoteCard.tsx` and exclude it from the parent query/view.

---

### [6.5] MEDIUM — Toggle parent_visible ON — parent sees immediately (no delay/review)

**File:** `src/hooks/useLessonNotes.ts:154-161` and RLS parent policy
**Issue:** When a teacher sets `parent_visible = true` and saves, the note becomes immediately visible to parents via RLS. There is no review step, no scheduled publication, and no confirmation like "This will be visible to parents immediately. Are you sure?"
**Impact:** A teacher could accidentally leave `parent_visible = true` (the default) and save notes with sensitive content. The parent would see the note on their next portal load.
**Fix:** Add a confirmation dialog when saving with `parent_visible = true` if `teacher_private_notes` is non-empty (to warn about the data exposure in 6.3). Consider defaulting `parent_visible` to `false` and requiring explicit opt-in.

---

### [6.6] LOW — Toggle parent_visible OFF after creation — disappears from portal correctly

**File:** RLS parent SELECT policy: `parent_visible = true`
**Issue:** If a teacher toggles `parent_visible` from `true` to `false` and saves, the RLS policy will immediately stop returning the note to parents. This works correctly — the note disappears from the parent portal on next load.
**Impact:** No issue with the toggle-off behavior. However, there is no notification to the parent that a previously-visible note was retracted, which could be confusing if they had already read it.
**Fix:** Consider logging when `parent_visible` changes from true to false as an audit event.

---

### [6.7] MEDIUM — Notes stats bar count does not match visible notes when filters applied

**File:** `src/hooks/useNotesExplorer.ts:144-189` vs `src/hooks/useNotesExplorer.ts:46-142`
**Issue:** `useNotesStats` (line 144) only filters by `startDate`, `endDate`, and `teacherId`. It does NOT apply `studentId`, `visibilityFilter`, or `searchQuery` filters. Meanwhile, `useNotesExplorer` (line 46) applies all five filters. When a user filters by student or searches for text, the stats bar still shows the unfiltered count.
**Impact:** The stats bar shows "42 Total Notes" but the list below only shows 8 notes (filtered by student). Users may think notes are missing or the filter is broken.
**Fix:** Pass all filter parameters to `useNotesStats` and apply the same filtering. Update the query key to include all filters (currently only includes `startDate`, `endDate`, `teacherId` — line 148).

---

### [6.8] MEDIUM — Teacher "Private only" filter shows ALL teachers' private notes

**File:** `src/hooks/useNotesExplorer.ts:81-85`
**Issue:** The visibility filter `private` sets `.eq('parent_visible', false)`. For a teacher-role user, this returns ALL non-parent-visible notes in the org (due to the staff SELECT RLS policy from 6.1). Combined with 6.1, a teacher can filter to "Private only" and see every teacher's private notes, including `teacher_private_notes` content.
**Impact:** Amplifies the privacy issue from 6.1. The "Private only" filter becomes a convenient way for any teacher to browse all private notes across the org.
**Fix:** For teacher-role users, auto-filter by their own `teacher_id` when `visibilityFilter === 'private'`. Or fix the root cause (6.1) by restricting the RLS policy.

---

### [6.9] LOW — CSV export correctly excludes teacher_private_notes

**File:** `src/pages/NotesExplorer.tsx:68-91`
**Issue:** None — the CSV export columns are: Date, Time, Student, Teacher, Content Covered, Homework, Focus Areas, Engagement, Parent Visible. `teacher_private_notes` is NOT included. This is correct.
**Impact:** No issue.
**Fix:** None needed.

---

### [6.10] LOW — PDF export correctly excludes teacher_private_notes

**File:** `src/pages/NotesExplorer.tsx:94-139`
**Issue:** None — the PDF export renders content_covered and homework but NOT teacher_private_notes. This is correct.
**Impact:** No issue.
**Fix:** None needed.

---

### [6.11] MEDIUM — No unique constraint allows duplicate notes per lesson/student/teacher

**File:** `supabase/migrations/20260225001655_*.sql` — table definition
**Issue:** There is no unique constraint on `(lesson_id, student_id, teacher_id)`. A teacher could save notes multiple times and create duplicate note rows for the same lesson+student combination. The `useSaveLessonNote` hook tries to prevent this by passing `id` for existing notes, but if two tabs are open or the initial load doesn't find the existing note, a duplicate is created.
**Impact:** Duplicate notes appear in the Notes Explorer. The `useStudentLessonNotes` hook would show multiple entries for the same lesson. Stats counts would be inflated.
**Fix:** Add a unique constraint: `ALTER TABLE lesson_notes ADD CONSTRAINT uq_lesson_notes_lesson_student_teacher UNIQUE (lesson_id, student_id, teacher_id)`. Use `ON CONFLICT ... DO UPDATE` (upsert) in the insert mutation.

---

### [6.12] LOW — Notes for deleted students become orphaned (student_id SET NULL)

**File:** `supabase/migrations/20260225001655_*.sql` — `ON DELETE SET NULL` on student_id FK
**Issue:** When a student is deleted, their notes have `student_id` set to NULL. These notes then look like whole-lesson notes (since `student_id IS NULL` is the marker for whole-lesson notes). They would appear in queries filtering for whole-lesson notes.
**Impact:** Orphaned per-student notes masquerade as whole-lesson notes after student deletion. They inflate the Notes Explorer counts and could confuse teachers reviewing lesson history.
**Fix:** Change to `ON DELETE CASCADE` (delete notes when student is deleted), or change to a soft-delete pattern for students. Alternatively, add a `deleted_student_id` column to preserve the association without the FK.

---

### [6.13] LOW — Notes for deleted lessons are cascade-deleted (correct)

**File:** `supabase/migrations/20260225001655_*.sql` — `ON DELETE CASCADE` on lesson_id FK
**Issue:** None — when a lesson is deleted, all associated notes are automatically deleted. This is the correct behavior.
**Impact:** No issue.
**Fix:** None needed.

---

### [6.14] INFO — useNotesExplorer non-admin private notes guard is a no-op

**File:** `src/hooks/useNotesExplorer.ts:128-134`
**Issue:** Lines 128-134 have a comment "Hide private notes from other teachers (non-admins)" but the code is a no-op — it maps notes through unchanged: `return n;`. The comment says "we'll rely on RLS" but per finding 6.1, RLS doesn't hide `teacher_private_notes` from other teachers.
**Impact:** The intended privacy protection was not implemented. Combined with 6.1, this means the data is both fetched AND available in the client state for any teacher.
**Fix:** Either implement the filtering here (`if (n.teacher_id !== currentTeacherId) return { ...n, teacher_private_notes: null }`) or fix the RLS policy (preferred, see 6.1).

---

## SEVERITY SUMMARY

| Severity | Count | Findings |
|----------|-------|----------|
| CRITICAL | 1 | 6.3 |
| HIGH | 4 | 4.3, 4.4, 5.1, 6.1 |
| MEDIUM | 8 | 4.1, 4.5, 4.7, 5.3, 5.5, 6.5, 6.7, 6.8, 6.2, 6.4, 6.11 |
| LOW | 5 | 4.2, 4.8, 5.4, 6.6, 6.9, 6.10, 6.12, 6.13 |
| INFO | 2 | 5.6, 5.7, 6.14 |

### TOP 5 PRIORITY FIXES

1. **[6.3] CRITICAL** — Parent can read `teacher_private_notes` via RLS (data in network response)
2. **[4.4] HIGH** — Open slots included in billing runs (financial impact)
3. **[6.1] HIGH** — Teachers can read each other's private notes via RLS
4. **[5.1] HIGH** — No role check on bulk edit (teacher can edit other teacher's lessons)
5. **[4.3] HIGH** — No conflict detection when generating slots (double-booking)
