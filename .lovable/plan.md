

## Plan: Re-run All Blocked/Skipped Tests

I'll use the browser automation tools to systematically test each blocked item across Stages 3–8, using the live preview and the test accounts provided. I'll stop after each stage to report results.

### Test Execution Order

**Stage 5 first** (creates test data needed for Stages 3, 4):
1. **5.1** — Navigate to `/calendar`, find a past lesson with students, open detail panel, scroll to LessonNotesForm, fill all fields, save
2. **5.2** — Navigate to Register for that date, verify the note icon appears for the student
3. **5.3** — Navigate to `/notes`, verify the note appears in the explorer
4. **5.4** — Navigate to `/students`, open student detail, check Notes tab
5. **5.5** — Log in as parent (demo-parent), check portal for shared note
6. **5.6** — Verify private notes are NOT visible to parent

**Stage 3:**
- **3.5** — Set viewport to 390px, open Register, tap notes icon, verify bottom sheet (not popover)

**Stage 4:**
- **4.2** — Verify note cards display correctly with real data on `/notes`
- **4.7** — Check stats bar values match the data

**Stage 6:**
- **6.1** — Open Register for a day with open slots, verify they appear
- **6.3** — Select a recurring lesson, bulk edit, verify only that instance changed
- **6.4** — Click 12:00 on day view, verify pre-filled time is 12:00

**Stage 7:**
- **7.5** — Log in as parent, verify redirect to `/portal/home`

**Stage 8** (all at 390px):
- **8.1** — Notes Explorer layout at 390px
- **8.2** — Register notes popover renders as bottom sheet
- **8.3** — Calendar ⚡ dropdown visible and functional
- **8.4** — Slot generator wizard renders correctly
- **8.5** — Bulk select bar positioned above bottom nav

### Accounts
- Staff tests: demo-teacher or e2e-owner credentials
- Parent tests: demo-parent@lessonloop.test / DemoParent2026!

### Deliverable
After each stage: itemised pass/fail table with screenshots and details. No fixes — documentation only.

