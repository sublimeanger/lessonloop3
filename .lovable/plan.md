

# Fix: Unreadable Calendar When Many Lessons Overlap

## Problem

The overlap layout algorithm divides each day column equally among all concurrent lessons. In a busy academy (e.g., 7 teachers running lessons at 10:00), this creates 7+ tiny columns where lesson text is truncated to single characters -- completely unreadable.

## Solution

Cap visible columns at 3 and show a "+N more" overflow pill for hidden lessons. This is the same pattern Google Calendar uses for dense time slots.

---

## Changes

### 1. Update `overlapLayout.ts` -- Add max-column cap

- Add an optional `maxColumns` parameter (default: 3)
- When a cluster has more columns than the cap, mark overflow lessons with a flag
- Return a new `overflowLessons` map alongside the existing positions map, keyed by time-slot ranges

### 2. Update `WeekTimeGrid.tsx` -- Render overflow indicators

- After rendering the visible (capped) lesson cards, render a small "+N more" pill at each time slot that has overflow
- Clicking the pill opens a popover listing all lessons in that time slot in a readable vertical list
- Each lesson in the popover is clickable (opens the lesson detail panel)

### 3. Update `LessonCard.tsx` -- Ultra-compact mode

- When `totalColumns >= 3`, switch to an ultra-compact display: show only the student's first name (no last name, no time range, no secondary line)
- This maximises readability even at 3 columns wide

---

## Technical Detail

**overlapLayout.ts changes:**

```text
Current: computeOverlapLayout(lessons, hourHeight, startHour)
New:     computeOverlapLayout(lessons, hourHeight, startHour, maxColumns = 3)

When totalColumns > maxColumns:
  - Lessons in columns 0..(maxColumns-2) render normally
  - Column (maxColumns-1) becomes reserved for a "+N more" indicator
  - Overflow lessons are returned in a separate Map<string, LessonWithDetails[]>
    keyed by a time-range bucket (e.g. "10:00-10:30")
```

**WeekTimeGrid.tsx changes:**

- Call `computeOverlapLayout` with `maxColumns = 3`
- Render visible lessons as before (now max 3 columns wide, so always readable)
- For each overflow bucket, render a small pill: "+4 more" positioned at the correct top/height
- Pill click opens a Popover with a scrollable list of all lessons in that slot

**LessonCard.tsx changes (calendar variant):**

- Add a `compact` prop (boolean)
- When `compact && totalColumns >= 3`: show only first name, hide time range and secondary line even for 30+ min lessons
- This keeps text readable at ~60-80px column widths

### Files Modified
- `src/components/calendar/overlapLayout.ts` -- Add max-column capping and overflow tracking
- `src/components/calendar/WeekTimeGrid.tsx` -- Render "+N more" pills with popover, pass compact flag
- `src/components/calendar/LessonCard.tsx` -- Add compact display mode for narrow columns

### No New Files, No Database Changes

