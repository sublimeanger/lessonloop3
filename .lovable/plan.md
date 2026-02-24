

# Students Page -- World-Class Mobile and Desktop Polish

## Problem
The Students page mobile cards look cramped and cut off. The instrument badge, email, and other metadata are squeezed into a single horizontal row that overflows on narrow screens. The filter controls also feel oversized on mobile.

## Changes (CSS/layout only -- no functionality changes)

### 1. StudentCard mobile layout overhaul

The metadata row currently crams badge + email + phone + "No guardian" into a single `flex` line. On mobile this truncates or overflows badly.

**Fix:**
- Change the metadata container from a single `flex` row to `flex flex-wrap` so items wrap naturally onto a second line
- Reduce `gap-3` to `gap-1.5` with `gap-y-1` for tighter vertical spacing between wrapped items
- Move the "No guardian" warning to its own line below the metadata row for visual clarity
- Ensure the instrument badge never truncates -- it should display fully and wrap if needed

### 2. Student name + status dot row

Currently the name and status indicator sit on one line with `gap-2`. On narrow screens the name can push the status dot off-screen.

**Fix:**
- Add `min-w-0` to the name span so it truncates properly
- Keep status dot always visible with `shrink-0` (already there, just verify)

### 3. Card padding and spacing

- Reduce card padding from `p-4` to `p-3` on mobile, keeping `p-4` on `sm+` breakpoints (`p-3 sm:p-4`)
- Reduce avatar size from `h-10 w-10` to `h-9 w-9` on mobile for better proportion (`h-9 w-9 sm:h-10 sm:w-10`)
- Reduce gap between avatar and content from `gap-4` to `gap-3`

### 4. Filter controls polish

- Change sort dropdown from `h-11 w-full` to `h-9 w-full` on mobile to match the status pills height -- keeps things compact
- Combine search and sort onto one row on wider mobile screens using a grid layout: `grid grid-cols-[1fr_auto] gap-2` so the sort sits beside search when there's room

### 5. Desktop table polish

- Add `whitespace-nowrap` to table header cells for cleaner alignment
- Ensure table rows have consistent vertical padding

### 6. StatusPills mobile touch targets

- Keep `min-h-11` for proper 44px touch targets but ensure pills flex evenly across the width on mobile: add `flex-1` to each pill button on mobile so they fill the bar evenly rather than bunching to the left

---

## Technical Details

### File: `src/pages/Students.tsx`

**StudentCard component (lines 131-199):**
- Line 143: Change `gap-4` to `gap-3` and `p-4` to `p-3 sm:p-4`
- Line 146: Change avatar from `h-10 w-10` to `h-9 w-9 sm:h-10 sm:w-10`
- Line 170: Change metadata div from `flex items-center gap-3` to `flex flex-wrap items-center gap-x-2 gap-y-1`
- Line 172: Instrument badge -- add `max-w-full` to prevent overflow, keep existing styling

**StatusPills component (lines 51-68):**
- Line 57-58: Add `flex-1 sm:flex-initial` to each pill button so they distribute evenly on mobile

**Filters section (lines 296-329):**
- Lines 316-328: Restructure sort + status pills row. Change `flex flex-col gap-2` to `flex items-center gap-2` and make sort dropdown `w-[140px]` on mobile instead of `w-full`, so sort and pills sit side by side
- Line 318: Change SelectTrigger from `h-11 w-full text-xs sm:h-9 sm:w-[160px]` to `h-9 w-[140px] text-xs sm:w-[160px]`

**Desktop table (lines 345-370):**
- Line 349-355: Add `whitespace-nowrap` to TableHead cells

### No new files, no new dependencies, no functionality changes.
All changes are purely CSS class adjustments within `src/pages/Students.tsx`.
