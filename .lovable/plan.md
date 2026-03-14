

## Plan: Simplify Solo Teacher Navigation

Three targeted changes across 3 files. No database or route changes.

### Change 1: Sidebar — `src/components/layout/AppSidebar.tsx`

Add a `soloOwnerGroups` nav config (lines 67-105 area) with only:
- **Top**: Dashboard, Calendar
- **Teaching**: Students, Register, Practice, Resources, Notes
- **Business**: Invoices, Messages, Reports

No Teachers, Locations, Batch Attendance, Leads, Waiting List, Make-Ups, or Continuation.

Update `getNavGroups` (line 172) to accept `orgType` parameter:
```
function getNavGroups(role, orgType) {
  if ((role === 'owner' || role === 'admin') && orgType === 'solo_teacher') 
    return soloOwnerGroups;
  // ...existing switch
}
```

Update the call site (line 266) to pass `currentOrg?.org_type`.

### Change 2: Bottom Nav — `src/components/layout/StaffBottomNav.tsx`

Add solo-specific configs:
- `soloOwnerTabs`: Home, Calendar, Students, Messages (same 4 tabs)
- `soloOwnerMore`: Invoices, Register, Practice, Settings (no Teachers)

Update `getTabsForRole` to accept `orgType` and check for solo teacher before falling into the owner/admin case.

Update the call site (line 94) to pass `currentOrg?.org_type`.

### Change 3: Checklist — `src/components/shared/OnboardingChecklist.tsx`

Remove the "Add a teaching location" step from the `solo_teacher` config (line ~51), leaving 3 steps:
1. Add your first student
2. Schedule a lesson
3. Create your first invoice

### Files Modified

| File | Lines affected | Change |
|------|---------------|--------|
| `AppSidebar.tsx` | ~67-105, 172-187, 266 | Add `soloOwnerGroups`, update `getNavGroups` signature |
| `StaffBottomNav.tsx` | ~32-85, 87-94 | Add solo configs, update selector to check org_type |
| `OnboardingChecklist.tsx` | ~48-52 | Remove location step from solo_teacher config |

