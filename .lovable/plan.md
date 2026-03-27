

# Calendar Deep Audit — Comprehensive Test Plan

## Scope

Full UX and functionality audit of the calendar module across all views, interactions, and roles. This is a browser-based testing sweep at both desktop (1296px) and mobile (390px) viewports, covering every interaction path.

---

## Test Sessions (executed sequentially via browser tools)

### Session 1: Navigation & View Switching (Desktop)

1. Load `/calendar` — verify skeleton appears, then resolves without layout shift
2. Click each view toggle: Day → Stacked → Week → Agenda — confirm each renders correctly
3. Verify Today button navigates to current date
4. Click Prev/Next arrows — confirm date updates in WeekContextStrip and URL params sync (`?date=`, `?view=`)
5. Click a day in the WeekContextStrip — confirm Day view navigates to that date
6. Verify keyboard shortcuts: ← → (navigate), T (today), N (new lesson), S/W/A (views)
7. Verify month label in WeekContextStrip updates correctly when week spans two months
8. Test deep link: load `/calendar?date=2026-04-15&view=agenda` — confirm correct date and view

### Session 2: Day View Interactions (Desktop)

1. Click an empty time slot — verify QuickCreatePopover opens at correct time
2. Drag across time slots to create a range — verify QuickCreatePopover opens with correct start/end times
3. Verify lesson cards show: time, student name, teacher colour bar, status badges (cancelled, completed, open slot)
4. Click a lesson card — verify LessonDetailSidePanel opens (on lg+ screens)
5. Verify side panel shows: time, duration, teacher, location, room, students, attendance buttons, notes, recurrence info
6. Mark attendance from side panel — verify optimistic update and toast
7. Drag a lesson to a new time — verify optimistic move (pulsing animation) and confirm toast
8. Resize a lesson (drag bottom edge) — verify minimum 15min snap and end time updates
9. Verify "now" indicator line appears at correct position on today
10. Verify auto-scroll to current hour on initial load

### Session 3: Week Time Grid View (Desktop)

1. Switch to Week view — verify 7-day columns render with day headers
2. Verify weekend columns show correctly (muted if no lessons)
3. Click a slot — verify QuickCreatePopover at correct day/time
4. Drag a lesson across days — verify it moves to the new day/time
5. Verify overlap layout: 2+ lessons at same time show side-by-side (max 4 columns + overflow pill)
6. Click overflow pill — verify popover shows hidden lessons
7. Verify closure dates display (shaded column or indicator)
8. Verify lesson cards show compact info (truncated names for narrow columns)
9. Drag-resize a lesson vertically — confirm it extends properly
10. Verify hour labels in gutter are correct and aligned

### Session 4: Stacked & Agenda Views (Desktop)

1. Stacked view: verify 7-day columns with stacked card layout
2. Stacked view: verify colour bars per teacher, time labels, student names
3. Stacked view: verify compact toggle reduces card size
4. Stacked view: click a day header — verify slot creation opens
5. Stacked view: verify collapse/expand for days with 6+ lessons
6. Agenda view: verify 14-day forward list grouped by day
7. Agenda view: verify "Group by teacher" toggle groups lessons under teacher headings
8. Agenda view: verify lesson cards show full details (time, student, teacher, location)
9. Agenda view: click a lesson — verify detail panel opens
10. Both views: verify empty days show appropriately (no day header in agenda, empty column in stacked)

### Session 5: Lesson Creation Flow

1. Click "New Lesson" button — verify LessonModal opens (Dialog on desktop, Drawer on mobile)
2. Fill out: teacher, student, date, time, duration — verify all selects work
3. Test student selector: search, multi-select for group lessons, clear
4. Test date picker inside modal — verify calendar popover opens
5. Test time picker — verify 15-minute intervals
6. Test duration picker — verify preset options and custom
7. Test location/room selection — verify rooms filter by selected location
8. Test lesson type switching: individual → group → paired → ensemble
9. Toggle "Recurring" — verify recurrence section appears (day checkboxes, end date)
10. Set recurring on Mon+Wed until end date — verify preview count
11. Create a lesson — verify success toast, calendar refetches, modal closes
12. Edit an existing lesson — verify all fields pre-populated
13. Edit a recurring lesson — verify RecurringActionDialog ("This only" / "This and future")
14. Test conflict detection: create a lesson overlapping an existing one — verify warning/error alerts
15. Test online lesson toggle and Zoom connection integration
16. Test notes (private + shared) and recap URL fields

### Session 6: QuickCreate Popover

1. Click empty slot — verify QuickCreate popover shows start time
2. Verify student combobox search works
3. Verify teacher auto-selects if user is teacher role
4. Verify duration presets (30, 45, 60 min) toggle correctly
5. Click "Full editor" — verify LessonModal opens with time pre-filled
6. Create via QuickCreate — verify success toast, lesson appears on calendar
7. Test conflict detection within QuickCreate

### Session 7: Lesson Detail Panel (Desktop Side Panel)

1. Click lesson — verify side panel slides in from right
2. Verify all metadata: time, duration, teacher, location, room, status badge
3. Verify student list with attendance buttons (Present, Absent, Late, Cancelled)
4. Click attendance — verify optimistic update, button state change
5. Click Edit — verify modal opens with lesson data
6. Verify RecurrenceInfo: series summary, clickable date list
7. Click a recurrence date — verify calendar navigates to that date
8. Verify notes section (private + shared) with inline edit
9. Close panel — verify it slides out smoothly
10. Open different lesson — verify panel content updates

### Session 8: Lesson Detail Panel (Sheet, Tablet/Mobile)

