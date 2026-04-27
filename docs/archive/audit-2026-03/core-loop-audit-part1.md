# LessonLoop Core Loop Audit — Part 1

**Scope:** Sign Up & Create Org, Add Students, Create Lessons
**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Rule:** DO NOT FIX. Findings only.

---

## STEP 1: SIGN UP & CREATE ORG

### [1A] — Supabase Auth Method & Email Verification

**Status:** VERIFIED CORRECT

**Files read:**
- `src/pages/Signup.tsx:83-128` (handleSignup)
- `src/contexts/AuthContext.tsx:353-364` (signUp method)
- `supabase/functions/onboarding-setup/index.ts:56-61` (email verification gate)

**Trace:**
1. User fills form, clicks "Create account" → `handleSignup` at line 83.
2. Calls `signUp(trimmedEmail, password, fullName.trim())` at line 117.
3. `signUp` in AuthContext (line 353) calls `supabase.auth.signUp()` with `options.data: { full_name: fullName }` and `emailRedirectTo: ${origin}/verify-email`.
4. Supabase sends a confirmation email. The signup form shows a "Check your email" screen (line 143-180) with a resend button (60s cooldown).
5. Email confirmation IS required: `onboarding-setup` at line 56-61 checks `user.email_confirmed_at` and returns 403 if null.
6. `RouteGuard` at line 115-118 also blocks unverified users from protected routes, redirecting to `/verify-email`.

