Plan approved for Bugs 1, 2, 4, 5. 

Bug 3: You say it's already fixed, but during real testing 

an invited teacher was sent through the full onboarding wizard 

(asked about org type, team size, pricing plans). Please verify 

by actually testing the invite flow:

1. From Settings → Members, invite a fresh email as Teacher

2. Open the invite link in incognito

3. Create the account

4. Does the user land on /dashboard or /onboarding?

If they hit /onboarding, the fix isn't working. Check:

- Does the invite-accept edge function actually run before 

  the client-side redirect?

- Is there a race condition where RouteGuard checks 

  has_completed_onboarding BEFORE the edge function updates it?

- Does refreshProfile() complete before the navigation happens?

If it truly is fixed and my earlier test was before the fix 

was deployed, confirm that and move on.  
  
Plan: Fix 5 Bugs Across User Types

### BUG 1: Teacher mobile nav missing features (LAUNCH BLOCKER)

**File:** `src/components/layout/StaffBottomNav.tsx`

Add missing imports (`Music`, `FolderOpen`, `FileText`, `UserCheck`) and expand `teacherMore` from 2 items to 6:

```
Register, Batch Attendance, Practice, Resources, Notes, Settings
```

### BUG 2: Finance user sees teaching dashboard

**File:** `src/pages/Dashboard.tsx`

Add a `FinanceDashboard` component and route finance users to it. Insert before line 105:

```typescript
const isFinance = currentRole === 'finance';
if (isFinance) return <FinanceDashboard firstName={firstName} />;
```

`FinanceDashboard` — simple component with 4 StatCards (Revenue MTD, Outstanding, Overdue, Total Invoices) + quick links to `/invoices` and `/reports/revenue`. Reuses existing `StatCard`, `AppLayout`, `useDashboardStats`.

### BUG 3: Invited users hitting onboarding — NO CHANGE NEEDED

Already fixed:

- `invite-accept` edge function sets `has_completed_onboarding: true`
- `AcceptInvite.tsx` calls `refreshProfile()` after acceptance
- RouteGuard check at line 139 works correctly with this data

### BUG 4: Academy sidebar too crowded

**File:** `src/components/layout/AppSidebar.tsx`

Restructure `ownerAdminGroups`:

- **Business** (always visible): Invoices, Reports, Locations, Messages
- **Pipeline** (collapsible, starts collapsed): Leads, Waiting List, Make-Ups, Continuation
- Remove the separate "Communication" group

Use the existing `Collapsible` component from shadcn. Add a collapsible group variant to the sidebar rendering logic.

### BUG 5: Finance Reports icon wrong

**File:** `src/components/layout/StaffBottomNav.tsx`

Import `BarChart3` and update `financeMore` to use it for Reports instead of `ClipboardList`.

### Files Modified


| File                 | Changes                                                       |
| -------------------- | ------------------------------------------------------------- |
| `StaffBottomNav.tsx` | BUG 1: Expand teacherMore to 6 items. BUG 5: Fix Reports icon |
| `Dashboard.tsx`      | BUG 2: Add FinanceDashboard component + routing               |
| `AppSidebar.tsx`     | BUG 4: Split Business group, add collapsible Pipeline section |
