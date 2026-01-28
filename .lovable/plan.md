
# Mobile Responsiveness Audit and Fix Plan

## Problem Summary
The application has multiple forms and layouts that use fixed two-column grids (`grid-cols-2`) without responsive breakpoints, causing content to appear cramped, cut-off, or "janky" on mobile devices.

## Issues Identified

### 1. Student Wizard (High Priority)
The main wizard visible in your screenshot has these issues:
- **StudentInfoStep.tsx**: First/Last name fields and Email/Phone fields use fixed `grid-cols-2`
- **GuardianStep.tsx**: New guardian email/phone fields and relationship/primary-payer fields use fixed `grid-cols-2`
- **TeachingDefaultsStep.tsx**: Already responsive (uses full-width fields)
- **StudentWizard.tsx**: Step indicator connectors hidden on mobile (uses `hidden xs:block` class which is not a valid Tailwind breakpoint)

### 2. Other Modals and Forms
- **LessonModal.tsx**: Location/Room selection uses fixed `grid-cols-2`
- **CreateAssignmentModal.tsx**: Minutes/Days and Start/End date fields use fixed `grid-cols-2`
- **CreateInvoiceModal.tsx**: Already responsive (uses `sm:grid-cols-2`)
- **StudentDetail.tsx**: Edit mode name/email/phone fields and guardian relationship/payer fields use fixed `grid-cols-2`

### 3. Dashboard Components
- **QuickActionsGrid.tsx**: Fixed `grid-cols-2` on all screens (works but could be tighter)
- **Dashboard stat cards**: Already responsive (`sm:grid-cols-2 lg:grid-cols-4`)

---

## Implementation Plan

### Step 1: Fix Student Wizard Forms
**StudentInfoStep.tsx** - Make grids stack on mobile:

| Line | Current | Fixed |
|------|---------|-------|
| 26 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| 62 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |

### Step 2: Fix Guardian Step Forms
**GuardianStep.tsx** - Make grids responsive:

| Line | Current | Fixed |
|------|---------|-------|
| 137 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| 163 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |

### Step 3: Fix Wizard Step Indicator
**StudentWizard.tsx** - Fix the step connector visibility:

| Line | Current | Fixed |
|------|---------|-------|
| 320 | `hidden xs:block` | `hidden sm:block` |

The `xs:` breakpoint is not a default Tailwind class. Change to `sm:block` to show connectors on small screens and above.

### Step 4: Fix Lesson Modal
**LessonModal.tsx** - Make location/room grid responsive:

| Line | Current | Fixed |
|------|---------|-------|
| 653 | `grid grid-cols-2 gap-3` | `grid grid-cols-1 sm:grid-cols-2 gap-3` |

### Step 5: Fix Practice Assignment Modal
**CreateAssignmentModal.tsx** - Make target and date grids responsive:

| Line | Current | Fixed |
|------|---------|-------|
| 159 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| 184 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |

### Step 6: Fix Student Detail Page
**StudentDetail.tsx** - Make edit mode forms responsive:

| Line | Current | Fixed |
|------|---------|-------|
| 350 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| 360 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| 701 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/students/wizard/StudentInfoStep.tsx` | 2 grid fixes |
| `src/components/students/wizard/GuardianStep.tsx` | 2 grid fixes |
| `src/components/students/StudentWizard.tsx` | 1 breakpoint fix |
| `src/components/calendar/LessonModal.tsx` | 1 grid fix |
| `src/components/practice/CreateAssignmentModal.tsx` | 2 grid fixes |
| `src/pages/StudentDetail.tsx` | 3 grid fixes |

**Total: 11 changes across 6 files**

---

## Technical Notes

- The fix pattern is consistent: change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`
- This makes fields stack vertically on mobile (under 640px) and side-by-side on small screens and above
- The `sm:` breakpoint (640px) aligns with Tailwind's mobile-first responsive design
- No functional changes; purely CSS class modifications
- All existing desktop layouts remain unchanged

## Expected Result
After implementation:
- All wizard forms will stack fields vertically on mobile
- No text overflow or cut-off inputs
- Professional, usable forms on all screen sizes
- Step indicators will show connectors on tablets and desktops
