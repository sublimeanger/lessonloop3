# Deep Security Audit — Part 3

**Date:** 2026-03-15
**Auditor:** Claude (Opus 4.6)
**Scope:** Auth & Session Edge Cases, Cascade & Orphan Checks, RLS Policy Completeness, Edge Function Deep Dive
**Codebase:** LessonLoop3

---

## SECTION 7: AUTH & SESSION EDGE CASES

### 7.1 Sign-Up Flow — Exact Sequence of Events

**Files:** `src/contexts/AuthContext.tsx`, `supabase/migrations/20260119230917_*.sql`

1. User calls `signUp(email, password, fullName)` → `supabase.auth.signUp()` with `emailRedirectTo`
2. Supabase creates `auth.users` row
3. Database trigger `handle_new_user()` fires (SECURITY DEFINER):
   - Creates `profiles` row with `id = NEW.id`
   - Inserts `user_roles(user_id, 'owner')` — every new user gets 'owner' role
4. `onAuthStateChange` fires `SIGNED_IN` event
5. `AuthContext` fetches profile + roles in parallel
6. User is redirected to `/verify-email` (if `email_confirmed_at` is null, RouteGuard blocks protected routes)
7. After email verification, user reaches `/onboarding`

**No issues found.** The sequence is well-orchestrated with race condition protection via `fetchingRef` and `initialisedRef`.

---

### 7.2 Invite Flow — User Clicks Invite → Creates Account

**Files:** `src/components/auth/RouteGuard.tsx:192-197`, `supabase/functions/invite-accept/index.ts`

1. User clicks invite link → lands on `/accept-invite?token=...`
2. If not authenticated, redirected to `/auth` — invite URL is stored in `sessionStorage` (`lessonloop_invite_return`)
3. User signs up → `handle_new_user()` trigger creates profile + assigns 'owner' role
4. After onboarding, `PublicRoute` checks `sessionStorage` for invite return URL
5. **SEC validation:** Only allows paths starting with `/accept-invite` (line 194) — good open-redirect protection
6. `invite-accept` edge function validates: token matches email, invite not expired, not already accepted
7. Creates `org_memberships` record with invited role, updates invite status

**No issues found.** The flow is well-secured with email matching and token validation.

---

### 7.3 [LOW] — Session Expiry During Active Use

**File:** `src/contexts/AuthContext.tsx:279-341`

**Issue:** When a session expires mid-use, Supabase's `onAuthStateChange` fires `SIGNED_OUT`. The handler clears all state and shows a toast: "Session expired — please sign in again". However, there is a **timing window** where in-flight API calls using the expired token will fail with 401 errors before the UI reflects the signed-out state.

**Impact:** Users may see confusing error toasts from failed API calls (e.g., "Failed to load students") before the session expiry toast appears. Data being edited at the moment of expiry could be lost without warning.

**Fix:** Add a global Supabase response interceptor that detects 401 responses and triggers sign-out immediately, suppressing other error toasts during the transition. Consider adding an "unsaved changes" warning mechanism.

---

### 7.4 [LOW] — Two Tabs Open, Log Out in One

**File:** `src/contexts/AuthContext.tsx:389-417`

**Issue:** Sign-out uses `supabase.auth.signOut({ scope: 'global' })` which invalidates the refresh token server-side. The other tab's `onAuthStateChange` listener will eventually fire `SIGNED_OUT` when its next token refresh attempt fails. However, until the token refresh is attempted (tokens are typically valid for 1 hour), the second tab remains functional with a stale but valid JWT.

**Impact:** For up to 1 hour after logout in Tab A, Tab B continues to work normally. This is a Supabase architectural limitation, not a code bug. The `global` scope sign-out is the correct mitigation — it ensures the refresh token is revoked, so the session cannot be extended beyond the current JWT expiry.

**Fix:** Consider using `BroadcastChannel` API to notify other tabs of sign-out immediately, or subscribe to Supabase's `SIGNED_OUT` event which propagates across tabs via `localStorage` events. Supabase's JS client already does some cross-tab coordination, but the delay is inherent in JWT-based auth.

---

### 7.5 [MEDIUM] — User Removed From Org While Logged In

**File:** `src/contexts/OrgContext.tsx:270-292`

