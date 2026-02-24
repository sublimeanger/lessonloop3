# LessonLoop Functionality Checklist — World-Class Standard

> Test EVERY item on EVERY page at BOTH 375px mobile AND 1280px desktop. Test with real interactions — click, type, submit, delete, navigate. Not just visual inspection.

---

## Forms & Input (test at BOTH viewports)

### Validation
- [ ] Every required field shows error if empty on submit
- [ ] Validation fires on blur AND on submit
- [ ] Inline errors appear below the specific field in `text-sm text-destructive`
- [ ] Email fields reject invalid formats
- [ ] Name fields reject whitespace-only
- [ ] Date pickers prevent impossible selections (end before start)
- [ ] Currency inputs prevent negative values
- [ ] File uploads enforce size and type limits via `resource-validation.ts`
- [ ] Text inputs sanitised via `sanitize.ts`

### Submission
- [ ] Submit button disables during async with `Loader2` spinner
- [ ] On success: toast shown, modal closes, queries invalidated, UI updates immediately
- [ ] On error: toast with `variant: 'destructive'`, form stays open, user data preserved
- [ ] No double-submit possible — rapid clicking doesn't create duplicates
- [ ] Form doesn't lose data on network error

### Mobile-Specific Form Checks
- [ ] Text inputs don't trigger iOS zoom (must be `text-base` / 16px minimum)
- [ ] Keyboard doesn't obscure submit button (can scroll to it)
- [ ] Date pickers work with native mobile input or custom picker
- [ ] Select dropdowns are usable on touch (large enough targets)
- [ ] Modal forms scroll properly when content exceeds screen height

---

## API & Data Integrity (test at BOTH viewports)

### Scoping
- [ ] EVERY Supabase query includes `org_id` filter — verify in code, not just visually
- [ ] Parent users can ONLY see their own children's data
- [ ] Teachers can ONLY see their assigned students and lessons
- [ ] No data leaks across organisations

### Query Handling
- [ ] Every `{ data, error }` destructure checks the error case
- [ ] `isLoading` → correct skeleton UI
- [ ] `isError` → error UI, not blank screen
- [ ] Mutations invalidate relevant queries on success
- [ ] No stale data visible after create/update/delete
- [ ] Pagination works with 1 item, 10 items, 100+ items
- [ ] Filters + search + sort work in all combinations without breaking
- [ ] Empty result set shows EmptyState, not broken UI

---

## Destructive Actions (test at BOTH viewports)

- [ ] Every delete → `DeleteValidationDialog` with dependency check
- [ ] Blocked deletions: clear explanation of blocking dependencies
- [ ] Warned deletions: shows what will be affected, requires explicit confirm
- [ ] Recurring event edit/delete → "This event" vs "All future events" dialog
- [ ] No irreversible action without confirmation
- [ ] Destructive buttons use `variant="destructive"` — visually distinct
- [ ] Cancel/undo available where feasible
- [ ] Bulk delete (if applicable) confirms with count of affected items

### Mobile-Specific
- [ ] Confirmation dialogs are full-screen or large bottom-sheet
- [ ] Confirm/Cancel buttons are large enough to tap accurately
- [ ] No accidental delete possible from small tap targets

---

## Authentication & Permissions (test at BOTH viewports)

### Access Control
- [ ] Unauthenticated → redirect to `/login`
- [ ] Parent accessing admin route → redirect to `/portal/home`
- [ ] Teacher accessing owner-only features → clear "no permission" message
- [ ] Finance role: can access invoices/reports, blocked from full student management
- [ ] Feature-gated content → `FeatureGate` / `UpgradeBanner`, never blank page
- [ ] Usage limit hit → clear upgrade prompt with current count

### Auth Flows
- [ ] Login: email + password works, error messages are helpful
- [ ] Signup: creates account, redirects to onboarding
- [ ] Forgot password: sends email, reset flow works end-to-end
- [ ] Session expiry: redirect to login with friendly message, no crash
- [ ] Accept invite: creates account or links existing, joins org
- [ ] Social login (Google/Apple): works on both viewports

