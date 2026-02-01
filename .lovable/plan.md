
# Fix: Auto-Create Teacher Record During Onboarding

## Summary

The onboarding flow is missing a critical step: creating a teacher record for Solo Teachers and owner-teachers. This causes the lesson creation modal to have an empty teacher dropdown, blocking the core scheduling functionality.

---

## The Problem

When a user completes onboarding:
1. Profile is updated ✓
2. Organisation is created ✓
3. Org membership with role "owner" is created ✓
4. **No teacher record is created ✗**

Result: New users cannot create lessons because the Teacher dropdown is empty.

---

## Solution

### Update `onboarding-setup` Edge Function

Add teacher creation after organisation setup for:
- `solo_teacher` org type (owner is always the teacher)
- Optionally for `studio`/`academy` org types too

### Implementation Details

**File to modify:** `supabase/functions/onboarding-setup/index.ts`

**Add after line 174** (after org creation):

```typescript
// Step 3.5: For solo_teacher orgs, create a teacher record for the owner
if (org_type === 'solo_teacher') {
  console.log('[onboarding-setup] Creating teacher record for solo teacher');
  
  const { error: teacherError } = await adminClient
    .from('teachers')
    .insert({
      org_id: orgId,
      user_id: user.id,
      name: full_name,
      email: user.email,
      status: 'active',
    });

  if (teacherError && teacherError.code !== '23505') {
    console.error('[onboarding-setup] Teacher creation failed:', teacherError);
    // Non-fatal - log but don't fail onboarding
  } else {
    console.log('[onboarding-setup] Teacher record created');
  }
}
```

### Fix Existing Data

For users who already completed onboarding without a teacher record, we need to create teachers for them. This can be done via a one-time SQL migration:

```sql
-- Create teacher records for solo_teacher org owners who don't have one
INSERT INTO teachers (org_id, user_id, name, email, status)
SELECT 
  o.id as org_id,
  om.user_id,
  p.full_name as name,
  p.email,
  'active' as status
FROM organisations o
JOIN org_memberships om ON o.id = om.org_id AND om.role = 'owner'
JOIN profiles p ON om.user_id = p.id
LEFT JOIN teachers t ON t.org_id = o.id AND t.user_id = om.user_id
WHERE o.org_type = 'solo_teacher'
AND t.id IS NULL;
```

---

## Additional Fixes for Academy/Agency

For `academy` and `agency` org types, we could optionally:
1. Create a teacher record for the owner (if they teach)
2. Show a prompt in the UI to add teachers before creating lessons

However, for MVP, the Solo Teacher fix is most critical since that's the primary use case.

---

## Testing Plan

1. Deploy updated edge function
2. Run SQL to fix existing data
3. Sign up as new Solo Teacher → verify teacher record created
4. Navigate to Calendar → New Lesson → verify teacher appears in dropdown
5. Create a lesson → verify it saves successfully

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/onboarding-setup/index.ts` | Add teacher creation for solo_teacher orgs |

---

## Impact

- **Critical** - Without this fix, new Solo Teacher users cannot create lessons
- **Low risk** - The change is additive and doesn't affect existing functionality
- **Immediate benefit** - Core app functionality restored for new users
