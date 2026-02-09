

# World-Class Calendar Upgrade

## Summary

Consolidate from 3 views to 2, upgrade the week view from a stacked card layout to a proper time-grid (like Google Calendar / Teachworks), and add drag interactions for rapid lesson management.

---

## Phase 1: Time-Grid Week View (Replaces both CalendarGrid + StackedWeekView)

The current `StackedWeekView` simply stacks lesson cards vertically per day with no time axis. The current `CalendarGrid` has a time axis but is limited to a single day. The new unified component merges the best of both:

**New component: `WeekTimeGrid.tsx`**

- 7-column (or 5-column when no weekend lessons) time-grid layout, identical to Google Calendar's week view
- Horizontal axis: Mon-Sun day columns with sticky header row showing day name + date
- Vertical axis: time labels from 07:00 to 21:00 with 60px-per-hour rows and subtle half-hour divider lines
- Lesson cards positioned absolutely using the existing `computeOverlapLayout` algorithm (already built and tested)
- Cards show student name (bold), time range, and teacher/location in the same compact format used today
- Teacher colour tinting on cards (already working)
- Auto-scroll to current hour on load (smooth scroll to bring 9am or current time into view)
- "Now" indicator: red horizontal line spanning the current day column at the current time, updating every minute
- Closure date highlighting: warning-tinted column background with badge in header (already working in StackedWeekView)
- Auto-detect weekend lessons to toggle between 5 and 7 columns (already working)

**Desktop layout:**
- Time gutter (64px) on the left with hour labels
- Day columns filling remaining width equally
- ScrollArea wrapping the grid for vertical scroll
- Sticky day header row that stays visible while scrolling

**Mobile behaviour:**
- On mobile (`useIsMobile()`), delegate to the existing `MobileWeekView` component (no changes to mobile -- it works well)

**What gets removed:**
- `CalendarGrid.tsx` -- fully replaced (its time-grid layout, overlap positioning, click-to-create, and drag-to-create are all ported into the new component)
- The "day" view toggle option -- replaced by the week view which serves the same purpose with more context
- `CalendarView` type simplified to `'week' | 'agenda'`

---

## Phase 2: Click-to-Create on Time Grid

When a user clicks an empty area of the time grid:

- Snap the click position to the nearest 15-minute interval
- Call the existing `handleSlotClick(date)` callback, which already opens `LessonModal` pre-filled with that date and time
- This already works in `CalendarGrid` -- the logic ports directly

**Quick-Create Popover (new):**
Instead of always opening the full `LessonModal` (which has 15+ fields), a lightweight popover appears at the click position with just 3 fields:
- Student (searchable dropdown, auto-selects if only one)
- Teacher (auto-selected if only one, or from student defaults)
- Duration (preset buttons: 30, 45, 60 min)
- "Create" button to save immediately with defaults
- "More options..." link to open the full `LessonModal`

This mirrors how Google Calendar's quick event creation works and dramatically speeds up scheduling for solo teachers (the primary user).

---

## Phase 3: Drag-to-Create on Time Grid

When a user clicks and drags on an empty time slot:

- Show a selection overlay (blue dashed rectangle) snapped to 15-minute increments
- On mouse-up, determine start and end times from the drag coordinates
- Open the quick-create popover (or full modal via "More options") with the time range pre-filled
- This logic already exists in `CalendarGrid` via `handleMouseDown`, `handleMouseMove`, `handleMouseUp` -- it ports directly into the new component

---

## Phase 4: Drag-to-Reschedule Lessons

This is the flagship interaction. Users can grab a lesson card and drag it to a new time slot or day.

**Drag behaviour:**
- `onMouseDown` / `onTouchStart` on a lesson card initiates drag after a 150ms hold (to distinguish from click-to-view)
- During drag: the original card becomes a ghost (opacity 30%), and a "dragging" copy follows the cursor snapped to 15-minute grid positions
- Horizontal movement: moves the lesson to a different day column
- Vertical movement: changes the start time
- Drop: snaps to nearest 15-minute slot, calculates new `start_at` and `end_at`

**On drop:**
1. Run conflict detection on the new position (using existing `useConflictDetection` hook)
2. If the lesson is recurring, show the existing `RecurringActionDialog` asking "This lesson only" or "This and all future"
3. If no blocking conflicts: save immediately via Supabase update
4. If blocking conflicts: show a toast with the conflict message and revert the card to its original position
5. Call `refetch()` to refresh the calendar