### Mobile-Specific
- [ ] Login form: fields full-width, keyboard doesn't obscure
- [ ] Social login buttons: full-width, large tap targets
- [ ] Password field: show/hide toggle accessible

---

## Navigation & Routing (test at BOTH viewports)

- [ ] Every internal link goes to a real page (no 404s)
- [ ] Browser back button works sensibly on every page
- [ ] Deep links work: `/students/[id]`, `/invoices/[id]` load on direct visit
- [ ] Page title updates via `usePageMeta` on every page
- [ ] Scroll resets on navigation via `ScrollToTop`
- [ ] No redirect loops (especially auth/onboarding edge cases)
- [ ] Breadcrumbs (where present) are accurate and clickable

### Mobile Navigation
- [ ] Portal: `PortalBottomNav` highlights correct item on every page
- [ ] Admin: sidebar collapses, hamburger/mobile nav accessible
- [ ] Back gesture (iOS swipe) doesn't break anything
- [ ] Tab switching is instant (no loading delay for cached pages)

---

## Calendar (test at BOTH viewports)

### Desktop (1280px+)
- [ ] Day, Week, Stacked, Agenda views all render correctly
- [ ] Lesson creation modal saves and appears on calendar
- [ ] Edit single lesson: updates correctly
- [ ] Edit recurring: "This event" vs "All future events" works
- [ ] Delete single and series: removes cleanly
- [ ] Drag to reschedule: `useDragLesson` works, snaps to grid
- [ ] Resize to change duration: `useResizeLesson` works
- [ ] Conflict detection: `useConflictDetection` warns before double-booking
- [ ] Filters (teacher, location, room, instrument) all work independently and combined
- [ ] Calendar nav (prev/next week/day) works with keyboard arrows
- [ ] Quick create popover from time grid click
- [ ] Lesson detail side panel opens with complete info
- [ ] Teacher colour coding consistent across all views

### Mobile (375px)
- [ ] `CalendarMobileLayout` renders with `MobileWeekView` / `MobileDayView`
- [ ] Lesson cards are readable and tappable
- [ ] `MobileLessonSheet` opens with full detail
- [ ] Filter bar doesn't overflow — collapses or scrolls
- [ ] Date navigation is touch-friendly (swipe or large arrows)
- [ ] Quick create works on mobile (tap on time slot)
- [ ] No horizontal overflow on any view

---

## Students (test at BOTH viewports)

### Desktop
- [ ] Search + StatusPills filter work together
- [ ] Student rows show: avatar, name, instrument, status, actions
- [ ] StudentWizard: all steps complete (info → guardian → teaching defaults → success)
- [ ] Import flow: upload → mapping → preview → importing → complete
- [ ] Student detail: all tabs load without errors
- [ ] Guardian CRUD works (add, edit, remove)
- [ ] Instrument/grade assignment works
- [ ] Active/inactive toggle with confirmation

### Mobile
- [ ] Students display as cards, not cramped table
- [ ] Search is prominent and easy to access
- [ ] StudentWizard is full-screen with clear step progress
- [ ] Student detail: tabs work via swipe or scroll
- [ ] Cards are tappable with clear touch targets

---

## Invoices & Billing (test at BOTH viewports)

### Desktop
- [ ] Invoice creation: amounts calculated correctly in minor units
- [ ] Billing run wizard: generates correct invoices for correct period
- [ ] Status transitions: draft → sent → paid / overdue
- [ ] Record payment: updates status and amount correctly
- [ ] Send invoice: triggers email, updates status to "sent"
- [ ] Payment plans: `PaymentPlanSetup` calculates instalments correctly
- [ ] Stripe Connect: online payment works end-to-end
- [ ] Bulk actions: select multiple → send/mark paid works
- [ ] Invoice PDF: `useInvoicePdf` generates correct output
- [ ] All currency via `formatCurrencyMinor()` — never raw numbers

