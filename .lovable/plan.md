

# Calendar Density Improvements for High-Volume Academies

## Problem
When an academy has 50+ lessons per day, the current calendar views become difficult to read. The Stacked view shows an unbounded list of cards per day, the Time Grid gets overwhelmed with overlapping lessons, and there's no way to group by teacher for a quick overview.

## Changes

### 1. Stacked Week View -- Collapsible Day with Lesson Count + Teacher Grouping
**File: `src/components/calendar/StackedWeekView.tsx`**

- When a day has more than 8 lessons, show only the first 5 and a "Show N more" button to expand
- Add a teacher-grouped sub-layout: lessons are visually grouped under a small teacher name header with their colour dot, making it easy to scan "who's teaching what"
- Show a lesson count badge in the day header (e.g., "Mon 12 -- 14 lessons")

### 2. LessonCard Stacked Variant -- Tighter Compact Mode
**File: `src/components/calendar/LessonCard.tsx`**

- Add an `ultraCompact` rendering path for the stacked variant when the day has many lessons: single-line layout showing time + student name only, no secondary line, reduced vertical padding
- This kicks in automatically when the parent passes `compact={true}`

### 3. Time Grid -- Increase Max Overlap Columns + Summary Pill
**File: `src/components/calendar/overlapLayout.ts`**

- Increase default `maxColumns` from 3 to 4 for better density handling
- The existing "+N more" overflow pill already handles excess; this just shows more before triggering overflow

**File: `src/components/calendar/WeekTimeGrid.tsx`**

- Pass `maxColumns={4}` to `computeOverlapLayout`
- Add a day summary badge in the sticky header showing lesson count per day (e.g., "12") when count exceeds 10

### 4. Agenda View -- Teacher Grouping Option
**File: `src/components/calendar/AgendaView.tsx`**

- Add a "Group by teacher" toggle that reorganises lessons within each day under teacher sub-headers with their colour indicator
- This makes it easy for academy managers to review each teacher's daily load at a glance

### 5. Calendar Page -- Density Toggle
**File: `src/pages/CalendarPage.tsx`**

- Add a "Compact" toggle button in the toolbar (next to the view switcher) that enables compact mode across all views
- When active, it passes `compact={true}` down to StackedWeekView and WeekTimeGrid
- State persisted in localStorage so the preference sticks

---

## Technical Details

### StackedWeekView Changes
- New state: `expandedDays` (Set of date keys) to track which high-volume days are expanded
- Threshold constant: `COMPACT_THRESHOLD = 8` -- days with more lessons than this get collapsed
- Teacher grouping: group `dayLessons` by `teacher_user_id`, sort groups alphabetically, render a small coloured header per group
- Lesson count badge rendered in the day header div

### LessonCard Stacked Compact Mode
- When `compact` prop is true on the stacked variant: reduce padding to `px-1 py-px`, show only time + first student name on a single line, hide secondary line entirely
- Font sizes reduced to `text-[9px]` for time and `text-[10px]` for name

### WeekTimeGrid Day Count Badge
- In the sticky day header, when `dayLessons.length > 10`, render a small `Badge` showing the count
- Keeps managers aware of load without needing to scroll

### AgendaView Teacher Grouping
- New prop `groupByTeacher: boolean`
- When true, within each day group, sub-group lessons by teacher and render a coloured divider with the teacher name
- Toggle controlled from CalendarPage via a small button

### CalendarPage Compact Toggle
- New state: `isCompact` with localStorage persistence key `ll-calendar-compact`
- Rendered as a small toggle or button in the toolbar row
- Passed as prop to child view components

