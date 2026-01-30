
# Comprehensive System Integrity Audit & Fix Plan

## Executive Summary

After a thorough systematic review, I've identified **critical architectural inconsistencies** introduced by the partial migration to the new `teachers` table. The system is currently in a **broken state** where frontend components are mixing two incompatible ID schemes:

1. **`teachers.id`** (new): The primary key of the new `teachers` table
2. **`teacher_user_id`** / `auth.users.id` (old): The authentication user ID

This mismatch will cause **lesson creation failures, data corruption, and broken filtering**.

---

## Critical Issues Identified

### P0 - Data Integrity Failures (BLOCKING)

| Component | Issue | Impact |
|-----------|-------|--------|
| **LessonModal.tsx** | Saves `teachers.id` to `teacher_user_id` column | Lessons created with wrong teacher reference - **data corruption** |
| **TeachingDefaultsCard.tsx** | Uses old `org_memberships` query, expects `user_id` | Cannot display or save new `teachers.id` values |
| **TeacherAssignmentsPanel.tsx** | Uses old `teacher_user_id` column | Cannot create assignments for unlinked teachers |
| **DailyRegister.tsx** | Filters by `teacher_user_id === user.id` | Linked teachers see no lessons if DB stores `teachers.id` |
| **CalendarFiltersBar.tsx** | Filter uses `teacher_user_id` | Filtering won't work with new ID scheme |
| **usePayroll.ts** | Queries old `teacher_profiles` table | Payroll will show no data for teachers in new table |

### P1 - Functionality Gaps

| Component | Issue |
|-----------|-------|
| **useConflictDetection.ts** | Availability/time-off checks use `teacher_user_id` |
| **useTeacherAssignments.ts** | Counts use `teacher_user_id` column |
| **StudentDetail.tsx** | Passes `default_teacher_user_id` prop (should be `default_teacher_id`) |
| **useRegisterData.ts** | Teacher filtering uses old ID column |

---

## Database Schema State

The database now has **dual columns** for backward compatibility:

```text
lessons:
  - teacher_user_id (NOT NULL, currently used by app)
  - teacher_id (NULLABLE, new FK to teachers.id)

students:
  - default_teacher_user_id (old)
  - default_teacher_id (new)

student_teacher_assignments:
  - teacher_user_id (old)
  - teacher_id (new)
```

**Problem**: Frontend components are inconsistently using these columns.

---

## Fix Strategy

### Phase 1: Establish Consistency (Critical)

All components must use `teacher_id` (referencing `teachers.id`) as the primary identifier:

**1.1 LessonModal.tsx**
- Rename state from `teacherUserId` to `teacherId`
- Save to BOTH `teacher_user_id` (for backward compat) AND `teacher_id`
- When saving a lesson:
  - Lookup `teachers.user_id` to populate `teacher_user_id` for RLS policies
  - Store `teachers.id` in `teacher_id` column

**1.2 TeachingDefaultsCard.tsx**
- Query `teachers` table instead of `org_memberships`
- Save to `default_teacher_id` column
- Accept and display `defaultTeacherId` prop

**1.3 TeacherAssignmentsPanel.tsx**
- Query `teachers` table for available teachers
- Use `teacher_id` column for assignments
- Display `display_name` from `teachers` table

**1.4 CalendarFiltersBar.tsx & types.ts**
- Change filter from `teacher_user_id` to `teacher_id`
- Update CalendarFilters interface

**1.5 DailyRegister.tsx**
- For linked teachers, lookup their `teachers.id` from `user_id` match
- Filter by `teacher_id` instead of `teacher_user_id`

### Phase 2: Dual-Write Pattern

During transition, all lesson writes should:
1. Accept `teacher_id` (from `teachers` table) as the primary input
2. Lookup `teachers.user_id` to populate `teacher_user_id` for RLS
3. Store both values for compatibility

```typescript
// When creating lesson:
const teacher = teachers.find(t => t.id === selectedTeacherId);
await supabase.from('lessons').insert({
  teacher_id: selectedTeacherId,           // New: teachers.id
  teacher_user_id: teacher?.userId || '',  // Old: for RLS policies
  // ... other fields
});
```

### Phase 3: Update Supporting Hooks

| Hook | Change |
|------|--------|
| `usePayroll.ts` | Query `teachers` table instead of `teacher_profiles` |
| `useConflictDetection.ts` | Accept `teacher_id`, lookup `user_id` for availability checks |
| `useTeacherAssignments.ts` | Use `teacher_id` column |
| `useRegisterData.ts` | Include `teacher_id` in response |

### Phase 4: StudentDetail Integration

- Update `StudentDetail.tsx` to pass `defaultTeacherId` prop
- Update query to fetch `default_teacher_id` column

---

## Files to Modify

### High Priority (P0)
1. `src/components/calendar/LessonModal.tsx` - Use teacher_id, dual-write
2. `src/components/calendar/types.ts` - Update CalendarFilters interface
3. `src/components/calendar/CalendarFiltersBar.tsx` - Use teacher_id
4. `src/components/students/TeachingDefaultsCard.tsx` - Query teachers table
5. `src/components/students/TeacherAssignmentsPanel.tsx` - Full refactor
6. `src/pages/DailyRegister.tsx` - Fix teacher filtering
7. `src/hooks/useCalendarData.ts` - Already fixed, verify

### Medium Priority (P1)
8. `src/hooks/usePayroll.ts` - Query teachers table
9. `src/hooks/useConflictDetection.ts` - Accept teacher_id
10. `src/hooks/useTeacherAssignments.ts` - Use teacher_id
11. `src/hooks/useRegisterData.ts` - Add teacher_id
12. `src/pages/StudentDetail.tsx` - Use default_teacher_id prop

### Low Priority (P2)
13. `src/hooks/useReports.ts` - Update teacher lookups
14. `src/components/invoices/BillingRunWizard.tsx` - Teacher filter

---

## Technical Implementation Notes

### Backward Compatibility
The `teacher_user_id` column must remain populated for:
- Existing RLS policies that check `teacher_user_id = auth.uid()`
- Historical data integrity
- Rollback safety

### Helper Function
Add a utility to lookup teacher details:
```typescript
function getTeacherUserIdFromTeacherId(teacherId: string, teachers: Teacher[]): string | null {
  const teacher = teachers.find(t => t.id === teacherId);
  return teacher?.user_id || null;
}
```

### RLS Policy Updates (Optional Later)
Eventually update RLS to use:
```sql
-- Check if user is the teacher (supports linked teachers)
teacher_id IN (
  SELECT id FROM teachers WHERE user_id = auth.uid()
)
```

---

## Testing Checklist

After implementation, verify:
- [ ] Create lesson with unlinked teacher - saves correctly
- [ ] Create lesson with linked teacher - saves with both IDs
- [ ] Calendar filter by teacher works
- [ ] Daily register shows correct lessons for teacher role
- [ ] Teaching defaults save/display correctly
- [ ] Teacher assignments panel works with new table
- [ ] Payroll report shows teacher data
- [ ] Conflict detection works for both linked/unlinked

---

## Risk Mitigation

1. **Dual-write ensures no data loss** - old columns stay populated
2. **Incremental rollout** - fix one component at a time
3. **Test each component** before proceeding to next
4. **Keep teacher_profiles table** as fallback during transition