### Mobile
- [ ] Invoice list as scannable cards with amount and status prominent
- [ ] Filters collapse or are accessible via dropdown
- [ ] Create/send modals are full-screen
- [ ] Payment button is primary CTA, large and prominent
- [ ] Currency is large and readable

---

## Portal — Parent Experience (MOBILE-FIRST — test 375px before anything)

### Portal Home
- [ ] Shows only this parent's children's data
- [ ] `ChildSwitcher` works with 1 child and multiple children
- [ ] Next lesson card: prominent, shows date/time/teacher/location
- [ ] Quick action links to Schedule, Invoices, Practice
- [ ] `PortalWelcomeDialog` shows for first-time users

### Portal Schedule
- [ ] Upcoming lessons: clear cards with reschedule/cancel options
- [ ] Request modal: works on mobile keyboard
- [ ] Reschedule slot picker: large tappable time slots
- [ ] Past lessons visible with history view
- [ ] Calendar feed export (ICS/Google) works

### Portal Invoices
- [ ] Invoice cards show amount, status, due date clearly
- [ ] Pay button: primary CTA, full-width on mobile, large and obvious
- [ ] Payment plans show instalment timeline
- [ ] Stripe payment flow works on mobile browser

### Portal Practice
- [ ] Timer: large start/stop button, works with screen lock
- [ ] Practice history scrolls cleanly
- [ ] Streak badges are motivating and visible
- [ ] Weekly progress card is scannable
- [ ] Assignments from teacher are clear

### Portal Resources
- [ ] Resources stack single-column on mobile
- [ ] Download/preview works on mobile
- [ ] Audio player is touch-friendly
- [ ] File type clearly indicated

### Portal Messages
- [ ] Message list is full-width and scannable
- [ ] Compose is full-screen on mobile
- [ ] Send button reachable above keyboard
- [ ] Thread navigation clear

### Portal Profile
- [ ] Form is single-column on mobile
- [ ] Save button reachable
- [ ] Notification toggles are large enough to tap

### Portal Universal
- [ ] Feature-disabled pages → `PortalFeatureDisabled` not blank
- [ ] Error states → `PortalErrorState` not generic error
- [ ] `usePortalFeatures` correctly reflects org settings

---

## Messages & Communication (test at BOTH viewports)

- [ ] Compose sends to correct recipients
- [ ] Bulk compose works
- [ ] Internal (staff-to-staff) messages work separately
- [ ] Threads display in correct chronological order
- [ ] Unread count badge updates on read
- [ ] Parent message requests appear in admin view
- [ ] Reply works within threads
- [ ] Notification bell shows correct unread count
- [ ] Mobile: messages full-width, compose full-screen

---

## Reports (test at BOTH viewports)

- [ ] All 6 report pages load data correctly
- [ ] Date range filters work and update results
- [ ] Sorting works on all columns via `SortableTableHead`
- [ ] Pagination via `ReportPagination` works
- [ ] Numbers/currency formatted correctly
- [ ] Reports respect user role (finance vs owner)
- [ ] Mobile: tables scroll horizontally or convert to cards

---

## Settings (test at BOTH viewports)

- [ ] Every tab saves correctly and shows success toast
- [ ] Organisation settings persist across sessions
- [ ] Profile settings save correctly
- [ ] Calendar integrations connect and sync
- [ ] Invoice settings (terms, payment details) persist
- [ ] Rate cards CRUD works
- [ ] Term management works
- [ ] Member invitations send and accept
- [ ] Notification preferences save per-user
- [ ] LoopAssist preferences save
- [ ] Mobile: tabs scroll horizontally, forms single-column

---

## Edge Cases (test at BOTH viewports)

- [ ] `OfflineBanner` appears when connection lost
- [ ] Reconnection refreshes stale data
- [ ] Very long names (50+ chars) truncate, don't break layout
- [ ] Empty org (new signup) → onboarding flow, not errors
- [ ] Timezone differences handled correctly (org timezone, not browser)
- [ ] Multiple browser tabs: data stays in sync
- [ ] Session timeout: graceful redirect to login
- [ ] Rapid navigation: no race conditions or flash of wrong content
