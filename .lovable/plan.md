

# Dashboard Mobile Polish -- World-Class Upgrade

## Problem
On mobile, the dashboard's bottom sections ("Today's Schedule", "Quick Actions", and "Cancellation Tracking") look cut off and unpolished. Lesson rows truncate metadata awkwardly, and Quick Actions are buried at the bottom where they're least accessible.

## Changes

### 1. Reorder: Quick Actions above Today's Schedule (mobile only)

In all three dashboard variants (`SoloTeacherDashboard`, `AcademyDashboard`, `TeacherDashboard`), the bottom grid currently renders Today's Schedule first and Quick Actions second. On mobile these stack vertically, so Quick Actions end up at the very bottom.

**Fix:** On mobile (stacked), render Quick Actions first using CSS `order` utilities:
- `QuickActionsGrid` gets `order-first lg:order-none` so it appears first on mobile but stays in its natural column position on desktop.
- For `AcademyDashboard`, the Cancellation Tracking card and Quick Actions wrapper div gets the same treatment.

### 2. Polish TodayTimeline lesson rows (`TodayTimeline.tsx`)

The `LessonRow` component currently truncates metadata into a single cramped line. Improvements:
- Wrap the metadata line so on narrow screens it flows onto a second line instead of cutting off (`line-clamp-2` or remove `truncate` and allow wrapping).
- Ensure the student name line doesn't compete with the "NOW" / checkmark badges -- use `min-w-0` and `flex-wrap` so badges don't get pushed off-screen.
- Increase vertical rhythm slightly between rows for better touch separation (py-2.5 baseline).

### 3. Polish QuickActionsGrid (`QuickActionsGrid.tsx`)

- On mobile, use a 2x2 grid (`grid-cols-2`) instead of single-column stacking, giving a more compact and professional appearance.
- Ensure minimum touch target of 48px (`min-h-12`).
- Tighten padding for a cleaner card feel.

### 4. Cancellation Tracking card (Academy dashboard only)

- On mobile, this card should appear alongside Quick Actions (above the timeline). Already handled by the reorder in step 1.

### 5. StatCard grid mobile tweak

- Currently `grid-cols-1` on mobile for Solo/Academy (6 cards stacked). Switch to `grid-cols-2` to match Teacher dashboard and look more polished. Values and titles are already truncated so this is safe.

---

## Technical Details

### Files Modified

**`src/pages/Dashboard.tsx`**
- `SoloTeacherDashboard` (lines 200-208): Add `order` classes to QuickActionsGrid and TodayTimeline within the grid. Change stats grid from `grid-cols-1` to `grid-cols-2`.
- `AcademyDashboard` (lines 300-327): Same reorder pattern for the right-side column (Cancellation + Quick Actions). Change stats grid from `grid-cols-1` to `grid-cols-2`.
- `TeacherDashboard` (lines 431-439): Add order classes (already `grid-cols-2` for stats).

**`src/components/dashboard/TodayTimeline.tsx`**
- `LessonRow`: Remove `truncate` from the metadata `<p>` tag and replace with `line-clamp-2` to allow wrapping on narrow screens. Increase row padding from `py-2` to `py-2.5`.

**`src/components/dashboard/QuickActionsGrid.tsx`**
- Change mobile grid from `grid-cols-1` to `grid-cols-2` for a compact 2x2 layout.
- Increase `min-h` from `min-h-11` to `min-h-12` for better touch targets.

### No functionality changes
All changes are CSS/layout only. No data fetching, routing, or business logic is touched.

