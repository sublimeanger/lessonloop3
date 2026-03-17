

# Mobile Polish Part 2 — Every Page at 390px

## Root Cause: AppLayout Missing overflow-x-hidden

The `AppLayout` outer div and `<main>` lack `overflow-x-hidden`, which is the single biggest source of horizontal scroll on ALL staff pages. The `PortalLayout` already has it — AppLayout needs parity.

## Changes

### 1. AppLayout.tsx — Add overflow-x-hidden (fixes ALL staff pages at once)
- Outer div: add `overflow-x-hidden` to `flex min-h-screen w-full flex-col`
- Main element: add `overflow-x-hidden` alongside existing `overflow-auto`
- This immediately fixes Dashboard, Calendar, Students, Teachers, Locations, Invoices, Reports, Payroll, Continuation, Settings, Messages, Notes Explorer

### 2. InvoiceDetail.tsx — Line items table → mobile card layout
- The line items table (`min-w-[520px]`) squishes on mobile
- Add `hidden sm:block` to the table wrapper, and a mobile card layout `sm:hidden` showing description, qty, rate, amount stacked
- Same pattern Students page already uses (table on desktop, cards on mobile)

### 3. Report tables — Ensure horizontal scroll is contained
Tables in Payroll, Outstanding, Revenue, LessonsDelivered, Cancellations, TeacherPerformance, Utilisation all use `overflow-x-auto` + `min-w-[600px]` — this is fine because AppLayout fix will contain the scroll. No changes needed for these since they already have scroll containers.

### 4. Continuation.tsx — Response table mobile improvement
- Currently hides Guardian/Fee/Responded/Reminders columns on mobile — good
- But the remaining Student + Response columns still use `<table>` which is fine at 390px
- No changes needed — already responsive with `hidden sm:table-cell` etc.

### 5. Messages.tsx — TabsList overflow on mobile
- Check if TabsList (sent/requests/internal) overflows at 390px
- Add `overflow-x-auto` to TabsList wrapper if needed

### 6. Settings tabs on mobile
- Already has mobile nav → content pattern with back button — correct
- No changes needed

### 7. Login/Signup pages
- Card-based centered layout — works at 390px
- No changes needed

### 8. PortalHome.tsx — Children cards horizontal scroll
- Already uses `snap-start` + `min-w-[220px]` — works on mobile
- No changes needed

### 9. Portal pages (Schedule, Invoices, Practice, Resources, Messages, Profile)
- All wrapped in `PortalLayout` which has `overflow-x-hidden` — already protected
- No changes needed

### 10. Dashboard variants
- Uses card grid with responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — already responsive
- No changes needed

### 11. Calendar mobile
- Has dedicated `CalendarMobileLayout` component — already optimized
- No changes needed

## Summary of actual edits needed:

| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Add `overflow-x-hidden` to outer div and main |
| `src/pages/InvoiceDetail.tsx` | Add mobile card layout for line items (hidden table on mobile) |
| `src/pages/Messages.tsx` | Add `overflow-x-auto` to TabsList if it overflows |

### Technical Notes
- The AppLayout fix is the highest-impact single change — it prevents any child content from causing horizontal scroll across ~15 staff pages
- InvoiceDetail is the only high-traffic page where table content is user-facing (not just admin reports) and needs a proper mobile card alternative
- Report tables are admin-only and horizontal scroll within their container is acceptable UX

