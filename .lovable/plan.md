

# Show Recurring Series Details on Lesson Click

## The Problem
When you click a recurring lesson, the detail views show almost no useful recurrence info:
- **Desktop side panel** (`LessonDetailSidePanel`): just says "Recurring lesson" — no frequency, end date, nothing
- **Mobile sheet** (`MobileLessonSheet`): same — just "Recurring lesson"
- **Full detail panel** (`LessonDetailPanel`): shows "Weekly on Mon · Until 15 Mar · 5 remaining" which is better, but still no way to see the actual list of dates in the series

## The Fix

### 1. Create a `RecurrenceInfo` shared component
A reusable component that:
- Accepts a `recurrence_id` and the current lesson's `start_at`
- Queries `recurrence_rules` to get frequency, days, end date (same query LessonDetailPanel already does)
- Queries `lessons` with that `recurrence_id` to get all instances (id, start_at, status)
- Displays a summary line: **"Weekly on Mon · Until 15 Mar 2025 · 3 of 12 remaining"**
- Has a collapsible "View all dates" section listing every instance with date, time, and status badge (scheduled/completed/cancelled)
- Each date in the list is clickable → navigates to `/calendar?date=YYYY-MM-DD` and highlights that lesson
- Current lesson is visually marked in the list

### 2. Replace the static text in all three views

- **`LessonDetailSidePanel.tsx`** (line 176-181): Replace the static "Recurring lesson" span with `<RecurrenceInfo>`
- **`MobileLessonSheet.tsx`** (line 113-118): Replace "Recurring lesson" with `<RecurrenceInfo>`
- **`LessonDetailPanel.tsx`** (line 665-671): Replace the existing `recurrenceDescription` span with `<RecurrenceInfo>` (removes the duplicated query logic from this component since RecurrenceInfo handles it)

### 3. Component details

```
src/components/calendar/RecurrenceInfo.tsx
```

- Props: `recurrenceId: string`, `currentLessonId: string`, `currentStartAt: string`
- Two queries (both cached 5min):
  1. `recurrence_rules` → days_of_week, interval_weeks, end_date, start_date
  2. `lessons` where recurrence_id matches → id, start_at, status (ordered by start_at)
- Summary line with Repeat icon (matches existing styling)
- Collapsible list (Collapsible from shadcn) showing all instances
- Past lessons dimmed, current highlighted, future normal
- Cancelled lessons shown with strikethrough
- Mobile-friendly: scrollable list capped at ~200px height

### Files to edit
1. **Create** `src/components/calendar/RecurrenceInfo.tsx`
2. **Edit** `src/components/calendar/LessonDetailSidePanel.tsx` — swap static label for RecurrenceInfo
3. **Edit** `src/components/calendar/MobileLessonSheet.tsx` — swap static label for RecurrenceInfo
4. **Edit** `src/components/calendar/LessonDetailPanel.tsx` — swap inline recurrence logic for RecurrenceInfo, remove the now-unused `recurrenceRule` query and `recurrenceDescription` memo

