

# Organisation Members & Invitation System: UX Audit and Fixes

## Current State Analysis

After a thorough audit of the invitation and member management system, I found **7 issues** ranging from dead code to broken UX flows.

---

## Issues Found

### 1. DEAD CODE: GuardianInviteModal is never used
`src/components/settings/GuardianInviteModal.tsx` exists as a standalone component but is **never imported or rendered** anywhere in the application. Guardian invitations are already handled properly inline on the Student Detail page (via the Guardians tab). This file is redundant and should be deleted.

### 2. NO "Invite Member" button on the Settings > Members tab
The Members tab (`OrgMembersTab.tsx`) only shows existing members -- there is **no way to invite new people** from this screen. Users must know to navigate to the Teachers page to invite staff. This is a significant UX gap since users naturally expect to add members from the "Members" settings page.

**Fix:** Add an "Invite Member" button to the OrgMembersTab card header that opens an invite dialog (email + role selector for admin/teacher/finance). This reuses the same `invites` table logic already proven on the Teachers page.

### 3. NO pending invites shown on Settings > Members
When you invite someone from the Teachers page, there is no visibility of that pending invite on the Members tab. This means admins have no central view of who has been invited and is awaiting acceptance.

**Fix:** Fetch and display pending invites below the member list in the Members tab, with the ability to cancel/resend. This mirrors the "Pending Invites" section already on the Teachers page.

### 4. Duplicate invite paths cause confusion
Staff invitations can currently be sent from:
- Teachers page ("Invite to Login" button)
- Student Detail page (guardian portal invites)

But NOT from:
- Settings > Members (where users naturally look)

And the `GuardianInviteModal` in settings is dead code. This creates a confusing mental model. The fix in issue #2 above resolves this for staff invites.

### 5. Teachers page "Invite to Login" sends redundant data to edge function
The Teachers page `handleInvite` function passes `orgId`, `orgName`, `recipientEmail`, `recipientRole`, `inviteToken`, and `inviterName` in the body to `send-invite-email`. However, the edge function is designed to fetch all this data from the database using just `inviteId`. The extra fields are ignored. This is not a bug but is unnecessary code that could mislead future developers.

**Fix:** Simplify the Teachers page invite call to only pass `inviteId`, matching the pattern used in the Student Detail page.

### 6. Teachers page uses `useState` as `useEffect` for fetching invites
On the Teachers page (line 69-71), `fetchInvites()` is called inside a `useState()` callback, which is an anti-pattern. It should use `useEffect` instead.

**Fix:** Replace `useState(() => { fetchInvites(); })` with a proper `useEffect`.

### 7. OrgMembersTab: admins should also manage roles (not just owners)
Currently, role editing and member disabling are gated to `isOrgOwner` only. Based on the project's role-gating memory, admins should share broad management powers. The check should allow both owners and admins to manage non-owner members, with only ownership transfer restricted.

**Fix:** Update `canEditRole` and `canDisable` to check `isOrgAdmin` (which includes owners) instead of only `isOrgOwner`. Owners remain uneditable by admins.

---

## Implementation Plan

### Step 1: Delete dead code
- Delete `src/components/settings/GuardianInviteModal.tsx`

### Step 2: Enhance OrgMembersTab with invite capability and pending invites
- Add "Invite Member" button in the card header (visible to owners and admins)
- Add invite dialog with email field and role selector (admin, teacher, finance)
- Fetch and display pending invites with cancel/resend actions
- Use the same `invites` table insert + `send-invite-email` edge function call
- Update permission checks to allow admins (not just owners) to manage roles

### Step 3: Fix Teachers page anti-patterns
- Replace `useState(() => fetchInvites())` with `useEffect`
- Simplify the `handleInvite` body to only pass `inviteId` to `send-invite-email`

---

## Technical Details

### OrgMembersTab.tsx changes:
- Import `Input`, `Dialog`, `UserPlus`, `Send`, `RefreshCw` etc.
- Add state: `invites`, `isInviteDialogOpen`, `inviteEmail`, `inviteRole`, `isSending`
- Add `fetchInvites()` function querying `invites` table for current org, non-accepted, staff roles
- Add `handleInvite()` function: insert into `invites`, call `send-invite-email` with `inviteId`
- Add `cancelInvite()` function: delete from `invites` table
- Render "Invite Member" button in CardHeader (for `isOrgAdmin`)
- Render pending invites section below member list
- Change `canEditRole` and `canDisable` to use `isOrgAdmin` instead of `isOrgOwner`

### Teachers.tsx changes:
- Line 69-71: Replace `useState(() => { fetchInvites(); })` with `useEffect(() => { fetchInvites(); }, [currentOrg?.id])`
- Lines 108-119: Simplify `handleInvite` to only pass `{ inviteId: invite.id }` to `send-invite-email`

### File deletion:
- `src/components/settings/GuardianInviteModal.tsx` -- unused dead code