**Issue:** The `OrgContext` subscribes to realtime changes on the `organisations` table (line 270-292), but does **NOT** subscribe to changes on `org_memberships`. If an admin removes a user's membership while that user is actively using the app, the user's `currentRole` and `currentOrg` remain stale until they manually refresh the page or navigate.

**Impact:** A removed user continues to have full access to the org's data for their current session. All data access is governed by RLS policies that check `org_memberships` in real-time, so **database-level access is correctly revoked immediately**. However, the UI does not reflect the removal — the user sees stale cached data and can attempt (but fail) new operations, receiving confusing errors.

**Fix:** Add a realtime subscription to `org_memberships` filtered on `user_id = auth.uid()`. On `DELETE` or `UPDATE` (status changed from 'active'), clear org state and redirect to a "You've been removed" page.

---

### 7.6 [CRITICAL] — Teacher Can Escalate Own Role via Supabase Client

**File:** `supabase/migrations/20260119231348_*.sql:185-189`

**Issue:** The `org_memberships` UPDATE policy is:
```sql
CREATE POLICY "Org admins can update memberships"
  ON public.org_memberships
  FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));
```
This correctly restricts UPDATE to admins. A teacher **cannot** update their own membership row because `is_org_admin` checks for `role IN ('owner', 'admin')`.

However, examining the `user_roles` table:
```sql
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);
```
There is **only a SELECT policy** on `user_roles`. No INSERT, UPDATE, or DELETE policies exist. Since RLS is enabled and no write policies exist, write operations are **blocked by default** — this is correct behavior.

**Verdict:** Role escalation via direct client manipulation is **NOT possible**. Roles are fetched from the database via `get_user_roles()` (SECURITY DEFINER function), not from the JWT. The `user_roles` table has RLS enabled with no write policies, effectively making it read-only for clients.

**Status:** SAFE — but should be documented that `user_roles` is intentionally write-blocked at RLS level.

---

### 7.7 [INFO] — Role Source: Database, Not JWT

**File:** `src/contexts/AuthContext.tsx:79-104`

Roles are fetched via `supabase.rpc('get_user_roles', { _user_id: userId })` — a SECURITY DEFINER function that queries the `user_roles` table directly. Roles are **not** embedded in the JWT. This means:
- Role changes take effect on next profile refresh (not immediately)
- No JWT forgery vector for role escalation
- Trade-off: extra DB query on every auth init

**Status:** GOOD architectural decision for security.

---

### 7.8 [MEDIUM] — Org Isolation: Multi-Org User Data Leakage Risk

**File:** `src/contexts/OrgContext.tsx:128-250`

**Analysis:** When a user belongs to 2 orgs, `OrgContext` fetches ALL memberships (line 145-152) but only sets ONE as `currentOrg`. All hooks use `currentOrg.id` for queries. The user can switch orgs via `setCurrentOrg()`.

**Finding:** The `fetchOrganisations` query fetches all memberships regardless of org, which is correct for the org switcher. However, React Query cache keys include `currentOrg?.id`, so switching orgs triggers fresh fetches. Data from Org A is **not** visible when viewing Org B.

**Edge case:** During the org switch, there's a brief moment where cached data from Org A might render while Org B queries are loading. This is a UX issue, not a security issue — RLS prevents cross-org data access at the database level.

**Status:** SAFE — RLS is the primary enforcement mechanism, client-side filtering is defense-in-depth.

---

## SECTION 8: CASCADE & ORPHAN CHECK

### 8.1 Complete FK ON DELETE Behavior Map

