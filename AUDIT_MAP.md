# LessonLoop Phase 1 Audit Map

**Branch:** `audit/phase-1-map`
**Author:** Claude Code (Opus 4.7)
**Started:** 2026-04-16
**Purpose:** Navigation document for Phase 2 deep audit. Flow inventory + cross-cutting concern map + problem surface. No fixes in Phase 1.

Prior audit files referenced by filename (not duplicated):
- `audit-feature-01-auth-onboarding.md` … `audit-feature-26-payroll.md`
- `core-loop-audit-part{1,2,3}.md`
- `deep-audit-continuation-part{2,3}.md`
- `SECURITY_CORRECTNESS_AUDIT_2026-03-16.md`
- `bug-audit-report.md`
- `COHESION_AUDIT.md`
- `PRODUCTION_READINESS_DEEP_DIVE_2026-03-16.md`

Each section below is appended in its own commit to route around stream-idle timeouts.

---

## Section 1.A — Auth & Onboarding

### A1. Email+password sign-up (new owner)
- **Actor:** public
- **Entry:** `/signup` (→ `src/pages/Signup.tsx`)
- **Touchpoints:** `Signup` → `AuthContext.signUp` → `supabase.auth.signUp` → (email verify link) → `/verify-email` → `/onboarding` → `profile-ensure` edge fn → `onboarding-setup` edge fn (creates org, owner `org_memberships`, default location, terms) → `profiles.has_completed_onboarding=true`
- **Exits:** success → `/dashboard`; failure → error toast, stays on form. Unverified user → `/verify-email` loop.
- **Referenced audits:** `audit-feature-01-auth-onboarding.md`, `core-loop-audit-part1.md`
- **Priority:** CRITICAL (auth boundary + org-creation atomicity)

### A2. Sign-in
- **Actor:** owner | admin | teacher | finance | parent
- **Entry:** `/login` (also `/auth`)
- **Touchpoints:** `Login` → `AuthContext.signIn` → `supabase.auth.signInWithPassword` → `OrgContext` (loads memberships) → `RouteGuard` role resolution → redirect (`parent` → `/portal/home`, else `/dashboard` or `location.state.from`)
- **Exits:** success → role-appropriate landing; failure → error toast. Grace periods: 3s profile, 5s role.
- **Referenced audits:** `audit-feature-01-auth-onboarding.md`
- **Priority:** CRITICAL

### A3. Forgot / reset password
- **Actor:** any authenticated role
- **Entry:** `/forgot-password` → emailed magic link → `/reset-password`
- **Touchpoints:** `ForgotPassword` → `AuthContext.resetPassword` → `supabase.auth.resetPasswordForEmail` → Supabase templated email → `/reset-password` → `supabase.auth.updateUser({password})`
- **Exits:** success → `/login`; failure → error toast.
- **Referenced audits:** `audit-feature-01-auth-onboarding.md`
- **Priority:** HIGH (account takeover adjacency)

### A4. Email verification
- **Actor:** newly signed-up user
- **Entry:** `/verify-email` (after sign-up) OR Supabase confirm link → `auth.users.email_confirmed_at`
- **Touchpoints:** `VerifyEmail` → periodic `supabase.auth.getUser` poll → on confirmed, `RouteGuard` releases
- **Exits:** confirmed → `/onboarding`; unconfirmed → stays blocked from protected routes.
- **Priority:** HIGH

### A5. Staff invite — send
- **Actor:** owner | admin
- **Entry:** `/settings` → Members → "Invite" dialog (`InviteMemberDialog.tsx`)
- **Touchpoints:** `InviteMemberDialog` → `send-invite-email` edge fn → creates `org_invitations` row (token) → Resend email → recipient link `/accept-invite?token=…`
- **Exits:** success → invite pending row; failure → toast. Re-send via `PendingInvitesList`.
- **Referenced audits:** `audit-feature-03-roles-permissions.md`
- **Priority:** CRITICAL (role escalation vector — token issuance + role binding)

### A6. Staff/parent invite — accept
- **Actor:** new user OR existing user
- **Entry:** `/accept-invite?token=…` (deep-link-aware on native via `lib/native/deepLinks.ts`)
- **Touchpoints:** `AcceptInvite.tsx` → `invite-get` edge fn (redacted email preview) → if not signed in: `sessionStorage` stash → `/login` / `/signup` → back to `/accept-invite` → `invite-accept` edge fn (binds `user_id` to `org_memberships`, flips invite to accepted) → role-appropriate redirect
- **Exits:** success → `/dashboard` or `/portal/home`; failure → error message on token mismatch, expired, email mismatch.
- **Referenced audits:** `audit-feature-03-roles-permissions.md`
- **Priority:** CRITICAL (role binding, email-match enforcement)

### A7. Guardian batch invite (from student record / CSV import)
- **Actor:** owner | admin
- **Entry:** `Students.tsx` or `StudentsImport` CompleteStep
- **Touchpoints:** `batch-invite-guardians` edge fn → per-guardian `send-invite-email` → creates invite rows → Resend emails
- **Exits:** per-recipient success/failure report.
- **Referenced audits:** `audit-feature-22-parent-portal.md`
- **Priority:** HIGH

### A8. Sign-out
- **Actor:** any
- **Entry:** user menu / `signOut` button
- **Touchpoints:** `AuthContext.signOut` → `supabase.auth.signOut({scope: 'global'})` fallback to `local` → clear query cache → `/login`
- **Priority:** MEDIUM

### A9. Session resume (native app background → foreground)
- **Actor:** any (native only)
- **Entry:** Capacitor `App.appStateChange` (in `App.tsx` NativeInitializer)
- **Touchpoints:** `supabase.auth.getSession()` refresh → `queryClient.invalidateQueries()`
- **Exits:** success → refreshed data; if token expired → redirect to `/login`.
- **Priority:** HIGH (silent session loss on native)

### A10. Profile self-heal
- **Actor:** any authenticated user where `profiles` row is missing
- **Entry:** `Onboarding.tsx` on mount
- **Touchpoints:** `profile-ensure` edge fn → inserts `profiles` row → `refreshProfile`
- **Priority:** HIGH (RouteGuard 3s grace depends on this)

### A11. Zoom OAuth connect
- **Actor:** owner | admin | teacher (personal Zoom)
- **Entry:** `/settings` → Integrations → "Connect Zoom" → Zoom consent → `/auth/zoom/callback`
- **Touchpoints:** `zoom-oauth-start` edge fn → Zoom authorize → `zoom-oauth-callback` edge fn (token exchange, store in `zoom_connections`) → `ZoomOAuthCallback` page closes/redirects
- **Priority:** MEDIUM

### A12. Google Calendar OAuth connect
- **Actor:** owner | admin | teacher
- **Entry:** `/settings` → Integrations → "Connect Google"
- **Touchpoints:** `calendar-oauth-start` → Google consent → `calendar-oauth-callback` (stores tokens in `calendar_connections`) → subsequent `calendar-refresh-busy` cron uses tokens
- **Priority:** HIGH (third-party token storage + cron dependency)

---
