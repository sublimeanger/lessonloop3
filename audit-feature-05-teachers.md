# Audit Report: Feature 5 — Teachers

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Teacher CRUD, profiles, user-linking, invitations, availability, assignments, pay rates, tier limits, deactivation/removal, cascade effects

---

## 1. Files Audited

### Database / Migrations
| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/migrations/20260119231833_…932.sql` | `teacher_profiles` + `availability_templates` tables (legacy) |
| 2 | `supabase/migrations/20260120000720_…000.sql` | `availability_blocks` + `time_off_blocks` tables |
| 3 | `supabase/migrations/20260120001129_…1fb.sql` | Payroll columns on teacher_profiles (legacy) |
| 4 | `supabase/migrations/20260120215727_…bb0.sql` | Helper functions: `is_org_staff`, `is_org_scheduler`, `is_assigned_teacher`, etc. |
| 5 | `supabase/migrations/20260120215818_…626.sql` | RLS for lessons, attendance, lesson_participants (teacher-scoped) |
| 6 | `supabase/migrations/20260130162532_…ebb.sql` | **`teachers` table** (decoupled from auth), view, helper, FKs, backfill |
| 7 | `supabase/migrations/20260201203605_…7a.sql` | Solo-teacher seed data |
| 8 | `supabase/migrations/20260222220553_…5e0.sql` | `check_teacher_limit()` trigger on `org_memberships` |
| 9 | `supabase/migrations/20260314120000_…rpc.sql` | `get_teachers_with_pay()` RPC |
| 10 | `supabase/migrations/20260315100400_…mn.sql` | `teacher_limit_exceeded` column on organisations |
| 11 | `supabase/migrations/20260224200100_…sql` | `lesson_notes` — `teacher_id FK ON DELETE CASCADE` |
| 12 | `supabase/migrations/20260224230001_…sql` | `booking_pages` — `teacher_id FK ON DELETE CASCADE` |
| 13 | `supabase/migrations/20260221194946_…sql` | `time_off_blocks` + `availability_blocks` add `teacher_id` FK |
| 14 | `supabase/migrations/20260225010707_…sql` | `recurring_lesson_templates` — `teacher_id FK ON DELETE CASCADE` |
| 15 | `supabase/migrations/20260227120000_…sql` | `enrolment_waitlist` — `preferred_teacher_id FK ON DELETE SET NULL` |

### Edge Functions
| # | File | Purpose |
|---|------|---------|
| 16 | `supabase/functions/send-invite-email/index.ts` | Send invitation email (Resend) |
| 17 | `supabase/functions/invite-accept/index.ts` | Accept invitation — creates membership + links/creates teacher record |
| 18 | `supabase/functions/invite-get/index.ts` | Public pre-acceptance invite lookup |
| 19 | `supabase/functions/_shared/plan-config.ts` | Server-side plan limits |

### Frontend — Hooks
| # | File | Purpose |
|---|------|---------|
| 20 | `src/hooks/useTeachers.ts` | Teacher CRUD mutations + queries |
| 21 | `src/hooks/useTeacherAvailability.ts` | Availability blocks + time off CRUD |
| 22 | `src/hooks/useTeacherPerformance.ts` | Performance reporting aggregation |
| 23 | `src/hooks/useTeacherDashboard.ts` | Teacher's own dashboard stats |
| 24 | `src/hooks/useSubscription.ts` | Plan limits (maxTeachers) |
| 25 | `src/hooks/useUsageCounts.ts` | Usage counting + canAddTeacher gate |
| 26 | `src/hooks/useDeleteValidation.ts` | Pre-deletion safety checks |

### Frontend — Pages & Components
| # | File | Purpose |
|---|------|---------|
| 27 | `src/pages/Teachers.tsx` | Main Teachers management page |
| 28 | `src/pages/reports/TeacherPerformance.tsx` | Performance report page |
| 29 | `src/components/teachers/TeacherQuickView.tsx` | Teacher detail sheet |
| 30 | `src/components/settings/TeacherAvailabilityTab.tsx` | Availability management UI |
| 31 | `src/components/students/TeacherAssignmentsPanel.tsx` | Student-teacher assignment panel |
| 32 | `src/components/settings/InviteMemberDialog.tsx` | Invite member dialog |
| 33 | `src/components/settings/PendingInvitesList.tsx` | Pending invites list |
| 34 | `src/components/calendar/TeacherColourLegend.tsx` | Calendar teacher colour filter |
| 35 | `src/components/calendar/teacherColours.ts` | Colour palette utilities |
| 36 | `src/components/shared/TeacherFAB.tsx` | Mobile teacher FAB |
| 37 | `src/components/practice/TeacherPracticeReview.tsx` | Practice review for teachers |
| 38 | `src/components/students/TeachingDefaultsCard.tsx` | Default teacher per student |
| 39 | `src/lib/pricing-config.ts` | Canonical pricing configuration |
| 40 | `src/integrations/supabase/types.ts` | Generated DB types |

---

## 2. Schema

### 2.1 `teachers` Table

```sql
CREATE TABLE public.teachers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable
  display_name  text NOT NULL,
  email         text,
  phone         text,
  instruments   text[] NOT NULL DEFAULT '{}',
  employment_type employment_type NOT NULL DEFAULT 'contractor',
  pay_rate_type pay_rate_type,                    -- nullable enum
  pay_rate_value numeric(10,2) DEFAULT 0,
  payroll_notes text,
  bio           text,
  status        student_status NOT NULL DEFAULT 'active',  -- 'active'|'inactive'
  default_lesson_length_mins integer NOT NULL DEFAULT 60,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, email)
);
```

**Key observations:**
- `user_id` is **nullable** — allows teacher records before user signup (unlinked teachers)
- `user_id` FK has `ON DELETE SET NULL` — if auth user deleted, teacher record survives but becomes unlinked
- `status` reuses `student_status` enum (shared `active`/`inactive`) — acceptable but semantically imprecise
- `UNIQUE(org_id, email)` — prevents duplicate email per org, but `email` is nullable so multiple NULL-email teachers allowed (correct PostgreSQL behavior)
- Audit trigger and updated_at trigger both present

### 2.2 `availability_blocks` Table

```sql
CREATE TABLE public.availability_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  teacher_user_id uuid,          -- legacy: auth.users ID
  teacher_id      uuid REFERENCES teachers(id) ON DELETE CASCADE,  -- new FK
  day_of_week     day_of_week NOT NULL,
  start_time_local TIME NOT NULL,
  end_time_local   TIME NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 2.3 `time_off_blocks` Table

