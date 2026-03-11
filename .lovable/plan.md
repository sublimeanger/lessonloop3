MY INPUT - PLEASE AMEND ACCORDINGLY.  
  
Plan looks good with 4 amendments:

1. H-6 (Messages delete): Skip the database migration. Just add 

   a hard DELETE for now. We'll add soft-delete later.

2. H-7 (Teacher delete): The validation hook is correct per your 

   analysis. Find what ELSE is disabling the button on the 

   Teachers page — there's another condition beyond the lesson 

   check.

3. M-2 (Keyboard shortcuts): Don't implement two-key sequences. 

   Just remove the broken g+h/g+c/g+s/g+i entries from the 

   shortcuts dialog. Keep only working shortcuts.

4. M-11 (Room delete): If it already matches other delete dialogs, 

   skip it.

Proceed with all other fixes as planned. One commit per fix.  
  
Bug Fix Plan — 24 Issues (Prioritized)

This plan covers all 24 bugs in order: Launch Blockers first, then High Priority, then Medium. Each fix will be committed individually.

---

## LAUNCH BLOCKERS

### LB-2: Student List Capped at 1000 Rows

**Status**: Already fixed in the previous message. The `get_students_for_org` RPC function was created with `SECURITY DEFINER` to bypass PostgREST's row limit. `useStudents.ts` now calls this RPC. **No further action needed** — verify it works after deployment.

### LB-7: Bulk Edit Lessons Does Nothing

**Root cause**: `CalendarDesktopLayout.tsx` line 142 calls `bulk.enterSelectionMode()` — this is correctly wired. The `BulkSelectionContext` only exposes `selectionMode` and `selectedIds` (read-only). The `CalendarPage.tsx` wraps content in `BulkSelectionProvider` with the correct `bulkCtx`. The `LessonCard` reads from `useBulkSelection()` and shows checkboxes when `selectionMode` is true.

Need to check if `enterSelectionMode` on the `bulk` object (from `useBulkLessonActions`) actually sets `selectionMode` to true and whether the context value propagates. The issue is likely that `enterSelectionMode` is called but `bulkCtx` memo doesn't update, OR the dropdown closes and steals focus. Will trace the `useBulkLessonActions` hook.

**Fix**: Verify the `useBulkLessonActions.enterSelectionMode()` sets state that flows into `bulkCtx`. If the dropdown menu's `onSelect` auto-closes and prevents state update, add `e.preventDefault()` or use `onSelect` properly.

### LB-8: Dead Feature Request Link

**Files**: 

- `src/components/layout/AppSidebar.tsx` lines 372-383: Remove the "Suggest a feature" link block
- `src/pages/Help.tsx` lines 101-123: Remove the "Feature Requests" card
- `tests/e2e/feature-request.spec.ts`: Remove or skip the test file

---

## HIGH PRIORITY

### H-1: No Student Archive on Detail Page

**File**: `src/components/students/StudentInfoCard.tsx`
**Fix**: Add a status dropdown (Active/Inactive) next to the existing status Badge in the header. Use `useToggleStudentStatus` mutation. Show confirmation dialog before changing. Update badge on success, show toast.

### H-3: Future Attendance Can Be Marked

**File**: `src/pages/BatchAttendance.tsx`
**Status**: The `isFutureDate` guard already exists and disables buttons (lines 171, 177). However the attendance toggle buttons inside lesson cards (lines 306-374) are NOT disabled when `isFutureDate` is true — the `ToggleGroup` items lack a `disabled` prop.
**Fix**: Pass `isFutureDate` as `disabled` to all `ToggleGroupItem` components. The warning banner at line 229 already shows — change text to "Attendance can only be recorded for today or past dates."

### H-4: Attendance UX — Rename Ready/Complete

**File**: `src/components/register/RegisterRow.tsx`
**Fix**: 

- Line 149: Change `"Ready"` → `"Pending"`
- Line 146: Change `"Completed"` → `"Recorded"` (already says "Completed" which is fine, but rename to "Recorded")
- `src/pages/DailyRegister.tsx`: Add a one-line description below the page header
- Add tooltips on the status badges explaining meaning

### H-5: Internal Message Toast Says "Email Sent"

