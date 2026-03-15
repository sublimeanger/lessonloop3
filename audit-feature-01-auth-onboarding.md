# Production Readiness Audit — Feature 1: Authentication & Onboarding

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Email/password signup, login, password reset, email verification, invite-accept, org creation, onboarding wizard, session management, logout

---

## 1. Files Audited

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/onboarding-setup/index.ts` | Org creation during onboarding wizard |
| `supabase/functions/invite-accept/index.ts` | Accept invitation, create membership, link teacher/guardian |
| `supabase/functions/invite-get/index.ts` | Retrieve invite details (public, IP rate-limited) |
| `supabase/functions/send-invite-email/index.ts` | Send invitation email via Resend |
| `supabase/functions/profile-ensure/index.ts` | Ensure profile exists (self-healing fallback) |
| `supabase/functions/_shared/cors.ts` | CORS origin validation |
| `supabase/functions/_shared/rate-limit.ts` | Per-user and per-IP rate limiting |

### Frontend
| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | Auth state, session management, token refresh |
| `src/contexts/OrgContext.tsx` | Org selection, timezone/currency from org |
| `src/pages/Login.tsx` | Email/password + OAuth login |
| `src/pages/Signup.tsx` | New account creation |
| `src/pages/Onboarding.tsx` | Org setup wizard (5 steps) |
| `src/pages/AcceptInvite.tsx` | Invite acceptance (logged-in + new signup paths) |
| `src/pages/ResetPassword.tsx` | Password reset flow |
| `src/pages/VerifyEmail.tsx` | Email verification pending screen |
| `src/components/auth/RouteGuard.tsx` | Route protection, role checks, email confirmation gate |
| `src/components/auth/PasswordStrengthIndicator.tsx` | Password strength + HIBP breach check |
| `src/integrations/supabase/client.ts` | Supabase client configuration |
| `src/config/routes.ts` | Route definitions with auth types |
| `src/lib/error-handler.ts` | Error normalization (auth errors) |

### SQL Migrations (auth-related)
| File | Purpose |
|------|---------|
| `supabase/migrations/20260119230917_*.sql` | profiles, user_roles, handle_new_user trigger |
| `supabase/migrations/20260119231348_*.sql` | organisations, org_memberships, invites, handle_new_organisation trigger |
| `supabase/migrations/20260119232402_*.sql` | students, guardians, student_guardians |
| `supabase/migrations/20260120101011_*.sql` | Parent/guardian portal functions and policies |
| `supabase/migrations/20260120215727_*.sql` | Security helper functions (is_org_staff, is_assigned_teacher) |
| `supabase/migrations/20260120215754_*.sql` | Updated RLS policies for guardians, student_guardians |
| `supabase/migrations/20260123012557_*.sql` | Anonymous access blocking |
| `supabase/migrations/20260128181232_*.sql` | Teacher profiles RLS fixes |
| `supabase/migrations/20260208220540_*.sql` | Co-member profile visibility |
| `supabase/migrations/20260222192914_*.sql` | protect_onboarding_flag trigger |
| `supabase/migrations/20260315100300_*.sql` | prevent_org_id_mutation trigger |
| `supabase/migrations/20260130150728_*.sql` | related_student_id on invites |

---

## 2. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| AUTH-01 | **HIGH** | `onboarding-setup` has no explicit rate limit config — falls through to `default` (100 req/min). An attacker could create 100 orgs/minute before being rate-limited. | `_shared/rate-limit.ts`, `onboarding-setup/index.ts` | Add `"onboarding-setup": { maxRequests: 3, windowMinutes: 60 }` to RATE_LIMITS |
| AUTH-02 | **MEDIUM** | `handle_new_user()` trigger assigns `owner` role to ALL new signups in `user_roles` table. Users who sign up via invite also get an `owner` role in `user_roles` even though their org membership role may be `teacher` or `parent`. The `user_roles` table appears vestigial — the app uses `org_memberships.role` for actual access control. | `20260119230917_*.sql` | Either: (a) remove `user_roles` INSERT from `handle_new_user()` and deprecate the table, or (b) document that `user_roles` is only used as a legacy fallback and has no security impact |
| AUTH-03 | **MEDIUM** | `handle_new_organisation()` trigger sets `current_org_id` with `WHERE current_org_id IS NULL`. This is safe for first org but means if a user creates a second org, their `current_org_id` won't switch to it. The `onboarding-setup` edge function explicitly sets `current_org_id` after org creation (line 303-309), so this works — but there's a timing race where the trigger and edge function both try to set it. | `20260119231348_*.sql`, `onboarding-setup/index.ts` | Harmless race (both set same value) — no fix needed, but document the dual-write |
| AUTH-04 | **MEDIUM** | `org_memberships` INSERT policy requires `is_org_admin()`. During onboarding, the org doesn't exist yet, so the trigger (`handle_new_organisation`) creates the first membership via SECURITY DEFINER. But `onboarding-setup` also creates membership manually (line 272) using service_role if trigger didn't fire. This means there are two code paths for first membership creation — any drift could cause issues. | `20260119231348_*.sql`, `onboarding-setup/index.ts` | The belt-and-suspenders approach is actually good. Add a comment in both places referencing the other path. |
| AUTH-05 | **MEDIUM** | `send-invite-email` constructs invite URL using `req.headers.get("origin")` as fallback (line 109). A malicious admin could send requests with a crafted `Origin` header to make invite emails point to a phishing domain. | `send-invite-email/index.ts` | Remove `req.headers.get("origin")` fallback. Use only `FRONTEND_URL` env var or hardcoded `https://app.lessonloop.net` |
| AUTH-06 | **LOW** | Password requirements are enforced client-side only (min 8 chars). Supabase Auth itself has a default minimum of 6 characters. A direct API call to Supabase Auth could bypass the client-side 8-char minimum. | `PasswordStrengthIndicator.tsx`, `Signup.tsx` | Set minimum password length to 8 in Supabase dashboard (Authentication > Policies) |
| AUTH-07 | **LOW** | No explicit rate limit on login attempts from the frontend. Supabase Auth has built-in rate limiting but it's relatively generous. The app doesn't implement any client-side lockout or progressive delay. | `Login.tsx`, `AuthContext.tsx` | Supabase's built-in auth rate limiting is generally sufficient. Consider adding Cloudflare WAF rate limiting on `/auth/v1/token` for defense-in-depth (deferred to post-beta per CLAUDE.md). |
| AUTH-08 | **LOW** | `invite-get` endpoint does not require authentication (by design — the invite link works for unauthenticated users). It returns the org name and redacted email. An attacker who obtains an invite token can see which org issued it. | `invite-get/index.ts` | Acceptable risk — tokens are UUIDs (unguessable), and the endpoint is IP rate-limited (5/min). No fix needed. |
| AUTH-09 | **LOW** | `onboarding-setup` logs org_name to console (line 147). Not a security risk in Supabase edge functions (logs are server-side only), but could leak business data in log aggregation systems. | `onboarding-setup/index.ts` | Consider removing org_name from log line, keeping only org_id |
| AUTH-10 | **LOW** | `invite-accept` does not check whether the invited user's email is verified (`email_confirmed_at`). A user could sign up, not verify email, and still accept an invite. The `onboarding-setup` flow blocks unverified emails (line 56), but `invite-accept` doesn't. | `invite-accept/index.ts` | Add email verification check to `invite-accept` to match `onboarding-setup` behavior |
| AUTH-11 | **INFO** | Leaked password protection is NOT enabled in Supabase dashboard (per CLAUDE.md SEC-H1). This is a manual toggle Jamie needs to enable. | Supabase Dashboard | Enable in Supabase Dashboard > Authentication > Policies > Leaked Password Protection |
| AUTH-12 | **INFO** | HIBP breach check in `PasswordStrengthIndicator` is advisory only (shows warning, doesn't block signup). Network errors silently pass. This is acceptable UX but worth documenting. | `PasswordStrengthIndicator.tsx` | No fix needed — current behavior is correct (advisory warning, non-blocking) |
| AUTH-13 | **INFO** | No country/currency selector in onboarding wizard — auto-detected from browser timezone with fallback to GB/GBP. Limited timezone-to-country mapping (7 zones + Australia wildcard). Users in unmapped timezones (e.g., Canada, most of Europe) get GB/GBP defaults. | `onboarding-setup/index.ts` (lines 214-227) | Consider expanding timezone map or adding explicit country/currency selector in onboarding. Not a blocker — settings can be changed later. |

---

## 3. User Flow Trace: Signup to First Dashboard View

| Step | Component/Function | Action | Database Changes |
|------|-------------------|--------|-----------------|
| 1 | `Signup.tsx` | User enters name, email, password | — |
| 2 | `Signup.tsx` | Client-side validation: min 8 chars, strength indicator, optional HIBP check | — |
| 3 | `AuthContext.signUp()` | Calls `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` | `auth.users` INSERT |
| 4 | `handle_new_user()` trigger | AFTER INSERT on auth.users | `profiles` INSERT (has_completed_onboarding=false), `user_roles` INSERT (role='owner') |
| 5 | `Signup.tsx` | Shows "Check your email" screen | — |
| 6 | User clicks verification link | Supabase sets `email_confirmed_at` on `auth.users` | `auth.users` UPDATE |
| 7 | `VerifyEmail.tsx` | Detects confirmed email, redirects to `/onboarding` | — |
| 8 | `RouteGuard.tsx` | Checks `has_completed_onboarding=false`, allows access to `/onboarding` | — |
| 9 | `Onboarding.tsx` Step 1 (Welcome) | User enters full name, selects org type | — (sessionStorage only) |
| 10 | `Onboarding.tsx` Step 2 (Teaching Profile) | User enters org name, team size, instruments | — (sessionStorage only) |
| 11 | `Onboarding.tsx` Step 3 (Migration) | User selects data import approach | — (sessionStorage only) |
| 12 | `Onboarding.tsx` Step 4 (Plan) | User selects subscription plan | — (sessionStorage only) |
| 13 | `Onboarding.tsx` Submit | Calls `onboarding-setup` edge function | — |
| 14 | `onboarding-setup` | Validates auth, email confirmed, rate limit | — |
| 15 | `onboarding-setup` | **Idempotency check**: if already onboarded, returns existing org_id | — |
| 16 | `onboarding-setup` | Creates/updates profile with full_name | `profiles` UPDATE |
| 17 | `onboarding-setup` | Creates organisation with trial, timezone, currency | `organisations` INSERT |
| 18 | `handle_new_organisation()` trigger | Creates owner membership, sets current_org_id | `org_memberships` INSERT, `profiles` UPDATE |
| 19 | `onboarding-setup` | Waits for trigger membership (3 attempts, 200ms), creates manually if missing | Possible `org_memberships` INSERT |
| 20 | `onboarding-setup` | Creates teacher record if solo_teacher or also_teaches | `teachers` INSERT |
| 21 | `onboarding-setup` | Sets `has_completed_onboarding=true`, `current_org_id` | `profiles` UPDATE |
| 22 | `Onboarding.tsx` | Optional CSV import via `csv-import-execute` | Various table INSERTs |
| 23 | `RouteGuard.tsx` | Profile refresh detects onboarding complete, redirects to `/dashboard` | — |

---

## 4. User Flow Trace: Invite-Accept

| Step | Component/Function | Action | Database Changes |
|------|-------------------|--------|-----------------|
| 1 | Admin creates invite | `invites` INSERT via RLS (admin/owner) + `send-invite-email` edge function | `invites` INSERT, `message_log` INSERT |
| 2 | User clicks invite link | Opens `/accept-invite?token=<uuid>` | — |
| 3 | `AcceptInvite.tsx` | Calls `invite-get` edge function with token | — |
| 4 | `invite-get` | IP rate-limited (5/min), returns redacted email + org name + role | — |
| **Path A: User is already logged in** | | | |
| 5a | `AcceptInvite.tsx` | Validates email matches (first char + domain comparison) | — |
| 6a | `AcceptInvite.tsx` | Calls `invite-accept` edge function | — |
| 7a | `invite-accept` | Validates auth, rate limit, checks invite not expired/accepted | — |
| 8a | `invite-accept` | Strict email match (case-insensitive full email) | — |
| 9a | `invite-accept` | Blocks `owner`-role invites (defense-in-depth) | — |
| 10a | `invite-accept` | Upserts `org_memberships` (org_id, user_id, role, status=active) | `org_memberships` UPSERT |
| 11a | `invite-accept` | If teacher: links/creates teacher record | `teachers` INSERT or UPDATE |
| 12a | `invite-accept` | If parent: creates guardian + student_guardians link (with `org_id`) | `guardians` INSERT, `student_guardians` INSERT |
| 13a | `invite-accept` | Marks invite accepted, sets `current_org_id` + `has_completed_onboarding=true` | `invites` UPDATE, `profiles` UPDATE |
| 14a | `AcceptInvite.tsx` | Refreshes profile (3 retries, 500ms), navigates to dashboard/portal | — |
| **Path B: New user signup via invite** | | | |
| 5b | `AcceptInvite.tsx` | User enters email, name, password | — |
| 6b | `AcceptInvite.tsx` | Calls `supabase.auth.signUp()` | `auth.users` INSERT |
| 7b | `handle_new_user()` trigger | Creates profile + user_roles('owner') | `profiles` INSERT, `user_roles` INSERT |
| 8b | `AcceptInvite.tsx` | Polls for profile creation (10 retries, 500ms) | — |
| 9b | `AcceptInvite.tsx` | Calls `invite-accept` edge function | — |
| 10b-14b | Same as Path A steps 7a-14a | | |

---

## 5. RLS Policy Matrix

### profiles
| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Users can view their own profile | `auth.uid() = id` |
| SELECT | Org members can view co-member profiles | `id IN (SELECT om2.user_id FROM org_memberships om1 JOIN om2 ...)` |
| INSERT | Users can insert their own profile | `auth.uid() = id` |
| UPDATE | Users can update their own profile | `auth.uid() = id` |
| DELETE | — | No DELETE policy (profiles cannot be deleted via RLS) |
| ALL (anon) | Block anonymous access | `USING (false)` |

**Protection trigger:** `protect_onboarding_flag()` — only `service_role` can modify `has_completed_onboarding`

### organisations
| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Users can view their organisations | `is_org_member(auth.uid(), id)` |
| INSERT | Authenticated users can create | `auth.uid() = created_by` |
| UPDATE | Org admins can update | `is_org_admin(auth.uid(), id)` |
| DELETE | Org owners can delete | `has_org_role(auth.uid(), id, 'owner')` |

### org_memberships
| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Members can view | `is_org_member(auth.uid(), org_id)` |
| INSERT | Org admins can create | `is_org_admin(auth.uid(), org_id)` |
| UPDATE | Org admins can update | `is_org_admin(auth.uid(), org_id)` |
| DELETE | Org admins can delete (not owners) | `is_org_admin(auth.uid(), org_id) AND role != 'owner'` |

### invites
| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Org admins can view | `is_org_admin(auth.uid(), org_id)` |
| INSERT | Org admins can create | `is_org_admin(auth.uid(), org_id)` |
| UPDATE | Org admins can update | `is_org_admin(auth.uid(), org_id)` |
| DELETE | Org admins can delete | `is_org_admin(auth.uid(), org_id)` |

### guardians
| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Admin can view (active) | `deleted_at IS NULL AND is_org_admin(auth.uid(), org_id)` |
| SELECT | Admin can view (deleted) | `deleted_at IS NOT NULL AND is_org_admin(auth.uid(), org_id)` |
| SELECT | Teacher (assigned students only) | `has_org_role() AND EXISTS(student_guardians JOIN student_teacher_assignments)` |
| SELECT | Finance can view | `has_org_role(auth.uid(), org_id, 'finance')` |
| SELECT | Parent can view own record | `user_id = auth.uid()` |
| INSERT | Admin only | `is_org_admin(auth.uid(), org_id)` |
| UPDATE | Admin only | `is_org_admin(auth.uid(), org_id)` |
| DELETE | Admin only | `is_org_admin(auth.uid(), org_id)` |

### student_guardians
| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Admin can view | `is_org_admin(auth.uid(), org_id)` |
| SELECT | Teacher (assigned) | `has_org_role('teacher') AND is_assigned_teacher()` |
| SELECT | Finance | `has_org_role('finance')` |
| SELECT | Parent (own links) | `is_parent_of_student(auth.uid(), student_id)` |
| INSERT | Admin only | `is_org_admin(auth.uid(), org_id)` |
| UPDATE | Admin only | `is_org_admin(auth.uid(), org_id)` |
| DELETE | Admin only | `is_org_admin(auth.uid(), org_id)` |

### user_roles
| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Users can view own | `auth.uid() = user_id` |
| ALL (anon) | Blocked | `USING (false)` |

### Security Helper Functions (all SECURITY DEFINER, search_path = public)
- `is_org_member(_user_id, _org_id)` — checks active membership
- `has_org_role(_user_id, _org_id, _role)` — checks specific role
- `is_org_admin(_user_id, _org_id)` — checks owner/admin
- `is_parent_of_student(_user_id, _student_id)` — checks guardian link
- `is_assigned_teacher(_user_id, _org_id, _student_id)` — checks teacher assignment

---

## 6. Edge Case Analysis

| Scenario | What Happens | Status |
|----------|-------------|--------|
| User signs up but doesn't verify email | Profile created with `has_completed_onboarding=false`. RouteGuard redirects to `/verify-email`. Cannot access onboarding or dashboard. `onboarding-setup` rejects with 403 "Please verify your email". | SAFE |
| User clicks expired invite link | `invite-get` returns 400 with org name for friendly UI. `invite-accept` returns 400 "invitation has expired". UI shows expiry message with "request a new invite" option. | SAFE |
| User accepts invite for org they're already in | `org_memberships` UPSERT on `(org_id, user_id)` — updates role to invite's role, no duplicate. `invite-accept` succeeds idempotently. | SAFE |
| Org owner is deleted | `auth.users(id)` CASCADE deletes profile. `organisations.created_by` ON DELETE SET NULL (org persists). `org_memberships` CASCADE deletes owner membership. **Risk:** Org has no owner. | MEDIUM RISK — org becomes ownerless |
| Password reset for non-existent email | Supabase Auth returns success (no account enumeration). No email sent. | SAFE |
| User has accounts in multiple orgs | `current_org_id` tracks selected org. `OrgContext` loads all active memberships. Org switcher available. | SAFE |
| Session token expires | Supabase SDK auto-refreshes. If refresh fails, `onAuthStateChange` fires SIGNED_OUT. AuthContext shows "Session expired" toast and redirects to login. | SAFE |
| Supabase auth is down | 6-second hard timeout in AuthContext. After 8 seconds, RouteGuard shows "Logout and try again" button. Network error handler detects connection issues. | SAFE |
| Two simultaneous signups (race) | `handle_new_user()` trigger runs twice. Profile INSERT has PK constraint on `id` (tied to auth.users), so no duplicate profiles. `profile-ensure` handles `23505` unique violation gracefully. | SAFE |
| Invite-accept runs twice | `accepted_at` check returns "already accepted" on second call. `org_memberships` UPSERT is idempotent. | SAFE |
| Onboarding submitted twice | Idempotency guard checks `has_completed_onboarding && current_org_id` — returns existing org on second call. | SAFE |
| User tries to escalate role via invite | Owner-role invites blocked at `invite-accept` (defense-in-depth). Only admin/owner can create invites (RLS). | SAFE |
| Unverified user accepts invite | `invite-accept` does NOT check `email_confirmed_at`. User can accept invite without verifying email. | LOW RISK (see AUTH-10) |

---

## 7. Verdict

### PRODUCTION READY — with 2 recommended fixes before launch

**Blocking Issues (should fix before production):**

1. **AUTH-01 (HIGH):** Add explicit rate limit for `onboarding-setup` to prevent mass org creation. One-line fix in `rate-limit.ts`.
2. **AUTH-05 (MEDIUM):** Remove `req.headers.get("origin")` fallback in `send-invite-email` to prevent invite URL manipulation.

**Recommended Before Launch (non-blocking):**

3. **AUTH-06 (LOW):** Set minimum password length to 8 in Supabase dashboard.
4. **AUTH-10 (LOW):** Add email verification check to `invite-accept`.
5. **AUTH-11 (INFO):** Enable leaked password protection in Supabase dashboard (SEC-H1 — already tracked).

**Overall Assessment:**

The authentication and onboarding system is well-architected with strong security practices:
- Proper JWT validation on all edge functions via `auth.getUser()` (not just token decode)
- Comprehensive rate limiting on all auth-related endpoints
- CORS origin validation with explicit allowlist
- Account enumeration protection on login
- Global signout invalidating refresh tokens server-side
- HIBP breach check on password selection (advisory)
- Onboarding idempotency via `has_completed_onboarding` flag (protected by trigger)
- Defense-in-depth on invite-accept (blocks owner role, email match, expiry check)
- `org_id` properly set on all `student_guardians` inserts (known bug was fixed)
- No service_role key exposure in frontend
- No console.log of tokens or sensitive data
- Open-redirect prevention on route guards
- Anonymous access blocked on all auth tables

The two blocking issues are simple fixes (one config line, one line removal). The system is otherwise production-ready.
