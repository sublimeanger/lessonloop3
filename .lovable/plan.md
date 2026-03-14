Approve but flag two things:

1. **Issue 9 touches an edge function** — `supabase/functions/looopassist-chat/index.ts`. Lovable can edit it but the function needs to be redeployed to Supabase after. Make sure Lovable pushes the change and you redeploy edge functions. Also note: the edge function **folder name** has the triple-o typo too (`looopassist-chat`). Don't rename the folder — that would break the endpoint URL. Just fix the settings nav key (Issue 11) and leave the folder name as is.
2. **Issue 11 — check for URL params too.** If anyone has bookmarked `?tab=looopassist`, the new key `loopassist` won't match. Low risk but worth knowing. Also check if there are any other references:

```
Tell Lovable: Before fixing Issue 11, search the entire codebase:
  grep -rn "looopassist" src/ supabase/
  
Do NOT rename the edge function folder 
(supabase/functions/looopassist-chat/) — only fix the settings 
nav key and its matching cases in Settings.tsx. The edge function 
folder name is a separate concern and renaming it would break 
the API endpoint.
```

Everything else looks correct. Accept and let it run.

&nbsp;

## Plan: Fix 7 Issues from Role Audit

### Issue 6: Settings adminOnly for Org/Branding

**File:** `src/components/settings/SettingsNav.tsx`

- Line 53: Add `adminOnly: true` to Organisation nav item
- Line 54: Add `adminOnly: true` to Branding nav item

### Issue 7: AcceptInvite onboarding safety net

**File:** `src/pages/AcceptInvite.tsx`

The edge function already sets `has_completed_onboarding: true` (line 210-216 of invite-accept). However, there may be a timing issue where `refreshProfile()` returns before the edge function's DB write propagates. 

Add a retry loop in `acceptInvite()` (after line 148) and `signUpAndAccept()` (after line 249): after calling `refreshProfile()`, check that the profile actually has `has_completed_onboarding === true`. If not, wait 500ms and retry up to 3 times. This eliminates the race condition.

### Issue 8: Hide LoopAssist from Finance

**File:** `src/components/layout/Header.tsx`

Add a separate check for LoopAssist visibility:

```typescript
const showLoopAssist = currentRole && ['owner', 'admin', 'teacher'].includes(currentRole);
```

Use `showLoopAssist` for the LoopAssist button. Keep `isStaff` for the notification bell (but see Issue 12).

### Issue 9: Role-aware LoopAssist system prompt

**File:** `supabase/functions/looopassist-chat/index.ts`

After building `orgContext` (line 1624), append role-specific instructions:

```typescript
let roleInstructions = "";
if (userRole === "teacher") {
  roleInstructions = "\n\nROLE RESTRICTIONS: You are assisting a teacher. Only discuss their own lessons, students, and schedule. Do not reveal financial data (revenue, invoice totals, payment details), other teachers' information, or organisation-level settings.";
} else if (userRole === "finance") {
  roleInstructions = "\n\nROLE RESTRICTIONS: You are assisting a finance team member. Focus on invoices, payments, and revenue. Do not reveal teacher pay rates, lesson notes, or student practice data.";
}
```

Add `roleInstructions` to `fullContext` on line 1656.

### Issue 10: Student filtering RPC — NO CHANGE NEEDED

The `get_students_for_org` function already correctly filters: teachers get only assigned students via `student_teacher_assignments` INNER JOIN, owners/admins/finance get all students.

### Issue 11: Fix "looopassist" typo

**File:** `src/components/settings/SettingsNav.tsx` line 87

- Change `value: 'looopassist'` → `value: 'loopassist'`

**File:** `src/pages/Settings.tsx` line 101

- Change `case 'looopassist':` → `case 'loopassist':`

**File:** `src/pages/Settings.tsx` line 117 (adminTabs array)

- Change `'looopassist'` → `'loopassist'`

### Issue 12: Hide notification bell from Finance

**File:** `src/components/layout/Header.tsx`

Change the notification bell check:

```typescript
const showNotifications = currentRole && ['owner', 'admin', 'teacher'].includes(currentRole);
```

Use `showNotifications` for the bell instead of `isStaff`.

### Files Modified


| File                        | Issues                      |
| --------------------------- | --------------------------- |
| `SettingsNav.tsx`           | #6 (adminOnly), #11 (typo)  |
| `Settings.tsx`              | #11 (matching typo)         |
| `AcceptInvite.tsx`          | #7 (refresh retry)          |
| `Header.tsx`                | #8 (LoopAssist), #12 (bell) |
| `looopassist-chat/index.ts` | #9 (role instructions)      |


No changes needed for Issue 10.