**File**: `src/hooks/useInternalMessages.ts` line 254
**Fix**: Change toast from `'Your message has been sent and the recipient notified by email.'` to `'Internal note sent successfully.'` — internal messages should not mention email notification. The email notification edge function call (lines 234-248) can remain (it's best-effort), but the toast should not reference it.

### H-6: Messages Cannot Be Deleted

**Scope**: This requires:

1. Database migration: Add `deleted_at` column to `internal_messages` table
2. Update `useInternalMessages.ts` queries to filter `deleted_at IS NULL`
3. Add delete mutation hook
4. UI: Add trash icon to message items in `InternalMessageList.tsx`
5. Add "Delete conversation" to thread overflow menu with confirmation dialog

### H-7: Teacher Cannot Be Deleted

**File**: `src/hooks/useDeleteValidation.ts` lines 143-186
**Status**: Already correct! Lines 152-160 check `gte('start_at', now)` — this only checks future lessons. The guard already works correctly.
**Investigation needed**: The user says "Remove Teacher button is greyed out" — need to check the Teachers page button disable condition. May be a separate UI issue.
**Fix**: Check `src/pages/Teachers.tsx` for any additional disable conditions on the Remove Teacher button. Also add an "Archive" option as alternative.

### H-8: Invoice Form Fields Not Labelled

**File**: `src/components/invoices/CreateInvoiceModal.tsx` lines 340-381
**Fix**: Add `<Label>` above each input in the grid:

- "Description" above the description input
- "Qty" above the quantity input  
- "Price (£)" above the price input
- Add labels as a header row above the first item, hide on mobile where single-column layout makes placeholder sufficient

### H-9: No PDF Download on Paid Invoices

**File**: `src/pages/InvoiceDetail.tsx`
**Root cause**: Lines 491 — the sidebar "Actions" card only renders when `invoice.status !== 'void' && invoice.status !== 'paid'`. So paid invoices lose the PDF download in the sidebar. The header area (line 187-201) shows PDF for parents unconditionally, but the staff view doesn't have it in the header for paid status.
**Fix**: For staff view, add the Download PDF button to the header actions for ALL statuses (currently only draft/sent/overdue have header actions). OR move PDF download out of the Actions card and show it independently regardless of status.

---

## MEDIUM PRIORITY

### M-1: Logo Not Clickable

**File**: `src/components/layout/Header.tsx` lines 31-34
**Fix**: Wrap `Logo` and `LogoWordmark` in `<Link to="/dashboard">`.

### M-2: Keyboard Shortcuts g+h Don't Work

**File**: `src/hooks/useKeyboardShortcuts.ts`
**Fix**: The shortcuts array defines `key: 'g h'` but the `handleKeyDown` only matches single keys. Implement a two-key sequence: track when 'g' is pressed, set a flag, clear after 500ms, and match the second key within that window.

### M-3: Quick Actions "New Lesson" Opens Calendar Without Modal

**File**: `src/components/dashboard/QuickActionsGrid.tsx` line 24 and 31
**Fix**: Change `href: '/calendar'` to `href: '/calendar?action=new'` for the "New Lesson" action.

### M-4: Student Picker Needs Polish

**File**: `src/components/calendar/lesson-form/StudentSelector.tsx`
**Fix**: Add avatar circles with initials, better padding, clearer selected state, "No results" message.

### M-5: Auth Session Drops Randomly

**File**: `src/contexts/AuthContext.tsx`
**Status**: Token refresh handling already exists (lines 269-277). The `TOKEN_REFRESHED` event skips profile refetch and just ensures initialisation completes.
**Fix**: Add a toast notification when token refresh fails (i.e., when `onAuthStateChange` fires with event `SIGNED_OUT` unexpectedly, or when the session is null after a refresh attempt). Currently the code silently sets `user` to null on line 304-310 — add a toast there.

### M-6: Leads Kanban Not Scrollable

**File**: `src/components/leads/LeadKanbanBoard.tsx` line 258-262
**Status**: Already has `overflow-x-auto` on mobile with `snap-x`. Desktop doesn't have it.
**Fix**: Add `overflow-x-auto` to the desktop case as well. Add `min-w-[260px]` to each column so they don't shrink. Add sticky stage headers.

### M-7: Practice Assignment — No Student Search

**File**: `src/components/practice/CreateAssignmentModal.tsx`
**Fix**: Add a search `Input` above the student list. Filter students by name as user types.

### M-8: Practice Assignments Not Clickable

**File**: `src/pages/Practice.tsx`
**Fix**: Make assignment cards clickable to open a detail panel/dialog showing full assignment info, practice logs, and edit/delete buttons.

### M-9: Resource Sharing Modal Polish

**File**: `src/components/resources/ShareResourceModal.tsx`
**Status**: Already has "Select all" button, search, checkmarks. Fairly clean.
**Fix**: Add "Share with all students" quick button, improve spacing, add location-based sharing dropdown if locations are available.

### M-10: Resource Deletion Slow With No Feedback

**File**: `src/components/resources/ResourceCard.tsx`
**Fix**: Add `deleteMutation.isPending` loading state to the delete button. Show spinner and "Deleting..." text. Disable button during deletion.

### M-11: Room Delete Modal Visually Rough

**File**: `src/pages/Locations.tsx` lines 973-983
**Status**: Already uses `DeleteValidationDialog` which uses the standard `AlertDialog` pattern. This is consistent with other delete confirmations.
**Fix**: Check if the dialog's styling matches the design system. May need minor tweaks to the confirmation text.

### M-12: Payment Plan Tab Confusing

**File**: `src/pages/Invoices.tsx` and related components
**Fix**: After creating a payment plan on a draft invoice, show an inline note: "Send the invoice to activate the payment plan."

### M-13: Recurring Invoice Pause UX Unclear

**File**: `src/components/settings/RecurringBillingTab.tsx` lines 84-86
**Fix**: Replace the plain icon-only toggle button with a labeled button showing "Pause"/"Resume" text with pause/play icons. Add tooltip explaining what pausing does.

---

## Implementation Order

Each fix = 1 commit. Starting with LB-7, LB-8, then H-1 through H-9, then M-1 through M-13. LB-2 is already done.

Total: ~23 commits (LB-2 already done).