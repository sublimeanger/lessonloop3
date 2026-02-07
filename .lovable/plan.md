

# Massive Agency Demo Data Seeder

## Overview
Build a new edge function `seed-agency-demo` that transforms the `demo-teacher@lessonloop.test` account from a solo teacher into a fully operational agency with 9 schools, 18 teachers, 300+ students, thousands of lessons, and complete invoicing history. This will also create loginable teacher and parent accounts for cross-role testing.

## Current State
- **Account**: `demo-teacher@lessonloop.test` (password: `DemoTeacher2026!`)
- **User ID**: `b633da13-0599-4ab0-bfd8-c5a686b5d684`
- **Org ID**: `5b905216-85ae-4aca-8c50-9757d0444b60`
- **Org type**: `solo_teacher` with `max_teachers: 1`
- **Existing data**: 1 teacher record (the owner), nothing else
- The org needs to be upgraded to `agency` type first

---

## Phase 1: Organisation Upgrade

Update the existing organisation record:
- `org_type` -> `agency`
- `name` -> `Harmony Music Education Agency`
- `subscription_plan` -> `agency`
- `max_students` -> `9999`
- `max_teachers` -> `9999`
- `vat_enabled` -> `true`, `vat_rate` -> `20`
- Set invoice address fields for realism

---

## Phase 2: Locations (9 Schools)

Create 9 schools across different UK cities, each with 2-3 rooms:

| # | School Name | City | Rooms |
|---|-------------|------|-------|
| 1 | Oakwood Primary School | London | Music Room, Hall |
| 2 | St Mary's Academy | Manchester | Room A, Room B, Hall |
| 3 | Riverside Secondary School | Birmingham | Music Suite, Practice Room |
| 4 | The Willows Prep | Bristol | Studio 1, Studio 2 |
| 5 | Kingsgate Grammar | Leeds | Music Block, Drama Hall |
| 6 | Elmhurst Community School | Liverpool | Teaching Room, Assembly Hall |
| 7 | Briarwood College | Sheffield | Music Dept, Rehearsal Room |
| 8 | Ashford Park School | Nottingham | Room 1, Room 2, Room 3 |
| 9 | Westfield Junior School | Cambridge | Music Room, Practice Room |

Total: 9 locations, ~22 rooms

---

## Phase 3: Teachers (18 Teachers)

Create 18 teacher records (unlinked -- no auth accounts) distributed across schools. Two of these will also get loginable auth accounts for cross-role testing.

Each teacher has:
- Realistic UK name
- 2-3 instruments from: Piano, Violin, Guitar, Cello, Drums, Flute, Clarinet, Saxophone, Trumpet, Recorder
- Employment type (mix of `employee` and `contractor`)
- Pay rate (per_lesson or hourly)

**Loginable Teacher Accounts** (2 accounts with full auth):
1. `teacher1@lessonloop.test` / `Teacher1Demo2026!` -- assigned to schools 1-3
2. `teacher2@lessonloop.test` / `Teacher2Demo2026!` -- assigned to schools 4-6

These will have:
- Auth user created with `email_confirm: true`
- Profile, org_membership (role: teacher), user_roles, teacher record
- Their `teachers.user_id` linked to their auth ID

---

## Phase 4: Students (315 Students) + Guardians (~250 Guardians)

Create 35 students per school (9 x 35 = 315 students), each with:
- Realistic UK first/last name combinations
- Teaching defaults set (default_location_id, default_teacher_id)
- Status: mostly `active`, a few `inactive`

**Guardians (~250)**:
- Most students get 1 guardian (primary payer)
- ~30 families share guardians (siblings), testing multi-student guardian billing
- Each guardian linked via `student_guardians` with `is_primary_payer: true`

**Loginable Parent Accounts** (3 accounts):
1. `parent1@lessonloop.test` / `Parent1Demo2026!` -- parent of 2 siblings at School 1
2. `parent2@lessonloop.test` / `Parent2Demo2026!` -- parent of 1 child at School 4
3. `parent3@lessonloop.test` / `Parent3Demo2026!` -- parent of 3 siblings across Schools 2 and 5

These get:
- Auth user with email confirmed
- Profile, org_membership (role: parent), user_roles
- Guardian record with `user_id` linked
- Proper `student_guardians` linking

---

## Phase 5: Student-Teacher Assignments

Each student gets assigned to 1 primary teacher at their school via `student_teacher_assignments`. Teachers are distributed so each has ~15-20 students.

---

## Phase 6: Rate Cards (16 Cards)

Create rate cards for all instrument/duration combinations:

| Instrument | 30 min | 45 min |
|------------|--------|--------|
| Piano | 35.00 | 50.00 |
| Guitar | 32.00 | 45.00 |
| Violin | 38.00 | 55.00 |
| Cello | 38.00 | 55.00 |
| Drums | 30.00 | 42.00 |
| Flute | 35.00 | 50.00 |
| Clarinet | 35.00 | 50.00 |
| Saxophone | 35.00 | 50.00 |

