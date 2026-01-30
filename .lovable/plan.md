
# Fix: Teachers Being Pushed to Onboarding After Accepting Invite

## Problem
When a teacher accepts an invitation, they get redirected to `/onboarding` instead of `/dashboard`. The onboarding wizard asks them to create an organisation, which is wrong - they're joining an existing one!

## Root Cause
The `invite-accept` edge function does NOT set `has_completed_onboarding = true` for invited users.

## Solution

### 1. Edge Function Fix (`supabase/functions/invite-accept/index.ts`)
Update lines 146-155 to always set `has_completed_onboarding: true`:

```typescript
// Set current org and mark onboarding complete for invited users
await supabaseAdmin
  .from("profiles")
  .update({ 
    current_org_id: invite.org_id,
    has_completed_onboarding: true 
  })
  .eq("id", user.id);
```

### 2. Frontend Fix (`src/pages/AcceptInvite.tsx`)

**acceptInvite() function** - Navigate based on role:
```typescript
if (data.role === 'parent') {
  navigate('/portal/home');
} else {
  navigate('/dashboard');
}
```

**signUpAndAccept() function** - Same role-based navigation:
- Remove redundant profile updates (edge function handles it)
- Navigate to `/portal/home` for parents, `/dashboard` for teachers/staff

## Files to Modify
| File | Change |
|------|--------|
| `supabase/functions/invite-accept/index.ts` | Set `has_completed_onboarding = true` unconditionally |
| `src/pages/AcceptInvite.tsx` | Role-based navigation, remove duplicate profile updates |

## Result
- Teachers → `/dashboard` (their schedule, assigned students)
- Parents → `/portal/home` (their children, invoices)
- No more onboarding wizard for invited users
