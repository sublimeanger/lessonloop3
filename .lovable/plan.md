

## Plan: Fix Teacher Invite Onboarding Bypass + Build Error

### Root Cause

The bug has two contributing factors:

1. **`signUpAndAccept` in AcceptInvite.tsx (line 163-261)** — After a new user signs up and the invite is accepted (which sets `has_completed_onboarding: true` on the server), the code navigates to `/dashboard` **without calling `refreshProfile()`**. The existing `acceptInvite` flow (for already-logged-in users, line 148) correctly calls `await refreshProfile()`, but the signup flow doesn't. So when RouteGuard runs, the AuthContext still has a stale/null profile and redirects to `/onboarding`.

2. **Onboarding page has no membership guard** — If a user with existing org_memberships somehow reaches `/onboarding`, it shows the full wizard instead of redirecting them to `/dashboard`.

### Changes

**1. `src/pages/AcceptInvite.tsx`** — Add `await refreshProfile()` in `signUpAndAccept` before navigating (around line 248, mirroring what `acceptInvite` does at line 148).

**2. `src/pages/Onboarding.tsx`** — In the `ensureProfile` effect (line 39), after confirming the profile exists, check for existing `org_memberships`. If the user has any active membership, redirect to `/dashboard` (or `/portal/home` for parents) instead of showing the wizard. This acts as a safety net.

**3. `supabase/functions/overdue-reminders/index.ts`** — Fix the build error: add type annotation to the `.map((i) =>` callback at line 40 to resolve the implicit `any` type.

### Why This Is Sufficient

The `invite-accept` edge function already correctly sets `has_completed_onboarding: true` and `current_org_id`. The only issue is the client not refreshing its cached profile state before navigating. The Onboarding membership guard is defense-in-depth for any other edge case.

