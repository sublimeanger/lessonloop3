

# Mobile Calendar: Swipeable Week View

## Problem
On mobile (390px viewport), the week view tries to fit 5 day-columns into a container with `min-w-[500px]`, but the Radix ScrollArea isn't providing proper horizontal touch scrolling. This clips the 5th day and prevents swiping.

## Solution: Responsive Dual Layout

Use two different rendering strategies based on viewport:

- **Desktop (768px+)**: Keep the current clean 5/7-day grid exactly as-is -- it works well.
- **Mobile (<768px)**: Switch to a native horizontally-swipeable layout using CSS `scroll-snap`, showing ~3 days at a time with smooth finger-swiping to reveal the rest. Auto-scrolls to today on load.

This mirrors how Google Calendar and Apple Calendar handle mobile week views -- showing a few days at a time with intuitive swipe navigation.

## What You'll See

- On mobile, the calendar shows roughly 3 day columns at a time
- Each column is wide enough to display lesson cards legibly (no squishing)
- Swiping left/right smoothly reveals the remaining days with snap-to-day behavior
- The view automatically scrolls to today's column on load
- Small dot indicators below the grid show which section of the week is currently visible
- Tapping a day header scrolls that day to the start of the view

---

## Technical Details

### File: `src/components/calendar/StackedWeekView.tsx`

**Changes:**
1. Import `useIsMobile` hook and `useRef`/`useCallback` from React
2. Add a ref to the scroll container for programmatic scroll-to-today
3. Split the render into two branches:

**Mobile branch (isMobile = true):**
- Replace `ScrollArea` + grid with a `div` using:
  - `overflow-x: auto` with `-webkit-overflow-scrolling: touch` for native momentum scrolling
  - `scroll-snap-type: x mandatory` for day-boundary snapping
  - Each day column: `scroll-snap-align: start`, `min-w-[calc(33.33vw)]` so ~3 days are visible
- Sticky day headers that scroll horizontally with content
- `useEffect` on mount to scroll the container so today's column is visible
- Small dot indicators (5 or 7 dots) below the scroll area, highlighting which days are currently in view using an `IntersectionObserver` or scroll position calculation
- Hide the vertical `ScrollArea` wrapper (not needed when scrolling horizontally)

**Desktop branch (isMobile = false):**
- Keep the existing grid layout completely unchanged
- Wrapped in vertical `ScrollArea` as before

4. Add a `useEffect` that runs on mount/date change to auto-scroll to today's column position

### File: `src/pages/CalendarPage.tsx`
- No changes needed -- the `StackedWeekView` component handles its own responsive behavior internally

### No new dependencies required
- Uses native CSS scroll-snap (supported in all modern browsers)
- Uses the existing `useIsMobile` hook

