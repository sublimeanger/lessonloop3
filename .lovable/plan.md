
# Critical Fix: Teacher Role Permission Enforcement

## Problems Identified

### Problem 1: Teachers See "Add Student" and "Import" Buttons
The Students page (`src/pages/Students.tsx`) displays administrative actions to ALL users who can access the page, including teachers. Teachers should only be able to VIEW their assigned students, not create new ones.

**Current Code (lines 143-156):**
```typescript
actions={
  <div className="flex items-center gap-2">
    <Link to="/students/import">
      <Button variant="outline">Import</Button>
    </Link>
    <Button onClick={openAddWizard}>Add Student</Button>
  </div>
}
```
No role check - everyone sees these buttons.

### Problem 2: Sidebar Fallback Shows Everything
In `AppSidebar.tsx` (line 90), when `currentRole` is `null`, it defaults to `ownerAdminNav` which shows EVERYTHING including Invoices, Teachers, Locations.

**Current Code:**
```typescript
function getNavItems(role: AppRole | null): NavItem[] {
  if (!role) return ownerAdminNav; // DANGEROUS!
  ...
}
```

If the OrgContext hasn't fully loaded yet, teachers momentarily see the full admin navigation.

### Problem 3: Teacher Students Page Allows Status Toggle
Teachers can toggle student status (active/inactive) which should be admin-only.

---

## Solution

### Fix 1: Hide Admin Actions from Teachers on Students Page
**File:** `src/pages/Students.tsx`

Only show Add Student and Import buttons to owners/admins:
```typescript
const isAdmin = currentRole === 'owner' || currentRole === 'admin';

// In PageHeader actions:
actions={
  isAdmin && (
    <div className="flex items-center gap-2">
      <Link to="/students/import">
        <Button variant="outline">Import</Button>
      </Link>
      <Button onClick={openAddWizard}>Add Student</Button>
    </div>
  )
}

// Also hide status toggle button for teachers
```

### Fix 2: Safe Sidebar Fallback
**File:** `src/components/layout/AppSidebar.tsx`

Don't show ANY navigation when role is null (show loading or empty state):
```typescript
function getNavItems(role: AppRole | null): NavItem[] {
  if (!role) return []; // Empty until role is known
  ...
}
```

### Fix 3: Hide Status Toggle from Teachers
**File:** `src/pages/Students.tsx`

Teachers should not be able to activate/deactivate students:
```typescript
{isAdmin && (
  <Button onClick={(e) => { e.preventDefault(); toggleStatus(student); }}>
    {student.status === 'active' ? 'Deactivate' : 'Activate'}
  </Button>
)}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Students.tsx` | Add role checks to hide Add/Import/Status toggle from teachers |
| `src/components/layout/AppSidebar.tsx` | Change fallback from `ownerAdminNav` to empty array |

---

## Route Protection Review (Already Correct)
The routes in `App.tsx` are correctly configured:
- `/invoices` - Only `['owner', 'admin', 'finance']` - Teachers CANNOT access ✓
- `/teachers` - Only `['owner', 'admin']` - Teachers CANNOT access ✓  
- `/students/import` - Only `['owner', 'admin']` - Teachers CANNOT access ✓
- `/students` - Allows teachers but UI must hide admin actions

The issue is the UI showing buttons that lead to blocked routes, and the sidebar showing links to blocked routes during the brief moment when role is null.

---

## Result After Fix
- Teachers see "My Students" with a read-only list of assigned students
- No Add, Import, or Status toggle buttons visible
- Sidebar shows only teacher-appropriate navigation from the start
- Route guards remain as backup protection