```sql
CREATE TABLE public.time_off_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  teacher_user_id uuid,          -- legacy: auth.users ID
  teacher_id      uuid REFERENCES teachers(id) ON DELETE CASCADE,  -- new FK
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 2.4 Legacy Tables (still present)

- `teacher_profiles` — original teacher profile table, tied to `auth.users`. Data migrated to `teachers` table. Still exists in schema but superseded.
- `availability_templates` — weekly availability template per user/day. Unique constraint `(user_id, org_id, day_of_week)` limits to one slot per day. Superseded by `availability_blocks` which allows multiple per day.

---

## 3. Findings

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|----------------|
| TCH-01 | **CRITICAL** | **Teacher limit enforcement counts memberships, not teacher records.** `check_teacher_limit()` counts `org_memberships` where role IN (`owner`, `admin`, `teacher`). This means: (a) owner + admin are counted against the teacher limit, so a solo_teacher plan with 1 owner is already at limit and cannot add a teacher; (b) unlinked teacher records (no membership) are NOT counted, so you can create unlimited unlinked teachers bypassing the limit. | `migrations/…220553…sql`, `src/hooks/useUsageCounts.ts` | Rewrite `check_teacher_limit()` to count active records in `teachers` table instead of memberships. Client-side `useUsageCounts` should also count `teachers` with `status='active'` instead of memberships. |
| TCH-02 | **HIGH** | **Client-side-only enforcement warning still present.** `useUsageCounts.ts` has explicit comment: "These limits are currently client-side only. Server-side enforcement via RLS/triggers is required before production." The server-side trigger exists but has the wrong counting logic (TCH-01). | `src/hooks/useUsageCounts.ts` | Fix server-side trigger (TCH-01), then remove the warning comment. |
| TCH-03 | **HIGH** | **No DB constraint preventing `end_time` <= `start_time` on availability blocks.** Both `availability_blocks` and `time_off_blocks` have no CHECK constraint ensuring `end > start`. Invalid time ranges can be stored. | `migrations/…000720…sql`, `migrations/…162532…sql` | Add `CHECK (end_time_local > start_time_local)` on `availability_blocks` and `CHECK (end_at > start_at)` on `time_off_blocks`. |
| TCH-04 | **HIGH** | **No overlap prevention for availability blocks.** Multiple availability blocks can overlap on the same day/time for the same teacher. No exclusion constraint or trigger prevents this. The UI has client-side overlap detection but it's bypassable via direct API. | `availability_blocks` schema | Add an exclusion constraint or BEFORE INSERT trigger to reject overlapping time ranges per teacher per day. |
| TCH-05 | **HIGH** | **`invite-accept` creates org_membership via upsert but does NOT check teacher limit.** When a teacher accepts an invite, `invite-accept/index.ts` line 97 upserts into `org_memberships`. The `check_teacher_limit` trigger fires on INSERT only, but `upsert` may hit the `ON CONFLICT ... DO UPDATE` path, bypassing the trigger entirely. | `supabase/functions/invite-accept/index.ts:97` | Either: (a) change to INSERT with explicit conflict handling, or (b) also attach the trigger to UPDATE events, or (c) add a pre-check before the upsert. |
| TCH-06 | **MEDIUM** | **`teacher_user_id` is NOT a formal FK on `availability_blocks` and `time_off_blocks`.** The column exists but has no REFERENCES constraint. Orphan records possible if the auth user is deleted. | `availability_blocks`, `time_off_blocks` schema | Add FK `REFERENCES auth.users(id) ON DELETE CASCADE` or rely solely on `teacher_id` FK (which does have CASCADE). Consider dropping `teacher_user_id` entirely since `teacher_id` is the canonical reference. |
| TCH-07 | **MEDIUM** | **`teachers_with_pay` view still exists alongside `get_teachers_with_pay()` RPC.** The view uses `CASE` column masking with `is_org_admin()` but the RPC checks `owner/admin/finance`. Finance role can access pay data via RPC but NOT via the view (which checks `is_org_admin` — owner/admin only). Inconsistent access. | `migrations/…162532…sql:69-101`, `migrations/…120000…rpc.sql` | Drop the `teachers_with_pay` view since the RPC is the sanctioned access path. Or align both to use the same role check. |
| TCH-08 | **MEDIUM** | **`teacher_profiles` (legacy) table still has RLS policies allowing any org member to INSERT/UPDATE/DELETE their own profile.** While superseded by the `teachers` table, the old table still exists and is writable. Could cause confusion or stale data. | `migrations/…231833…sql:73-88` | Drop `teacher_profiles` table or at minimum revoke INSERT/UPDATE/DELETE policies if it's kept for historical data. |
| TCH-09 | **MEDIUM** | **`useTeachers` query has hard limit of 100 teachers.** Orgs with >100 teachers will have data silently truncated. Agency plan allows unlimited teachers. | `src/hooks/useTeachers.ts:52` | Remove the limit or implement proper pagination. Show a warning if 100 teachers returned (already partially done in `Teachers.tsx:823`). |
| TCH-10 | **MEDIUM** | **`handleSelfAdd` in Teachers.tsx bypasses `canAddTeacher` check.** The "Add Myself" button for owner/admin inserts directly into `teachers` table without checking `canAddTeacher`. The banner is hidden for agency orgs but not gated by limit. | `src/pages/Teachers.tsx:199-219` | Add `if (!canAddTeacher) return;` guard at the top of `handleSelfAdd`. |
| TCH-11 | **MEDIUM** | **Parent can see teacher email and phone via RLS.** The `teachers` SELECT policy allows parents to view all columns including `email` and `phone`. No column-level restriction for parent role. | `migrations/…162532…sql:49-51` | Either: (a) create a restricted view for parent access that omits contact fields, or (b) add column-level security, or (c) filter fields in the frontend query (less secure). |
| TCH-12 | **MEDIUM** | **`deleteTeacher` mutation uses `'disabled' as any` status cast.** The org_memberships status enum apparently doesn't include 'disabled' in the TypeScript types, requiring an unsafe cast. | `src/hooks/useTeachers.ts:153` | Add 'disabled' to the TypeScript enum or verify the DB enum includes it. |
| TCH-13 | **MEDIUM** | **Teacher removal doesn't clean up `lesson_notes`, `booking_pages`, or `recurring_lesson_templates`.** The `processRemoval` function in Teachers.tsx cleans up assignments, practice assignments, default teacher, and upcoming lessons, but doesn't handle other FK references. These use `ON DELETE CASCADE` at DB level via teacher_id FK, but removal is a soft-delete (status change), not a hard delete — so CASCADE never fires. | `src/pages/Teachers.tsx:357-438` | Add cleanup for `lesson_notes`, `booking_pages`, and `recurring_lesson_templates` that reference the deactivated teacher, or document that these intentionally persist. |
| TCH-14 | **LOW** | **`teacher_user_id` can be changed after initial link.** No trigger or constraint prevents updating `teachers.user_id` to a different user. The `invite-accept` function only sets it if NULL, but admin UPDATE policy allows changing it. | `teachers` table, RLS policies | Add a trigger that prevents changing `user_id` once set (only allow NULL -> value, not value -> different value). |
| TCH-15 | **LOW** | **Availability stored in local time without explicit timezone reference.** `availability_blocks.start_time_local` / `end_time_local` are `TIME` columns (no timezone). The "local" suffix implies org timezone but there's no constraint or documentation tying it to `organisations.timezone`. | `availability_blocks` schema | Document that local times are interpreted in the org's timezone. Consider adding a `timezone` column or comment. |
| TCH-16 | **LOW** | **No invite expiry cleanup job.** Expired invites remain in the `invites` table indefinitely. No cron function purges them. | `invites` table | Add a periodic cleanup function or a Supabase cron job to delete invites expired >30 days. |
| TCH-17 | **LOW** | **`availability_templates` table has UNIQUE(user_id, org_id, day_of_week)** which limits to one template per day. This is overly restrictive compared to `availability_blocks` (multiple per day). Potential confusion if legacy code still references it. | `availability_templates` schema | Drop `availability_templates` if fully replaced by `availability_blocks`. |
| TCH-18 | **LOW** | **Duplicate invite sends for same email.** When creating a teacher with "Send login invite" checked, the code checks for duplicate invites via error message string matching (`inviteError.message.includes('duplicate')`). Fragile — depends on Supabase error message format. | `src/pages/Teachers.tsx:263` | Use error code instead of message string matching. Or pre-check for existing invite before INSERT. |
| TCH-19 | **LOW** | **`checkTeacherRemoval` blocks on upcoming lessons but `processRemoval` handles them.** The validation dialog blocks removal if upcoming lessons exist, but then `processRemoval` is designed to handle reassignment/cancellation. The block is a speed-bump UX decision, not a data integrity issue. | `src/hooks/useDeleteValidation.ts:151-194`, `src/pages/Teachers.tsx:326-355` | Consider flow: `checkTeacherRemoval` returns a warning (not block) for upcoming lessons since the removal dialog handles them. Currently the user sees two dialogs in sequence. |

---

## 4. RLS Policy Matrix

### `teachers` Table

| Operation | owner | admin | teacher | finance | parent |
|-----------|-------|-------|---------|---------|--------|
| SELECT | via `is_org_staff` | via `is_org_staff` | via `is_org_staff` | via `is_org_staff` | via `has_org_role(parent)` |
| INSERT | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |
| UPDATE | via `is_org_admin` | via `is_org_admin` | **Own record only** (`user_id = auth.uid()`) | **DENIED** | **DENIED** |
| DELETE | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |

**Note:** Teacher INSERT is admin-only. The `handleSelfAdd` function works because the owner/admin has the admin policy.

### `availability_blocks` Table

| Operation | owner/admin | teacher | finance | parent |
|-----------|-------------|---------|---------|--------|
| SELECT | via `is_org_staff` | via `is_org_staff` | via `is_org_staff` | **DENIED** |
| INSERT | Allowed (admin) | Own record only | **DENIED** | **DENIED** |
| UPDATE | Allowed (admin) | Own record only | **DENIED** | **DENIED** |
| DELETE | Allowed (admin) | Own record only | **DENIED** | **DENIED** |

### `time_off_blocks` Table

Same pattern as `availability_blocks`.

### `teachers_with_pay` View (SECURITY_INVOKER)

| Data Field | owner/admin | teacher (self) | teacher (other) | finance | parent |
|------------|-------------|----------------|-----------------|---------|--------|
| Basic fields | Visible | Visible | Visible | **No access** (view filtered by `is_org_member`) | **No access** |
| pay_rate_type/value/notes | Visible | Visible (self only) | **MASKED (NULL)** | **MASKED** | **No access** |

**Issue:** Finance role should see pay data but the view's `is_org_admin()` check excludes them. The RPC `get_teachers_with_pay()` correctly includes finance (TCH-07).

### `get_teachers_with_pay()` RPC

| Role | Access |
|------|--------|
| owner | Full pay data |
| admin | Full pay data |
| finance | Full pay data |
| teacher | **DENIED** (raises exception) |
| parent | **DENIED** (raises exception) |

---

## 5. CASCADE Impact Map — Teacher Deletion

When a teacher record is **hard-deleted** from the `teachers` table:

```
teachers.id DELETED
  ├── lessons.teacher_id              → SET NULL  (lesson keeps history, loses teacher ref)
  ├── students.default_teacher_id     → SET NULL  (student loses default teacher)
  ├── student_teacher_assignments     → CASCADE   (assignments deleted)
  ├── availability_blocks.teacher_id  → CASCADE   (availability deleted)
  ├── practice_assignments.teacher_id → SET NULL  (assignment kept, teacher ref nulled)
  ├── lesson_notes.teacher_id         → CASCADE   (notes deleted!)
  ├── booking_pages.teacher_id        → CASCADE   (booking pages deleted!)
  ├── recurring_lesson_templates      → CASCADE   (templates deleted!)
  ├── enrolment_waitlist.preferred_teacher_id → SET NULL
  └── time_off_blocks.teacher_id      → CASCADE   (time off deleted)
