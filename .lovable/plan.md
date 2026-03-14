

## Plan: Fix Onboarding Checklist Auto-Advance + Teacher Assignment Persistence

### BUG 1: Checklist doesn't auto-advance

**Root Cause:** The checklist steps link users to `/students`, `/teachers`, `/locations` pages. After creating an item there, the user stays on that page. The `onboarding-progress` query (which powers the checklist) is never invalidated after creation, so even navigating back manually wouldn't refresh it without a full page reload.

**Fix:** In `StudentWizard.tsx`, the `onSuccess` callback already fires and `queryClient.invalidateQueries` is called for `usage-counts`. Simply add invalidation for `onboarding-progress` too. The same needs to happen in the teacher creation flow (`Teachers.tsx`) and location creation flow. The `FirstRunExperience` component on the dashboard will automatically re-derive the current step when the query data updates.

No navigation change is needed — the checklist widget on `/dashboard` already updates reactively. The user just needs to go back to `/dashboard` (which they naturally do). The key fix is ensuring the query cache is invalidated so data is fresh when they return.

**Files to modify:**
- `src/components/students/StudentWizard.tsx` — add `queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })` after student creation (line ~303)
- `src/pages/Teachers.tsx` — add same invalidation after teacher creation
- Check location creation for same pattern

### BUG 2: Teacher selection doesn't persist to `student_teacher_assignments`

**Root Cause:** In `StudentWizard.tsx` line 188-190, the `teachingData.teacherId` is saved to `students.default_teacher_id` (a column on the students table). However, **no row is inserted into `student_teacher_assignments`**, which is the junction table that the Teachers tab reads from. The `default_teacher_id` is just a convenience field for pre-populating lesson forms — it doesn't create an actual teacher-student relationship.

**Fix:** After the student is created (line ~200), if `teachingData.teacherId` is set, insert a row into `student_teacher_assignments` with:
- `org_id`: currentOrg.id
- `student_id`: createdStudent.id  
- `teacher_id`: teachingData.teacherId
- `teacher_user_id`: fetched from the teachers table (need to look up the teacher's `user_id`)
- `is_primary`: true

To get the `teacher_user_id`, we need to either:
- Fetch it from the `teachers` table at insert time, OR
- Extend `TeachingDefaultsStep` to also expose the selected teacher's `user_id`

The simplest approach: after student creation, if `teachingData.teacherId` is set, query the `teachers` table for that teacher's `user_id`, then insert into `student_teacher_assignments`.

**File to modify:**
- `src/components/students/StudentWizard.tsx` — Add ~10 lines after student creation (around line 216) to insert the teacher assignment

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/students/StudentWizard.tsx` | Insert `student_teacher_assignments` row when teacher selected; invalidate `onboarding-progress` query |
| `src/pages/Teachers.tsx` | Invalidate `onboarding-progress` query after teacher creation |