1. Resize viewport to tablet (768px) — click lesson — verify Sheet opens (not side panel)
2. Verify all the same info as desktop side panel
3. Verify attendance marking works
4. Verify edit, delete, cancel actions
5. Verify the delete confirmation AlertDialog
6. Cancel a lesson — verify recurring prompt if applicable
7. Delete a lesson — verify confirmation, toast, calendar refresh

### Session 9: Mobile Layout (390px)

1. Set viewport to 390px — load calendar
2. Verify sticky header: date, Today button, Zap dropdown, prev/next week arrows
3. Verify WeekContextStrip renders 7 days with dots
4. Verify MobileDayView: lesson cards as list with teacher colour bars
5. Tap a lesson — verify MobileLessonSheet (Drawer) opens from bottom
6. Verify sheet shows: time, duration, teacher avatar, students, status, location
7. Tap "Edit" in sheet — verify LessonModal opens as Drawer
8. Tap "View Details" — verify LessonDetailPanel Sheet opens
9. Verify FAB (+) position: not overlapping bottom nav or content
10. Tap FAB — verify LessonModal opens with 9am default time for current date
11. Long-press a lesson card — verify bulk selection mode activates
12. Verify filter bar scrolls horizontally on mobile
13. Verify no horizontal overflow on the page
14. Swipe left/right on WeekContextStrip — verify week navigation

### Session 10: Filters

1. Click teacher filter pill — verify dropdown with teacher names and colour dots
2. Select a teacher — verify lessons filter, URL updates (`?teacher=`)
3. Verify lesson count badges on filter pills
4. Click location filter — verify locations list
5. Select location — verify lessons filter and rooms filter updates accordingly
6. Click room filter — verify only rooms for selected location show
7. Click instrument filter — verify instruments list
8. Toggle "Hide cancelled" — verify cancelled lessons disappear
9. Clear all filters — verify all lessons return
10. Verify filter state persists across view switches (Day → Week → back)
11. Verify filter state persists across date navigation

### Session 11: Bulk Actions

1. Open Zap dropdown → "Select Lessons" — verify bulk selection mode activates
2. Click lessons to select — verify checkboxes/rings appear, count in BulkSelectBar
3. Click "Select All" — verify all visible lessons selected
4. Click "Clear" — verify selections removed
5. Click "Edit Selected" — verify BulkEditDialog opens with teacher/location/room/status/type selects
6. Make a bulk change — verify progress bar, success toast, calendar refresh
7. Click "Cancel Selected" — verify bulk cancel with confirmation
8. Press Escape — verify selection mode exits
9. Change filters while in selection mode — verify selections clear
10. Change date while in selection mode — verify selections clear
11. Verify teachers can only select their own lessons

### Session 12: Slot Generator Wizard

1. Open Zap dropdown → "Generate Open Slots" (admin only)
2. Verify Step 1: date range, time range, duration, break config
3. Verify slot count preview updates as settings change
4. Verify Step 2: teacher selection, location, room
5. Verify Step 3: preview timeline of slots
6. Generate slots — verify success, calendar navigates to first slot date
7. Verify generated slots show with dashed border and "Open" badge
8. Verify slot generator is hidden for non-admin roles

### Session 13: Mark Day Complete

1. Navigate to a past day with scheduled lessons
2. Verify "Mark Day Complete" button appears with count
3. Click — verify AlertDialog shows lesson list
4. Confirm — verify lessons status changes to completed, attendance records created
5. Verify toast with count
6. Navigate to a day with no past scheduled lessons — verify button is hidden

### Session 14: Edge Cases & Error States

1. Empty calendar (no lessons at all) — verify EmptyState with CTA
2. 500+ lessons cap — verify warning Alert and filter suggestion
3. Offline state — verify New Lesson button disabled, drag disabled, toast on interaction attempt
4. Load with invalid date param (`?date=invalid`) — verify graceful fallback to today
5. Very long lesson title — verify truncation in all views
6. Lesson with no teacher — verify "Unassigned" display
7. Lesson with no students — verify title fallback
8. Lesson with many students (10+) — verify "+N" truncation
9. Lesson spanning midnight — verify correct rendering
10. Very short lesson (15min) — verify card is still clickable

### Session 15: Parent Role

1. Switch to parent account — load calendar
2. Verify title shows "Schedule" not "Calendar"
3. Verify no "New Lesson" button, no FAB, no Zap dropdown
4. Verify lesson click opens detail but no edit/delete actions
5. Verify no drag-to-reschedule
6. Verify no bulk selection
7. Verify no slot generator access
8. Verify slot click does nothing

### Session 16: Performance & Polish

1. Rapid date navigation (click Next 10 times quickly) — verify no stale data flash, abort controller cancels previous requests
2. Switch views rapidly — verify no render errors
3. Open/close modals rapidly — verify no stale state
4. Verify teacher colour consistency across all views
5. Verify loading skeleton matches final layout (no CLS)
6. Verify contextual hint appears for first-time users
7. Verify LoopAssist banner shows for unmarked lessons
8. Verify calendar data refetch interval (60s) works
9. Verify compact mode toggle persists across page refreshes (localStorage)

---

## Execution Approach

Each session will be executed one at a time via browser tools. After each session, I will document:
- Bugs found (with severity: critical/major/minor)
- UX issues (with recommendation)
- Code fixes applied

I will fix issues as they are discovered and provide a grouped summary at the end.

---

## Priority Order

Sessions 1-3 first (core navigation + primary views), then Sessions 5-6 (creation flows), then Session 9 (mobile), then remaining sessions. This ensures the highest-traffic paths are audited first.

