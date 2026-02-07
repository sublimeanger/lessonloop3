

# Calendar Overhaul: MyMusicStaff-Inspired Design

## The Problem

The current week view ("Calendar") still feels cluttered compared to MyMusicStaff's approach. While we moved from a time-grid to stacked cards, our cards are too heavy -- they show time ranges prominently, lesson titles, student names, teacher names, location, badges, and icons all crammed together. The result is visual noise rather than the clean, scannable list that MyMusicStaff achieves.

Looking at the MyMusicStaff reference closely, their design succeeds because of simplicity:
- Each card has a **solid colour background** matching the teacher (not a subtle left border)
- **Student name is the headline** (bold, prominent)
- Secondary line: "Lesson with [Teacher]" or "[Location] with [Teacher]"
- Optional time range only when the event has a specific time
- No badges, no icons for lesson type, no extra metadata
- Cards are compact: 2-3 lines max, flush to the column edges

## The 3 Views We Need to Refine

### 1. Week View (StackedWeekView) -- The Priority

**Current issues:**
- Cards have a left-border colour (too subtle) instead of a full background tint
- Time range "09:00 - 09:30" shown prominently at the top (clutters the visual flow)
- Lesson title shown separately from student names (redundant)
- Teacher name + location + lesson type badge + recurring icon = too much metadata
- Cards have rounded-lg, shadow-on-hover, borders -- too much "card chrome"

**Redesign:**
- **Full background tint** using the teacher's colour (light pastel in light mode, deeper shade in dark mode) -- matching the MyMusicStaff look
- **Line 1**: Time range in small text + instrument/recurring icon (de-emphasised, like "09:00 - 09:30")
- **Line 2**: **Student name(s) in bold** -- this is what teachers scan for
- **Line 3**: "Lesson with [Teacher Name]" or "[Location] with [Teacher Name]"
- Remove: lesson type badge, MapPin icon, separate teacher colour dot (the whole card IS the colour)
- Minimal padding, no rounded corners on individual cards -- cards sit flush in the column like MyMusicStaff
- Remove the border-l-4 left accent -- replace with full background fill

**Column changes:**
- Remove the "No lessons" italic text for empty days -- just leave them empty (cleaner)
- Keep the "+ Add" button but make it even more subtle
- Remove the `gap-px bg-border` grid approach -- use a cleaner column divider

### 2. Day View (CalendarGrid) -- Keep Time-Grid, Polish Cards

The day view time-grid layout works well for seeing one day's schedule precisely. Changes:
- Apply the same teacher background-tint to the compact day-view cards
- Ensure the time-grid card variant looks cohesive with the new stacked design

### 3. Agenda View -- Align Styling

The agenda view is fine structurally but should pick up the teacher colour tinting for visual consistency:
- Apply light teacher background tint to agenda cards
- Student name as the primary bold text (currently lesson title is primary)

## Technical Changes

### `src/components/calendar/LessonCard.tsx`

Complete rework of the `stacked` variant:

```
Before (stacked):
+--border-l-4 teal--------------------------+
| 09:00 - 09:30 (bold)                       |
| Piano - Grade 3 (title)                    |
| Erin Laffin                                |
| [dot] Alice W  [pin] Studio A  [badge] 1:1 |
+--------------------------------------------+

After (stacked):
+--full teal background tint-----------------+
| 09:00 - 09:30                (small, grey) |
| Laffin, Erin               (bold, primary) |
| Lesson with Alice W         (small, muted) |
+--------------------------------------------+
```

- Remove `border-l-4` left accent
- Add full `teacherColour.bgLight` background
- Line 1: time range in `text-xs text-muted-foreground`
- Line 2: student name(s) in `font-semibold` (last name, first name format for scannability)
- Line 3: "Lesson with [Teacher]" or "[Location] with [Teacher]" in `text-xs`
- No badges, no icons (except a small recurring icon if needed)
- Cancelled lessons: strikethrough + reduced opacity (keep)
- Group lessons: show "2 students" or "Group Lesson" + student count

Also update the `calendar` variant (day view) to use the full teacher background tint.

### `src/components/calendar/StackedWeekView.tsx`

- Replace `grid grid-cols-7 gap-px bg-border` with a cleaner CSS grid or flex layout with simple vertical dividers
- Tighten card spacing: reduce from `space-y-1.5 p-1.5` to `space-y-0.5 p-1`
- Remove the "No lessons" empty state text -- empty columns stay empty
- Simplify the now-indicator styling
- Ensure cards stretch full width within columns (no internal card borders, rely on background colour for separation)

### `src/components/calendar/CalendarGrid.tsx`

- Pass `teacherColour` to the `calendar` variant `LessonCard` (already partially done)
- Ensure the day-view cards use the background tint for consistency

### `src/components/calendar/teacherColours.ts`

No structural changes needed. The existing `bgLight` classes already provide the background tints. We just need to actually USE them as the card background instead of the subtle border.

### `src/pages/CalendarPage.tsx`

No changes needed -- already wires everything together correctly.

## Visual Result

After these changes, the week view will look like:

```
| Mon 3            | Tue 4            | Wed 5            |
|  [teal bg]       |  [rose bg]       |  [teal bg]       |
|  09:00 - 09:30   |  09:00 - 10:00   |  10:00 - 10:30   |
|  Laffin, Erin    |  Brewer, Jacob   |  Ramchandani, R  |
|  w/ Alice W      |  w/ Amy B        |  w/ Kyoko H      |
|                  |                  |                  |
|  [teal bg]       |  [rose bg]       |  [amber bg]      |
|  09:35 - 10:05   |  09:30 - 10:00   |  10:30 - 11:00   |
|  Forey, Beatrice |  Keeling, Alula  |  Grillo, Ava     |
|  w/ Alice W      |  w/ Amy B        |  Lesson w/ Lisa  |
```

Each card's background colour immediately tells you which teacher -- no legend lookup needed. Student names are the first thing your eye catches. Clean, minimal, scannable.

## Files Modified

| File | Summary |
|------|---------|
| `src/components/calendar/LessonCard.tsx` | Rework stacked variant: full bg tint, student-name-first layout, remove badges/icons. Polish calendar variant similarly. |
| `src/components/calendar/StackedWeekView.tsx` | Tighter spacing, remove "No lessons" text, cleaner column dividers, flush card layout. |
| `src/components/calendar/CalendarGrid.tsx` | Minor -- ensure day view cards pass teacher colour for bg tint consistency. |

No database changes. No new files.

