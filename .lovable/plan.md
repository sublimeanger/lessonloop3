

# Plan: Add Invite Status Tracking to Guardians Tab

## Summary

Enhance the Guardians tab in StudentDetail.tsx to show invite status (pending, expired) and replace the generic "Invite" button with contextual actions:
- **Uninvited**: Show "Invite" button (current behavior)
- **Invite Pending**: Show "Invite Pending" badge + "Resend" button
- **Invite Expired**: Show "Invite Expired" badge + "Resend" button
- **Portal Access**: Show "Portal Access" badge (already implemented)

---

## Current Behavior

| Guardian State | Current Display |
|----------------|-----------------|
| No email | Nothing shown |
| Has email, no user_id | "Invite" button |
| Has user_id | "Portal Access" badge |

**Problem**: After sending an invite, the "Invite" button remains visible because we don't check for pending invites. This could lead to duplicate invites being created.

---

## Enhanced Behavior

| Guardian State | New Display |
|----------------|-------------|
| No email | Nothing shown |
| Has email, no invite, no user_id | "Invite" button |
| Has email, pending invite (not expired) | "Invite Pending" badge + "Resend Invite" button |
| Has email, expired invite | "Invite Expired" badge + "Resend Invite" button |
| Has user_id | "Portal Access" badge |

---

## Implementation Details

### 1. Create New Interface for Invite Status

```typescript
interface GuardianInviteStatus {
  guardianId: string;
  inviteId: string | null;
  inviteStatus: 'none' | 'pending' | 'expired' | 'accepted';
  expiresAt?: string;
}
```

### 2. Add State for Invite Statuses

```typescript
const [guardianInvites, setGuardianInvites] = useState<Record<string, GuardianInviteStatus>>({});
```

### 3. Create Function to Fetch Invite Statuses

Query the `invites` table for all guardian emails in the current org with role='parent':

```typescript
const fetchGuardianInvites = async () => {
  if (!currentOrg) return;
  
  // Get all guardian emails for this org
  const guardianEmails = guardians
    .map(sg => sg.guardian?.email)
    .filter(Boolean);
  
  if (guardianEmails.length === 0) return;
  
  const { data } = await supabase
    .from('invites')
    .select('id, email, expires_at, accepted_at')
    .eq('org_id', currentOrg.id)
    .eq('role', 'parent')
    .in('email', guardianEmails);
  
  // Map by email to guardian
  const inviteMap: Record<string, GuardianInviteStatus> = {};
  guardians.forEach(sg => {
    const guardian = sg.guardian;
    if (!guardian?.email) return;
    
    const invite = data?.find(i => i.email === guardian.email);
    if (!invite) {
      inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: null, inviteStatus: 'none' };
    } else if (invite.accepted_at) {
      inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: invite.id, inviteStatus: 'accepted' };
    } else if (new Date(invite.expires_at) < new Date()) {
      inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: invite.id, inviteStatus: 'expired', expiresAt: invite.expires_at };
    } else {
      inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: invite.id, inviteStatus: 'pending', expiresAt: invite.expires_at };
    }
  });
  
  setGuardianInvites(inviteMap);
};
```

### 4. Call fetchGuardianInvites After fetchGuardians

Update useEffect to fetch invite statuses after guardians are loaded:

```typescript
useEffect(() => {
  fetchStudent();
  fetchGuardians();
}, [id, currentOrg?.id]);

useEffect(() => {
  if (guardians.length > 0) {
    fetchGuardianInvites();
  }
}, [guardians]);
```

### 5. Update handleInviteGuardian to Support Resend

Modify the function to handle resending by deleting the old invite first (or updating it):

