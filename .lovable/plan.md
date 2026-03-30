

## Dashboard Alert Navigation Fixes

Three broken links in the UrgentActionsBar that users hit immediately after login.

### Technical Details

**Current state:**
- `useUrgentActions.ts` counts sent+overdue invoices 7+ days past due as "overdue" (16), but the Invoices page filter only shows `status='overdue'` (4)
- The `get_invoice_stats` RPC also lumps sent-past-due into `overdue_count` — so tab badge says 16 but filter returns 4
- Unmarked lessons link goes to `/register` which only shows today
- Invoices page ignores URL search params entirely
- Tabs component uses `defaultValue="invoices"` with no controlled state for `?tab=plans`

---

### Changes

**1. `src/hooks/useUrgentActions.ts` — Fix counts and hrefs**

- Change unmarked lessons href from `/register` to `/register?view=unmarked`
- Replace the single overdue query with two separate queries:
  - `status = 'overdue'` → severity error, href `/invoices?status=overdue`
  - `status = 'sent'` + `due_date < today` → new "invoices past due" action, severity warning, href `/invoices?status=sent&due=past`
- Remove the 7-day threshold (any overdue is urgent)

**2. `src/pages/DailyRegister.tsx` — Add unmarked backlog view**

- Import `useSearchParams`
- Read `view` param; when `view=unmarked`, render a backlog mode:
  - Different page title: "Unmarked Lessons (Last 30 Days)"
  - New query fetching all lessons with `status='scheduled'`, `end_at < now`, `end_at > 30 days ago`, joined with teacher/participants
  - Group results by date, display most recent first
  - Each lesson shows date, time, student names, teacher name
  - Quick actions: "All Present" per lesson, expandable RegisterRow for individual marking
  - Counter at top: "X lessons need attendance"
  - "Back to Today's Register" link to `/register`
  - Respect teacher filter (teachers only see their own)
- Normal daily view (no `?view` param) remains completely unchanged

**3. `src/pages/Invoices.tsx` — Read URL search params**

- Import `useSearchParams`
- Initialize `filters` from `searchParams.get('status')` 
- Initialize active tab from `searchParams.get('tab')` (supports `?tab=plans`)
- `handleFiltersChange` updates URL params via `setSearchParams`
- Make `Tabs` controlled with `value`/`onValueChange` to support `?tab=plans`

**4. `get_invoice_stats` RPC — Align overdue_count with filter**

- Database migration to update the RPC:
  - `overdue_count`: only `status = 'overdue'` (not sent+past-due)
  - `sent_count`: all `status = 'sent'` (including past-due sent)
  - Add new `past_due_count`: `status = 'sent' AND due_date < CURRENT_DATE`
  - `overdue` (amount): keep as-is or split similarly
- Update `useInvoiceStats` return type to include `pastDueCount`
- Update `statusCounts` in Invoices.tsx to use the corrected counts

**5. `src/components/invoices/InvoiceFiltersBar.tsx` — Support past-due filter**

- When URL has `status=sent&due=past`, set status filter to `sent` and add a `dueDateTo` filter for today (so only past-due sent invoices show)
- Or add a "Past Due" pill to the filter bar that combines `status=sent` + `due_date < today`

---

### Files Modified
- `src/hooks/useUrgentActions.ts`
- `src/pages/DailyRegister.tsx` (add backlog view component inline or as separate component)
- `src/pages/Invoices.tsx`
- `src/hooks/useInvoices.ts` (update stats type)
- `supabase/migrations/` (new migration for `get_invoice_stats` RPC fix)
- Possibly `src/components/invoices/InvoiceFiltersBar.tsx` (if adding past-due pill)

### Testing
1. Dashboard → click "X unmarked lessons" → see all X grouped by date, mark attendance, lessons disappear
2. Dashboard → click "X overdue invoices" → Invoices page filtered to overdue, count matches
3. Dashboard → click "X invoices past due" → Invoices page filtered to sent invoices past due
4. Direct URL `/invoices?tab=plans` → opens Payment Plans tab
5. Changing filter tabs updates URL; browser back button works

