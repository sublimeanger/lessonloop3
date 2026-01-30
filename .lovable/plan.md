
# Unlinked Teacher Records Architecture

## Problem Statement

Currently, teachers in LessonLoop **must** have an authentication account to be fully functional. This creates friction for real-world music schools where:

- External contractors may never need to log in
- Peripatetic teachers work across multiple schools
- Historical records need teachers who no longer work there
- CSV imports need to reference teachers who haven't been invited yet

The current architecture ties `teacher_user_id` to `auth.users(id)` in several places, blocking the creation of "unlinked" teacher records.

---

## Current Architecture

| Table | Column | Constraint |
|-------|--------|------------|
| `teacher_profiles` | `user_id` | FK to `auth.users(id)` **ON DELETE CASCADE** |
| `student_teacher_assignments` | `teacher_user_id` | FK to `auth.users(id)` **ON DELETE CASCADE** |
| `lessons` | `teacher_user_id` | NOT NULL, **no FK** (uuid only) |
| `students` | `default_teacher_user_id` | nullable, **no FK** |
| `practice_assignments` | `teacher_user_id` | NOT NULL, **no FK** |
| `availability_blocks` | `teacher_user_id` | NOT NULL, **no FK** |
| `time_off_blocks` | `teacher_user_id` | NOT NULL, **no FK** |

---

## Proposed Solution

Create a dedicated **`teachers` table** that decouples teacher records from authentication:

```text
teachers
├── id (uuid, PK)
├── org_id (FK to organisations)
├── user_id (FK to auth.users, NULLABLE) -- linked when they sign up
├── display_name (text, required)
├── email (text, optional) -- for matching during invite
├── phone (text, optional)
├── instruments (text[])
├── employment_type (enum)
├── pay_rate_type (enum)
├── pay_rate_value (numeric)
├── payroll_notes (text)
├── bio (text)
├── status (enum: active, inactive)
├── created_at, updated_at
```

### Migration Strategy

1. Create new `teachers` table with nullable `user_id`
2. Migrate existing `teacher_profiles` data into new `teachers` table
3. Add `teacher_id` column to affected tables (lessons, students, etc.)
4. Update application code to use `teacher_id` for lookups
5. Update CSV import to create unlinked teachers
6. Add "Link Account" flow when teacher accepts invite

---

## Database Changes

### New Table: `teachers`

```sql
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- nullable!
  display_name text NOT NULL,
  email text,
  phone text,
  instruments text[] NOT NULL DEFAULT '{}',
  employment_type employment_type NOT NULL DEFAULT 'contractor',
  pay_rate_type pay_rate_type,
  pay_rate_value numeric(10,2),
  payroll_notes text,
  bio text,
  status student_status NOT NULL DEFAULT 'active', -- reuse enum
  default_lesson_length_mins integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, email) -- prevent duplicates by email within org
);
```

### Alter Existing Tables

```sql
-- Add teacher_id (FK to new teachers table)
ALTER TABLE public.lessons ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN default_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.student_teacher_assignments ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;
ALTER TABLE public.availability_blocks ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;
ALTER TABLE public.time_off_blocks ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;
ALTER TABLE public.practice_assignments ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
```

### Data Migration

```sql
-- Migrate from teacher_profiles to teachers
INSERT INTO public.teachers (org_id, user_id, display_name, instruments, employment_type, ...)
SELECT org_id, user_id, COALESCE(display_name, p.full_name), instruments, employment_type, ...
FROM public.teacher_profiles tp
JOIN public.profiles p ON p.id = tp.user_id;

-- Update lessons with teacher_id based on teacher_user_id
UPDATE public.lessons l SET teacher_id = t.id
FROM public.teachers t WHERE l.teacher_user_id = t.user_id AND l.org_id = t.org_id;
```

---

## Application Code Changes

### Teachers Page
- Add ability to create "unlinked" teacher records (name, email, instruments)
- Show "Link Account" button for unlinked teachers
- Display linked/unlinked status badge

### Teacher Dropdowns (LessonModal, TeachingDefaultsCard, etc.)
- Query `teachers` table instead of `org_memberships + profiles`
- Show display_name from teachers table
- No change to user experience

### CSV Import
- Create teacher records in `teachers` table
- Match by email or name (case-insensitive)
- No auth account required

### Invite Flow
- When a teacher accepts an invite, link their `auth.user.id` to the matching `teachers` record (by email)
- Update `teachers.user_id` and grant org membership

### RLS Policies
- Teachers with `user_id` can still access their own data via `auth.uid()`
- New function: `get_teacher_id_for_user(user_id, org_id)` for lookups
- Payroll data protection remains (admin-only for pay rates)

### Reports & Payroll
- Query `teachers` table for display names
- Filter by `teacher_id` instead of `teacher_user_id`
- Unlinked teachers still appear in payroll (with pay rates)

---

## UI Changes

### Teachers Page
- "Add Teacher" button (creates unlinked record)
- "Invite to Login" action (sends invite email, optional)
- Status badges: "Active", "Pending Invite", "Linked"

### New Teacher Modal
- Display Name (required)
- Email (optional, used for invite matching)
- Instruments (multi-select)
- Employment Type (contractor/employee)
- Pay Rate (optional)

---

## Files to Create/Modify

### Database
- New migration for `teachers` table and data migration

### Backend
- Update `invite-accept` to link teacher records
- Update `csv-import-execute` to create teachers in new table

### Frontend
| File | Change |
|------|--------|
| `src/pages/Teachers.tsx` | Add "Create Teacher" functionality, query new table |
| `src/hooks/useCalendarData.ts` | Change teacher query to use `teachers` table |
| `src/components/calendar/LessonModal.tsx` | Use `teacher_id` for selection |
| `src/components/students/TeachingDefaultsCard.tsx` | Use `teacher_id` |
| `src/components/students/TeacherAssignmentsPanel.tsx` | Use `teacher_id` |
| `src/hooks/usePayroll.ts` | Query `teachers` table |
| `src/hooks/useReports.ts` | Query `teachers` table |
| `src/pages/DailyRegister.tsx` | Filter by `teacher_id` |

---

## Benefits

1. **Import Flexibility**: Teachers don't need accounts to be referenced
2. **Historical Integrity**: Departed teachers can be kept without auth accounts
3. **Agency Model**: External contractors tracked without login
4. **Seamless Linking**: When teachers do join, their records are already populated
5. **No Breaking Changes**: Existing users continue to work (dual-read during transition)

---

## Technical Considerations

### Backward Compatibility
- Keep `teacher_user_id` columns temporarily during migration
- Read from both old and new columns with preference for new
- Remove old columns after successful migration

### Performance
- Add indexes on `teachers.org_id`, `teachers.user_id`, `teachers.email`
- Use the new `teachers` table as the single source of truth

### Security
- Same RLS model: admins see all, teachers see own (via `user_id` when linked)
- Pay rate visibility restricted to admins and the teacher themselves
