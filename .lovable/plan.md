
# Plan: Add Guardian Portal Invite Functionality to UI

## Summary

The `GuardianInviteModal` component exists but isn't connected to any UI element. This prevents testing the parent portal flow. We need to add an "Invite to Portal" button to the Student Detail page (Guardians tab) so users can invite guardians to access their portal.

---

## The Problem

Currently:
1. The `GuardianInviteModal` component is fully implemented in `src/components/settings/GuardianInviteModal.tsx`
2. The `send-invite-email` edge function is ready to send invitation emails
3. The `invite-accept` edge function handles invitation acceptance
4. **However, there's no UI button to trigger the invite flow**

This means users cannot invite guardians to the parent portal, blocking a critical feature.

---

## Solution

Add an "Invite to Portal" button to the Student Detail page's Guardians tab. When a guardian has no `user_id` (hasn't been invited yet) and has an email address, show an "Invite to Portal" button next to their entry.

---

## Implementation Details

### File to Modify: `src/pages/StudentDetail.tsx`

**Changes Required:**

1. **Import the GuardianInviteModal component**
   ```typescript
   import { GuardianInviteModal } from '@/components/settings/GuardianInviteModal';
   ```

2. **Add state for the invite modal**
   ```typescript
   const [inviteModalOpen, setInviteModalOpen] = useState(false);
   ```

3. **Update the Guardians tab header** to include an "Invite Guardians" button alongside "Add Guardian"

4. **Render the GuardianInviteModal** at the end of the component

---

## Alternative: Add Per-Guardian Invite Button

Instead of (or in addition to) a bulk invite modal, add an individual "Invite to Portal" button next to each uninvited guardian in the list:

```text
┌─────────────────────────────────────────────────────────┐
│ Michelle Johnson          [guardian] [Primary Payer]   │
│ michelle.johnson@email.com                             │
│                           [Invite to Portal] [Remove]  │
└─────────────────────────────────────────────────────────┘
```

This requires:
1. Checking if `sg.guardian?.user_id` is null and `sg.guardian?.email` exists
2. Adding an inline "Invite" button that directly creates the invite and calls the edge function

---

## Recommended Approach

**Option A: Bulk Modal (Simpler)**
- Add one "Invite Guardians" button in the Guardians tab header
- Opens the existing `GuardianInviteModal` which shows all uninvited guardians
- Minimal code changes

**Option B: Inline Per-Guardian Buttons (Better UX)**
- Add an "Invite" button directly on each uninvited guardian row
- More immediate and contextual for users
- Requires more code but better user experience

I recommend **Option B** for better UX, but will show changes for both options.

---

## Changes Summary

### Option A: Add Modal Trigger

| File | Change |
|------|--------|
| `src/pages/StudentDetail.tsx` | Import GuardianInviteModal, add state, render modal, add "Invite Guardians" button in header |

### Option B: Inline Invite Buttons (Recommended)

| File | Change |
|------|--------|
| `src/pages/StudentDetail.tsx` | Add inline "Invite" button per guardian, implement `handleInviteGuardian` function |

---

## Technical Details for Option B

Add a new function in StudentDetail.tsx:

```typescript
const handleInviteGuardian = async (guardian: Guardian) => {
  if (!guardian.email || !currentOrg) return;
  
  try {
    // Create invite record
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        org_id: currentOrg.id,
        email: guardian.email,
        role: 'parent' as const,
        related_student_id: student?.id,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Send invite email via edge function
    await supabase.functions.invoke('send-invite-email', {
      body: {
        inviteId: invite.id,
        guardianId: guardian.id,
      },
    });

    toast({
      title: 'Invite sent',
      description: `Portal invite sent to ${guardian.full_name}`,
    });
    
    fetchStudent(); // Refresh to update UI
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    });
  }
};
```

Update the guardian list row to show invite button:

```tsx
{/* In the guardian row, add: */}
{!sg.guardian?.user_id && sg.guardian?.email && (
  <Button 
    variant="outline" 
    size="sm" 
    onClick={() => handleInviteGuardian(sg.guardian!)}
    className="gap-1"
  >
    <Send className="h-3 w-3" />
    Invite
  </Button>
)}
```

---

## Database Changes

No database changes required - the `invites` table already supports:
- `role: 'parent'` for guardian invites
- `related_student_id` to pre-link the guardian to the student

---

## Testing Plan

After implementing:
1. Navigate to Student Detail page for Oliver Johnson
2. Go to Guardians tab
3. Click "Invite" button next to Michelle Johnson
4. Verify toast shows "Invite sent"
5. Check database: `invites` table has new record with `role: 'parent'`
6. Copy invite token from database
7. Navigate to `/accept-invite?token=...`
8. Create parent account and accept invite
9. Verify redirect to `/portal/home`
10. Verify parent can see Oliver's details