**Visual feedback during drag:**
- Ghost card at original position (semi-transparent)
- Dragged card follows cursor with slight shadow elevation
- Target time slot highlighted with a subtle blue background
- Time label tooltip near the cursor showing the snapped time (e.g. "10:15")

**Touch support (mobile):**
- Long-press (300ms) initiates drag mode
- Haptic feedback via `navigator.vibrate(50)` if available
- Cancel by dragging back to original position or tapping elsewhere

---

## Phase 5: Drag-to-Resize Duration

A small drag handle appears at the bottom edge of lesson cards (visible on hover).

**Behaviour:**
- Dragging the handle changes the `end_at` while keeping `start_at` fixed
- Snaps to 15-minute intervals
- Minimum duration: 15 minutes
- Visual: the card height changes in real-time during drag
- On release: update `end_at` in the database, with conflict detection
- If recurring: show the `RecurringActionDialog`

---

## CalendarPage.tsx Changes

- Remove the `'day'` option from `CalendarView` type and the `ToggleGroupItem` for day view
- Replace `CalendarGrid` and `StackedWeekView` with the single `WeekTimeGrid` component
- Simplify view toggle to just Week and Agenda (2 icons)
- Pass `onSlotDrag`, `onLessonDrag`, and `onLessonResize` callbacks
- Update keyboard shortcuts: remove `d` for day view
- Navigation always moves by week (remove day-by-day logic for `view === 'day'`)

---

## Technical Details

### Files Created
- `src/components/calendar/WeekTimeGrid.tsx` -- The new unified time-grid week view (~350 lines)
- `src/components/calendar/QuickCreatePopover.tsx` -- Lightweight lesson creation popover (~120 lines)
- `src/components/calendar/useDragLesson.ts` -- Custom hook encapsulating drag-to-reschedule state machine (~150 lines)
- `src/components/calendar/useResizeLesson.ts` -- Custom hook for drag-to-resize (~80 lines)

### Files Modified
- `src/components/calendar/types.ts` -- Remove `'day'` from `CalendarView`, add `DragState` type
- `src/components/calendar/LessonCard.tsx` -- Add drag handle for resize, `onDragStart` prop, cursor styles
- `src/components/calendar/overlapLayout.ts` -- No changes needed (already works perfectly for multi-day grids)
- `src/pages/CalendarPage.tsx` -- Consolidate views, wire new callbacks, simplify navigation
- `src/hooks/useCalendarData.ts` -- Minor: remove `'day'` view handling (map to `'week'` internally)

### Files Removed
- `src/components/calendar/CalendarGrid.tsx` -- Fully replaced by `WeekTimeGrid`
- `src/components/calendar/StackedWeekView.tsx` -- Fully replaced by `WeekTimeGrid`

### Files Unchanged
- `src/components/calendar/MobileWeekView.tsx` -- Still used for mobile, delegated from `WeekTimeGrid`
- `src/components/calendar/AgendaView.tsx` -- Stays as-is
- `src/components/calendar/LessonModal.tsx` -- Stays as-is (still used for full editing)
- `src/components/calendar/LessonDetailPanel.tsx` -- Stays as-is
- `src/components/calendar/RecurringActionDialog.tsx` -- Stays as-is, reused for drag operations
- `src/hooks/useConflictDetection.ts` -- Stays as-is, called during drag-drop
- All existing test files remain valid

### Implementation Order
1. Create `WeekTimeGrid.tsx` with time-grid layout, overlap positioning, click-to-create, and drag-to-create (porting from CalendarGrid)
2. Wire it into `CalendarPage.tsx`, remove day view toggle, remove old components
3. Build `QuickCreatePopover.tsx` for fast lesson creation
4. Build `useDragLesson.ts` hook and integrate drag-to-reschedule
5. Build `useResizeLesson.ts` hook and integrate drag-to-resize
6. Add touch support for mobile drag interactions
7. Verify all existing functionality: closures, teacher colours, now indicator, conflict detection, recurring lesson handling

### No Database Changes Required
All interactions use existing Supabase tables and columns. Drag-to-reschedule simply updates `start_at` and `end_at` on the `lessons` table. No new edge functions, no migrations.

