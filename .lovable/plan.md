
# Plan: Auto-Populate Teaching Defaults in LessonModal

## Overview
When a user selects a student for a **private lesson** (1:1), the system will automatically populate the Teacher, Location, and Rate Card from that student's saved defaults. This reduces clicks and speeds up scheduling for administrative staff.

---

## Technical Changes

### 1. Expand Student Data in `useCalendarData.ts`

**File**: `src/hooks/useCalendarData.ts`

Currently, the `students` query only fetches:
```
id, first_name, last_name
```

We need to expand it to include:
```
id, first_name, last_name, default_location_id, default_teacher_user_id, default_rate_card_id
```

The student type will be updated to:
```typescript
{
  id: string;
  name: string;
  default_location_id: string | null;
  default_teacher_user_id: string | null;
  default_rate_card_id: string | null;
}
```

---

### 2. Update Student Selection Logic in `LessonModal.tsx`

**File**: `src/components/calendar/LessonModal.tsx`

Modify the `handleStudentToggle` function to:
1. When selecting a student for a **private lesson** (not editing an existing lesson)
2. Look up the student's defaults
3. Auto-populate Teacher, Location if they exist in the available options
4. Only populate if the field is currently empty (don't override user selections)

```text
handleStudentToggle(studentId)
  |
  v
[Is this a new private lesson (not editing)?]
  |
  +--> Yes --> [Find student in list]
  |             |
  |             v
  |            [If student.default_teacher_user_id exists and teacherUserId is empty]
  |             --> setTeacherUserId(student.default_teacher_user_id)
  |            [If student.default_location_id exists and locationId is null]
  |             --> setLocationId(student.default_location_id)
  |             
  +--> No --> [Skip auto-populate (editing existing lesson)]
```

---

### 3. Update Type Definition

**File**: `src/components/calendar/types.ts` (if needed)

Ensure the student type returned from the hook matches the new shape.

---

## User Experience

```text
User clicks "New Lesson"
        |
        v
+----------------------------------+
|  New Lesson                      |
|                                  |
|  Lesson Type: [Private]          |
|                                  |
|  Teacher: [Select teacher...]    |  <-- Empty initially
|  Student: [Select student...]    |  <-- Empty initially
|  Location: [Select location...]  |  <-- Empty initially
|                                  |
+----------------------------------+
        |
   User selects "Sophie Richards"
        |
        v
+----------------------------------+
|  New Lesson                      |
|                                  |
|  Lesson Type: [Private]          |
|                                  |
|  Teacher: [Jamie McKaye]         |  <-- Auto-populated!
|  Student: [Sophie Richards]      |  <-- User selected
|  Location: [Burhill]             |  <-- Auto-populated!
|                                  |
+----------------------------------+
```

- If the user has already selected a teacher or location before choosing the student, those selections are **preserved** (no override)
- Only empty fields are populated
- Works for private lessons only (group lessons may have multiple students with different defaults)

---

## Implementation Steps

1. Update `useCalendarData.ts`:
   - Modify the students query to include defaults
   - Update the return type mapping

2. Update `LessonModal.tsx`:
   - Expand the `handleStudentToggle` function
   - Add logic to check if we're creating a new lesson
   - Auto-populate teacher and location if defaults exist and fields are empty

---

## Edge Cases Handled

- **No defaults set**: Nothing happens, fields stay empty
- **Defaults point to deleted/inactive teacher/location**: Check against available `teachers` and `locations` arrays before setting
- **Editing existing lesson**: Skip auto-populate to preserve user's previous choices
- **Group lessons**: Skip auto-populate (which student's defaults would we use?)
- **User already selected values**: Don't override
