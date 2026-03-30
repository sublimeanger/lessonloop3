

# P0 Critical Fix: Admin White Screen + Solo-to-Academy Scaling

## Bug 1: RouteGuard redirects staff to /portal/home during org membership propagation

**Root cause**: When `orgInitialised` is true but `currentRole` is still null (membership not yet propagated after invite acceptance), RouteGuard immediately redirects to `/portal/home`, which rejects non-parent roles → white screen.

**Changes:**

### 1. `src/components/auth/RouteGuard.tsx` — Add role grace period

Add a `roleGraceRef` / `roleGraceDone` pattern (matching the existing `profileGraceRef` at lines 66-85):

- When `orgInitialised === true` AND `currentRole === null`, start a 5-second grace timer
- During grace, call `refreshOrganisations()` from `useOrg()` to retry fetching memberships
- Show `<AuthLoading>` during the grace period
- Only after grace expires AND role is still null, redirect to `/portal/home`
- If `currentRole` arrives during grace, cancel the timer and proceed normally

Affects lines 144-154. Import `refreshOrganisations` from the existing `useOrg()` hook (already exposed in context).

### 2. `src/pages/AcceptInvite.tsx` — Increase retry timing

Two locations (lines 149-154 and lines 255-259): change retry loop from `3 attempts × 500ms` to `5 attempts × 1000ms`, giving 5 seconds total for edge function DB writes to propagate. Also add `refreshOrganisations()` call after the profile retry loop to ensure OrgContext picks up the new membership before navigation.

---

## Bug 2: Solo teachers cannot add a second teacher

**Root cause**: Solo nav hides Teachers page; invite dialog only shows admin/teacher/finance but solo orgs need an explicit path to discover this.

**Changes:**

### 3. `src/components/layout/AppSidebar.tsx` — Add Teachers link to solo nav

Add a "Teachers" item to the `soloOwnerGroups` "Teaching" group (line 81 area):
```
{ title: 'Teachers', url: '/teachers', icon: GraduationCap }
```
This gives solo owners a path to the Teachers page where they can add staff. The `/teachers` route already allows `['owner', 'admin']` roles.

### 4. `src/components/settings/InviteMemberDialog.tsx` — Confirm teacher role is available

The invite dialog already includes "teacher" as a role option (line 130: `<SelectItem value="teacher">Teacher</SelectItem>`). No change needed here — this is already correct.

### 5. Org type transition (backend concern — note only)

When a solo_teacher org adds their first non-owner teacher, `org_type` should transition to `studio`. This is a backend/edge-function concern. The frontend will automatically show the full nav once `orgType !== 'solo_teacher'` (line 207 in AppSidebar.tsx). Flag this for backend team if not already handled.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/auth/RouteGuard.tsx` | Add roleGrace timer + refreshOrganisations retry |
| `src/pages/AcceptInvite.tsx` | Increase retry to 5×1000ms, add org refresh |
| `src/components/layout/AppSidebar.tsx` | Add Teachers nav item to soloOwnerGroups |

## What This Does NOT Change

- No changes to OrgContext.tsx (refreshOrganisations already exposed)
- No changes to InviteMemberDialog (teacher role already available)
- No changes to route config (teachers route already allows owner/admin)
- Solo nav simplification preserved — only Teachers link added

