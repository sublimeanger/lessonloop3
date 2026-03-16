This plan is correct. Now implement all of it. 

Create the EntityLink component and apply it across all 10 files listed. 

Don't skip any. Show me the completed changes, not another plan.

One addition: for teacher names, instead of just linking to /teachers page 

(which isn't very useful), open TeacherQuickView directly on click. You 

already have TeacherQuickView in the codebase — trigger it with the 

teacher's ID. Same pattern EntityChip already uses in LoopAssist. 

For location names, same idea — open a lightweight popover/sheet showing 

location name, address, rooms, rather than navigating away from the 

current view.

The goal is: clicking an entity gives you useful context WITHOUT losing 

your place. Navigating away from the calendar to /teachers is disruptive. 

A quick-view sheet or popover is much better UX for inline context.

Only navigate away (full page navigation) for students and invoices, 

which have dedicated detail pages worth visiting.  
  
Contextual Navigation / Entity Cross-Linking — Implementation Plan

## Scope Assessment

After auditing the codebase, here is the current state:

**Already working:**

- Student names on Students list → `/students/{id}` ✓
- Invoice numbers on Invoice list → `/invoices/{id}` ✓  
- Dashboard StatCards → have `href` props with deep links ✓
- EntityChip component (used in LoopAssist/messaging) → students, invoices, lessons ✓
- TeacherQuickView → student names link to `/students/{id}` ✓

**Not linked (plain text):**

- **Calendar LessonDetailPanel** (mobile sheet, 986 lines): teacher name, location, student names — all plain text
- **Calendar LessonDetailSidePanel** (desktop, 290 lines): teacher name, location, student names — all plain text
- **Calendar MobileLessonSheet**: teacher name, location, student names — plain text
- **Calendar MobileDayView**: teacher name — plain text
- **Calendar AgendaView**: teacher group names — plain text
- **Invoice Detail**: payer name, line item lesson dates — plain text
- **Payroll report**: teacher names, lesson entries — plain text
- **Register**: student names — plain text
- **Continuation**: student names, guardian names — plain text

**Key constraint:** There is NO `/teachers/:id` route. Teachers are managed on `/teachers` via a `TeacherQuickView` sheet. So teacher links must open TeacherQuickView or navigate to `/teachers` with a highlight param.

## Implementation Plan

### 1. Create a shared `EntityLink` component

A reusable inline link component for all entity types. Subtle styling: `text-primary hover:underline cursor-pointer` with keyboard support and 44px mobile touch targets.

```
src/components/shared/EntityLink.tsx
```

Props: `type` (student | teacher | location | invoice | lesson), `id`, `label`, `className`, optional `onClick` override (for teacher quick-view). Renders a `<Link>` for routable entities, or a `<button>` for quick-view entities. Style: inherits current font size, adds `text-primary/80 hover:text-primary hover:underline` with `focus-visible:ring-2`.

### 2. Calendar Lesson Detail Panel (desktop sheet — `LessonDetailPanel.tsx`)

- **Student names** (line ~675-676): Wrap each `{p.student.first_name} {p.student.last_name}` in `<EntityLink type="student" id={p.student.id}>`. Same for attendance section (line ~716).
- **Teacher name** (line ~612-613): Wrap in clickable element → navigate to `/teachers` (no individual teacher page exists).
- **Location name** (line ~621): Wrap in clickable element → navigate to `/locations`.
- **Recurrence description** (line ~663-667): Already shows "Weekly on Mon · Until date · X remaining" — this is good. Add: make it a button that filters calendar to show all lessons with this `recurrence_id`.

### 3. Calendar LessonDetailSidePanel (desktop sidebar — `LessonDetailSidePanel.tsx`)

- **Student names** (line ~230-231): Wrap in EntityLink → `/students/{id}`
- **Teacher name** (line ~159): Wrap in clickable → `/teachers`
- **Location name** (line ~166-168): Wrap in clickable → `/locations`

### 4. Calendar MobileLessonSheet (`MobileLessonSheet.tsx`)

- **Teacher name** (line ~96): Wrap in clickable → `/teachers`
- **Location name** (around line 100+): Wrap in clickable → `/locations`
- **Student names** (around line 110+): Wrap in EntityLink → `/students/{id}`

### 5. Calendar MobileDayView (`MobileDayView.tsx`)

- **Teacher name** (line ~169): Wrap in clickable → `/teachers` (e.stopPropagation needed to prevent card click)

### 6. Invoice Detail (`InvoiceDetail.tsx`)

- **Payer name** (line ~295): Wrap `payerName` — if payer is a guardian with a linked student, link to student detail; otherwise just display
- **Line item lesson dates** (line ~324-326): Wrap the date/time text — link to `/calendar?date={lessonDate}`

### 7. Payroll Report (`Payroll.tsx`)

- **Teacher names** (line ~254): Wrap teacher name in clickable → `/teachers`
- **Lesson entries in expanded table** (line ~301-303): Wrap lesson title/date as link → `/calendar?date={lessonDate}`

### 8. Attendance Register (`RegisterRow.tsx`)

- **Student names** (line ~231): Wrap `participant.student_name` in EntityLink → `/students/{student_id}`

### 9. Continuation components

- **ContinuationResponseDetail.tsx** (line ~80): Student name → `/students/{id}`
- **ContinuationRunWizard.tsx** (line ~389): Student names → EntityLink

### 10. Recurrence display enhancement (LessonDetailPanel)

The recurrence info at line ~663-667 already displays "Weekly on Mon · Until date · X remaining" which is good. Enhancement:

- Make the recurrence line clickable
- On click: close the detail panel and filter calendar to show the series (could navigate to `/calendar?recurrence={recurrence_id}` or show a popover listing all instances)
- Since adding a recurrence filter param to the calendar is complex, a simpler approach: add a "View all X lessons" link that navigates to `/calendar?view=agenda` scoped to the term dates

## Files to create/edit:

1. **Create** `src/components/shared/EntityLink.tsx` — shared clickable entity component
2. **Edit** `src/components/calendar/LessonDetailPanel.tsx` — student, teacher, location links
3. **Edit** `src/components/calendar/LessonDetailSidePanel.tsx` — student, teacher, location links
4. **Edit** `src/components/calendar/MobileLessonSheet.tsx` — student, teacher, location links
5. **Edit** `src/components/calendar/MobileDayView.tsx` — teacher name link (with stopPropagation)
6. **Edit** `src/pages/InvoiceDetail.tsx` — payer name, lesson date links
7. **Edit** `src/pages/reports/Payroll.tsx` — teacher name, lesson entry links
8. **Edit** `src/components/register/RegisterRow.tsx` — student name links
9. **Edit** `src/components/continuation/ContinuationResponseDetail.tsx` — student name link
10. **Edit** `src/components/continuation/ContinuationRunWizard.tsx` — student name links

## Not in scope (no route exists):

- **Teacher detail page** (`/teachers/:id`): Does not exist. Teacher names will link to `/teachers` page. A future enhancement could open TeacherQuickView directly.
- **Location detail page** (`/locations/:id`): No individual location route exists. Links go to `/locations`.
- **Room, Term, Billing Run, Make-Up Credit detail pages**: No dedicated routes. These won't get links in this pass.
- **Instrument filtering**: Not a navigable entity.

## Styling approach:

All entity links use the same subtle pattern: inherit font-size, `text-primary/80 hover:text-primary hover:underline decoration-primary/30 cursor-pointer transition-colors`. Keyboard accessible with `focus-visible:ring-2`. On mobile, ensure the touch target is at least 44px by using `min-h-[44px] inline-flex items-center` when the link is the primary tap target.