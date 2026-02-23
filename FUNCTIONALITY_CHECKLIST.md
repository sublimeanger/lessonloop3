# LessonLoop Functionality Checklist

> Run this checklist against every page. For each item, test manually or verify in code. If it fails, fix it.

## Forms & Input

- [ ] Every form field has visible label text
- [ ] Required fields are marked or validated with clear error messages
- [ ] Validation fires on blur AND on submit
- [ ] Inline errors appear below the specific field, not just as a toast
- [ ] Submit button disables during submission with a Loader2 spinner
- [ ] On error: form stays open, user data preserved, error toast shown
- [ ] On success: toast shown, modal closes or page navigates, queries invalidated
- [ ] Date pickers default to sensible dates (today, start of term, etc.)
- [ ] Select/dropdown fields have a placeholder or default selection
- [ ] No form submits empty/whitespace-only for required fields
- [ ] Text inputs are sanitised via `sanitize.ts` before storage

## API & Data

- [ ] Every Supabase query scopes to `currentOrg.id` — no data leakage between orgs
- [ ] Every `{ data, error }` destructure checks the error case
- [ ] React Query `isLoading` drives skeleton/loading UI
- [ ] React Query `isError` drives error UI (not just silent failure)
- [ ] Mutations invalidate relevant queries on success
- [ ] No stale data visible after a mutation (check the UI updates immediately)
- [ ] Pagination works correctly with large datasets (students, invoices, lessons)
- [ ] Filters and search don't break when combined
- [ ] Sorting works correctly on all sortable columns

## Destructive Actions

- [ ] Every delete uses `DeleteValidationDialog` with dependency checking
- [ ] Blocked deletions show clear explanation of what's preventing deletion
- [ ] Warned deletions show what will be affected before confirming
- [ ] Recurring event edits/deletes ask "This event" vs "All future events"
- [ ] No irreversible action happens without explicit confirmation
- [ ] Cancel/undo is available where feasible
- [ ] Destructive buttons use `variant="destructive"` — visually distinct from safe actions

## Authentication & Permissions

- [ ] Unauthenticated users are redirected to login
- [ ] Parents accessing admin routes are redirected to `/portal/home`
- [ ] Teachers can only see their own assigned students and lessons
- [ ] Finance role can access invoices and reports but not full student management
- [ ] Feature-gated content shows `FeatureGate` / `UpgradeBanner`, not a blank page
- [ ] Usage limits (e.g., max students) show a clear upgrade prompt when hit
- [ ] Session expiry is handled gracefully (redirect to login with friendly message)
- [ ] Password reset flow works end-to-end

## Double-Submit Prevention

- [ ] Buttons disable during async operations
- [ ] Form submissions debounced or guarded against rapid double-clicks
- [ ] Bulk actions (e.g., bulk send invoices) can't be triggered twice
- [ ] Navigation during submission doesn't create duplicate records

## Navigation & Routing

- [ ] Every link/route goes to a real page (no 404s from internal links)
- [ ] Back button behaves sensibly on every page
- [ ] Breadcrumbs (where present) are accurate and clickable
- [ ] Page title updates via `usePageMeta` on every page
- [ ] Deep links work (e.g., `/students/[id]` loads correctly on direct visit)
- [ ] Scroll position resets on page navigation via `ScrollToTop`
- [ ] No redirect loops (especially around auth/onboarding)

## Calendar-Specific

- [ ] Lessons display correctly in Day, Week, Stacked, and Agenda views
- [ ] Creating a lesson via modal saves correctly and appears on calendar
- [ ] Editing a lesson (single or recurring) updates correctly
- [ ] Deleting a lesson (single or series) removes it cleanly
- [ ] Drag to reschedule works on desktop (`useDragLesson`)
- [ ] Resize to change duration works on desktop (`useResizeLesson`)
- [ ] Conflict detection warns before double-booking (`useConflictDetection`)
- [ ] Filters (teacher, location, room, instrument) all work
- [ ] Calendar navigation (prev/next week/day) works correctly
- [ ] Quick create popover works from time grid click
- [ ] Lesson detail side panel opens with full info
- [ ] Teacher colour coding is consistent via `teacherColours.ts`
- [ ] Calendar sync (Google) creates/updates/deletes external events

## Students-Specific

- [ ] Student creation wizard completes all steps (info → guardian → teaching defaults)
- [ ] Student import (CSV) handles mapping, preview, and execution
- [ ] Student detail page loads all tabs without errors
- [ ] Guardian management (add, edit, remove) works correctly
- [ ] Instrument/grade assignment works with the grade frameworks
- [ ] Status toggle (active/inactive) works with proper confirmation
- [ ] Search filters correctly across name, instrument, status
- [ ] Make-up credit balance displays and updates correctly

## Invoices & Billing

- [ ] Invoice creation modal calculates amounts correctly (minor units / pence)
- [ ] Billing run wizard generates invoices for the correct students/period
- [ ] Invoice status transitions: draft → sent → paid / overdue
- [ ] Recording payment updates status and amount correctly
- [ ] Sending invoice triggers email and updates status
- [ ] Payment plans (`PaymentPlanSetup`, `InstallmentTimeline`) calculate correctly
- [ ] Stripe Connect integration works for online payments
- [ ] Bulk actions (select multiple → send/mark paid) work correctly
- [ ] Invoice PDF generation via `useInvoicePdf` produces correct output
- [ ] Currency always displayed via `formatCurrencyMinor()` — never raw numbers

## Portal (Parent Experience)

- [ ] Parent sees only their own children's data
- [ ] Child switcher works when parent has multiple children
- [ ] Upcoming lessons display correctly with reschedule/cancel options
- [ ] Invoice list shows correct balances with online payment option
- [ ] Practice timer and history work correctly
- [ ] Resources shared by teachers are accessible and downloadable
- [ ] Messages/requests create properly and reach the admin
- [ ] Portal feature toggles respect org settings (`usePortalFeatures`)
- [ ] Disabled features show `PortalFeatureDisabled` component, not empty pages

## Messages & Communication

- [ ] Compose modal sends to correct recipients
- [ ] Bulk compose works for multiple recipients
- [ ] Internal messages (staff-to-staff) work separately from parent messages
- [ ] Message threads display in correct order
- [ ] Unread count badge updates correctly on read
- [ ] Message requests from parents appear in admin view
- [ ] Reply functionality works within threads
- [ ] Notification bell shows unread count

## Reports

- [ ] All report pages load data correctly
- [ ] Date range filters work and update results
- [ ] Sorting works on all table columns
- [ ] Pagination works for large result sets
- [ ] Numbers/currency formatted correctly throughout
- [ ] Reports respect the user's role (finance vs owner)

## Settings

- [ ] Organisation settings save correctly
- [ ] Profile settings save correctly
- [ ] Calendar integrations (Google) connect and sync
- [ ] Invoice settings (default terms, payment details) persist
- [ ] Rate cards create, edit, and apply correctly
- [ ] Term management (create, edit terms) works
- [ ] Member invitations send and accept correctly
- [ ] Notification preferences save per-user
- [ ] Branding settings (if present) apply across the app
- [ ] LoopAssist preferences save correctly

## Offline & Edge Cases

- [ ] `OfflineBanner` appears when connection is lost
- [ ] Actions attempted offline show appropriate error
- [ ] Reconnection refreshes stale data automatically
- [ ] Very long names/text truncate gracefully (don't break layouts)
- [ ] Empty org (brand new signup) shows onboarding flow, not errors
- [ ] Timezone differences handled correctly (org timezone, not browser)
