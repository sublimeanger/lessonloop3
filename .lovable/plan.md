

# Restore Stacked Week View as Default Calendar

## Problem

The current time-grid view (hour rows, 07:00-21:00 axis, tiny positioned cards) is cluttered and hard to read at a glance. The previous stacked layout -- simple day columns with lesson cards listed vertically -- gave a much better full-week overview.

## Solution

Bring back a clean stacked week view as the default, and keep the time-grid as an optional "detailed" view for users who need precise time positioning.

---

## Changes

### 1. Add a new `StackedWeekView.tsx` component

A clean, simple week layout:
- 7 (or 5) day columns side by side, equal width
- Each column has a day header (Mon 3, Tue 4, etc.) with today highlighted
- Lesson cards stacked vertically within each day, sorted by start time
- Cards use the existing `LessonCard` "stacked" variant (shows time, student name, teacher)
- Teacher colour tinting on cards (already working)
- Closure date highlighting on column headers
- Click anywhere on a day column to trigger lesson creation for that day
- Click a lesson card to open the detail panel (existing behaviour)
- No hour rows, no time axis, no absolute positioning -- just a clean list per day
- Scrollable if a day has many lessons

### 2. Update `CalendarPage.tsx` -- Add third view option

- Add `'stacked'` back to the `CalendarView` type alongside `'week'` and `'agenda'`
- Set `'stacked'` as the default view
- Add a third toggle button (e.g. a Columns icon) for the stacked view
- View toggle: Stacked (default) | Time Grid | Agenda
- When clicking an empty area of a day column in stacked view, open the quick-create popover with that day pre-selected (time defaults to next available hour)
- Keyboard shortcut: `S` for stacked view

### 3. Update `types.ts`

- Add `'stacked'` to the `CalendarView` type union

---

## Technical Detail

### `StackedWeekView.tsx` (~120 lines)

```text
Props:
  - currentDate: Date
  - lessons: LessonWithDetails[]
  - teacherColourMap: Map<string, TeacherWithColour>
  - onLessonClick: (lesson) => void
  - onDayClick: (date: Date) => void
  - isParent: boolean

Layout:
  - flex container with equal-width day columns
  - Each column: header + scrollable card list
  - Cards use LessonCard variant="stacked"
  - Empty days show subtle "No lessons" text
  - Click on empty space calls onDayClick(day)
```

### `CalendarPage.tsx` changes

- Default view state: `useState<CalendarView>('stacked')`
- Add `onDayClick` handler that sets slot date to noon on that day, opens quick-create
- Render `StackedWeekView` when `view === 'stacked'`
- Keep `WeekTimeGrid` for `view === 'week'` (the detailed time-grid)
- Keep `AgendaView` for `view === 'agenda'`
- Toggle group gets 3 options: Columns (stacked), LayoutGrid (time-grid), List (agenda)

### `types.ts` change

- `CalendarView = 'stacked' | 'week' | 'agenda'`

### Files Created
- `src/components/calendar/StackedWeekView.tsx`

### Files Modified
- `src/pages/CalendarPage.tsx` -- Add stacked view as default, wire onDayClick
- `src/components/calendar/types.ts` -- Add 'stacked' to CalendarView

### No Database Changes