```

**Current behavior:** Teachers are **soft-deleted** (status = 'inactive'), not hard-deleted. CASCADE rules never fire during normal operation. The soft-delete path in `processRemoval()` manually handles:
- Upcoming lessons: reassign or cancel
- `student_teacher_assignments`: explicitly deleted
- `practice_assignments.teacher_id`: explicitly nulled
- `students.default_teacher_id`: explicitly nulled

**NOT handled by soft-delete path:**
- `lesson_notes` — teacher's notes remain referencing inactive teacher (acceptable)
- `booking_pages` — public booking pages for inactive teacher remain active (potential issue)
- `recurring_lesson_templates` — templates continue referencing inactive teacher (could create new lessons for inactive teacher)

When `auth.users` entry is deleted:
```
auth.users DELETED
  ├── teachers.user_id                → SET NULL  (teacher becomes unlinked)
  ├── teacher_profiles.user_id        → CASCADE   (legacy profile deleted)
  ├── availability_templates.user_id  → CASCADE   (legacy templates deleted)
  └── org_memberships                 → CASCADE   (membership deleted)
```

---

## 6. Teacher Invite Flow Trace

### Step 1: Admin Creates Teacher Record (Optional)
```
Teachers.tsx → handleCreateTeacher()
  → supabase.from('teachers').insert({ org_id, display_name, email, ... })
  → RLS: "Admin can create teachers" — is_org_admin() check
  → Teacher record created with user_id = NULL (unlinked)
