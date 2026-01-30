
# System Integrity Audit - Outstanding Issues

## Audit Summary

After a thorough systematic review of the codebase, I've identified that **the core architecture is correctly implemented** but there are **several remaining inconsistencies** that need to be addressed for the system to be truly flawless.

---

## ✅ What's Working Correctly

| Component | Status | Notes |
|-----------|--------|-------|
| **LessonModal** | ✅ Correct | Dual-write pattern (saves both `teacher_id` and `teacher_user_id`) |
| **Teachers Page** | ✅ Correct | Creates/displays linked & unlinked teachers from `teachers` table |
| **TeachingDefaultsCard** | ✅ Correct | Queries `teachers` table, saves `default_teacher_id` |
| **TeacherAssignmentsPanel** | ✅ Correct | Uses `teacher_id` FK with backward compat `teacher_user_id` |
| **StudentWizard** | ✅ Correct | Saves `default_teacher_id` to students table |
| **TeachingDefaultsStep** | ✅ Correct | Uses `teacherId` referencing `teachers.id` |
| **usePayroll** | ✅ Correct | Queries `teachers_with_pay` view, uses `teacher_id` |
| **useCalendarData** | ✅ Correct | Fetches from `teachers` table |
| **CalendarFiltersBar** | ✅ Correct | Uses `teacher_id` in CalendarFilters interface |
| **invite-accept** | ✅ Correct | Links auth user to existing teacher record by email |
| **csv-import-execute** | ✅ Correct | Creates teachers in new table, dual-write for lessons |

---

## ⚠️ Remaining Issues (P1 - Medium Priority)

### 1. DailyRegister Teacher Filtering
**File:** `src/pages/DailyRegister.tsx` (lines 50-52)

**Issue:** Filters by `teacher_user_id` but lessons created for unlinked teachers will have empty `teacher_user_id` initially.

```typescript
// Current (problematic):
const lessons = allLessons?.filter(lesson => 
  !teacherFilter || lesson.teacher_user_id === teacherFilter
);
```

**Note:** This works for backward compatibility because `LessonModal` does dual-write. The real issue is that `teacherFilter` is set to `user.id`, which should work for linked teachers.

**Verdict:** ⚠️ Works for linked teachers, but the logic should be updated to use `teacher_id` for future-proofing.

---

### 2. useTeacherAssignments Hook (Unused)
**File:** `src/hooks/useTeacherAssignments.ts`

**Issue:** Still queries `teacher_user_id` column but this hook appears to be **superseded by** `useTeacherStudentCounts` in `src/hooks/useTeachers.ts` which correctly queries `teacher_id`.

**Verdict:** 🔧 Legacy code - should be removed or updated, but not actively breaking anything.

---

### 3. useReports - Lessons Delivered & Cancellation Reports
**File:** `src/hooks/useReports.ts` (lines 218-349)

**Issue:** 
- Queries `teacher_user_id` from lessons
- Looks up teacher names from `teacher_profiles` table (legacy)
- Won't show unlinked teachers correctly

**Impact:** Reports may show "Unknown" for lessons taught by unlinked teachers or teachers created via CSV import.

**Fix Required:** Update to query `teacher_id` and lookup names from `teachers` table.

---

### 4. useDeleteValidation - Teacher Removal Checks
**File:** `src/hooks/useDeleteValidation.ts` (lines 163, 181)

**Issue:** Checks for future lessons and assignments using `teacher_user_id`, which won't catch lessons assigned to unlinked teachers.

**Impact:** Could allow deletion of teachers who still have scheduled lessons (if those lessons were created for unlinked teachers).

**Fix Required:** Update checks to use `teacher_id` column.

---

### 5. useTeacherAvailability & Time-Off
**File:** `src/hooks/useTeacherAvailability.ts`

**Issue:** Availability blocks and time-off are stored with `teacher_user_id`, which means **unlinked teachers cannot have availability set**.

**Design Decision:** This is actually **correct behavior** - unlinked teachers don't have user accounts, so they can't set their own availability. Once they accept an invite and become linked, they can manage their availability.

**Verdict:** ✅ Working as designed.

---

### 6. useConflictDetection
**File:** `src/hooks/useConflictDetection.ts`

**Issue:** Checks availability/time-off using `teacher_user_id` passed from LessonModal.

**Current Flow:**
1. LessonModal selects `teacherId` (from `teachers.id`)
2. Looks up `teacherUserId` from the selected teacher
3. Passes `teacher_user_id` to conflict detection

**Verdict:** ✅ Working correctly due to the lookup pattern in LessonModal (line 239-240).

---

### 7. Portal RescheduleSlotPicker
**File:** `src/components/portal/RescheduleSlotPicker.tsx`

**Issue:** Queries availability using `teacher_user_id` from the lesson.

**Verdict:** ✅ Works because lessons store both `teacher_user_id` and `teacher_id`, and linked teachers have valid `user_id`.

---

### 8. Edge Functions - LoopAssist & iCal
**Files:** 
- `supabase/functions/looopassist-execute/index.ts` (line 189)
- `supabase/functions/calendar-ical-feed/index.ts` (line 107)

**Issue:** Still query `teacher_user_id` for lesson filtering/display.

**Impact:** 
- LoopAssist summaries may not include lessons from unlinked teachers
- iCal feeds work correctly (filters by user connection which requires linked teacher)

---

## 📊 Database Schema Verification

The schema is correctly set up with dual columns for backward compatibility:

| Table | New Column | Old Column | Status |
|-------|------------|------------|--------|
| `lessons` | `teacher_id` (nullable FK) | `teacher_user_id` (NOT NULL) | ✅ Both populated |
| `students` | `default_teacher_id` | `default_teacher_user_id` | ✅ New column used |
| `student_teacher_assignments` | `teacher_id` | `teacher_user_id` | ✅ Both populated |

---

## 🔧 Recommended Fixes (Priority Order)

### Phase 1: High Impact (Fix Now)
1. **useReports.ts** - Update to query `teacher_id` and `teachers` table
2. **useDeleteValidation.ts** - Check `teacher_id` column for lesson/assignment counts

### Phase 2: Cleanup (Can Wait)
3. **useTeacherAssignments.ts** - Remove if unused, or update to `teacher_id`
4. **DailyRegister.tsx** - Update filter to use `teacher_id` lookup

### Phase 3: Edge Functions (Low Priority)
5. **looopassist-execute** - Update lesson query to handle both ID columns
6. **calendar-ical-feed** - No change needed (linked teachers only)

---

## Final Assessment

**Overall System Status: 🟡 Functional with Minor Gaps**

The core lesson creation, teacher management, student defaults, and calendar features are working correctly. The dual-write pattern ensures backward compatibility.

The remaining issues are:
- **Reports** - May show "Unknown" for some teachers
- **Delete validation** - May not catch all blocking conditions
- **Legacy hooks** - Should be cleaned up

**Recommendation:** The system is functional for day-to-day operations. The Phase 1 fixes should be implemented before heavy usage of unlinked teachers via CSV import.
