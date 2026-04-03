# Mobile Polish Sweep — Implementation Plan

This plan systematically fixes mobile UX issues across the app at 375px viewport width, organized into focused implementation steps.

---

## Step 1: Fix Base UI Components (Textarea & Select)

**Files:** `src/components/ui/textarea.tsx`, `src/components/ui/select.tsx`

- **Textarea:** Add `text-base md:text-sm` to match Input's pattern (prevents iOS auto-zoom on focus)
- **SelectTrigger:** Add `text-base md:text-sm` and ensure `h-11 sm:h-10` for mobile touch targets

These two changes cascade across the entire app — every Select and Textarea automatically gets proper mobile sizing.

---

## Step 2: Create Reusable DatePicker Component

**New file:** `src/components/ui/date-picker.tsx`

Create a reusable `DatePicker` component wrapping `Popover + Calendar` to avoid duplicating ~20 lines of boilerplate in every file. Props: `value: string`, `onChange: (date: string) => void`, `placeholder?: string`, `disabled?: (date: Date) => boolean`, `min?: string`, `max?: string`, `className?: string`.

This component will be used to replace all `type="date"` inputs.

---

## Step 3: Replace Native Date Inputs — High Priority Forms (8 files)

Replace `<Input type="date">` with the new `<DatePicker>` component in:

1. **BookTrialModal.tsx** — date input (time input: add `text-base` class)
2. **CreateInvoiceModal.tsx** — due date + 2 lesson date range inputs
3. **CreateAssignmentModal.tsx** — start/end dates
4. **AssignmentDetailDialog.tsx** — edit end date
5. **StudentInfoStep.tsx** — DOB
6. **StudentInfoCard.tsx** — DOB edit
7. **TermManagementCard.tsx** — term start/end dates
8. **BookingPage.tsx** — already done, skip

---

## Step 4: Replace Native Date Inputs — Medium Priority Forms (7 files)

9. **BillingRunWizard.tsx** — 2 editable dates (keep 2 disabled as styled display)
10. **ContinuationRunWizard.tsx** — notice deadline
11. **MessageRequestsList.tsx** — reschedule date
12. **RecurringBillingTab.tsx** — next run date
13. **TeacherAvailabilityTab.tsx** — 2 time-off dates
14. **AuditLogTab.tsx** — 2 filter dates
15. **TermAdjustmentWizard.tsx** — effective date

---

## Step 5: Style Filter Bar Dates (2 files)

For **InvoiceFiltersBar.tsx** and **DateRangeFilter.tsx**: keep native `type="date"` but add `className="h-11 text-base md:text-sm"` for consistent sizing. These are low-priority filter inputs where native pickers are acceptable.

---

## Step 6: Style Time Inputs (5 files)

For all `type="time"` inputs, add `text-base md:text-sm h-11 sm:h-10` to prevent iOS auto-zoom and ensure touch targets:

1. **BookTrialModal.tsx**
2. **MessageRequestsList.tsx**
3. **TermAdjustmentWizard.tsx**
4. **AddToWaitlistDialog.tsx** (×2)
5. **OfferSlotDialog.tsx**

---

## Step 7: Dialog Full-Screen on Mobile (3 files)

These dialogs lack the mobile full-screen pattern. Add `h-[100dvh] w-full max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-lg sm:border sm:p-6`:

1. **BulkEditDialog.tsx** — currently only `sm:max-w-md`
2. **AssignmentDetailDialog.tsx** — currently only `sm:max-w-md`
3. **RecurringActionDialog.tsx** — currently `max-w-md p-0`

Note: BookTrialModal and OfferSlotDialog already use Drawer on mobile (via `useIsMobile`), so they're fine. AddToWaitlistDialog and CreateAssignmentModal already have the pattern.

---

## Step 8: Table Overflow Fixes (2 files)

1. **HelpArticle.tsx** — already has `overflow-x-auto` wrapper on tables ✅
2. **BillingRunHistory.tsx** — wrap table in `<div className="overflow-x-auto">`
3. **SchedulingSettingsTab.tsx** — check make-up policy table, add `overflow-x-auto` or card layout on mobile

---

## Step 9: Text Overflow & Truncation Audit

Add `truncate` or `line-clamp-1` classes where long text may overflow at 375px:

- Student/teacher names in lesson cards and filter dropdowns
- Invoice descriptions in list views
- Navigation items (likely already handled)

This is a targeted pass — most components already handle this.

---

## Technical Notes

- The `DatePicker` component must include `pointer-events-auto` on the Calendar per shadcn best practices
- All Calendar instances use `mode="single"` with `format(date, 'yyyy-MM-dd')` for string state compatibility
- The base component fixes (Textarea, SelectTrigger) provide the biggest impact-to-effort ratio since they cascade everywhere
- Approximately 20 files will be modified total  
  
  
After completing all 9 steps, do a final visual pass at 375px viewport on these key pages: Dashboard, Calendar, Register, Students, Invoices, Settings > Scheduling, Portal Home, Portal Schedule, and the Booking Page. Screenshot each and fix any remaining overflow, clipping, or spacing issues you find.