```

### Step 2: Admin Sends Invite
```
Teachers.tsx → handleCreateTeacher() (if sendInvite toggled on)
  → supabase.from('invites').insert({ org_id, email, role: 'teacher' })
  → UNIQUE(org_id, email) prevents duplicates
  → supabase.functions.invoke('send-invite-email', { inviteId })
```

OR separately via:
```
InviteMemberDialog → insert invite → invoke send-invite-email
```

### Step 3: Edge Function Sends Email
```
send-invite-email/index.ts
  → Auth check (JWT)
  → Rate limit (5/min per user)
  → Authorization: only owner/admin of the invite's org
  → Fetch invite + org name
  → Build URL: https://app.lessonloop.net/accept-invite?token=<uuid>
  → Send via Resend (if configured), log to message_log
  → Invite expires in 7 days (default)
```

### Step 4: Recipient Clicks Link
```
/accept-invite?token=<uuid>
  → AcceptInvite page checks token
  → Calls invite-get edge function (public, IP-rate-limited)
  → Shows invite details, prompts sign-up/login
```

### Step 5: Recipient Accepts
```
invite-accept/index.ts
  → Auth check (Bearer token required)
  → Rate limit (per-user)
  → Validate: token exists, not expired, not already accepted
  → Email match: user.email must match invite.email (case-insensitive)
  → Block owner-role invites (defense-in-depth)
  → UPSERT org_membership (org_id, user_id, role, status='active')
  → ⚠️ check_teacher_limit trigger fires on INSERT but may NOT fire on upsert UPDATE path (TCH-05)
  → If role === 'teacher':
      → Look up existing teacher record by (org_id, email)
      → If found + unlinked: UPDATE teachers SET user_id = user.id
      → If not found: INSERT new teacher record
  → Mark invite accepted (accepted_at = now)
  → Set profile.current_org_id, has_completed_onboarding = true
