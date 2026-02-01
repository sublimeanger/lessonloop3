
# Plan: Fix send-invite-email Edge Function Parameter Mismatch

## Summary

The `send-invite-email` edge function expects 7 parameters (`inviteId`, `orgId`, `orgName`, `recipientEmail`, `recipientRole`, `inviteToken`, `inviterName`) but the frontend code only passes 2 (`inviteId`, `guardianId`). This will cause the invite functionality to fail silently.

---

## The Problem

**Edge Function Expects:**
```typescript
interface InviteEmailRequest {
  inviteId: string;
  orgId: string;
  orgName: string;
  recipientEmail: string;
  recipientRole: string;
  inviteToken: string;
  inviterName: string;
}
```

**Frontend Sends (both GuardianInviteModal and StudentDetail.tsx):**
```typescript
{
  inviteId: invite.id,
  guardianId: guardian.id,
}
```

This mismatch means the edge function will receive `undefined` for most required fields, causing the email to fail or send with broken content.

---

## Solution

Update the edge function to fetch the required data from the database using just `inviteId`. This is the cleanest approach because:
1. All data already exists in the `invites` table (`org_id`, `email`, `role`, `token`)
2. Organisation name can be joined from `organisations` table
3. Reduces frontend complexity - just pass the invite ID
4. More secure - frontend doesn't need to pass sensitive data

---

## Implementation Details

### File to Modify: `supabase/functions/send-invite-email/index.ts`

**Changes Required:**

1. Update the interface to accept minimal input:
```typescript
interface InviteEmailRequest {
  inviteId: string;
  guardianId?: string; // Optional, for linking
}
```

2. Fetch all required data from database:
```typescript
// Fetch invite with related org data
const { data: invite, error: fetchError } = await supabase
  .from('invites')
  .select(`
    id,
    org_id,
    email,
    role,
    token,
    organisations!inner(name)
  `)
  .eq('id', inviteId)
  .single();

if (fetchError || !invite) {
  throw new Error('Invite not found');
}

const orgName = invite.organisations.name;
const recipientEmail = invite.email;
const recipientRole = invite.role;
const inviteToken = invite.token;
const orgId = invite.org_id;
const inviterName = orgName; // Use org name as inviter for now
```

3. Use these fetched values for email composition

---

## Database Schema Check

The `invites` table has:
- `id` (uuid)
- `org_id` (uuid) - FK to organisations
- `email` (text)
- `role` (text)
- `token` (text) - auto-generated
- `related_student_id` (uuid, optional)
- `expires_at` (timestamp)

All required data is available via the invite record.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-invite-email/index.ts` | Fetch invite details from DB instead of expecting them in request body |

---

## Testing Plan

After fixing:
1. Navigate to Students > Oliver Johnson > Guardians tab
2. Click "Invite" button next to Michelle Johnson
3. Check edge function logs for successful execution
4. Check `invites` table for new record with token
5. Check `message_log` table for logged email with invite URL
6. Copy invite URL from logs
7. Navigate to accept-invite page
8. Create parent account and accept invite
9. Verify redirect to portal
