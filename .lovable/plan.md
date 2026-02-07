
# Fix Plan: Calendar Display, Conflict Detection, and Account Setup

## Issues Found

### 1. Duplicate Lessons in the Database
There are **3 lessons for Jamie Mckaye at exactly the same time** (Feb 9, 09:00-10:00):
- 2 standalone lessons (no recurrence link -- likely created during earlier bug testing)
- 1 lesson from the recurring Monday series

These are stacking on top of each other, which is why the calendar looks "malformed."

### 2. No Overlap Layout in the Calendar
When multiple lessons share the same time slot, the calendar renders them **directly on top of each other** with identical positioning. There is no side-by-side column algorithm, so overlapping events appear garbled.

### 3. Conflict Detection Gap for Unlinked Teachers
When a teacher does not have a user account (teacher_user_id is null), **all teacher overlap checks are skipped**. This means the system happily lets you create duplicate lessons at the same time for the same teacher. The system should use the `teacher_id` column (from the teachers table) as a fallback for overlap detection.

### 4. Lauren's Account Status
Lauren (laurentwilleypiano@gmail.com) already has the **owner** role and the **agency** plan, but her subscription status shows as "trialing". This needs to be switched to "active" permanently.

---

## Fix Steps

### Step 1: Clean Up Duplicate Lessons (Database)
Delete the 2 standalone duplicate lessons for Jamie Mckaye on Feb 9 that were created during bug testing. Keep the one that belongs to the recurring series.

### Step 2: Fix Conflict Detection for Unlinked Teachers
Update `useConflictDetection.ts` to add a new `checkTeacherLessonsByTeacherId` function that queries by `teacher_id` (from the teachers table) instead of `teacher_user_id`. When `teacher_user_id` is null but `teacher_id` is provided, this check will run instead -- preventing duplicate bookings for teachers without login accounts.

### Step 3: Add Overlap Layout to CalendarGrid
Add a column-based overlap algorithm to `CalendarGrid.tsx` that:
- Groups lessons that share overlapping time ranges
- Assigns each overlapping lesson a column index and total column count
- Renders them side-by-side (e.g., 2 overlapping lessons each get 50% width) instead of stacking

This is a standard calendar layout algorithm used by Google Calendar, Outlook, etc.

### Step 4: Set Lauren's Subscription to Active Agency
Run a database update to set her organisation's `subscription_status` to `active` and clear the trial end date so she has permanent, unrestricted agency access.

---

## Technical Details

### Overlap Layout Algorithm (Step 3)
```text
Before (current):
+------------------+
| Lesson A         |  <-- Lesson B renders BEHIND this, invisible
| 09:00 - 10:00    |
+------------------+

After (fix):
+---------+---------+
| Lesson  | Lesson  |
| A       | B       |
| 09:00   | 09:00   |
+---------+---------+
```

The algorithm groups lessons into "overlap clusters" where any lesson that overlaps in time with another is in the same cluster. Each lesson in a cluster gets a column index and the total number of columns, which determines its left offset and width within the day column.

### Conflict Detection Fix (Step 2)
The `LessonModal` will pass `teacher_id` alongside `teacher_user_id` to the conflict checker. A new parallel check will query the `lessons` table filtering by `teacher_id` (not `teacher_user_id`) to catch overlaps for unlinked teachers.

### Files Modified
- `src/components/calendar/CalendarGrid.tsx` -- overlap layout algorithm
- `src/hooks/useConflictDetection.ts` -- teacher_id-based conflict check
- `src/components/calendar/LessonModal.tsx` -- pass teacher_id to conflict checker
- Database migration -- clean up duplicates + update Lauren's subscription