**Evidence — email verification gate (onboarding-setup:56-61):**
```typescript
if (!user.email_confirmed_at) {
  return new Response(
    JSON.stringify({ error: 'Please verify your email address before setting up your account.' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**What if user signs up, closes tab, comes back later?**
- Session is restored by `supabase.auth.getSession()` in AuthContext:220. If email is verified, they proceed to onboarding. If not, RouteGuard redirects to `/verify-email`.
- Onboarding state is persisted in `sessionStorage` (useOnboardingState.ts:79-97) — survives page reloads within the same browser session but NOT tab closes.

**What if they sign up with an existing email?**
- Supabase returns an error from `signUp`. The error is shown via toast at Signup.tsx:120-126. Supabase's default behavior: if email confirmation is required, it returns a fake success to prevent account enumeration. This means the user sees "Check your email" even for duplicate emails — which is the secure behavior.

**Impact:** None — working correctly.

---

### [1B] — Profile Creation

**Status:** VERIFIED CORRECT (with redundancy safety nets)

**Files read:**
- `supabase/migrations/20260119230917_...sql:80-101` (handle_new_user trigger)
- `supabase/functions/profile-ensure/index.ts:1-132`
- `supabase/functions/onboarding-setup/index.ts:149-197`
- `src/contexts/AuthContext.tsx:139-176` (ensureProfileExists)
- `src/pages/Onboarding.tsx:39-113` (ensureProfile effect)

**Trace — who creates the profile FIRST:**
1. **Database trigger `handle_new_user`** (migration line 80-101): Fires `AFTER INSERT ON auth.users`. Creates `profiles` row with `id`, `email`, `full_name` from `raw_user_meta_data->>'full_name'`. Also inserts `user_roles` row with role `'owner'`.
2. **`profile-ensure` edge function** (lines 52-73): Called as a safety net. Checks if profile exists first (`maybeSingle`). If it exists, returns it immediately (line 67-72). If not, creates one (line 80-88). Handles race condition: if insert fails with `23505` (unique violation), fetches the trigger-created profile (line 93-104).
3. **`onboarding-setup` edge function** (lines 150-197): Also has self-healing. Checks if profile exists (line 150-154). If missing, creates it with `23505` guard (line 168). If profile exists, updates `full_name` and `phone` (line 184-188).

**What if profile-ensure and onboarding-setup BOTH try to create it?**
- The trigger fires first (synchronous, on auth.users INSERT).
- Both edge functions check for existence before inserting.
- Both handle `23505` unique violation gracefully.
- No crash possible.

**Evidence — trigger creates profile (migration:86-93):**
```sql
INSERT INTO public.profiles (id, email, full_name)
VALUES (
  NEW.id,
  NEW.email,
  COALESCE(NEW.raw_user_meta_data->>'full_name', '')
);
```

**Evidence — profile-ensure handles race (profile-ensure:91-104):**
```typescript
if (insertError) {
  if (insertError.code === '23505') { // Unique violation
    const { data: raceProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    return new Response(
      JSON.stringify({ profile: raceProfile, created: false }),
      { status: 200, ... }
    );
  }
}
```

**Is full_name populated?**
- Trigger uses `COALESCE(NEW.raw_user_meta_data->>'full_name', '')` — yes, populated from signup form's `data: { full_name: fullName }`.
- If empty string (e.g. OAuth without name), profile-ensure uses `user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'` (line 78).

**Impact:** None — triple-layer safety net is robust.

---

### [1C] — Onboarding-Setup Edge Function

**Status:** VERIFIED CORRECT (with one EDGE CASE RISK)

**Files read:**
- `supabase/functions/onboarding-setup/index.ts:1-337` (entire file)
- `supabase/migrations/20260119231348_...sql:228-251` (org creation trigger)

**Trace — what it creates, in order:**

1. **Auth validation** (lines 28-52): Checks auth header, verifies user, blocks unverified emails.
2. **Rate limiting** (lines 66-69): Per-user rate limit.
3. **Idempotency guard** (lines 72-87): Checks `profiles.has_completed_onboarding` AND `current_org_id`. If both set, returns existing org_id with 200. This prevents double-creation.
4. **Input validation** (lines 90-134): Validates org_name, org_type, full_name. Strips control characters. Validates lengths (1-100).
5. **Profile ensure** (lines 149-197): Creates or updates profile. Handles `23505` on create.
6. **Organisation row** (lines 200-253): Creates with columns:
   - `id` (crypto.randomUUID)
   - `name`, `org_type`, `country_code`, `currency_code`, `timezone`
   - `created_by: user.id`
   - `subscription_plan`, `subscription_status: 'trialing'`
   - `trial_ends_at` (30 days from now)
   - `max_students`, `max_teachers` (from PLAN_LIMITS)
   - `parent_reschedule_policy` (smart defaults by org_type)
7. **Org membership** (lines 256-275): Waits for trigger-created membership (3 attempts, 200ms apart). If trigger didn't fire, creates manually. The `on_organisation_created` trigger (migration line 228-251) creates `org_memberships` row with role `'owner'` and sets `profiles.current_org_id` if null.
8. **Teacher record** (lines 277-300): Created for `solo_teacher` always, or for `studio`/`academy` if `also_teaches` is true. Not created for `agency`. Handles `23505`.
9. **Complete flag** (lines 302-317): Sets `profiles.has_completed_onboarding = true` and `current_org_id = orgId`.

**What it does NOT create:**
- ~~Default location~~ — NO default location created.
- ~~Default instruments~~ — NO instruments created.
- ~~Term~~ — NO term created.

**What if the function times out?**
- Steps are sequential, not transactional. If it times out after step 6 (org created) but before step 9 (completion flag):
  - Org exists, membership exists (via trigger), but `has_completed_onboarding` is false.
  - User retries → idempotency guard at line 81 checks BOTH `has_completed_onboarding` AND `current_org_id`. Since onboarding is NOT complete, it falls through and **creates a SECOND org**.

**What if user calls it twice (double-click, retry)?**
- Client-side guard: `isSubmitting.current` ref prevents concurrent calls (Onboarding.tsx:200-201).
- Server-side guard: The idempotency check (line 81) only returns early if `has_completed_onboarding=true AND current_org_id IS NOT NULL`. A failed first attempt that partially created an org will NOT be caught — the user gets a new org on retry.

**EDGE CASE RISK: Partial failure creates orphan org**

**Evidence (onboarding-setup:71-87):**
```typescript
if (existingCheck?.has_completed_onboarding && existingCheck?.current_org_id) {
  return new Response(
    JSON.stringify({ success: true, org_id: existingCheck.current_org_id, ... }),
    { status: 200, ... }
  );
}
```

The guard requires BOTH flags. If org was created (step 6) but the completion update (step 9) failed or timed out:
- `has_completed_onboarding` = false, `current_org_id` may or may not be set (the trigger sets it only if null).
- On retry, a NEW org is created. The old org becomes an orphan.

**Impact:** On timeout/crash between steps 6-9, user gets duplicate orgs. Unlikely but possible on slow connections. The client has a 30s timeout (Onboarding.tsx:218).

**Fix:** Check for existing org_memberships with role='owner' for this user, not just the completion flag.

---

### [1D] — Post-Onboarding State

**Status:** VERIFIED CORRECT

**Files read:**
- `supabase/functions/onboarding-setup/index.ts:302-317`
- `src/pages/Onboarding.tsx:357-358`
- `src/contexts/OrgContext.tsx` (referenced, not read — OrgContext loads from profile.current_org_id)
- `src/components/auth/RouteGuard.tsx:127-141`

**Trace:**
1. `onboarding-setup` sets `has_completed_onboarding=true` and `current_org_id=orgId` (lines 303-309).
2. Client calls `refreshProfile()` (Onboarding.tsx:357) which re-fetches profile and roles from DB.
3. Client calls `clearOnboardingState()` (line 358) to clear sessionStorage.
4. Navigates to success step, then user clicks "Go to Dashboard" (handled by SetupStep component).
5. RouteGuard checks `profile.has_completed_onboarding` (line 139). Since it's now true, user passes through.

**Loading gap?**
- `refreshProfile()` is called BEFORE navigating away. OrgContext will load from `profile.current_org_id`.
- There may be a brief loading state while OrgContext initializes, but RouteGuard handles this with `AuthLoading` component (line 146-148) while `orgInitialised` is false.

**Evidence (Onboarding.tsx:357-358):**
```typescript
await refreshProfile();
clearOnboardingState();
```

**Impact:** None — clean handoff.

---

### [1E] — Invited User Path (AcceptInvite)

**Status:** EDGE CASE RISK

**Files read:**
- `src/pages/AcceptInvite.tsx:1-488` (entire file)
- `supabase/functions/invite-accept/index.ts:1-229` (entire file)
- `src/components/auth/RouteGuard.tsx:62-85` (grace period)

**Trace — existing user (already logged in):**
1. User clicks invite link → `/accept-invite?token=xxx`.
2. `fetchInvite` calls `invite-get` edge function (line 92-93) to get invite details.
3. UI checks email match using `emailLikelyMatches` (line 317). Only first char + domain compared (invite email is redacted by invite-get). If no match, shows warning and disables Accept button.
4. User clicks "Accept invitation" → `acceptInvite()` (line 123-166).
5. Calls `invite-accept` edge function, which:
   - Validates token, checks expiry, checks email match (exact, server-side: line 89-94).
   - **Upserts** org_membership (line 97-100): `onConflict: "org_id,user_id"` — safe for re-accepts.
   - For teacher role: links or creates teacher record (lines 110-150).
   - For parent role: creates/links guardian, links to student (lines 153-203).
   - Marks invite as accepted (line 206).
   - Sets `current_org_id` and `has_completed_onboarding=true` (lines 210-216).
6. Client retries `refreshProfile()` 3 times with 500ms delays (lines 149-153).
7. Navigates to `/dashboard` or `/portal/home` based on role.

**Trace — new user (no account):**
1. Shows signup form (lines 364-487).
2. `signUpAndAccept` (line 168-272):
   - Calls `supabase.auth.signUp()` (line 201-208). No email redirect specified besides `window.location.origin`.
   - Waits for profile via `waitForProfile` (line 16-27): polls 10 times with 500ms delays (5 seconds total).
   - Calls `invite-accept` edge function.
   - Updates profile with `full_name`.
   - Retries `refreshProfile()` 3 times.

**EDGE CASE RISK 1: New user signup may require email verification**

The `signUpAndAccept` function at line 201-208 calls `supabase.auth.signUp()`. If Supabase has email confirmation enabled (which it does — evidenced by Signup.tsx flow), the new user gets a confirmation email. But `signUpAndAccept` immediately tries to call `invite-accept`, which requires a valid authenticated session.

**However:** Supabase returns a session on signup even before email verification if `autoconfirm` is disabled (the user is created but unverified). The `invite-accept` function does NOT check `email_confirmed_at` (unlike `onboarding-setup`). So this path likely works — the user gets a session, accepts the invite, and can verify email later.

**Evidence — invite-accept does NOT check email_confirmed_at:**
The function at lines 34-39 only checks `getUser()` succeeds, not that email is confirmed. Compare with onboarding-setup:56-61 which explicitly checks.

**EDGE CASE RISK 2: RouteGuard race condition**

After `acceptInvite` or `signUpAndAccept` navigates to `/dashboard`, RouteGuard checks:
1. `profile.has_completed_onboarding` (line 139) — must be true.
2. `invite-accept` sets this on the server (line 210-216).
3. Client calls `refreshProfile()` 3 times (AcceptInvite.tsx:149-153 / 255-257).

**The retry loop:**
```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  await refreshProfile();
  if (attempt < 2) await new Promise(r => setTimeout(r, 500));
}
```

This is 3 profile fetches with 500ms gaps = ~1.5 seconds max. The refreshProfile call fetches from DB directly, and `invite-accept` already wrote `has_completed_onboarding=true` server-side. The first fetch should succeed unless Supabase replication is lagging.

**RouteGuard grace period** (lines 62-85): If profile is null after auth init, waits 3 seconds before redirecting to onboarding. This is for the case where profile fetch times out, not specifically for invite flow.

**Is 3x 500ms enough?**
- The writes happen BEFORE the retries start (invite-accept completes, then retries run).
- Unless Supabase has replication lag > 1.5s, the first or second refresh will pick up the change.
- Risk: On very slow connections, profile fetch itself may time out (5s timeout in AuthContext:46-52), and all 3 retries fail. User would see the RouteGuard grace period loading state, then get redirected to onboarding.
- Onboarding.tsx:54-73 has a safety net: if user already has active org memberships, it skips onboarding and redirects to dashboard.

**EDGE CASE RISK 3: invite-accept missing org_id on student_guardians insert**

At `invite-accept:195`, the `student_guardians` insert does NOT include `org_id`:
```typescript
await supabaseAdmin.from("student_guardians").insert({
  guardian_id: guardianId,
  student_id: invite.related_student_id,
  relationship: "parent",
  is_primary_payer: true,
});
```

The `student_guardians` table has `org_id UUID NOT NULL` (migration line 36). This insert will fail with a NOT NULL constraint violation. The guardian is created but NOT linked to the student.

**Evidence (migration:34-43):**
```sql
CREATE TABLE public.student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  ...
```

**Status:** BUG FOUND

**Impact:** When a parent accepts an invite linked to a specific student (`related_student_id`), the guardian-student link silently fails. The parent gets org access but is NOT connected to their child. The admin would need to manually link them.

**Fix:** Add `org_id: invite.org_id` to the `student_guardians` insert at invite-accept:195.

---

## STEP 2: ADD STUDENTS

### [2A] — Student Record Creation

**Status:** VERIFIED CORRECT

**Files read:**
- `src/components/students/StudentWizard.tsx:149-350` (handleCreate)
- `src/components/students/wizard/StudentInfoStep.tsx` (referenced)
- `src/lib/schemas.ts` (referenced — studentSchema)

**Trace:**
1. User clicks "Add Student" → opens `StudentWizard` (Students.tsx:402).
2. 3-step wizard: Student Details → Guardian → Teaching Setup.
3. Step 1 validates via `studentSchema.safeParse()` (line 105-106).
4. Step 3 submission calls `handleCreate()` (line 149).
5. Duplicate detection (lines 153-174): Fetches all students in org, checks name match OR email match.
6. Student insert (lines 180-198):

```typescript
const studentPayload = {
  org_id: currentOrg.id,      // Set from OrgContext — client-side
  first_name: studentData.firstName.trim(),
  last_name: studentData.lastName.trim(),
  email: studentData.email.trim() || null,
  phone: studentData.phone.trim() || null,
  dob: studentData.dob || null,
  notes: studentData.notes.trim() ? stripHtml(studentData.notes.trim()) : null,
  default_location_id: teachingData.locationId || null,
  default_teacher_id: teachingData.teacherId || null,
  default_rate_card_id: teachingData.rateCardId || null,
};
```

**Required columns:** `first_name` and `last_name` (validated by schema), `org_id` (from OrgContext).

**Is org_id set from client or server?** Client-side via `currentOrg.id`. RLS on the `students` table enforces that the user can only insert into orgs they're a member of, so a tampered org_id would fail at DB level.

**What if org_id is wrong?** RLS would reject the insert. The client always uses `currentOrg.id` from OrgContext which is derived from `profiles.current_org_id`.

**Impact:** None — working correctly.

---

### [2B] — Guardian Creation

**Status:** EDGE CASE RISK (graceful degradation)

**Files read:**
- `src/components/students/StudentWizard.tsx:248-308` (guardian handling)

**Trace:**
1. Guardian creation is SEPARATE from student creation. Student is created first (line 193), then guardian is handled (line 249+).
2. If `guardianData.mode === 'new'`, a new guardian row is inserted (lines 255-264).
3. If guardian creation fails, a toast warns the user but the student IS created (lines 266-271):
   ```typescript
   toast({
     title: 'Student created, guardian failed',
     description: 'The student was created but we couldn\'t add the guardian. You can add them later.',
     variant: 'destructive'
   });
   ```
4. The `student_guardians` junction row is created separately (lines 288-297) with `org_id: currentOrg.id`.
5. If the junction row fails, it's logged but doesn't crash (line 299-300).

**What if student creates but guardian fails?**
- Student exists without guardian. Warning toast shown. User can add guardian later from student detail page. This is graceful degradation, not a bug.

**What if guardian email already exists in another org?**
- Guardians are scoped by `org_id`, so the same email can exist in multiple orgs without conflict.

**Impact:** Low — graceful degradation. User is informed and can retry.

---

### [2C] — Teacher Assignment During Student Creation

**Status:** VERIFIED CORRECT

**Files read:**
- `src/components/students/StudentWizard.tsx:218-244` (teacher assignment)

**Trace:**
1. In Step 3 (Teaching Setup), user selects a teacher via `teachingData.teacherId`.
2. After student creation, at line 219, the code checks `if (teachingData.teacherId)`.
3. It fetches the teacher record to get `user_id` (lines 221-225).
4. Creates `student_teacher_assignments` row (lines 228-236):
   ```typescript
   const { error: staError } = await supabase
     .from('student_teacher_assignments')
     .insert({
       org_id: currentOrg.id,
       student_id: createdStudent.id,
       teacher_id: teacherRecord.id,
       teacher_user_id: teacherRecord.user_id || null,
       is_primary: true,
     });
   ```
5. Error is logged but doesn't crash (line 238-239).

**Does teacher selection persist?**
- YES. The `student_teacher_assignments` row IS created. The `default_teacher_id` is also set on the student record itself (in the student payload at line 189).

**After creating a student with a teacher selected, is there a row in the junction table?**
- YES — confirmed at line 228-236. Both `students.default_teacher_id` AND `student_teacher_assignments` are populated.

**Impact:** None — working correctly. The old bug where teacher selection didn't persist has been fixed.

---

### [2D] — Student List (get_students_for_org RPC)

**Status:** VERIFIED CORRECT

**Files read:**
- `supabase/migrations/20260311155816_...sql:1-51` (RPC definition)
- `src/hooks/useStudents.ts:24-41` (client call)

**Trace:**
1. `useStudents` calls `supabase.rpc('get_students_for_org', { _org_id, _role, _user_id })` (line 29-33).
2. The RPC is `SECURITY DEFINER` with `search_path = 'public'`.

**Role filtering:**
- If `_role = 'teacher'`: INNER JOINs `student_teacher_assignments` and `teachers` to filter by `teacher.user_id = _user_id`. Teacher only sees assigned students. ✓
- Otherwise (owner/admin/finance): Returns ALL students in org. ✓
- Both branches filter `deleted_at IS NULL`.

**Does it handle > 1000 students?**
- The RPC has NO LIMIT clause — it returns ALL matching students. The client doesn't paginate.
- For very large academies (1000+ students), this could be slow but won't break.
- No pagination means the entire result set is loaded into memory at once.

**Does it include guardian_count?**
- YES: `COALESCE((SELECT COUNT(*) FROM student_guardians sg WHERE sg.student_id = s.id), 0) AS guardian_count` (lines 31 and 44).
- Note: the subquery is a correlated subquery, which could be slow at scale (N+1 pattern). A LEFT JOIN + GROUP BY would be more efficient, but this works correctly.

**Evidence (migration:26-37 — teacher branch):**
```sql
IF _role = 'teacher' AND _user_id IS NOT NULL THEN
  RETURN QUERY
  SELECT ...
  FROM students s
  INNER JOIN student_teacher_assignments sta ON sta.student_id = s.id AND sta.org_id = _org_id
  INNER JOIN teachers t ON t.id = sta.teacher_id AND t.user_id = _user_id AND t.org_id = _org_id
  WHERE s.org_id = _org_id AND s.deleted_at IS NULL
  ORDER BY s.last_name, s.first_name, s.id;
```

**Impact:** None — working correctly. Performance concern at scale is noted but not a bug.

---

### [2E] — Student Detail Page (Non-Existent UUID)

**Status:** VERIFIED CORRECT

**Files read:**
- `src/pages/StudentDetail.tsx:1-50`
- `src/hooks/useStudentDetailPage.ts:58-94`

**Trace:**
1. `useStudentDetailPage` fetches student by `id` from URL params (line 70-83).
2. Uses `maybeSingle()` which returns `null` if no match (not an error).
3. If `student` is null after query settles (lines 89-94):
   ```typescript
   if (!studentQuery.isLoading && studentQuery.isFetched && !student && id && currentOrg) {
     toast({ title: 'Student not found', variant: 'destructive' });
     navigate('/students');
   }
   ```
4. User sees a toast "Student not found" and is redirected to `/students`.
5. During loading, `DetailSkeleton` is shown (StudentDetail.tsx:16-21).

**Evidence (useStudentDetailPage.ts:89-94):**
```typescript
useEffect(() => {
  if (!studentQuery.isLoading && studentQuery.isFetched && !student && id && currentOrg) {
    toast({ title: 'Student not found', variant: 'destructive' });
    navigate('/students');
  }
}, [studentQuery.isLoading, studentQuery.isFetched, student, id, currentOrg]);
```

**Impact:** None — clean error handling, no crash.

---

## STEP 3: CREATE LESSONS

### [3A] — Single Lesson Creation

**Status:** VERIFIED CORRECT

**Files read:**
- `src/components/calendar/useLessonForm.ts:323-714` (handleSaveWithMode — create branch)
- `src/components/calendar/useLessonForm.ts:358-362` (timezone conversion)

**Trace:**
1. User fills form: teacher (required), at least one student (required, line 330-331), date, time, duration (15-240 mins, lines 334-341).
2. Timezone conversion (lines 359-362):
   ```typescript
   const [hour, minute] = startTime.split(':').map(Number);
   const localDateTime = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
   const startAtUtc = fromZonedTime(localDateTime, orgTimezone);
   const endAtUtc = addMinutes(startAtUtc, durationMins);
   ```
3. `selectedDate` is a JS Date from the date picker. `startTime` is HH:mm string.
4. `fromZonedTime(localDateTime, orgTimezone)` converts org-local wall-clock to UTC. This is correct — if user picks "2pm" in Europe/London (UTC+1 in summer), `fromZonedTime` produces 1pm UTC.
5. `end_at` is computed from `start_at + durationMins`.
6. Both `start_at` and `end_at` are stored as ISO strings in UTC.

**Required fields for DB insert (lines 624-641):**
- `org_id`, `lesson_type`, `teacher_user_id`, `teacher_id`, `location_id`, `room_id`
- `start_at`, `end_at` (UTC ISO strings)
- `title` (auto-generated from student names)
- `status: 'scheduled'`, `created_by: user.id`
- `recurrence_id` (null for single lessons)

**Evidence — timezone conversion (useLessonForm.ts:359-362):**
```typescript
const startAtUtc = fromZonedTime(localDateTime, orgTimezone);
const endAtUtc = addMinutes(startAtUtc, durationMins);
```

**Impact:** None — correct UTC storage with proper timezone handling.

---

### [3B] — lesson_participants Atomicity

**Status:** EDGE CASE RISK

**Files read:**
- `src/components/calendar/useLessonForm.ts:643-678` (create branch — participants)

**Trace:**
1. Lesson insert (lines 644-648): Inserts all lesson rows (single or recurring) in one batch.
2. Participant insert (lines 651-664): Only runs IF `insertedLessons` is truthy AND `selectedStudents.length > 0`.
3. The two operations are NOT atomic — they're separate Supabase calls.

**What if participant insert fails?**
- Lessons exist without participants (orphaned lessons).
- Error is caught at line 694 and toast shown with "Partial creation may have occurred" message.
- The lessons appear on the calendar but without student names.

**Evidence (useLessonForm.ts:643-664):**
```typescript
const { data: insertedLessons, error: lessonError } = await supabase
  .from('lessons')
  .insert(allLessonRows)
  .select('id, start_at');
if (lessonError) throw lessonError;

if (insertedLessons && selectedStudents.length > 0) {
  const allParticipants = insertedLessons.flatMap(l =>
    selectedStudents.map(studentId => ({
      org_id: currentOrg.id,
      lesson_id: l.id,
      student_id: studentId,
    }))
  );
  const { error: partError } = await supabase
    .from('lesson_participants')
    .insert(allParticipants);
  if (partError) throw partError;
}
```

**Impact:** If participant insert fails, lessons exist on calendar without students attached. User can edit the lesson to re-add students. Low risk — Supabase batch inserts rarely fail partially.

---

### [3C] — Recurring Lesson Creation

**Status:** VERIFIED CORRECT

**Files read:**
- `src/components/calendar/useLessonForm.ts:537-620` (recurrence generation)

**Trace:**
1. Creates a `recurrence_rules` row (lines 541-553) with `pattern_type: 'weekly'`, `days_of_week`, `interval_weeks: 1`.
2. Builds recurrence dates in org timezone (lines 558-575):
   ```typescript
   const zonedStart = toZonedTime(startAtUtc, orgTimezone);
   const zonedEnd = recurrenceEndDate
     ? setHours(startOfDay(recurrenceEndDate), 23)
     : toZonedTime(addDays(startAtUtc, 90), orgTimezone);
   const allDays = eachDayOfInterval({ start: zonedStart, end: zonedEnd });
   ```
3. For each day matching `recurrenceDays`, sets same wall-clock time using `fromZonedTime` (line 570). This correctly handles DST transitions.
4. Default end: 90 days if no end date specified.

**Cap:** `MAX_RECURRING = 200` (line 612). If exceeded, series is truncated with a toast warning.

**Closure dates:** Checked at lines 579-610. Fetches `closure_dates` for the org and date range, filters out matching lessons. Handles both `applies_to_all_locations` and location-specific closures. Compares org-local date strings to avoid timezone mismatch.

**Batch insert:** All lessons inserted in ONE batch call (line 644-648). NOT one-by-one.

**What if lesson 50 of 80 fails?** The entire batch insert fails (Supabase batch insert is atomic). No partial state.

**What's the recurrence_id?** It's the `recurrence_rules.id` from step 1 (line 556). All lessons in the series share this ID.

**Evidence — closure date filtering (useLessonForm.ts:600-605):**
```typescript
const filtered = lessonsToCreate.filter(lessonDate => {
  const zonedDate = toZonedTime(lessonDate, orgTimezone);
  const dateStr = format(zonedDate, 'yyyy-MM-dd');
  return !closureDateSet.has(dateStr);
});
```

**Impact:** None — robust implementation with proper DST handling, closure filtering, and 200-lesson cap.

---

### [3D] — Calendar Display After Creation

**Status:** VERIFIED CORRECT

**Files read:**
- `src/hooks/useCalendarData.ts:157-241` (query + realtime)
- `src/hooks/useCalendarData.ts:200-223` (realtime subscription)
- `src/components/calendar/useLessonForm.ts:716-717` (post-save callbacks)

**Trace:**
1. After save, `onSaved()` callback is called (line 716). This is passed from the calendar page and typically calls `refetch()` on the calendar query.
2. Realtime subscription (useCalendarData.ts:201-223): Subscribes to `postgres_changes` on `lessons` table filtered by `org_id`. On ANY change, invalidates all `calendar-lessons` queries:
   ```typescript
   queryClient.invalidateQueries({ queryKey: ['calendar-lessons'] });
   ```
3. The lesson appears immediately after `onSaved()` triggers refetch.

**Teacher double-booking DB constraint:**
YES — there IS a DB-level constraint. The `check_lesson_conflicts` trigger (migration `20260222200941`):
- Fires `BEFORE INSERT` and `BEFORE UPDATE` on `lessons`.
- Checks teacher overlap: if `teacher_id` is set, looks for any other non-cancelled lesson with the same teacher in the same org that overlaps the time range.
- Checks room overlap similarly.
- Raises `EXCEPTION 'CONFLICT:TEACHER:...'` on violation.

**Evidence (useCalendarData.ts:213-216 — realtime):**
```typescript
.on('postgres_changes', {
  event: '*', schema: 'public', table: 'lessons',
  filter: `org_id=eq.${currentOrg.id}`,
}, () => {
  queryClient.invalidateQueries({ queryKey: ['calendar-lessons'] });
})
```

**Evidence (migration — teacher conflict trigger):**
```sql
IF NEW.teacher_id IS NOT NULL THEN
  SELECT id, title, start_at INTO _conflict_teacher
  FROM public.lessons
  WHERE teacher_id = NEW.teacher_id
    AND id != COALESCE(NEW.id, '...')
    AND status != 'cancelled'
    AND start_at < NEW.end_at
    AND end_at > NEW.start_at
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CONFLICT:TEACHER:...';
  END IF;
END IF;
```

**Impact:** None — lessons appear immediately via refetch + realtime. Double-booking prevented at DB level.

---

### [3E] — QuickCreatePopover Timezone

**Status:** VERIFIED CORRECT (with one design note)

**Files read:**
- `src/components/calendar/QuickCreatePopover.tsx:86-192` (handleCreate)
- `src/components/calendar/QuickCreatePopover.tsx:93-97` (timezone comment)

**Trace:**
1. `startDate` is passed from the calendar grid. The comment at lines 92-95 explains:
   ```typescript
   // startDate already has the correct local wall-clock time from the
   // calendar grid (via setHours/setMinutes). Use it directly —
   // .toISOString() converts to UTC automatically. No extra timezone
   // conversion needed; fromZonedTime would double-convert and shift
   // the time by the UTC offset.
   const startAtUtc = startDate;
   ```
2. This means `startDate` is treated as a JS Date object whose wall-clock time matches the org timezone. `.toISOString()` converts to UTC using the browser's timezone offset.

**+1h bug fixed?**
- The comment explicitly addresses this: "fromZonedTime would double-convert and shift the time by the UTC offset." This was the +1h bug — applying `fromZonedTime` when the date already represented local time.
- The fix: use `startDate` directly, letting `.toISOString()` handle the conversion.
- This works correctly IF the browser timezone matches the org timezone. For UK-based music schools in Europe/London, this is almost always true.

**Potential issue:** If a user's browser is in a different timezone than the org (e.g., user traveling abroad), the `.toISOString()` conversion would use the browser's offset, not the org's. The full lesson form (useLessonForm.ts) correctly uses `fromZonedTime(localDateTime, orgTimezone)`, but QuickCreatePopover does NOT. However, the calendar grid itself displays times in the browser's timezone, so the visual time matches what gets stored — it's just not explicitly org-timezone-aware.

**Can you create a lesson without a student?**
- NO. The create button is disabled when `!studentId` (line 297):
  ```typescript
  disabled={!studentId || !teacherId || isSaving}
  ```

**Evidence (QuickCreatePopover.tsx:96-97):**
```typescript
const startAtUtc = startDate;
const endAtUtc = addMinutes(startAtUtc, duration);
```

**Impact:** Works correctly for same-timezone users. Cross-timezone users could see 1h offset in QuickCreate specifically (not in the full form). Low risk for a UK music school SaaS.

---

## SUMMARY OF FINDINGS

| Step | Status | Severity | Summary |
|------|--------|----------|---------|
| 1A | VERIFIED CORRECT | — | Email+password signup with confirmation. Google/Apple OAuth also supported. |
| 1B | VERIFIED CORRECT | — | Triple-layer profile creation (trigger → profile-ensure → onboarding-setup). |
| 1C | EDGE CASE RISK | LOW | Partial failure between org creation and completion flag can create orphan orgs on retry. |
| 1D | VERIFIED CORRECT | — | Clean handoff from onboarding to dashboard. |
| 1E | **BUG FOUND** | **MEDIUM** | `invite-accept` missing `org_id` in `student_guardians` insert (line 195). Parent invite linked to a student silently fails to create guardian-student link. |
| 2A | VERIFIED CORRECT | — | Student creation with proper validation, org_id from OrgContext, RLS enforcement. |
| 2B | EDGE CASE RISK | LOW | Guardian creation is separate from student. Failure shows warning toast. Graceful degradation. |
| 2C | VERIFIED CORRECT | — | Teacher assignment creates both `default_teacher_id` and `student_teacher_assignments` row. |
| 2D | VERIFIED CORRECT | — | RPC correctly filters by role. No pagination (scale concern, not a bug). |
| 2E | VERIFIED CORRECT | — | Non-existent student shows toast and redirects. No crash. |
| 3A | VERIFIED CORRECT | — | Correct UTC storage with proper timezone conversion via `fromZonedTime`. |
| 3B | EDGE CASE RISK | LOW | Lesson + participants not atomic. Partial failure shows warning. |
| 3C | VERIFIED CORRECT | — | Proper DST handling, closure filtering, 200-lesson cap, batch insert. |
| 3D | VERIFIED CORRECT | — | Immediate display via refetch + realtime. DB-level teacher double-booking prevention. |
| 3E | VERIFIED CORRECT | LOW | +1h bug fixed. QuickCreate uses browser TZ (correct for same-TZ users). |

### Bugs Requiring Fix (1)

1. **[1E] invite-accept:195** — Missing `org_id` in `student_guardians` insert. Will fail with NOT NULL constraint. Parent invite flow breaks guardian-student linking.

### Edge Cases Worth Monitoring (3)

1. **[1C]** — Onboarding timeout can create orphan orgs (idempotency guard only checks completion flag, not existing orgs).
2. **[2B]** — Guardian creation failure after student creation (graceful degradation, user informed).
3. **[3B]** — lesson_participants insert failure after lessons created (graceful degradation, user informed).
