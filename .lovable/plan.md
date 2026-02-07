

# Redesign Calendar: Stacked Lesson Cards with Teacher Colour Coding

## The Problem

The current calendar uses a time-grid layout where each hour has a fixed-height row (60px) and lessons are absolutely positioned based on their start/end times. This creates several issues:

- **Visual clutter**: Hour gridlines, time gutter, and small lesson cards crammed into narrow columns make it hard to scan
- **Wasted space**: A 30-minute lesson gets only 30px of height -- barely readable
- **Overlap mess**: When lessons overlap (common for academies with multiple teachers), the column-splitting algorithm makes each card even narrower
- **Scrolling fatigue**: The grid spans 7am-9pm (14 hours x 60px = 840px), forcing constant scrolling through empty hours

## The Solution

Replace the time-grid layout with a **stacked card layout** for the week view, inspired by the MyMusicStaff reference. Each day column shows lessons as vertically stacked cards (sorted by time), with the time displayed on each card. A colour-coded left border indicates the teacher.

### What Changes

**1. New "Stacked" Week View (default)**

Each day column contains lesson cards stacked top-to-bottom, sorted by start time. No hour gridlines. No time gutter. Each card shows:
- **Time range** (e.g. "09:00 - 09:30") prominently at the top
- **Student name(s)**
- **Teacher name** (with matching colour dot)
- **Location icon** if present
- **Left border** colour-coded to the teacher

This fits far more lessons per screen and is scannable at a glance.

**2. Teacher Colour Palette**

A consistent set of 8 distinct, accessible colours is assigned to teachers based on their index in the teachers list. A small **colour legend** strip below the filters bar shows which colour belongs to which teacher, making the calendar instantly readable.

Colours are chosen for good contrast in both light and dark modes:
- Teal, Rose, Amber, Violet, Emerald, Sky, Orange, Fuchsia

**3. Keep the Time-Grid for Day View**

The existing time-grid remains available in day view where it makes sense (seeing one day's schedule with precise time positioning). But even here, lesson cards get the teacher colour-coding.

**4. Click-to-Create Still Works**

Clicking empty space in a day column still opens the "New Lesson" modal. In the stacked view, a subtle "+ Add lesson" affordance appears at the bottom of each day column. Drag-to-create only works in time-grid (day) view since it needs the time axis.

**5. "Now" Indicator**

For today's column, a small badge or line shows the current time so teachers can see where they are in their day.

### Layout Comparison

Current (time-grid):
```text
| 09:00 | [tiny card] |            |            |
| 10:00 |             | [tiny card]|            |
| 11:00 |             |            |            |
| ...   |  (empty)    |  (empty)   |  (empty)   |
```

New (stacked):
```text
| Mon 3         | Tue 4         | Wed 5         |
| 09:00-09:30   | 09:00-10:00   | 10:00-10:30   |
| Erin Laffin   | Jacob Brewer  | Rose Ramchan  |
| w/ Alice W    | w/ Amy B      | w/ Kyoko H    |
|               |               |               |
| 09:35-10:05   | 09:30-10:00   | 10:30-11:00   |
| Beatrice Forey| Alula Keeling | Ava Grillo    |
| w/ Alice W    | w/ Amy B      | w/ Kyoko H    |
```

## Technical Details

### Files Modified

**`src/components/calendar/CalendarGrid.tsx`** -- Major refactor
- Add a `layout` mode: `'stacked'` (default for week) vs `'timegrid'` (default for day)
- In stacked mode: remove time gutter, hour gridlines, and absolute positioning
- Render lessons as a simple sorted flex column of cards per day
- Keep the time-grid code for day view (and as an optional toggle)
- Pass teacher colour map down to lesson cards
- Add a "now" indicator line for today's column
- Add click handler on empty column space to open "New Lesson"

**`src/components/calendar/LessonCard.tsx`** -- New "stacked" variant
- Add a `variant: 'stacked'` option alongside existing `'calendar'` and `'agenda'`
- Stacked card shows: time range (bold), student names, teacher name with colour dot, location
- Left border uses the teacher's assigned colour
- Cancelled lessons shown with reduced opacity and strikethrough

**`src/components/calendar/TeacherColourLegend.tsx`** -- New file
- Small horizontal strip showing teacher name + colour dot
- Placed below the filters bar
- Clicking a teacher in the legend filters the calendar to that teacher

**`src/components/calendar/overlapLayout.ts`** -- No changes needed
- Only used in time-grid mode (day view), so remains untouched

**`src/pages/CalendarPage.tsx`** -- Minor updates
- Pass teachers list to CalendarGrid for colour mapping
- Render TeacherColourLegend below filters

**`src/hooks/useCalendarData.ts`** -- No changes needed

### Teacher Colour Assignment

Colours are deterministically assigned by sorting teachers alphabetically and mapping to an 8-colour palette (wrapping if more than 8 teachers):

```text
Index 0: Teal    (#0d9488)
Index 1: Rose    (#e11d48)
Index 2: Amber   (#d97706)
Index 3: Violet  (#7c3aed)
Index 4: Emerald (#059669)
Index 5: Sky     (#0284c7)
Index 6: Orange  (#ea580c)
Index 7: Fuchsia (#c026d3)
```

### No database changes required

The teacher colour is derived from the teacher's position in the sorted list -- no new columns needed. This keeps things simple and avoids migration overhead.
