

## Plan: Add Actions Dropdown to Mobile Calendar + Fix BulkSelectBar Position

### Problem
1. `CalendarMobileLayout` has no ⚡ actions dropdown — users cannot access "Generate Open Slots" or "Select Lessons" on mobile.
2. `BulkSelectBar` sits at `bottom: 0` which overlaps the mobile bottom nav.

### Approach
**Option (a):** Add a small ⚡ icon button in the mobile header bar (next to "Today" button). This mirrors the desktop pattern and keeps the FAB for its current purpose.

### Changes

**1. `src/components/calendar/CalendarMobileLayout.tsx`**
- Import `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `Zap`, `CheckSquare`, `SlotGeneratorWizard`, and `useState`.
- Add `useState(false)` for `slotWizardOpen`.
- In the header bar (the row with "Today" button), add a ⚡ `DropdownMenu` button before or after "Today":
  - "Generate Open Slots" → opens `SlotGeneratorWizard`
  - "Select Lessons" → calls `bulk.enterSelectionMode()`
- Both items disabled when `!isOnline` or `isParent` (don't render for parents).
- Render `<SlotGeneratorWizard>` at the bottom of the component (same pattern as desktop), passing `wizardTeachers`, `locations`, `rooms`, `refetch`.
- Need to add `refetch` to the component props interface.

**2. `src/components/calendar/BulkSelectBar.tsx`**
- On mobile (no `sm:` prefix), change `bottom-0` positioning to use `style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}` so it sits above the bottom nav.
- Keep the existing `sm:bottom-4` for desktop.

**3. `src/pages/CalendarPage.tsx`**
- Pass `refetch` to `CalendarMobileLayout` via `sharedProps` (it's already passed to desktop but not mobile).