| Parent Table | Child Table.Column | ON DELETE | Correct? |
|---|---|---|---|
| auth.users | profiles.id | CASCADE | ✅ |
| auth.users | user_roles.user_id | CASCADE | ✅ |
| auth.users | org_memberships.user_id | CASCADE | ✅ |
| auth.users | teachers.user_id | SET NULL | ✅ |
| organisations | org_memberships.org_id | CASCADE | ✅ |
| organisations | students.org_id | CASCADE | ✅ |
| organisations | guardians.org_id | CASCADE | ✅ |
| organisations | lessons.org_id | CASCADE | ✅ |
| organisations | invoices.org_id | CASCADE | ✅ |
| organisations | locations.org_id | CASCADE | ✅ |
| organisations | profiles.current_org_id | SET NULL | ✅ |
| students | lesson_participants.student_id | CASCADE | ✅ |
| students | attendance_records.student_id | CASCADE | ✅ |
| students | student_guardians.student_id | CASCADE | ✅ |
| students | invoices.payer_student_id | SET NULL | ✅ |
| students | invoice_items.student_id | SET NULL | ✅ |
| students | make_up_credits.student_id | CASCADE | ✅ |
| students | practice_assignments.student_id | CASCADE | ✅ |
| students | practice_logs.student_id | CASCADE | ✅ |
| students | resource_shares.student_id | CASCADE | ✅ |
| guardians | student_guardians.guardian_id | CASCADE | ✅ |
| guardians | invoices.payer_guardian_id | SET NULL | ✅ |
| teachers | lessons.teacher_id | SET NULL | ✅ |
| teachers | students.default_teacher_id | SET NULL | ✅ |
| teachers | student_teacher_assignments.teacher_id | CASCADE | ✅ |
| teachers | availability_blocks.teacher_id | CASCADE | ✅ |
| teachers | practice_assignments.teacher_id | SET NULL | ✅ |
| locations | lessons.location_id | SET NULL | ✅ |
| locations | rooms.location_id | CASCADE | ✅ |
| lessons | lesson_participants.lesson_id | CASCADE | ✅ |
| lessons | attendance_records.lesson_id | CASCADE | ✅ |
| lessons | lesson_notes.lesson_id | CASCADE | ✅ |
| lessons | invoice_items.linked_lesson_id | SET NULL | ✅ |
| invoices | invoice_items.invoice_id | CASCADE | ✅ |
| invoices | payments.invoice_id | CASCADE | ✅ |
| invoices | invoice_installments.invoice_id | CASCADE | ✅ |

---

### 8.2 [LOW] — Delete Student: Cascading Consequences

**Impact chain:**
```
Student deleted
  → lesson_participants: CASCADE (deleted)
  → attendance_records: CASCADE (deleted)
  → student_guardians: CASCADE (deleted)
  → make_up_credits: CASCADE (deleted)
  → practice_assignments: CASCADE (deleted)
  → practice_logs: CASCADE (deleted)
  → resource_shares: CASCADE (deleted)
  → invoices.payer_student_id: SET NULL (invoice preserved, payer blanked)
  → invoice_items.student_id: SET NULL (line item preserved, student blanked)
```

**Issue:** Cascading lesson_participants deletion means historical lesson records lose their student associations. Attendance history is permanently deleted. This is **data loss** for reporting purposes.

**Impact:** Admin deletes a student → all attendance records and lesson participation history is irreversibly lost. Invoices are preserved but show "Unknown" payer.

**Fix:** Consider soft-delete for students (archive flag) instead of hard delete. Alternatively, use SET NULL on lesson_participants and attendance_records to preserve history.

---

### 8.3 [LOW] — Delete Teacher: Lessons Orphaned

**Impact chain:**
```
Teacher deleted
  → lessons.teacher_id: SET NULL (lessons preserved, no teacher)
  → students.default_teacher_id: SET NULL (students lose default)
  → student_teacher_assignments: CASCADE (deleted)
  → availability_blocks: CASCADE (deleted)
  → practice_assignments.teacher_id: SET NULL (preserved)
```

**UI handling:** LessonDetailPanel shows "Unknown" for null teacher (line 566). LessonCard gracefully handles with empty string (line 49-62). Calendar renders lessons without teacher name.

**Status:** UI handles gracefully. No crashes.

---

### 8.4 [LOW] — Delete Guardian: Invoice Payer Blanked

**Impact chain:**
```
Guardian deleted
  → student_guardians: CASCADE (link to students severed)
  → invoices.payer_guardian_id: SET NULL (invoices preserved, payer blanked)
```

**UI handling:** InvoiceList shows "Unknown" for null payer_guardian (line 119-123 in InvoiceList.tsx).

**Status:** UI handles gracefully. No crashes.

---

### 8.5 [LOW] — Delete Location: Lessons Lose Location

