

# Make Calendar Lessons Intuitive to Edit and Remove

## The Problem

The calendar already supports clicking lessons to view details and editing them, but the experience isn't intuitive:

1. **Too many steps to reschedule**: Click lesson, then detail panel opens, then click "Edit", then a full modal opens, then you change the date/time, then save. That's 4+ clicks for what should feel instant.
2. **"Remove from schedule" is buried**: The Cancel and Delete actions are at the bottom of the detail panel, styled the same as everything else. Users can't find how to take a student off the calendar.
3. **No visual hint that cards are interactive**: The lesson cards have a cursor-pointer, but no hover tooltip or visual cue telling users "click to manage this lesson."

## What Changes

### 1. Redesign the Detail Panel for Quick Actions

Transform the top of the detail panel from a passive information display into an action-oriented header with three prominent, clearly labelled buttons:

- **Reschedule** (calendar icon) -- Opens the edit modal with the date/time fields focused
- **Cancel Lesson** (ban icon) -- Direct cancel flow (with recurring choice if applicable)
- **Delete** (trash icon) -- Direct delete flow

These replace the current bottom-of-panel buttons that users aren't finding.

### 2. Add Hover Tooltip on Lesson Cards

When hovering over a lesson card on the calendar grid, show a subtle tooltip: "Click to view, edit, or cancel". This teaches users the interaction is available.

### 3. Improve the Detail Panel Layout

Restructure the detail panel to show:
- Lesson title + status badge (existing)
- **Quick action buttons** right below the header (NEW -- prominent, coloured)
- Time, teacher, location, students info (existing, kept compact)
- Attendance section (existing)
- Notes (existing)

The old bottom action bar is removed in favour of the prominent top placement.

### 4. Add "End All Future Lessons" as a Named Action

For recurring lessons, add a clearly labelled "End Series" option alongside Cancel and Delete. This specifically answers the user's question: "How do I take a student off the calendar?" -- you click the lesson, then click "End Series", which cancels all future occurrences.

## Technical Details

### Files Modified

**`src/components/calendar/LessonDetailPanel.tsx`**
- Move action buttons from the bottom of the panel to directly below the header
- Style them as a prominent button group with clear icons and labels:
  - "Reschedule" (primary outline, calendar icon)
  - "Cancel" (warning/amber styling, ban icon)  
  - "Delete" (destructive ghost, trash icon)
- For recurring lessons, add an "End Series" button that cancels all future lessons in one click (with confirmation)
- Keep attendance and notes sections below

**`src/components/calendar/LessonCard.tsx`**
- Wrap the calendar variant card in a Tooltip showing "Click to view or edit"
- Add a subtle scale-up hover effect (`hover:scale-[1.02]`) for visual feedback

**`src/components/calendar/CalendarGrid.tsx`**
- Wrap each lesson's clickable div with the Tooltip provider so hover hints work within the grid context

### No database changes required -- this is purely a UX restructuring of existing functionality.

