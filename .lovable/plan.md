

# Calendar Enhancements — Implementation Plan

This plan covers 8 improvements from the third-party review (excluding heatmap overlay and smart scheduling suggestions).

---

## 1. 500-Lesson Cap Warning + Server-Side Filtering

**Problem:** `useCalendarData` silently caps at 500 lessons with no user feedback. Large academies could lose data.

**Changes:**
- `src/hooks/useCalendarData.ts` — After fetching, check if `lessonsData.length === LESSONS_PAGE_SIZE`. If so, surface a flag `isCapReached: true` from the hook.
- When teacher/location/room filters are active, apply them in the query (already done) so the cap is less likely to be hit.
- `src/pages/CalendarPage.tsx` — When `isCapReached` is true, render an amber alert banner: *"Showing first 500 lessons. Apply filters (teacher, location) to narrow results."*

---

## 2. Recurring Lesson "Edited" Badge

**Problem:** No visual indicator when a single instance of a recurring series has been individually modified (e.g., different time or date from the pattern).

**Changes:**
- `src/hooks/useCalendarData.ts` — In the enrichment step, for lessons with a `recurrence_id`, fetch the recurrence pattern or compare siblings to detect anomalies. A simpler approach: add an `is_exception` or check if the lesson's `updated_at` differs meaningfully from `created_at` (indicating manual edit). The most reliable approach is to add a boolean `is_series_exception` column to the `lessons` table via migration, defaulted to `false`, and set to `true` whenever a "this only" edit is made.
- `src/pages/CalendarPage.tsx` — When saving a "this_only" edit on a recurring lesson, set `is_series_exception = true`.
- `src/components/calendar/LessonCard.tsx` — When `lesson.recurrence_id` exists AND `lesson.is_series_exception` is true, render a small "Edited" badge (amber, next to the recurring icon).

**Database migration:**
```sql
ALTER TABLE public.lessons 
  ADD COLUMN is_series_exception boolean NOT NULL DEFAULT false;
```

---

## 3. Batch Attendance Mode

**Problem:** Taking attendance for 8+ lessons requires opening each lesson individually.

**Changes:**
- Create `src/pages/BatchAttendance.tsx` — A dedicated end-of-day view that:
  - Lists all today's completed/scheduled lessons in chronological order
  - Each lesson row shows student names with Present/Absent/Late toggle buttons inline
  - Has a "Mark All Present" button at the top that defaults every student to present
  - Saves attendance in batch via a single "Save All" action
- `src/App.tsx` — Add route `/batch-attendance`
- `src/components/layout/AppSidebar.tsx` — Add nav link under Calendar section
- `src/components/calendar/LessonDetailPanel.tsx` — No changes needed (existing per-lesson attendance stays)

---

## 4. Mobile Drag-to-Reschedule

**Problem:** The `MobileWeekView` has no drag interaction for rescheduling lessons.

**Changes:**
- `src/components/calendar/MobileWeekView.tsx` — Add long-press (300ms) detection on lesson cards using touch events. On activation:
  - Haptic feedback (`navigator.vibrate(50)`)
  - Visual lift effect (scale + shadow on the card)
  - Track touch position and highlight the destination day column
  - On drop (touchend), calculate the target day and show a confirmation dialog with the proposed new date/time
  - Call existing `onLessonDrop` callback from parent
- Update props to accept `onLessonDrop` (same signature as desktop)
- `src/components/calendar/WeekTimeGrid.tsx` — Pass `onLessonDrop` and `onLessonResize` through to `MobileWeekView`
- `src/pages/CalendarPage.tsx` — No changes needed (already passes handlers)

**UX flow:** Long-press card (300ms) -> card lifts with haptic -> drag horizontally across day columns -> release -> confirmation toast with "Moved to [Day] at [Time]" or conflict error.

---

## 5. Mobile Stacked View — 3-Day Rolling Default

**Problem:** 7 columns at 33.33vw each means each column is ~130px on a 390px screen. A 3-day centred view would be more scannable.

**Changes:**
- `src/components/calendar/MobileWeekView.tsx` — Change `min-w-[33.33vw]` to `min-w-[80vw]` so each day card takes most of the screen width, making it a true swipeable day-by-day view rather than a cramped multi-column layout. The snap behaviour already works (`snap-x snap-mandatory`). This gives each day ~312px of width on a 390px screen.
- Auto-scroll to today remains unchanged.
- Dot indicators remain for all 7 days.

---

## 6. Parent Portal — Add to Calendar Export

**Problem:** Parents frequently ask "what time is the lesson?" — exporting to their phone calendar solves this.

**Changes:**
- Create `src/lib/calendarExport.ts` — Utility functions:
  - `generateICSEvent(lesson)` — Returns an .ics file string for a single lesson
  - `generateGoogleCalendarUrl(lesson)` — Returns a Google Calendar "add event" URL
- `src/pages/portal/PortalSchedule.tsx` — Add "Add to Calendar" dropdown button on each upcoming lesson card with options:
  - "Google Calendar" — Opens link in new tab
  - "Apple / Outlook (.ics)" — Downloads .ics file

---

## 7. Offline Resilience — Service Worker Caching

**Problem:** Teachers in studios with patchy signal see blank screens.

**Changes:**
- Install `vite-plugin-pwa` dependency
- `vite.config.ts` — Add PWA plugin with workbox config:
  - Cache app shell (HTML, JS, CSS) with StaleWhileRevalidate
  - Cache API responses for `/rest/v1/lessons` with NetworkFirst strategy (30-second timeout, fallback to cache)
  - `navigateFallbackDenylist: [/^\/~oauth/]` to protect auth flow
- `index.html` — Add PWA meta tags and manifest link
- Create `public/manifest.json` with LessonLoop branding
- The calendar will render from cache when offline, with a subtle "Offline — showing cached data" banner when `navigator.onLine` is false
- `src/components/shared/OfflineBanner.tsx` — Small amber banner component that listens to online/offline events

---

## 8. Lesson Page Size — Server-Side Filter Optimisation

**Problem:** Filters are applied in the query but could be more aggressive to stay under the 500 cap.

**Changes:**
- `src/hooks/useCalendarData.ts` — When filters are active, also filter the related data fetches (participants, attendance) to only the filtered lesson IDs, reducing payload size. Add `teacher_user_id` filter directly in the lessons query (already done for `teacher_id` but needs alignment with the actual column name used in the DB).
- Return `totalCount` alongside `lessons` by adding a separate `.count()` query (or checking if `lessonsData.length === LESSONS_PAGE_SIZE`) so the UI knows when data is truncated.

---

## Technical Summary

| Item | Files Modified | New Files | DB Migration |
|------|---------------|-----------|-------------|
| 500-lesson cap warning | useCalendarData.ts, CalendarPage.tsx | -- | -- |
| Edited badge | LessonCard.tsx, useCalendarData.ts, CalendarPage.tsx | -- | Add `is_series_exception` column |
| Batch attendance | App.tsx, AppSidebar.tsx | BatchAttendance.tsx | -- |
| Mobile drag | MobileWeekView.tsx, WeekTimeGrid.tsx | -- | -- |
| 3-day mobile | MobileWeekView.tsx | -- | -- |
| Calendar export | PortalSchedule.tsx | calendarExport.ts | -- |
| Offline/PWA | vite.config.ts, index.html | manifest.json, OfflineBanner.tsx | -- |
| Filter optimisation | useCalendarData.ts | -- | -- |

**Estimated scope:** ~8 files modified, ~4 new files, 1 database migration.

