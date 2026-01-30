

# Role-Based Access Control (RBAC) Security Audit & Fix Plan

## Executive Summary

A thorough review of the codebase reveals the role-based access control (RBAC) is **mostly correct** but has several critical issues that need fixing to ensure complete lockdown.

---

## Current RBAC Architecture

### Route-Level Protection (App.tsx)
The RouteGuard correctly enforces allowedRoles at the routing level:

| Route | Allowed Roles | Status |
|-------|--------------|--------|
| `/portal/*` | parent | Correct |
| `/dashboard` | All authenticated | Correct |
| `/calendar` | owner, admin, teacher | Correct |
| `/students` | owner, admin, teacher | Correct |
| `/students/import` | owner, admin | Correct |
| `/teachers` | owner, admin | Correct |
| `/locations` | owner, admin | Correct |
| `/invoices` | owner, admin, finance | Correct |
| `/reports` | owner, admin, finance, teacher | Correct |
| `/reports/revenue` | owner, admin, finance | Correct |
| `/reports/outstanding` | owner, admin, finance | Correct |
| `/reports/cancellations` | owner, admin | Correct |
| `/reports/utilisation` | owner, admin | Correct |
| `/reports/payroll` | owner, admin, teacher, finance | Needs Review |
| `/reports/lessons` | owner, admin, teacher | Correct |
| `/practice` | owner, admin, teacher | Correct |
| `/resources` | owner, admin, teacher | Correct |
| `/messages` | owner, admin, teacher, finance | Correct |
| `/settings` | owner, admin, teacher, finance | Correct |

### Sidebar Navigation (AppSidebar.tsx)

| Role | Navigation Items | Status |
|------|-----------------|--------|
| owner/admin | Full navigation (Dashboard, Calendar, Register, Students, Teachers, Locations, Practice, Resources, Invoices, Reports, Messages, Settings, Help) | Correct |
| finance | Dashboard, Invoices, Reports, Messages, Settings, Help | Correct |
| teacher | Dashboard, My Calendar, Register, My Students, Practice, Resources, Messages, Settings, Help | Correct |
| parent | Portal navigation only | Correct |
| **null (loading)** | Empty array `[]` | **FIXED** (was returning full admin nav) |

---

## Issues Identified & Fixes Required

### ISSUE 1: Resources Page - Teachers Can Upload (CRITICAL)

**Problem**: The Resources page (`src/pages/Resources.tsx`) shows "Upload Resource" button to ALL users who access the page, including teachers. Teachers should only VIEW resources, not upload them.

**Current Code** (lines 37-42):
```typescript
actions={
  <Button onClick={() => setUploadModalOpen(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Upload Resource
  </Button>
}
```

**Fix**: Add role check to hide upload from teachers:
```typescript
const { currentRole } = useOrg();
const isAdmin = currentRole === 'owner' || currentRole === 'admin';

// In PageHeader actions:
actions={
  isAdmin && (
    <Button onClick={() => setUploadModalOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      Upload Resource
    </Button>
  )
}
```

---

### ISSUE 2: Practice Page - Teachers Can Create Assignments (REVIEW)

**Problem**: The Practice page (`src/pages/Practice.tsx`) shows "New Assignment" button to all users. Need to verify: should teachers be able to create assignments for their own students?

**Business Logic Decision**:
- If YES (teachers can create assignments for their assigned students): Current code is correct
- If NO (only admins create assignments): Add role check similar to Issue 1

**Recommendation**: Keep current behaviour - teachers SHOULD be able to create assignments for their assigned students. The hook `usePracticeAssignments` should already scope to their students via RLS.

---

### ISSUE 3: QuickActionsGrid - Teacher Actions Link to Admin Pages (LOW)

**Problem**: The `QuickActionsGrid` for teachers includes "My Students" linking to `/students`. This is correct since teachers can access that route, but teachers clicking "My Students" might expect a different filtered view.

**Current behaviour**: Teachers go to Students page and see only their assigned students (already fixed via earlier changes)

**Status**: NO FIX NEEDED - the Students page now properly shows only assigned students to teachers and hides admin actions.

---

### ISSUE 4: StudentDetail - Teachers Can Add/Remove Guardians (CRITICAL)

**Problem**: On `StudentDetail.tsx`, the "Add Guardian" button and remove guardian functionality is shown to ALL users including teachers.

**Current Code** (line 437):
```typescript
<Button onClick={() => setIsGuardianDialogOpen(true)} size="sm" className="gap-2">
  <Plus className="h-4 w-4" />
  Add Guardian
</Button>
```

**Fix**: Add role check:
```typescript
{isOrgAdmin && (
  <Button onClick={() => setIsGuardianDialogOpen(true)} size="sm" className="gap-2">
    <Plus className="h-4 w-4" />
    Add Guardian
  </Button>
)}
```

Also fix the remove guardian button (line 463-474) to be admin-only.

---

### ISSUE 5: StudentDetail - TeachingDefaultsCard Editable by Teachers (CRITICAL)

**Problem**: The `TeachingDefaultsCard` allows editing teaching defaults (location, teacher, rate card). Teachers should NOT be able to change rate cards or reassign students to other teachers.

**File**: `src/components/students/TeachingDefaultsCard.tsx`

**Fix**: Pass `isOrgAdmin` prop and disable editing for teachers, or make it view-only for non-admins.

---

### ISSUE 6: CalendarPage - Teachers Can Create Lessons (REVIEW)