---

## Phase 7: Lessons (~2,500+ Lessons)

Generate lessons Monday-Friday only, spread across 12 weeks:
- **Past 8 weeks**: ~1,600 completed lessons (status: `completed`)
- **Current week**: ~200 lessons (mix of `completed` for past days, `scheduled` for remaining)
- **Future 4 weeks**: ~800 scheduled lessons (status: `scheduled`)
- **~30 cancelled lessons** scattered through past weeks

Each lesson:
- Assigned to correct teacher (`teacher_user_id` + `teacher_id`)
- Set at correct location + room
- Time slots: 08:30-17:00, staggered 30/45 min blocks
- Proper `lesson_participants` linking student to lesson
- Mix of `private` and `group` (some group lessons with 2-3 students)

**Attendance Records** for completed lessons:
- ~90% `present`, ~5% `absent`, ~3% `late`, ~2% `cancelled_by_student`

---

## Phase 8: Invoicing (~180 Invoices)

Generate monthly invoices for the past 3 months, grouped by guardian (payer):

**Month 1 (2 months ago)**: ~60 invoices
- ~50 `paid` with payment records
- ~8 `overdue`
- ~2 `void`

**Month 2 (1 month ago)**: ~60 invoices
- ~35 `paid`
- ~15 `sent`
- ~8 `overdue`
- ~2 `void`

**Month 3 (current)**: ~60 invoices
- ~10 `paid`
- ~30 `sent`
- ~15 `draft`
- ~5 `overdue`

Each invoice:
- Linked to correct `payer_guardian_id` and `payer_student_id`
- Proper `invoice_items` (4 lessons per student per month)
- Correct totals calculated from rate cards
- `GBP` currency, sequential `invoice_number`

**Payments**: Created for all `paid` invoices with mix of `bank_transfer`, `card`, and `cash` methods

---

## Phase 9: Make-Up Credits (~20 Credits)

Create make-up credits for some cancelled lessons:
- ~15 unredeemed (available)
- ~5 redeemed (linked to make-up lessons)

---

## Phase 10: Messaging Data

Seed realistic messaging across all channels:
- **Internal messages** (10+): teacher-to-owner conversations about schedules, student progress
- **Message requests** (8+): parent requests for reschedules, cancellations, general queries (mix of pending/approved/declined)
- **Outbound message log** (15+): invoice reminders, lesson confirmations, welcome emails

---

## Technical Implementation

### Edge Function: `supabase/functions/seed-agency-demo/index.ts`

The function will:
1. Accept a POST request with the user's auth token
2. Verify the caller is the org owner
3. Run all phases sequentially with progress logging
4. Use batch inserts (chunks of 100) to stay within database limits
5. Return a comprehensive summary of everything created
6. Include idempotency check (skip if data already exists)

### Batching Strategy
- Supabase insert limit is ~1000 rows, but we'll batch at 100 for reliability
- Lessons (2500+) split into 25 batches
- Lesson participants follow the same batching
- Attendance records batched similarly

### Auth Account Creation
- Uses `supabase.auth.admin.createUser()` with `email_confirm: true`
- Creates profiles, org_memberships, user_roles, teacher/guardian records
- All done via service role key

### Data Integrity
- All records scoped to the single org ID
- All foreign keys properly linked
- No orphaned records
- Invoice totals calculated from actual rate cards
- Lesson times respect Monday-Friday only, no overlapping slots per teacher

---

## Test Account Summary

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Owner/Admin | demo-teacher@lessonloop.test | DemoTeacher2026! | Full agency dashboard, all schools |
| Teacher 1 | teacher1@lessonloop.test | Teacher1Demo2026! | Schools 1-3, own students only |
| Teacher 2 | teacher2@lessonloop.test | Teacher2Demo2026! | Schools 4-6, own students only |
| Parent 1 | parent1@lessonloop.test | Parent1Demo2026! | 2 siblings at School 1 |
| Parent 2 | parent2@lessonloop.test | Parent2Demo2026! | 1 child at School 4 |
| Parent 3 | parent3@lessonloop.test | Parent3Demo2026! | 3 children across Schools 2 & 5 |

---

## What This Enables Testing

- **Calendar**: Busy multi-teacher, multi-location week view with filtering
- **Students**: 300+ student list with search, pagination, teaching defaults
- **Invoicing**: Full invoice lifecycle -- drafts, sent, paid, overdue, void
- **Reports**: Revenue, outstanding ageing, utilisation, payroll -- all with real data
- **Parent Portal**: Login as parent, see children, lessons, invoices, send requests
- **Teacher View**: Login as teacher, see own schedule, own students only (RLS)
- **Billing Runs**: Test with real completed lessons to generate new invoices
- **LoopAssist AI**: Query against meaningful data ("show overdue invoices", "who has lessons today")
- **Multi-guardian**: Sibling families testing consolidated billing
- **Make-up credits**: Test credit issuance and redemption flows

