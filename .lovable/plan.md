
# Enhanced Student Creation Flow

## Overview
Transform the student creation experience from a basic form to a cohesive, streamlined workflow that allows creating a complete student profile in one flow - including guardian/payer linking and school assignment.

## Current Problems
1. **Fragmented workflow**: Create student first, then navigate to detail page, then add guardian separately
2. **No school linking**: Students cannot be associated with a school/location where they're taught
3. **No default settings**: Each lesson must manually set teacher, rate, location
4. **Billing friction**: Primary payer not identified at creation time, complicating invoice generation

## Proposed Solution: Multi-Step Student Wizard

Replace the simple dialog with a stepped wizard modal that captures all essential data in one cohesive flow.

### Step 1: Basic Student Info (Required)
- First name, Last name (required)
- Date of birth
- Email, Phone (optional - for older students)
- Notes

### Step 2: Guardian/Payer (Optional but Prompted)
- Toggle: "Add a parent or guardian?"
- If yes, two options:
  - **Link existing guardian** (searchable dropdown of org's guardians)
  - **Create new guardian** (inline form: name, email, phone)
- Relationship dropdown (Mother, Father, Guardian, Other)
- "Primary payer" toggle with helper text explaining billing implications
- Can add multiple guardians if needed

### Step 3: Teaching Defaults (Optional)
- **School/Location**: Dropdown of locations (type=school) where this student is taught
- **Default teacher**: Assign a teacher for quick lesson creation
- **Default rate card**: Pre-select billing rate

### Completion
- Summary card showing what was created
- "View Student" button to go to detail page
- "Add Another Student" to restart wizard

---

## Technical Changes

### 1. Database Migration
Add new columns to `students` table:
```text
- default_location_id (uuid, nullable, FK to locations)
- default_teacher_user_id (uuid, nullable, FK to profiles via user_id)
- default_rate_card_id (uuid, nullable, FK to rate_cards)
```

### 2. New Component: `StudentWizard.tsx`
Location: `src/components/students/StudentWizard.tsx`

Features:
- Multi-step dialog using existing UI components (Dialog, Tabs)
- Step indicator showing progress (1 of 3, 2 of 3, etc.)
- Form state managed with React state (or react-hook-form for validation)
- Handles all three creation steps atomically
- Fallback: If guardian creation fails, student is still saved with warning

### 3. Update `Students.tsx`
- Replace inline Dialog with `<StudentWizard />` component
- Pass callbacks for success/cancel
- Maintain edit functionality in existing inline dialog (or upgrade that too)

### 4. Update `LessonModal.tsx` Defaults
- When creating a lesson for a student, auto-populate:
  - Teacher from `student.default_teacher_user_id`
  - Location from `student.default_location_id`
  - Rate from `student.default_rate_card_id`
- User can override, but defaults reduce clicks

### 5. Update `StudentDetail.tsx` Overview Tab
- Display linked location/school in overview
- Show default teacher and rate card
- Add quick-edit for these defaults

### 6. CSV Import Enhancement (Future)
- Update `csv-import-mapping` and `csv-import-execute` edge functions
- Add mapping for `school_name` / `location_name`
- Match against existing locations or create new school-type location

---

## User Experience Flow

```text
User clicks "Add Student"
        |
        v
+----------------------------------+
|  Step 1: Student Details         |
|  [First Name*] [Last Name*]      |
|  [DOB]                           |
|  [Email] [Phone]                 |
|  [Notes]                         |
|                                  |
|  [Cancel]  [Next: Add Guardian]  |
+----------------------------------+
        |
        v
+----------------------------------+
|  Step 2: Guardian / Payer        |
|                                  |
|  [x] Add a parent or guardian    |
|                                  |
|  ( ) Link existing guardian      |
|      [Dropdown: Select...]       |
|                                  |
|  ( ) Create new guardian         |
|      [Name*] [Email] [Phone]     |
|                                  |
|  Relationship: [Mother v]        |
|  [ ] Primary payer (for billing) |
|                                  |
|  [Back]  [Next: Teaching Setup]  |
+----------------------------------+
        |
        v
+----------------------------------+
|  Step 3: Teaching Defaults       |
|                                  |
|  School/Location (optional)      |
|  [Dropdown: Select location...]  |
|                                  |
|  Default Teacher (optional)      |
|  [Dropdown: Select teacher...]   |
|                                  |
|  Default Rate Card (optional)    |
|  [Dropdown: Select rate...]      |
|                                  |
|  [Back]  [Create Student]        |
+----------------------------------+
        |
        v
+----------------------------------+
|  Success!                        |
|                                  |
|  Created: Emma Wilson            |
|  Guardian: Sarah Wilson (Mother) |
|  School: St Mary's Primary       |
|                                  |
|  [View Student]  [Add Another]   |
+----------------------------------+
```

---

## Benefits

1. **Faster onboarding**: Teachers add complete student profiles in one flow
2. **Billing-ready from day one**: Primary payer identified immediately
3. **Fewer clicks for lessons**: Defaults auto-populate teacher/location/rate
4. **School reporting**: Can filter/report by school location
5. **Matches competitor UX**: Aligns with Teachworks, TutorCruncher patterns

---

## Implementation Order

1. **Phase 1 - Database**: Add new columns to students table
2. **Phase 2 - Wizard Component**: Build `StudentWizard.tsx` with all steps
3. **Phase 3 - Integration**: Replace dialog in `Students.tsx`, update saves
4. **Phase 4 - Defaults**: Update `LessonModal.tsx` to use student defaults
5. **Phase 5 - Detail Page**: Show defaults on student overview
6. **Phase 6 - Polish**: Edit wizard variant, CSV import updates

---

## Out of Scope (Future Enhancements)

- Family/sibling grouping (create one guardian, add multiple students)
- Parent self-registration form (enrolment form like My Music Staff)
- Auto-invite guardian to portal during wizard
- Instrument/subject assignment

