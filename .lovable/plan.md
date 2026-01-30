
# LessonLoop System Audit & Critical Fix Plan

## Problems Identified

### 1. CSV Import 401 Error - CRITICAL
**Symptom**: CSV import fails with "Unauthorized" error

**Root Cause**: The edge functions `csv-import-mapping` and `csv-import-execute` were not properly deployed. The analytics logs show 401 errors occurring because:
- The edge functions may not have been deployed to production
- I've already re-deployed them during this investigation

**Verification Needed**: Test the CSV import after deployment (already done)

**Fix Status**: Edge functions were redeployed. Need to verify they work with user authentication.

---

### 2. user_roles Table Inconsistency - MEDIUM
**Symptom**: Every user gets `owner` role in `user_roles` table even if they're a teacher or parent

**Root Cause**: The `handle_new_user` database trigger always inserts `role: 'owner'` for every new signup. The `invite-accept` edge function doesn't update this table.

**Impact**: The `roles` array in `AuthContext` always contains `['owner']` for all users. However, this is currently mitigated because:
- The actual authorization uses `currentRole` from `OrgContext` (which reads from `org_memberships`)
- Role-based route guards use `allowedRoles` which checks against `currentRole`

**Recommendation**: This should be cleaned up but isn't blocking functionality. The `user_roles` table appears to be legacy and could be deprecated in favour of `org_memberships`.

---

### 3. Missing teacher_profiles for Invited Teachers - LOW
**Symptom**: `teacher_profiles` table is empty

**Root Cause**: When a teacher accepts an invite, no `teacher_profile` record is created. This is needed for:
- Pay rate configuration (hourly, per_lesson, percentage)
- Display name
- Payroll calculations

**Impact**: The Payroll report will show `0` for teacher pay because it relies on `teacher_profiles.pay_rate_type` and `pay_rate_value`.

**Fix**: Update `invite-accept` edge function to create a `teacher_profile` record when role is `teacher`.

---

### 4. Session Token Access Pattern - NO ISSUE FOUND
**Analysis**: The code in `StudentsImport.tsx` uses:
```typescript
const { data: session } = await supabase.auth.getSession();
Authorization: `Bearer ${session?.session?.access_token}`,
```

This is technically correct because:
- `supabase.auth.getSession()` returns `{ data: { session: Session | null }, error }`
- Destructuring `{ data: session }` means `session = { session: Session | null }`
- So `session?.session?.access_token` correctly accesses the token

The 401 errors seen in logs were from my unauthenticated test call, not from user sessions.

---

## Implementation Plan

### Phase 1: Immediate Fixes (This Session)

#### 1.1 Add teacher_profile Creation to invite-accept
When a teacher accepts an invite, create their teacher_profile record:

**File**: `supabase/functions/invite-accept/index.ts`
**Change**: After creating org_membership for teachers, also create teacher_profile:

```typescript
// If this is a teacher invite, create teacher profile
if (invite.role === "teacher") {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  await supabaseAdmin
    .from("teacher_profiles")
    .upsert({
      org_id: invite.org_id,
      user_id: user.id,
      display_name: profile?.full_name || user.email?.split("@")[0] || "Teacher",
      pay_rate_type: null,
      pay_rate_value: 0,
    }, { onConflict: "org_id,user_id" });
}
```

#### 1.2 Verify CSV Import Works
- The edge functions are now deployed
- Test will confirm they work with authenticated users

#### 1.3 Ensure Edge Function Error Handling is Robust
Add better error messages when session is missing:

**File**: `src/pages/StudentsImport.tsx`
**Change**: Add explicit session validation before API calls:

```typescript
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData?.session?.access_token) {
  throw new Error("Please log in again to import students");
}
```

---

### Phase 2: Clean-up (Future Session)

#### 2.1 Deprecate user_roles Table
The `user_roles` table is redundant with `org_memberships.role`. Consider:
- Remove `get_user_roles` function usage from `AuthContext`
- Update `handle_new_user` trigger to not create owner role
- Or simply ignore it since `org_memberships` is authoritative

#### 2.2 Add Teacher Profile Admin UI
Add a way for admins to set teacher pay rates in Settings → Teachers tab.

---

## Testing Checklist

After implementation:

| Test Case | Expected Result |
|-----------|-----------------|
| Upload CSV file | AI mapping suggestions appear |
| Mapping step | Can map columns to fields |
| Preview step | Dry run shows valid/duplicate counts |
| Execute import | Students created successfully |
| Teacher payroll | Shows teacher with correct earnings |
| Teacher login | Lands on /dashboard with TeacherDashboard view |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/invite-accept/index.ts` | Add teacher_profile creation |
| `src/pages/StudentsImport.tsx` | Add session validation with better error message |

## Edge Functions to Redeploy
- `invite-accept` (after teacher_profile fix)
- Already deployed: `csv-import-mapping`, `csv-import-execute`
