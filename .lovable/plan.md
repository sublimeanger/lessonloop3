
# Fix Teacher Invitation Acceptance Error

## Problem Summary
Teachers (and any invited users) cannot accept invitations. When clicking "Join", they receive an error. The database shows the invite remains unaccepted (`accepted_at: NULL`) and no `org_membership` is created.

## Root Cause
The `invite-accept` edge function queries for a column that doesn't exist:

```
ERROR: column invites.related_student_id does not exist
```

**Location:** `supabase/functions/invite-accept/index.ts`, line 49

The edge function attempts to select `related_student_id` from the `invites` table, but this column was never added to the database schema. The current `invites` table only has: `id, org_id, email, role, token, expires_at, created_at, accepted_at`.

## Solution

### Option A: Add the missing column (Recommended)
Add `related_student_id` to the `invites` table. This column is used for parent invitations to link them directly to a student.

**Database Migration:**
```sql
ALTER TABLE public.invites 
ADD COLUMN related_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.invites.related_student_id IS 'Optional link to a student for parent invites';
```

### Option B: Remove the column reference from edge function
If the feature isn't needed yet, simply remove `related_student_id` from the SELECT query.

**Edge Function Fix:**
```typescript
// Line 47-51: Change from
const { data: invite, error: inviteError } = await supabaseAdmin
  .from("invites")
  .select("id, org_id, email, role, expires_at, accepted_at, related_student_id")
  .eq("token", token)
  .maybeSingle();

// To
const { data: invite, error: inviteError } = await supabaseAdmin
  .from("invites")
  .select("id, org_id, email, role, expires_at, accepted_at")
  .eq("token", token)
  .maybeSingle();
```

Also update line 87+ to handle the undefined case:
```typescript
if (invite.role === "parent" && invite.related_student_id) {
  // becomes
if (invite.role === "parent") {
  // Skip student linking since column doesn't exist yet
```

## Recommendation
**Option A is preferred** because:
1. The parent invitation flow already has logic to use this column (lines 127-143)
2. It enables proper parent-to-student linking during invite acceptance
3. It's a simple additive change that doesn't break existing invites

## Implementation Steps

1. **Add database migration** to create the `related_student_id` column
2. **Update the Guardian Invite Modal** (if exists) to populate this field when inviting parents
3. **Deploy and verify** by having the teacher re-attempt invite acceptance

## Impact
- All pending invites will work after the migration
- No data loss (existing invites gain a null `related_student_id`)
- Parent invites can optionally link to students

## Testing Checklist
After fix:
1. Teacher accepts invite → redirected to dashboard
2. Verify `org_memberships` record created with role=teacher
3. Verify invite shows `accepted_at` timestamp
4. Parent accepts invite → guardian record created
