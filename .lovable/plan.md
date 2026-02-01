

# Plan: Add "Copy Invite Link" Button

## Overview
Add a clipboard copy button next to the "Resend" action on the Guardians tab, allowing admins to manually share the portal invite URL with guardians via their preferred communication channel (WhatsApp, text message, etc.).

## Current State
The Guardians tab in `src/pages/StudentDetail.tsx` currently shows:
- **"Invite Pending"** badge with "Resend" button
- **"Invite Expired"** badge with "Resend" button
- **"Portal Access"** badge (when guardian has user_id)

## Implementation

### 1. Extend Invite Status State
Store the invite token alongside the status so we can construct the URL:

```typescript
interface GuardianInviteStatus {
  status: 'none' | 'pending' | 'expired' | 'accepted';
  token?: string; // Add token for URL construction
}
```

### 2. Update fetchGuardianInvites
Modify the query to include the token in the returned data and store it in state.

### 3. Add Copy Link Handler
```typescript
const handleCopyInviteLink = async (token: string) => {
  const url = `${window.location.origin}/accept-invite?token=${token}`;
  await navigator.clipboard.writeText(url);
  toast({ title: 'Link copied', description: 'Invite link copied to clipboard' });
};
```

### 4. Update UI
Add a "Copy Link" button next to "Resend" for pending invites:

| Status | UI Display |
|--------|------------|
| Pending | Badge + "Copy Link" + "Resend" |
| Expired | Badge + "Resend" |
| Accepted | "Portal Access" badge |

### 5. Import Requirements
Add `Copy` icon from lucide-react.

## Files to Modify
- `src/pages/StudentDetail.tsx` - Add token storage, copy handler, and UI button

## User Experience
1. Admin views guardian with pending invite
2. Clicks "Copy Link" button
3. Toast confirms "Link copied to clipboard"
4. Admin pastes link into WhatsApp/SMS/email manually