**Problem**: The CalendarPage shows "New Lesson" button to teachers. Need to verify: should teachers create lessons?

**Current Code** (lines 173-178):
```typescript
{!isParent && (
  <Button onClick={() => { setSelectedLesson(null); setSlotDate(undefined); setIsModalOpen(true); }}>
    New Lesson
  </Button>
)}
```

**Business Logic Decision**:
- Solo teachers and admin staff SHOULD create lessons
- Teachers within academies MAY or MAY NOT be allowed to create lessons (org policy)

**Recommendation**: This is likely CORRECT for now. Teachers need to schedule lessons for their students. However, the LessonModal should restrict lesson creation to:
1. Only allow teachers to assign themselves or leave teacher blank
2. Only allow teachers to add their assigned students

---

### ISSUE 7: DailyRegister - All Users Can Mark Attendance (CORRECT)

**Review**: Teachers SHOULD be able to mark attendance for their lessons. The page correctly auto-filters to teacher's own lessons.

**Status**: CORRECT - No fix needed.

---

### ISSUE 8: Messages - Parent Requests Tab Visibility (CORRECT)

**Current Code** (line 117):
```typescript
const canViewRequests = isOrgAdmin || isOrgOwner;
```

**Status**: CORRECT - Only admins/owners see the "Parent Requests" tab.

---

### ISSUE 9: Settings - Tab Visibility (CORRECT)

**Review**: Settings tabs are correctly gated:
- Profile, Organisation, Availability, Calendar, Billing, Notifications, Help - All roles
- Members, Scheduling, Audit, Privacy, Rate Cards - Owner/Admin only

**Status**: CORRECT

---

### ISSUE 10: Reports - Teacher Seeing Payroll (MEDIUM)

**Problem**: Teachers can access `/reports/payroll` which shows ALL teacher pay rates and earnings.

**Current Route** (App.tsx line 179-182):
```typescript
<Route path="/reports/payroll" element={
  <RouteGuard allowedRoles={['owner', 'admin', 'teacher', 'finance']}>
    <PayrollReport />
  </RouteGuard>
} />
```

**Issue**: A teacher can see other teachers' pay rates.

**Fix Options**:
1. Remove teacher from allowedRoles (teachers can't see payroll)
2. Filter payroll report to show only the logged-in teacher's own data

**Recommendation**: Filter the report to show only the teacher's own data when `currentRole === 'teacher'`.

---

## Fix Implementation Plan

### Phase 1: Critical UI Fixes

| File | Change | Priority |
|------|--------|----------|
| `src/pages/Resources.tsx` | Add isAdmin check for Upload button | Critical |
| `src/pages/StudentDetail.tsx` | Add isOrgAdmin check for Add/Remove Guardian | Critical |
| `src/components/students/TeachingDefaultsCard.tsx` | Make rate card editing admin-only | Critical |

### Phase 2: Data Filtering Fixes

| File | Change | Priority |
|------|--------|----------|
| `src/pages/reports/Payroll.tsx` | Filter to teacher's own data when role=teacher | Medium |

### Phase 3: No Action Required

| Area | Status |
|------|--------|
| Route guards | Correctly implemented |
| Sidebar navigation | Fixed (empty array for null role) |
| Students page | Already fixed (admin actions hidden) |
| Messages page | Correctly gated |
| Settings page | Correctly gated |
| Dashboard | Correctly shows role-specific views |
| Calendar | Teachers should be able to create lessons |
| Daily Register | Teachers should mark attendance |
| Practice | Teachers should create assignments |

---

## Parent Portal Verification

### Routes (All Correct)
- `/portal/home` - parent only
- `/portal/schedule` - parent only
- `/portal/practice` - parent only
- `/portal/resources` - parent only
- `/portal/invoices` - parent only
- `/portal/messages` - parent only

### RouteGuard Behaviour
- If a parent tries to access `/dashboard`, they are redirected to `/portal/home`
- If a parent tries to access any non-portal route, they are redirected to `/portal/home`

### PublicRoute Behaviour
- If a logged-in parent visits `/login`, they are redirected to `/portal/home`

**Status**: CORRECT

---

## Summary of Required Changes

### Files to Modify

1. **src/pages/Resources.tsx**
   - Import `useOrg`
   - Add `isAdmin` check for Upload button

2. **src/pages/StudentDetail.tsx**
   - Add `isOrgAdmin` checks for:
     - Add Guardian button
     - Remove Guardian button
     - TeachingDefaultsCard (pass readOnly prop)

3. **src/components/students/TeachingDefaultsCard.tsx**
   - Add `readOnly` prop
   - Disable editing when readOnly is true

4. **src/pages/reports/Payroll.tsx**
   - Filter data to teacher's own records when `currentRole === 'teacher'`

---

## Testing Checklist

After implementation:

| Test | Expected Result |
|------|-----------------|
| Login as Teacher | See teacher-specific sidebar (no Invoices, Locations, Teachers) |
| Teacher → Students | See assigned students only, no Add/Import buttons |
| Teacher → Student Detail | Cannot add/remove guardians, cannot edit teaching defaults |
| Teacher → Resources | Cannot upload resources |
| Teacher → Payroll Report | See only own payroll data |
| Login as Parent | See portal sidebar only |
| Parent → /dashboard (manual URL) | Redirected to /portal/home |
| Login as Finance | See Dashboard, Invoices, Reports, Messages, Settings only |
| Finance → Students (manual URL) | Redirected to /dashboard |