**Impact chain:**
```
Location deleted
  → lessons.location_id: SET NULL (lessons preserved, no location)
  → rooms: CASCADE (all rooms at location deleted)
  → closure_dates: CASCADE (deleted)
```

**UI handling:** LessonDetailPanel conditionally renders location only if present (line 571-579). No crash on null.

**Status:** UI handles gracefully.

---

### 8.6 [MEDIUM] — Race Condition: Null Student in Calendar Participant Map

**File:** `src/hooks/useCalendarData.ts:112-115`

**Issue:** When fetching lesson participants with nested student join, if a student is deleted between the lessons query and the participants query (or CASCADE hasn't fully propagated), the `student` join returns `null`. The code stores these nulls in `participantsMap` without filtering:

```typescript
(participantsData.data || []).forEach(p => {
  const existing = participantsMap.get(p.lesson_id);
  if (existing) { existing.push(p); } else { participantsMap.set(p.lesson_id, [p]); }
  // p.student could be null here
});
```

**Downstream crash:** `LessonCard.tsx:32` accesses `participants[0].student.last_name` directly.

**Impact:** Rare but possible React crash when a student is deleted while another user is viewing the calendar.

**Fix:** Filter out participants with null students: `if (!p.student) return;`

---

## SECTION 9: RLS POLICY COMPLETENESS

### 9.1 Client-Queried Tables Inventory

Total unique tables queried from client code: **73 tables**

Key tables audited in detail:

| Table | RLS Enabled | SELECT | INSERT | UPDATE | DELETE | Status |
|---|---|---|---|---|---|---|
| lesson_notes | ✅ | ✅ org_staff | ✅ org_staff | ✅ admin/author | ✅ admin | COMPLIANT |
| enrolment_waitlist | ✅ | ✅ org_member | ❌ MISSING | ❌ MISSING | ✅ admin | **INCOMPLETE** |
| students | ✅ | ✅ org_member | ✅ org_member | ✅ org_member | ✅ admin | COMPLIANT |
| guardians | ✅ | ✅ org_member | ✅ org_member | ✅ org_member | ✅ admin | COMPLIANT |
| invoices | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |
| payments | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |
| org_memberships | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin (not owner) | COMPLIANT |
| lessons | ✅ | ✅ org_member | ✅ org_member | ✅ teacher/admin | ✅ admin | COMPLIANT |
| attendance_records | ✅ | ✅ org_member | ✅ org_member | ✅ org_member | ✅ admin | COMPLIANT |
| teachers | ✅ | ✅ org_staff | ✅ admin | ✅ admin/self | ✅ admin | COMPLIANT |
| locations | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |
| rate_cards | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |
| rooms | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |
| make_up_credits | ✅ | ✅ org+parent | ✅ staff | ✅ admin | ✅ admin | COMPLIANT |
| make_up_waitlist | ✅ | ✅ org+parent | ✅ via ALL(admin) | ✅ via ALL(admin) | ✅ via ALL(admin) | COMPLIANT* |
| practice_assignments | ✅ | ✅ org+parent | ✅ teacher | ✅ teacher | ✅ teacher | COMPLIANT |
| practice_logs | ✅ | ✅ org+parent | ✅ parent/member | ✅ teacher | ❌ MISSING | **INCOMPLETE** |
| resources | ✅ | ✅ org_staff | ✅ staff | ✅ staff | ✅ admin/uploader | COMPLIANT |
| resource_shares | ✅ | ✅ org_staff | ✅ staff | ❌ MISSING | ✅ staff | **INCOMPLETE** |
| invoice_items | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |
| billing_runs | ✅ | ✅ org_member | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |
| terms | ✅ | ✅ org_staff | ✅ via ALL(admin) | ✅ via ALL(admin) | ✅ via ALL(admin) | COMPLIANT |
| lead_activities | ✅ | ✅ org_staff | ✅ staff | ❌ MISSING | ❌ MISSING | **INCOMPLETE** |
| leads | ✅ | ✅ org_staff | ✅ staff | ✅ staff | ✅ admin | COMPLIANT |
| invites | ✅ | ✅ admin | ✅ admin | ✅ admin | ✅ admin | COMPLIANT |

*make_up_waitlist uses a FOR ALL policy for admins covering INSERT/UPDATE/DELETE.

---

### 9.2 [MEDIUM] — enrolment_waitlist Missing INSERT/UPDATE Policies

**File:** `supabase/migrations/20260227120000_*.sql`

**Issue:** The `enrolment_waitlist` table has RLS enabled with SELECT and DELETE policies, but **no INSERT or UPDATE policies** for the client. This means inserts/updates via the Supabase client will be **silently blocked** by RLS.

**Impact:** If any client code attempts to insert or update waitlist entries directly (rather than via edge function), the operation will fail. This may be intentional if all writes go through edge functions using SERVICE_ROLE_KEY, but if any client-side mutation exists, it will silently fail.

**Fix:** If client writes are intended, add INSERT/UPDATE policies. If all writes go through edge functions, document this as intentional.

---

### 9.3 [LOW] — practice_logs Missing DELETE Policy

**File:** `supabase/migrations/20260124023938_*.sql`

**Issue:** No DELETE policy on `practice_logs`. If a teacher or admin needs to delete an incorrect practice log, the operation will be blocked by RLS.

**Impact:** Practice logs cannot be deleted by anyone via the client. May be intentional (audit trail), but there's no documented reason.

**Fix:** Add DELETE policy restricted to `is_org_admin(auth.uid(), org_id)` or `is_org_staff(auth.uid(), org_id)`.

---

### 9.4 [LOW] — lead_activities Missing UPDATE/DELETE Policies

**File:** `supabase/migrations/20260225010707_*.sql`

**Issue:** `lead_activities` has SELECT and INSERT policies but no UPDATE or DELETE. Activities are append-only, which may be intentional for audit trail purposes.

**Impact:** Lead activities cannot be edited or deleted. If a staff member makes an incorrect entry, it cannot be corrected.

**Fix:** If intentional, document as immutable audit trail. Otherwise, add UPDATE/DELETE for admins.

---

### 9.5 [HIGH] — Overly Permissive USING(true) Policies

**Multiple migration files**

The following tables have `USING(true)` or `WITH CHECK(true)` policies that bypass org isolation:

| Table | Policy | Risk |
|---|---|---|
| **practice_streaks** | INSERT WITH CHECK(true), UPDATE USING(true) | **HIGH** — Any authenticated user can insert/update ANY org's streaks |
| **refunds** | ALL USING(true) WITH CHECK(true) | **MEDIUM** — Service role only table, but policy is overly broad |
| **rate_limits** | ALL USING(true) WITH CHECK(true) | **MEDIUM** — Any user can read/write rate limit records |
| **audit_log** | INSERT WITH CHECK(true) | **LOW** — Intentional for trigger-based inserts |
| **payment_notifications** | INSERT WITH CHECK(true) | **MEDIUM** — Any authenticated user can insert notifications |
| **kickstarter_signups** | INSERT WITH CHECK(true) | **LOW** — Public signup table |
| exam_boards | SELECT USING(true) | OK — Read-only reference data |
| grade_levels | SELECT USING(true) | OK — Read-only reference data |

**Most critical:** `practice_streaks` — a user in Org A could potentially insert or update streak records for students in Org B. The SELECT policies properly filter by org, but INSERT/UPDATE are wide open.

**Fix:** Replace `WITH CHECK(true)` with `WITH CHECK(is_org_member(auth.uid(), org_id))` on practice_streaks, and add org_id checks to payment_notifications and rate_limits.

---

### 9.6 [MEDIUM] — No UPDATE Prevention for org_id Column Changes

**All tables**

**Issue:** While most UPDATE policies verify the user is an org member/admin of the row's org, **none of the policies explicitly prevent changing the `org_id` column** to a different org. The USING clause checks the *current* org_id, but a WITH CHECK clause would be needed to verify the *new* org_id is also valid.

Example attack: Admin in Org A updates a student record, changing `org_id` from Org A to Org B. The USING clause passes (admin of Org A), but the student now belongs to Org B.

**Impact:** In practice, this is mitigated by the fact that most client code never sends an `org_id` field in UPDATE payloads — it's set once on INSERT. However, a malicious client could craft a direct Supabase request.

**Fix:** Add WITH CHECK clause to UPDATE policies: `WITH CHECK (org_id = (SELECT org_id FROM <table> WHERE id = id))` or use a database trigger to prevent org_id changes.

---

## SECTION 10: EDGE FUNCTION DEEP DIVE

### 10.1 Write-Capable Edge Functions Inventory

Total write-capable functions: **60**
Functions audited in detail: **13**

---

### 10.2 [CRITICAL] — seed-demo-data & seed-e2e-data: No Authentication

**File:** `supabase/functions/seed-demo-data/index.ts`, `supabase/functions/seed-e2e-data/index.ts`

**Issue:** Both seed functions have **zero authentication**. They check only whether the Supabase URL contains "localhost" or known non-production strings:

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
if (supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('staging')) {
  return new Response('Seed functions disabled in production', { status: 403 });
}
```

**Impact:**
- If the production URL check is bypassed (e.g., staging environment with production data), anyone can call these functions
- Uses `SERVICE_ROLE_KEY` to write directly to the database, bypassing ALL RLS
- Can insert/modify data with hardcoded org IDs
- No rate limiting whatsoever

**Fix:**
1. Remove these functions from production deployments entirely
2. If needed in staging, add API key authentication
3. Add rate limiting (max 1 call per hour)
4. Never deploy seed functions with `supabase functions deploy` in production

---

### 10.3 [MEDIUM] — create-billing-run: No Rate Limiting, Partial Org Verification in Retry

**File:** `supabase/functions/create-billing-run/index.ts`

**Issue:**
1. **No rate limiting** — an attacker with a valid JWT could trigger unlimited billing runs
2. In the retry flow (handleRetry), the function checks that the billing_run's org_id matches the request, but does **not** re-verify that the user still has membership in that org

**Impact:** A compromised JWT could generate unlimited billing runs, potentially creating hundreds of invoices. In retry flow, a user removed from an org could still retry a billing run if they have the billing_run_id.

**Fix:** Add rate limiting (e.g., 5 billing runs per org per hour). Re-verify org membership in handleRetry.

---

### 10.4 [LOW] — invite-accept: Well-Secured

**File:** `supabase/functions/invite-accept/index.ts`

**Analysis:**
- ✅ Verifies JWT and email match
- ✅ Blocks owner-level invites (defense-in-depth)
- ✅ Validates expiry, acceptance status, email match
- ✅ Rate limited: 10 requests per minute per user
- ✅ Token is org-specific, preventing cross-org abuse

**Status:** SECURE — exemplary implementation.

---

### 10.5 [LOW] — stripe-webhook: Well-Secured

**File:** `supabase/functions/stripe-webhook/index.ts`

**Analysis:**
- ✅ Cryptographic signature verification (Stripe webhook secret)
- ✅ Event deduplication via unique constraint (prevents double processing)
- ✅ Org resolved from Stripe metadata/subscription lookup
- ✅ Uses SERVICE_ROLE_KEY (necessary for subscription management)
- ✅ Idempotent processing

**Status:** SECURE.

---

### 10.6 [LOW] — looopassist-execute: Good Security with Minor Gaps

**File:** `supabase/functions/looopassist-execute/index.ts`

**Analysis:**
- ✅ JWT verification
- ✅ Role-based permission checking (ACTION_ROLE_PERMISSIONS map)
- ✅ Entity ownership validation (verifies entities belong to user's org)
- ✅ Input validation (max 50 entities, UUID format)
- ✅ Rate limited: 10 requests per minute
- ⚠️ Daily cap mentioned in rate-limit.ts but not enforced at function level

**Status:** GOOD — minor gap in daily cap enforcement.

---

### 10.7 [LOW] — gdpr-delete: Well-Secured

**File:** `supabase/functions/gdpr-delete/index.ts`

**Analysis:**
- ✅ JWT verification
- ✅ Requires owner/admin role
- ✅ Double verification: org membership AND entity ownership
- ✅ Validates action types (soft_delete, anonymise)
- ✅ Rate limited: 5 requests per 5 minutes

**Status:** SECURE.

---

### 10.8 [LOW] — gdpr-export: Good Security

**File:** `supabase/functions/gdpr-export/index.ts`

**Analysis:**
- ✅ JWT verification
- ✅ Requires owner/admin role
- ✅ Uses current_org_id from profile (cannot export other orgs)
- ✅ Rate limited: 5 requests per hour
- ⚠️ No explicit org_id format validation (minor)

**Status:** SECURE — user can only export their own org's data.

---

### 10.9 [MEDIUM] — booking-submit: Public Endpoint with IP Rate Limiting

**File:** `supabase/functions/booking-submit/index.ts`

**Analysis:**
- ✅ Public endpoint (no auth required — by design for prospective students)
- ✅ IP-based rate limiting: 5 submissions per 60 minutes
- ✅ Validates booking page exists and is enabled
- ✅ Validates required fields, email format
- ⚠️ Uses SERVICE_ROLE_KEY (necessary for public endpoint)
- ⚠️ No CAPTCHA or bot protection

**Impact:** Without CAPTCHA, a determined attacker could rotate IPs and flood an org with fake booking requests, each creating lead records and potentially triggering notification emails.

**Fix:** Consider adding reCAPTCHA or Turnstile verification for booking submissions.

---

### 10.10 [LOW] — account-delete: Excellent Security

**File:** `supabase/functions/account-delete/index.ts`

**Analysis:**
- ✅ JWT verification
- ✅ Checks user is not sole owner of any org (prevents orphaned orgs)
- ✅ Strict rate limiting: 2 requests per 5 minutes
- ✅ Cascade deletes properly handled

**Status:** SECURE.

---

### 10.11 [MEDIUM] — onboarding-setup: Input Validation Gap

**File:** `supabase/functions/onboarding-setup/index.ts`

**Analysis:**
- ✅ JWT verification + email confirmation check
- ✅ Idempotency guard (checks existing onboarding status)
- ✅ Input sanitization on org_name
- ✅ Whitelist validation on org_type
- ✅ Rate limited
- ⚠️ Uses SERVICE_ROLE_KEY to create org + membership + role records

**Minor concern:** The function creates both an `org_memberships` record AND a `user_roles` record. If the function is called multiple times (despite idempotency guard), race conditions could create duplicate records.

**Status:** GOOD.

---

### 10.12 [MEDIUM] — csv-import-execute: Large Attack Surface

**File:** `supabase/functions/csv-import-execute/index.ts` (50.6KB)

**Analysis:**
- ✅ JWT verification
- ✅ Admin/owner role required
- ✅ Rate limited: 10 requests per 10 minutes
- ⚠️ Large file (50.6KB) — extensive parsing logic with potential for edge cases
- ⚠️ Creates bulk records with SERVICE_ROLE_KEY
- ⚠️ File size/row count limits not immediately visible

**Impact:** A malicious CSV with thousands of rows could create excessive database records. Parsing edge cases could potentially cause unexpected behavior.

**Fix:** Ensure explicit row count limits. Add file size validation before parsing.

---

### 10.13 [LOW] — send-bulk-message: Good Security

**File:** `supabase/functions/send-bulk-message/index.ts`

**Analysis:**
- ✅ JWT verification
- ✅ Owner/admin role required
- ✅ All queries filtered by org_id
- ✅ Rate limited: 50 requests per 60 minutes
- ✅ Respects notification preferences

**Status:** SECURE.

---

## TOP 5 MOST DANGEROUS FINDINGS

### 1. [CRITICAL] — practice_streaks: USING(true) / WITH CHECK(true) Allows Cross-Org Writes

**File:** `supabase/migrations/20260124130317_*.sql:32,36`
**Issue:** The `practice_streaks` table has INSERT and UPDATE policies with `WITH CHECK(true)` and `USING(true)`, meaning any authenticated user can insert or update streak records for students in ANY organization. The SELECT policies correctly filter by org, but write policies are completely open.
**Impact:** A malicious user in Org A could inflate or reset practice streaks for students in Org B. While not a data breach, it affects data integrity and could undermine the gamification/motivation system.
**Fix:** Change INSERT policy to `WITH CHECK(is_org_member(auth.uid(), org_id))` and UPDATE policy to `USING(is_org_member(auth.uid(), org_id))`.

---

### 2. [CRITICAL] — seed-demo-data / seed-e2e-data: Zero Authentication with SERVICE_ROLE_KEY

**File:** `supabase/functions/seed-demo-data/index.ts`, `supabase/functions/seed-e2e-data/index.ts`
**Issue:** These functions require no authentication and use SERVICE_ROLE_KEY (full database access). The only protection is a string check on SUPABASE_URL to block production. If deployed to production (or if the URL check is wrong), anyone who discovers the function endpoint can write arbitrary data to the database.
**Impact:** Complete database compromise — attacker could insert, modify, or delete any data in any org. The SERVICE_ROLE_KEY bypasses all RLS policies.
**Fix:** Remove from production deploy pipeline. Add authentication. Add strict environment variable flag (`ALLOW_SEED=true`) rather than URL string matching.

---

### 3. [HIGH] — No UPDATE Prevention for org_id Column Mutation

**File:** All tables with UPDATE RLS policies
**Issue:** UPDATE policies verify the user is an admin of the *current* row's org (via USING clause), but don't verify the *new* values (no WITH CHECK clause preventing org_id changes). A malicious admin could theoretically change a record's `org_id` to move it to another org.
**Impact:** Data integrity violation — records could be moved between orgs. In practice, the Supabase client doesn't expose org_id in update forms, so this requires a crafted API request. However, a compromised admin account could exploit this.
**Fix:** Add WITH CHECK clauses to UPDATE policies that ensure org_id cannot change, or add a database trigger: `IF NEW.org_id != OLD.org_id THEN RAISE EXCEPTION 'org_id cannot be changed'; END IF;`

---

### 4. [HIGH] — enrolment_waitlist Missing INSERT/UPDATE RLS Policies

**File:** `supabase/migrations/20260227120000_*.sql`
**Issue:** The `enrolment_waitlist` table has RLS enabled but no INSERT or UPDATE policies. This means all client-side inserts and updates are **silently blocked**. If the application relies on edge functions for writes, this is fine — but if any client code attempts direct writes, they fail without error feedback.
**Impact:** If a code path attempts to insert/update waitlist entries via the Supabase client (not edge function), the operation silently fails. Users see no error but their action has no effect. This could cause data loss (e.g., student added to waitlist but entry never created).
**Fix:** Audit all code paths that write to `enrolment_waitlist`. If client writes exist, add appropriate INSERT/UPDATE policies. If all writes go through edge functions, add a code comment documenting this intentional restriction.

---

### 5. [MEDIUM] — User Removed From Org Retains UI Access Until Page Refresh

**File:** `src/contexts/OrgContext.tsx:270-292`
**Issue:** OrgContext subscribes to realtime changes on `organisations` table but NOT on `org_memberships`. When an admin removes a user from an org, the removed user's UI continues to show the org's data from React Query cache. While RLS prevents new database reads from succeeding, the cached data remains visible and the user sees confusing error messages on any action rather than a clean "you've been removed" experience.
**Impact:** Removed users see stale data and can attempt (failing) operations. While not a true security vulnerability (RLS blocks actual data access), it creates a poor security UX and could confuse users into thinking they still have access. A determined attacker could use the cached data visible in the UI before being fully signed out.
**Fix:** Add realtime subscription to `org_memberships` filtered on `user_id = auth.uid()`. On membership deletion or status change from 'active', immediately clear org state, invalidate React Query cache, and redirect to a "membership revoked" page.

---

## APPENDIX: Summary Statistics

| Category | Total Checked | Issues Found | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| Auth & Session | 8 scenarios | 4 | 0 | 0 | 2 | 2 |
| Cascade & Orphan | 36 FKs | 2 | 0 | 0 | 1 | 1 |
| RLS Policies | 25 tables | 7 | 1 | 1 | 2 | 3 |
| Edge Functions | 13 functions | 5 | 1 | 0 | 3 | 1 |
| **TOTAL** | | **18** | **2** | **1** | **8** | **7** |

**Overall assessment:** The application has strong security fundamentals — RLS is enabled on all tables, helper functions enforce org isolation consistently, and most edge functions have proper authentication and authorization. The critical findings (permissive RLS policies on practice_streaks, unauthenticated seed functions) should be addressed immediately. The high finding (org_id mutation prevention) requires a systematic fix across all tables.
