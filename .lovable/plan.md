

# Fix Critical Bugs: Student Detail Page + Invoice Date Format

## Problem Summary

The Student Detail page is completely broken -- both the Lessons and Invoices tabs fail with 400 errors due to schema mismatches between the code and database. Additionally, the Student interface is missing the `default_teacher_id` field, and date filters use US format placeholders instead of UK.

---

## Bug 1: Student Lessons Query (CRITICAL)

**File:** `src/hooks/useStudentDetail.ts` -- `useStudentLessons`

The query references columns that don't exist on the `lessons` table:

| Code references | Actual DB column |
|----------------|-----------------|
| `start_time` | `start_at` |
| `end_time` | `end_at` |
| `subject` | `title` |
| `attendance_status` on `lesson_participants` | Does not exist -- lives on `attendance_records` table |
| `profiles!lessons_teacher_user_id_fkey` | No such FK -- teacher FK is `lessons_teacher_id_fkey` pointing to `teachers` table |

**Fix:**
- Rewrite the Supabase query to use correct column names: `start_at`, `end_at`, `title`
- Join teacher via `teacher:teachers!lessons_teacher_id_fkey(display_name)` instead of `profiles`
- Remove `attendance_status` from `lesson_participants` select (column doesn't exist there)
- Fetch attendance separately: after getting lesson IDs, query `attendance_records` filtered by `student_id` and the lesson IDs to get attendance per lesson
- Update the `StudentLesson` interface to use `start_at`, `end_at`, `title` instead of `start_time`, `end_time`, `subject`

**Updated query approach:**
```
lesson_participants -> lessons!inner (id, start_at, end_at, status, title, locations(name), teacher:teachers!lessons_teacher_id_fkey(display_name))
```
Then a second query to `attendance_records` for the student + lesson IDs to map attendance status per lesson.

---

## Bug 2: Student Invoices Query (CRITICAL)

**File:** `src/hooks/useStudentDetail.ts` -- `useStudentInvoices`

Two issues:
1. Uses explicit FK hint syntax (`guardians!invoices_payer_guardian_id_fkey`) which may cause PostgREST ambiguity errors
2. The `StudentInvoice` interface uses `total_amount_pence` but the actual DB column is `total_minor`

**Fix:**
- Use the simpler relationship syntax that works in `useInvoices.ts`: `payer_guardian:guardians(full_name)` and `payer_student:students(first_name, last_name)`
- Update `StudentInvoice` interface: rename `total_amount_pence` to `total_minor`
- Update the mapping function accordingly

---

## Bug 3: Student Interface Missing `default_teacher_id`

**File:** `src/pages/StudentDetail.tsx`

The `Student` interface (line 41-53) has `default_teacher_user_id` but not `default_teacher_id`. The `TeachingDefaultsCard` is already using a workaround: `(student as any).default_teacher_id`. The DB has both columns, but `default_teacher_id` (FK to `teachers` table) is the one being used by the seeder and by `TeachingDefaultsCard`.

**Fix:**
- Add `default_teacher_id: string | null` to the `Student` interface
- Remove the `as any` cast on line 539 and use `student.default_teacher_id` directly

---

## Bug 4: Lesson Display Uses Old Field Names

**File:** `src/pages/StudentDetail.tsx` (lines 680-710)

The lesson rendering template references `sl.lesson.start_time`, `sl.lesson.subject`, `sl.lesson.teacher_name`. These need to match the updated interface.

**Fix:**
- `sl.lesson.start_time` -> `sl.lesson.start_at`
- `sl.lesson.subject` -> `sl.lesson.title`
- `sl.lesson.teacher_name` -> `sl.lesson.teacher_name` (keep, but sourced from `teachers.display_name`)

---

## Bug 5: Invoice Display Uses `total_amount_pence`

**File:** `src/pages/StudentDetail.tsx` (line 750)

References `inv.total_amount_pence` which needs to match the updated interface.

**Fix:**
- `inv.total_amount_pence` -> `inv.total_minor`

---

## Bug 6: UK Date Format (LOW)

**File:** `src/components/invoices/InvoiceFiltersBar.tsx`

The `<input type="date">` elements show browser-default `mm/dd/yyyy` placeholders. While the actual date picker behaviour is browser-controlled, we can add a `placeholder` attribute for browsers that support it.

**Fix:**
- This is actually controlled by the browser locale, not by placeholder attributes on `type="date"` inputs. The `type="date"` input renders a native date picker whose format follows the user's OS/browser locale settings. No code change needed here -- this is a non-issue since UK users will see `dd/mm/yyyy` natively.

---

## Files to Change

### 1. `src/hooks/useStudentDetail.ts` (full rewrite of both hooks)

**`StudentLesson` interface changes:**
- `start_time` -> `start_at`
- `end_time` -> `end_at`
- `subject` -> `title`

**`StudentInvoice` interface changes:**
- `total_amount_pence` -> `total_minor`

**`useStudentLessons` query rewrite:**
- Fix column names in select: `start_at`, `end_at`, `title`
- Join teacher via `teacher:teachers!lessons_teacher_id_fkey(display_name)`
- Remove `attendance_status` from `lesson_participants`
- Add a second query to `attendance_records` to get attendance per lesson for this student
- Merge attendance data into the returned results

**`useStudentInvoices` query rewrite:**
- Remove FK hint syntax from both query locations (lines 119-120 and 150-151)
- Use simple syntax: `payer_guardian:guardians(full_name)`, `payer_student:students(first_name, last_name)`
- Map `total_minor` instead of `total_amount_pence`

### 2. `src/pages/StudentDetail.tsx`

**Interface fix (line 41-53):**
- Add `default_teacher_id: string | null` to the `Student` interface

**TeachingDefaultsCard prop fix (line 539):**
- Change `(student as any).default_teacher_id || null` to `student.default_teacher_id`

**Lesson rendering fix (lines 680-710):**
- `sl.lesson.start_time` -> `sl.lesson.start_at` (two occurrences on line 685)
- `sl.lesson.subject` -> `sl.lesson.title` (line 701)

**Invoice rendering fix (line 750):**
- `inv.total_amount_pence` -> `inv.total_minor`

---

## Expected Outcome

After these fixes:
- Student detail Lessons tab will load all lessons with correct dates, titles, teacher names, location names, and attendance status
- Student detail Invoices tab will load all invoices with correct amounts, payer names, dates, and statuses
- Teaching defaults card will properly display teacher assignments without type casting hacks
- All 315 students in the demo data will have fully functional detail pages