```typescript
const handleInviteGuardian = async (guardian: Guardian, existingInviteId?: string) => {
  if (!guardian.email || !currentOrg || !student) return;
  setInvitingGuardianId(guardian.id);

  try {
    // If resending, delete the old invite first
    if (existingInviteId) {
      await supabase
        .from('invites')
        .delete()
        .eq('id', existingInviteId);
    }

    // Create new invite record
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        org_id: currentOrg.id,
        email: guardian.email,
        role: 'parent' as const,
        related_student_id: student.id,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Send invite email via edge function
    await supabase.functions.invoke('send-invite-email', {
      body: { inviteId: invite.id, guardianId: guardian.id },
    });

    toast({
      title: existingInviteId ? 'Invite resent' : 'Invite sent',
      description: `Portal invite sent to ${guardian.full_name} at ${guardian.email}`,
    });

    fetchGuardians();
  } catch (error: any) {
    toast({
      title: 'Error sending invite',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setInvitingGuardianId(null);
  }
};
```

### 6. Update Guardian Row UI

Replace the current invite button logic with status-aware rendering:

```tsx
{/* Invite status and actions */}
{isOrgAdmin && !sg.guardian?.user_id && sg.guardian?.email && (() => {
  const inviteStatus = guardianInvites[sg.guardian.id];
  const isInviting = invitingGuardianId === sg.guardian.id;
  
  if (!inviteStatus || inviteStatus.inviteStatus === 'none') {
    // No invite sent yet
    return (
      <Button variant="outline" size="sm" onClick={() => handleInviteGuardian(sg.guardian!)} disabled={isInviting} className="gap-1">
        {isInviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        Invite
      </Button>
    );
  } else if (inviteStatus.inviteStatus === 'pending') {
    // Invite pending
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">Invite Pending</Badge>
        <Button variant="ghost" size="sm" onClick={() => handleInviteGuardian(sg.guardian!, inviteStatus.inviteId!)} disabled={isInviting} className="gap-1 text-xs">
          {isInviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Resend
        </Button>
      </div>
    );
  } else if (inviteStatus.inviteStatus === 'expired') {
    // Invite expired
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="text-xs">Invite Expired</Badge>
        <Button variant="ghost" size="sm" onClick={() => handleInviteGuardian(sg.guardian!, inviteStatus.inviteId!)} disabled={isInviting} className="gap-1 text-xs">
          {isInviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Resend
        </Button>
      </div>
    );
  }
  return null;
})()}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/StudentDetail.tsx` | Add invite status interface, state, fetch function, update handleInviteGuardian, update guardian row UI |

---

## Visual Summary

```text
BEFORE:
┌─────────────────────────────────────────────────────────────┐
│ Sarah Watson          [guardian] [Primary Payer]            │
│ sarah.watson@test.com                                       │
│                                        [Invite]    [Remove] │
└─────────────────────────────────────────────────────────────┘

AFTER (Pending):
┌─────────────────────────────────────────────────────────────┐
│ Sarah Watson          [guardian] [Primary Payer]            │
│ sarah.watson@test.com                                       │
│                      [Invite Pending] [Resend]     [Remove] │
└─────────────────────────────────────────────────────────────┘

AFTER (Expired):
┌─────────────────────────────────────────────────────────────┐
│ Sarah Watson          [guardian] [Primary Payer]            │
│ sarah.watson@test.com                                       │
│                      [Invite Expired] [Resend]     [Remove] │
└─────────────────────────────────────────────────────────────┘

AFTER (Accepted):
┌─────────────────────────────────────────────────────────────┐
│ Sarah Watson          [guardian] [Primary Payer]            │
│ sarah.watson@test.com             [Portal Access]           │
│                                                    [Remove] │
└─────────────────────────────────────────────────────────────┘
```

---

## Edge Cases

1. **Multiple invites for same email**: Query returns most recent invite (ORDER BY created_at DESC LIMIT 1 per email)
2. **Guardian email changed after invite**: Old invite won't match; treated as "no invite"
3. **Race condition**: Disable button during invite send to prevent duplicates

---

## Testing Plan

After implementation:
1. Navigate to Students > Emily Watson > Guardians tab
2. Verify Sarah Watson shows "Invite Pending" badge (invite was already sent)
3. Click "Resend" button and verify new invite is created
4. Wait 7 days (or manually expire invite in DB) to test expired state
5. Accept invite and verify "Portal Access" badge appears

