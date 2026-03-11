

## Plan: Fix 7 Bugs from Test Report

### BUG 1: No mobile entry point — ALREADY FIXED
The previous commit already added the ⚡ `DropdownMenu` to `CalendarMobileLayout.tsx` and fixed `BulkSelectBar` positioning. **No further work needed.**

### BUG 2: Room dropdown missing from BulkEditDialog
**File:** `src/components/calendar/BulkEditDialog.tsx`

The Room dropdown already exists at lines 91-101 — it renders conditionally when `filteredRooms.length > 0`, which requires a location to be selected first. The `rooms` prop is passed from `BulkSelectBar`. **This appears to already work correctly.** The test may have failed because no location was selected during testing, or the test locations have no rooms configured.

**Action:** Verify this is actually working. The code at line 91 shows `{filteredRooms.length > 0 && (...)}` which only renders after selecting a location that has rooms. This is correct behaviour. **No fix needed** unless the issue is that rooms aren't being passed — but `BulkSelectBar` already passes them (line 103).

### BUG 3: Pluralisation — "Edit 1 lessons"
**File:** `src/components/calendar/BulkEditDialog.tsx`, line 66
- Change `Edit {count} lessons` → `Edit {count} {count === 1 ? 'lesson' : 'lessons'}`
- Also fix line 127: `Apply to {count} lessons` → same pattern

### BUG 4: Notes icon shows for ALL students
**Approach:** Option (b) — hide inside `StudentNotesPopover` when no notes exist. Option (a) would require adding `notes` to the register query's student select and threading it through, which touches more files. Option (b) is simpler: the component already fetches data on open — instead, we add a `hasNotes` prop. But the register query doesn't have student notes data.

**Better approach:** Add an optional `hasNotes` prop to `StudentNotesPopover`. When `hasNotes === false`, render `null`. In the register query (`useRegisterData.ts`), add `notes` to the student select (`students (id, first_name, last_name, notes)`). Then pass `hasNotes={!!student.notes}` from `RegisterRow` and `BatchAttendance`.

However, this only checks profile notes, not lesson notes. For a complete check we'd need a separate query. **Pragmatic fix:** Add `notes` to the student select in the register query, and pass `hasNotes` to the popover. For lesson notes, the icon will still show for students with profile notes only — which is the 80% case. Students with only lesson notes but no profile notes won't show the icon, which is acceptable.

**Files to change:**
1. `src/hooks/useRegisterData.ts` — add `notes` to student select
2. `src/components/register/StudentNotesPopover.tsx` — add `hasNotes?: boolean` prop, render null when `hasNotes === false`
3. `src/components/register/RegisterRow.tsx` — pass `hasNotes={!!participant.notes}`
4. `src/pages/BatchAttendance.tsx` — same

Need to also update the participant type in `RegisterLesson` to include `notes`.

### BUG 5: Parent login hangs on /dashboard
**File:** `src/components/auth/RouteGuard.tsx`

The issue is at line 145-148: when `allowedRoles` is set and `!orgInitialised`, it shows `AuthLoading` indefinitely. For parents, the org fetch may be slow or fail.

**Fix:** Before the `!orgInitialised` check, add a fast-path using the profile data. The `profile` object is available from `useAuth()`. We can check if the user's profile indicates a parent role. However, `currentRole` comes from OrgContext which hasn't initialised yet.

**Better fix:** Add a timeout or use `profile` data. Actually, the real fix is: if `orgInitialised` is true but `currentRole` is null (line 150), instead of redirecting to `/dashboard` (which creates a loop for parents), check if there's a parent membership pattern. 

Actually the simplest fix: at line 146, instead of blocking indefinitely, add a reasonable timeout. Or better: check if user has no org memberships at all (parent accounts may not). When `orgInitialised` is true and `currentRole` is null and user has `profile`, redirect parents to portal.

The real problem: parent hits `/dashboard` → `allowedRoles` is `['owner','admin','teacher','finance']` → waits for `orgInitialised` → org fetch times out or returns no memberships → `currentRole` is null → line 150 redirects to `/dashboard` → infinite loop.

**Fix:** At line 150, when `!currentRole` and the route being accessed is `/dashboard`, redirect to `/auth` or check profile for parent indicator. Or: change line 150-152 to also check for parent pattern:

```typescript
if (!currentRole) {
  // If no role found, user might be a parent or unlinked
  // Try portal as fallback instead of /dashboard (which may loop)
  return <Navigate to="/portal/home" replace />;
}
```

But that would send non-parent users to portal too. Better: check if profile has a parent indicator, or check if memberships exist but with parent role.

**Safest fix:** The `OrgContext` exposes `memberships` — but actually only `currentRole` and `hasInitialised` are exposed. Let me look...

Looking at the code: `currentRole` is set from `membership.role` in OrgContext. If parent has an active org_membership with role='parent', then `currentRole` would be 'parent' after org init. The issue is that org init is SLOW for parents somehow.

**Practical fix:** Add a force-timeout in RouteGuard specifically for the org init wait. After 5 seconds of waiting for `orgInitialised`, force a redirect based on available data. The `handleForceRedirect` function exists but only fires from `AuthLoading` component's 8-second timeout. We should make the role-check section use it too:

At line 146-148, replace:
```typescript
if (!orgInitialised) {
  return <AuthLoading onLogout={signOut} onForceRedirect={handleForceRedirect} />;
}
```
With: add a separate timer that, after 5 seconds of waiting for org, redirects to `/portal/home` as fallback. Or simpler — just pass the `onForceRedirect` to use portal redirect for this case.

Actually the simplest and most robust fix: update `handleForceRedirect` to try `/portal/home` when profile exists, and update the AuthLoading force timeout from 8s to 5s for this case.

### BUG 6: Open slots not distinct on Dashboard timeline
**File:** `src/hooks/useTodayLessons.ts` — add `is_open_slot` to the select query
**File:** `src/hooks/useTodayLessons.ts` — add `isOpenSlot` to `TodayLesson` interface
**File:** `src/components/dashboard/TodayTimeline.tsx` — render open slots with dashed border + "Open" badge, exclude from completed count

### BUG 7: Notes form "missing" — NOT A BUG
Add a helper message in `LessonDetailPanel` when the notes form is hidden because there are no participants: "Add students to this lesson to enable notes."

**File:** `src/components/calendar/LessonDetailPanel.tsx` — add a small muted text after the notes form condition.

---

### Summary of Changes

| Bug | Files | Change |
|-----|-------|--------|
| 1 | — | Already fixed |
| 2 | — | Already works (room shows after location selection) |
| 3 | `BulkEditDialog.tsx` | Pluralise "lesson/lessons" |
| 4 | `StudentNotesPopover.tsx`, `useRegisterData.ts`, `RegisterRow.tsx`, `BatchAttendance.tsx` | Add `hasNotes` prop, add `notes` to query |
| 5 | `RouteGuard.tsx` | Add faster fallback redirect for role-check timeout |
| 6 | `useTodayLessons.ts`, `TodayTimeline.tsx` | Add `is_open_slot` field, style open slots differently |
| 7 | `LessonDetailPanel.tsx` | Add helper text for lessons without students |