```

### Edge Cases
| Scenario | Handling |
|----------|----------|
| Invited email is user in another org | Allowed — user gets new membership in this org |
| Invite sent twice to same email | UNIQUE(org_id, email) prevents duplicate invite records |
| Invited email already a member | `InviteMemberDialog` pre-checks membership; `invite-accept` upserts |
| Teacher record exists but unlinked | Linked on accept (user_id updated) |
| No teacher record exists | Created on accept |
| Teacher user_id set to wrong user | Email match enforced; but admin can UPDATE teacher.user_id directly (TCH-14) |
| Linked user deleted from auth.users | teacher.user_id SET NULL (becomes unlinked); org_membership CASCADE deleted |

---

## 7. Availability Model Assessment

### Storage Model
- **Weekly slots:** `availability_blocks` — day + start/end TIME (local to org timezone)
- **Time off:** `time_off_blocks` — TIMESTAMPTZ range with optional reason
- **Legacy:** `availability_templates` — one slot per day per user (superseded)

### Strengths
- Clean separation of recurring availability vs exceptions
- TIME columns for weekly slots avoid timezone conversion issues for display
- `time_off_blocks` uses TIMESTAMPTZ for precise period handling
- Hooks properly look up `teacher_id` from `teacher_user_id` for backward compatibility

### Weaknesses
- **No overlap prevention** at DB level (TCH-04)
- **No end > start validation** at DB level (TCH-03)
- **No connection to existing lessons** — changing availability doesn't warn about or affect already-scheduled lessons (UI does warn when *deleting* blocks, but not when *modifying* block times)
- **Timezone assumption** — local times assumed to be in org timezone but no explicit link (TCH-15)
- **Dual ID pattern** — both `teacher_user_id` and `teacher_id` exist on the same rows. `teacher_user_id` has no FK constraint (TCH-06). This is a migration artifact that adds complexity.

### Assessment
The availability system is **functional but needs DB-level constraints** (TCH-03, TCH-04) before production. The dual-ID pattern should be cleaned up post-launch by dropping `teacher_user_id` and relying solely on `teacher_id`.

---

## 8. Solo Teacher Mode Integration

### Current Behavior
- Solo teacher plan (`org_type = 'solo_teacher'`): Teachers page hidden from nav (`soloOwnerGroups` in AppSidebar)
- Owner **does** need a teacher record to be assigned to lessons on the calendar
- Seed migration (`20260201203605_…sql`) auto-creates teacher records for solo owners
- Self-add banner appears for admin/owners without a teacher record (hidden for agency)

### Transition to Multi-Teacher
- When owner creates a second teacher → org should upgrade plan (enforced by tier limit)
- UI shows Teachers page for academy/agency org types
- No automatic org_type change when second teacher added

### Reversion
- If second teacher removed → teacher count drops back to 1
- No automatic reversion of org_type or plan
- Solo teacher nav continues to hide Teachers page if `org_type === 'solo_teacher'`

---

## 9. Verdict

### **NOT PRODUCTION READY**

**3 blocking issues must be fixed:**

1. **TCH-01 (CRITICAL):** Teacher limit trigger counts wrong entities (org_memberships instead of teachers table). A solo_teacher plan owner can't add any teacher because owner counts toward the limit. Unlinked teachers bypass the limit entirely.

2. **TCH-05 (HIGH):** Invite acceptance upsert may bypass the teacher limit trigger since the trigger only fires on INSERT, not on the UPDATE path of an upsert.

3. **TCH-03 + TCH-04 (HIGH):** No DB constraints prevent invalid or overlapping availability blocks.

**Recommended before production:**
- Fix teacher limit counting logic (TCH-01)
- Add pre-check in invite-accept before upsert (TCH-05)
- Add CHECK constraints on time ranges (TCH-03)
- Add overlap prevention constraint or trigger (TCH-04)
- Restrict parent access to teacher contact fields (TCH-11)
- Drop or lock down legacy `teacher_profiles` table (TCH-08)
- Align `teachers_with_pay` view with RPC access rules or drop view (TCH-07)

---

*End of audit report.*
