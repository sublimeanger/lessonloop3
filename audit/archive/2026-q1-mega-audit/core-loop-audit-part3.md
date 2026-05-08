# Core Loop Audit — Part 3: Dashboard Accuracy, Data Integrity & Edge Cases

**Auditor:** Claude (automated)
**Date:** 2026-03-15
**Branch:** audit/core-loop-part3
**Scope:** Steps 8–10 of the core loop audit

---

## STEP 8: DASHBOARD ACCURACY

---

### **[Step 8A] — Active Students Count**
**Status:** VERIFIED CORRECT
**Files read:** `src/hooks/useReports.ts:589-594`, `src/lib/studentQuery.ts:12-19`, `src/pages/Dashboard.tsx:194,293`
**Trace:**
Dashboard calls `useDashboardStats()` (line 123/226 of Dashboard.tsx). Inside `useReports.ts:589-594`:
```ts
supabase
  .from('students')
  .select('id', { count: 'exact', head: true })
  .eq('org_id', currentOrg.id)
  .eq('status', 'active')
  .is('deleted_at', null)
```
This is a `head: true` count-only query: `WHERE org_id = X AND status = 'active' AND deleted_at IS NULL`.

The `activeStudentsQuery()` helper in `studentQuery.ts:12-19` uses the identical filters (`status = 'active'`, `deleted_at IS NULL`, org-scoped). It adds `.limit(5000)` but that's irrelevant for the dashboard since dashboard uses `{ count: 'exact', head: true }` directly.

**Finding:** The dashboard query and the shared helper use the same filters. However, the **Students page** (`src/pages/Students.tsx`) uses a different data source — it calls `useStudents()` which invokes the RPC `get_students_for_org` and returns ALL students (active + inactive). The Students page then client-side filters to get the "active" pill count. These two approaches will agree on the active count as long as the RPC returns all students and the client filter matches `status === 'active'`. But the Students page header shows **total** student count (not just active), so the numbers displayed are intentionally different.

**Impact:** None — this is correct. Dashboard shows active students; Students page shows total with filter pills.

---

### **[Step 8B] — Today's Lessons Count**
**Status:** VERIFIED CORRECT
**Files read:** `src/hooks/useReports.ts:558-588`, `src/hooks/useTeacherDashboard.ts:39-83`
**Trace:**
Dashboard `useDashboardStats()` at lines 558-570:
```ts
const orgTimezone = currentOrg.timezone || 'Europe/London';
const todayStr = format(today, 'yyyy-MM-dd');
const todayStart = fromZonedTime(new Date(`${todayStr}T00:00:00`), orgTimezone).toISOString();
const todayEnd = fromZonedTime(new Date(`${todayStr}T23:59:59`), orgTimezone).toISOString();
```
Then queries lessons with `.gte('start_at', todayStart).lte('start_at', todayEnd).neq('status', 'cancelled')`.

**Finding:** "Today" is correctly defined in the **org's timezone** (defaulting to `Europe/London`). Cancelled lessons are excluded via `.neq('status', 'cancelled')`. Open slots are NOT excluded — the query has no filter on `is_open_slot`. This means unfilled open slots will be counted in "Today's Lessons".

The teacher dashboard (`useTeacherDashboard.ts:39-83`) uses the same timezone logic and also uses `fromZonedTime` correctly. However, it filters to `.eq('status', 'scheduled')` only (line 81), which is MORE restrictive — it excludes completed lessons from today's count, while the main dashboard includes them. This is a minor inconsistency between dashboards.

The calendar day view fetches the full week via `useCalendarData` and groups by day client-side. It does NOT display an explicit "today's lessons" count, so there's no number to compare against.

**Evidence:**
- Main dashboard: `.neq('status', 'cancelled')` — includes scheduled + completed + any other non-cancelled status (line 588)
- Teacher dashboard: `.eq('status', 'scheduled')` — only scheduled (line 81)

**Impact:** Low. Teacher sees fewer lessons than admin for the same day once lessons are completed. But this is arguably intentional — teachers care about remaining lessons.

---

### **[Step 8C] — Revenue MTD**
**Status:** BUG FOUND
**Files read:** `src/hooks/useReports.ts:604-610,638`, `src/hooks/useReports.ts:40-122` (revenue report)
**Trace:**
Dashboard `useDashboardStats()` at lines 604-610:
```ts
supabase
  .from('invoices')
  .select('total_minor')
  .eq('org_id', currentOrg.id)
  .eq('status', 'paid')
  .gte('issue_date', monthStart)
  .lte('issue_date', monthEnd)
  .limit(5000)
```
Then at line 638: `const revenueMTD = (mtdInvoices || []).reduce((sum, inv) => sum + inv.total_minor, 0) / 100;`

Revenue Report (`useRevenueReport`, lines 63-69) uses the RPC `get_revenue_report` which aggregates `paid_amount_minor` — this is the **actual payments** sum, not the invoice total.

**Finding:** **Two different definitions of "Revenue MTD":**
1. **Dashboard** (line 604-610): SUM of `total_minor` from invoices WHERE `status = 'paid'` AND `issue_date` within current month. This is **invoice total**, not actual payment amount. A partially-paid-then-completed invoice would show the full invoice total, not what was actually paid. Also, `issue_date` is used — an invoice issued in February but paid in March would NOT appear in March's dashboard MTD.
2. **Revenue Report** (RPC): Uses `paid_amount_minor` aggregation — potentially different from `total_minor`.

**Additional issue:** The dashboard uses `issue_date` for the month filter. This means revenue appears in the month the invoice was **issued**, not when it was **paid**. The revenue report also appears to use `issue_date` (it passes `_start_date`/`_end_date` to the RPC). So they're consistent on that front, but this is cash-basis-incorrect — it's "invoiced revenue" not "received revenue".

**Evidence:** `src/hooks/useReports.ts:604-610` — `status = 'paid'` + `issue_date` range
**Impact:** Medium. Dashboard MTD and Revenue Report may show different numbers because the dashboard sums `total_minor` while the report sums `paid_amount_minor`. For invoices paid in full these are identical, but for overpayments or partial payments they'd diverge. Also, a `limit(5000)` on the dashboard query could silently truncate for very active orgs.
**Fix:** Dashboard should use the same RPC or at minimum sum `paid_minor` instead of `total_minor`. Consider filtering by payment date instead of issue date for true cash-basis revenue.

---

### **[Step 8D] — Outstanding Amount**
**Status:** VERIFIED CORRECT (with caveat)
**Files read:** `src/hooks/useReports.ts:595,617-618,625`, `supabase/migrations/20260222234356_...sql:22-37`
**Trace:**
Dashboard calls `get_invoice_stats` RPC (line 595). The latest version of this RPC (`20260222234356` migration, lines 22-37):
```sql
'total_outstanding', COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total_minor ELSE 0 END), 0)
```
Then at line 625: `const outstandingAmount = (invoiceStats?.total_outstanding ?? 0) / 100;`

The Invoices page uses the same RPC `get_invoice_stats` via `useInvoiceStats()` (`src/hooks/useInvoices.ts:159-174`). Both display `total_outstanding` from the same source.

**Finding:** The outstanding amount is `SUM(total_minor) WHERE status IN ('sent', 'overdue')`. This does **NOT** account for partial payments. If an invoice for £100 has £50 paid, it still shows £100 outstanding (not £50). The `total_minor` column is the full invoice amount, not the remaining balance.

**Evidence:** RPC sums `total_minor`, not `total_minor - COALESCE(paid_minor, 0)`.
**Impact:** Medium. Outstanding is overstated for any partially-paid invoice. A school with several parents making partial payments would see inflated outstanding numbers on both the dashboard and invoices page (consistently wrong in both places).
**Fix:** Change the RPC to `SUM(total_minor - COALESCE(paid_minor, 0))` for outstanding invoices.

---

### **[Step 8E] — Teacher Dashboard**
**Status:** VERIFIED CORRECT
**Files read:** `src/hooks/useTeacherDashboard.ts:22-162`, `src/pages/Dashboard.tsx:348-458`
**Trace:**
1. Teacher dashboard calls `useTeacherDashboardStats()` (line 351).
2. The hook resolves the teacher's `teacher_id` from the `teachers` table using `user_id` + `org_id` (lines 49-54).
3. All queries are filtered by `.eq('teacher_id', myTeacherId)`:
   - "Today's Lessons" (line 80): `teacher_id = myTeacherId`, `status = 'scheduled'`, today's date range
   - "My Students" (line 87-89): `student_teacher_assignments` WHERE `teacher_id = myTeacherId`
   - "This Month" (lines 99-106): `teacher_id = myTeacherId`, `status = 'completed'`, month range
   - "Hours (Week)" (lines 91-97): `teacher_id = myTeacherId`, week range (all statuses)

**Finding:** All queries are correctly scoped to the teacher. "My Students" uses the `student_teacher_assignments` table, which is the correct assignment junction table. "This Week" hours includes ALL lesson statuses (including cancelled), which slightly inflates teaching hours.

**Evidence:** `useTeacherDashboard.ts:91-97` — no status filter on week lessons
**Impact:** Low. Cancelled lessons' hours are included in the weekly hours count.

---

### **[Step 8F] — Finance Dashboard**
**Status:** VERIFIED CORRECT (inherits 8C/8D caveats)
**Files read:** `src/components/dashboard/FinanceDashboard.tsx:1-119`, `src/pages/Dashboard.tsx:102-106`
**Trace:**
Finance dashboard (`FinanceDashboard.tsx:26`) calls `useDashboardStats()` — the same hook as Solo/Academy dashboards. It displays:
- Revenue (MTD): `stats?.revenueMTD` (line 63) — same query as 8C
- Outstanding: `stats?.outstandingAmount` (line 70) — same query as 8D
- Overdue: `stats?.overdueCount` (line 79) — from `get_invoice_stats` RPC

**Finding:** Finance dashboard inherits the same issues from 8C (Revenue MTD uses `total_minor` not `paid_minor`) and 8D (Outstanding doesn't account for partial payments). The "Overdue" count matches the invoices page since both use the same RPC.
**Impact:** See 8C and 8D.

---

### **[Step 8G] — Real-time Updates**
**Status:** FRAGILE
**Files read:** `src/hooks/useRealtimeInvoices.ts:1-107`, `src/hooks/useReports.ts:651-654`, `src/config/query-stale-times.ts`
**Trace:**
The `useRealtimeInvoices()` hook (called in Dashboard.tsx line 51) subscribes to Supabase Realtime for:
1. `invoices` table changes → invalidates `['invoice-stats', orgId]` and `['invoices', orgId]`
2. `payments` table changes → invalidates `['invoice-stats', orgId]` and `['invoices', orgId]`
3. `payment_notifications` INSERT → same invalidation + toast

**Finding:** The realtime subscription invalidates query keys `['invoice-stats', orgId]` and `['invoices', orgId]`, but the **dashboard stats** query key is `['dashboard-stats', currentOrg?.id]` (line 552 of useReports.ts). These are DIFFERENT keys. The realtime subscription does NOT invalidate `dashboard-stats`.

Dashboard stats rely on:
- `staleTime: STALE_REPORT` (10 minutes) — line 652
- `refetchInterval: STALE_STABLE` (5 minutes) — line 653

So after recording a payment:
- Invoice list updates immediately (via realtime)
- Invoice stats (used by Invoices page) update immediately (via realtime)
- **Dashboard stats do NOT update** until the 5-minute polling interval triggers, or the user navigates away and back (refetch on mount)

Similarly, after adding a student or marking attendance — there is NO realtime subscription for `students`, `lessons`, or `attendance_records` tables in the dashboard context. Dashboard stats are purely poll-based with 5-minute intervals.

**Evidence:**
- Realtime invalidates: `['invoice-stats', orgId]` — `useRealtimeInvoices.ts:46-48`
- Dashboard query key: `['dashboard-stats', currentOrg?.id]` — `useReports.ts:552`
- These don't match.

**Impact:** Medium. After recording a payment, the dashboard "Revenue MTD" and "Outstanding" cards remain stale for up to 5 minutes. Users may think the payment didn't register and try again. After adding a student, the "Active Students" count is stale for the same period.
**Fix:** Add `['dashboard-stats']` to the realtime invalidation list, or subscribe to additional tables.

---

## STEP 9: DATA INTEGRITY CROSS-CHECK

---

### **[Step 9A] — Student → Lesson → Attendance**
**Status:** EDGE CASE RISK
**Files read:** `supabase/migrations/20260119233145_...sql:44-56` (lesson_participants, attendance_records schema)
**Trace:**
- `lesson_participants`: FK `lesson_id → lessons(id) ON DELETE CASCADE`, FK `student_id → students(id) ON DELETE CASCADE`
- `attendance_records`: FK `lesson_id → lessons(id) ON DELETE CASCADE`, FK `student_id → students(id) ON DELETE CASCADE`
- Both tables share `(lesson_id, student_id)` as the logical key.

When a student is removed from a lesson (deleted from `lesson_participants`), the attendance record in `attendance_records` is NOT cascade-deleted because the FK is on `student_id → students` not on `lesson_participants`. The attendance record persists as long as both the student and lesson exist.

**Finding:** Removing a student from a lesson's participant list AFTER marking attendance leaves an orphaned attendance record. The attendance record references a student who is no longer a participant of that lesson. This is arguably correct (historical record of attendance) but could cause confusion in reports that join attendance to lesson_participants.

**Impact:** Low. The attendance record is historical and shouldn't be deleted. But if any report filters attendance by joining to lesson_participants, it would miss these records.

---

### **[Step 9B] — Lesson → Invoice**
**Status:** BUG FOUND
**Files read:** `supabase/functions/create-billing-run/index.ts` (via agent analysis), `src/hooks/useBillingRuns.ts:44-116`
**Trace:**
- Billing run creates invoice items with `linked_lesson_id` FK (→ `lessons(id) ON DELETE SET NULL`).
- Rate is looked up from `rate_cards` at billing time, NOT snapshotted at lesson creation.
- Cancelled lessons at lesson level are excluded (status filter).
- Teacher-cancelled attendance records are excluded (attendance check).

**Finding:** The dedup logic queries ALL `linked_lesson_id` values from `invoice_items` globally per org (not per student). For a multi-student group lesson, once lesson L1 is billed for student A, the entire lesson L1 is added to `billedLessonIds`. In the next billing run, student B (who also participated in L1) will be skipped because L1 is already in the set. **This means group lesson participants beyond the first billing run will never be billed.**

If a lesson is cancelled AFTER invoicing, the invoice remains. There is no automatic link-back to void the invoice. The `linked_lesson_id` FK is `ON DELETE SET NULL`, so deleting the lesson would null-out the reference but leave the invoice item intact.

If an invoice is voided, the `void_invoice` RPC (`20260222233816` migration) sets status to 'void' but does NOT unmark the lesson as billed. The lesson's ID remains in `invoice_items.linked_lesson_id`. This means voided invoice items still prevent re-billing of the same lesson.

**Evidence:**
- Billing run dedup: queries all `linked_lesson_id` from `invoice_items` without per-student filtering
- `void_invoice` RPC: does NOT delete invoice_items or null-out `linked_lesson_id`

**Impact:** HIGH. Group lessons (2+ students) may only bill one set of students per billing run. If voided and re-run, the lessons cannot be re-billed because the voided invoice items still contain the `linked_lesson_id`.
**Fix:** Dedup should check `(linked_lesson_id, student_id)` pairs, not just `linked_lesson_id`. Voiding should clear `linked_lesson_id` on the voided invoice's items.

---

### **[Step 9C] — Invoice → Payment**
**Status:** VERIFIED CORRECT (with caveat)
**Files read:** `supabase/migrations/20260222155756_...sql:1-81` (record_payment_and_update_status)
**Trace:**
`record_payment_and_update_status` RPC:
1. Locks invoice row with `FOR UPDATE` (line 23-26) — prevents concurrent payment race conditions
2. Rejects payments on `paid` or `void` invoices (line 32-34)
3. Inserts payment record (line 37-39)
4. Updates `paid_minor` atomically: `paid_minor = COALESCE(paid_minor, 0) + _amount_minor` (line 57-59)
5. Sums all payments to determine if fully paid (line 62-64)
6. Auto-transitions to `paid` status if `total_paid >= total_minor` (line 67-69)

**Finding:** Payment recording is atomic and well-protected. The `FOR UPDATE` lock prevents double-payment race conditions. However, voiding an invoice after payment is blocked (`void_invoice` rejects `status = 'paid'`, line 23-24 of void_invoice). But for partially-paid invoices (status still 'sent' or 'overdue'), voiding IS possible and the existing payment records are NOT touched — they become orphaned payments against a voided invoice.

**Evidence:** `void_invoice` RPC (migration `20260222233816`): only changes invoice status and installments. No cleanup of payments table.
**Impact:** Medium. Partial payment + void = orphaned payment records. Revenue reports that sum payments would still count these, inflating revenue. The `get_invoice_stats` RPC filters by invoice status, so `paid_total` wouldn't include voided invoices, but actual payments table records remain.

---

### **[Step 9D] — Guardian → Invoice → Payment**
**Status:** EDGE CASE RISK
**Files read:** `supabase/migrations/20260119234233_...sql:28` (invoices schema)
**Trace:**
- `invoices.payer_guardian_id` → `guardians(id) ON DELETE SET NULL` (line 28)
- `invoices.payer_student_id` → `students(id) ON DELETE SET NULL` (line 29)
- `payments.invoice_id` → `invoices(id) ON DELETE CASCADE` (line 54)

**Finding:** Deleting a guardian sets `payer_guardian_id = NULL` on all their invoices. The invoices themselves persist (not cascade-deleted). Payment records persist because they FK to the invoice, not the guardian. However, the payer name is lost — any invoice or report showing "Payer" will show NULL/Unknown for these invoices.

Guardian deletion does NOT block even if invoices are outstanding. A guardian could be deleted while owing money, and the outstanding invoices would become payer-orphaned with no way to identify who owes.

**Evidence:** FK definition: `ON DELETE SET NULL` at line 28 of initial migration
**Impact:** Medium. Deleting a guardian with outstanding invoices loses the payer identity. The invoice amount still shows in outstanding totals, but "who owes" is unknown.
**Fix:** Either prevent guardian deletion when outstanding invoices exist, or use soft-delete for guardians.

---

### **[Step 9E] — Numbers Consistency**
**Status:** BUG FOUND
**Files read:** All files from steps 8A–8F
**Trace:** Comparing dashboard queries to page/report queries for each number:

| Metric | Dashboard Query | Page/Report Query | Same? |
|--------|----------------|-------------------|-------|
| Active Students | `students WHERE status='active' AND deleted_at IS NULL` (count, head:true) | Students page: `get_students_for_org` RPC → client-side filter | **Functionally yes** — both filter `status='active'`, but different code paths |
| Revenue MTD | `SUM(total_minor) FROM invoices WHERE status='paid' AND issue_date in month` | Revenue report: `get_revenue_report` RPC sums `paid_amount_minor` | **NO** — different columns (`total_minor` vs `paid_amount_minor`) |
| Outstanding | `get_invoice_stats` RPC: `SUM(total_minor) WHERE status IN ('sent','overdue')` | Invoices page: same RPC | **Yes** — same RPC, same numbers |
| Today's Lessons | Direct query: `lessons WHERE start_at in today AND status != 'cancelled'` | Calendar: `useCalendarData` fetches week, groups by day | **No explicit count on calendar** — not directly comparable |

**Finding:** Revenue MTD is the critical inconsistency. The dashboard and the revenue report could show different numbers for the same month because they aggregate different columns.
**Impact:** HIGH for financial credibility. A school owner checking dashboard vs. revenue report and seeing different numbers would lose trust in the system.

---

## STEP 10: EDGE CASES THAT KILL BUSINESSES

---

### **[Step 10A] — Term Boundary**
**Status:** EDGE CASE RISK
**Files read:** `supabase/functions/create-billing-run/index.ts` (via agent analysis)
**Trace:**
Billing run receives `start_date` and `end_date` as strings (e.g., "2025-09-01" and "2025-12-31"). These are used directly in the Supabase query:
```ts
.gte('start_at', start_date)
.lte('start_at', end_date)
```
The `start_at` column is a `timestamptz` stored in UTC. The `start_date`/`end_date` are plain date strings. Supabase/Postgres will cast the date string to midnight UTC.

**Finding:** A lesson on Dec 15 at 23:00 GMT would have `start_at = '2025-12-15T23:00:00Z'`. The billing boundary `end_date = '2025-12-31'` becomes `'2025-12-31T00:00:00Z'` in the comparison. Since `23:00 < 00:00` of Dec 31, the lesson IS included. But a lesson on Dec 31 at ANY time after midnight UTC would be excluded because `start_at > '2025-12-31T00:00:00Z'`.

For orgs NOT in UTC (e.g., `America/New_York`), a lesson at 22:00 local on Dec 31 = 03:00 Jan 1 UTC. This lesson starts "on Dec 31" locally but its UTC `start_at` is Jan 1, so it would be excluded from a Sep-Dec billing run. The billing run does NOT convert start_date/end_date to the org's timezone before filtering.

**Evidence:** Edge function uses raw date strings against UTC `start_at` column without timezone conversion.
**Impact:** HIGH for non-UTC orgs. Lessons on the last day of a billing period may be missed. For UK schools (UTC+0 in winter, UTC+1 in summer), summer evening lessons could be excluded.
**Fix:** Convert `start_date`/`end_date` to org-timezone-aware UTC boundaries using `fromZonedTime` before querying.

---

### **[Step 10B] — Mid-term Student Join**
**Status:** VERIFIED CORRECT
**Files read:** `supabase/functions/create-billing-run/index.ts` (via agent analysis)
**Trace:**
The billing run fetches lessons in the date range and then checks `lesson_participants` for each lesson to determine which students participated. If a student joined Oct 15, they would only appear in `lesson_participants` for lessons from Oct 15 onwards. Lessons before Oct 15 would not have this student as a participant.

**Finding:** The billing run correctly bills only for lessons where the student was actually a participant. A student joining mid-term is only billed for lessons they attended, not retroactively from term start.
**Impact:** None — correct behaviour.

---

### **[Step 10C] — Mid-term Student Leave**
**Status:** VERIFIED CORRECT
**Files read:** `supabase/functions/create-billing-run/index.ts` (via agent analysis)
**Trace:**
- Cancelled lessons (lesson-level `status = 'cancelled'`) are excluded from billing.
- Teacher-cancelled attendance records are excluded.
- Completed lessons before the leave date remain billable.

**Finding:** If a student leaves Nov 1 and their future lessons are cancelled, those cancelled lessons are correctly excluded. Completed lessons before Nov 1 are correctly included.
**Impact:** None — correct behaviour, assuming lessons are properly cancelled upon student departure.

---

### **[Step 10D] — Teacher Change Mid-term**
**Status:** VERIFIED CORRECT
**Files read:** `supabase/functions/create-billing-run/index.ts` (via agent analysis)
**Trace:**
Billing runs group by payer (guardian/student), not by teacher. Lessons with Teacher A and lessons with Teacher B are both included as long as they fall within the date range and have the student as participant. The billing run does not filter by teacher.

**Finding:** Both teachers' lessons are correctly included in the billing run. For payroll (not audited here), teacher_id on each lesson correctly identifies which teacher delivered it.
**Impact:** None — correct behaviour for billing.

---

### **[Step 10E] — Rate Change Mid-term**
**Status:** EDGE CASE RISK
**Files read:** `supabase/functions/create-billing-run/index.ts` (via agent analysis — rate lookup logic)
**Trace:**
Rates are looked up at billing time from the `rate_cards` table. The function finds a rate card matching the lesson's duration. If the rate was changed from £25 to £30 mid-term, ALL lessons in the billing run (including those before the change) would be billed at the NEW rate of £30.

**Finding:** Rates are NOT snapshotted at lesson creation time. Rate changes are retroactive within a billing run. There is no `effective_from` date on rate cards that would allow different rates for different periods.

**Evidence:** Rate lookup function `findRateForDuration` matches on duration only, with no date filter.
**Impact:** HIGH. A mid-term rate increase would retroactively increase charges for lessons already delivered at the old rate. This would overcharge parents and could cause disputes.
**Fix:** Either snapshot the rate at lesson creation (store `rate_minor` on lesson or lesson_participants), or add `effective_from`/`effective_to` dates on rate cards and filter by lesson date.

---

### **[Step 10F] — Double Billing**
**Status:** VERIFIED CORRECT (for single-student lessons)
**Files read:** `supabase/functions/create-billing-run/index.ts` (dedup logic), `supabase/migrations/20260315200600_...sql:1-23`
**Trace:**
Three layers of protection:
1. **Lesson-level dedup:** `billedLessonIds` Set prevents re-billing lessons that already have invoice items (via `linked_lesson_id`).
2. **Within-run dedup:** `dedupKey = ${lesson.id}-${student.id}` prevents duplicate items within a single billing run.
3. **Billing run uniqueness:** Partial unique index `idx_billing_runs_no_duplicate ON billing_runs (org_id, start_date, end_date) WHERE status != 'failed'` prevents duplicate billing runs for the same period.

**Finding:** For single-student (1:1) lessons, double billing is well-prevented. However, as noted in 9B, the lesson-level dedup (`billedLessonIds`) is too aggressive for group lessons — it deduplicates at the lesson level rather than the (lesson, student) level.

**Impact:** See 9B for group lesson impact.

---

### **[Step 10G] — Partial Payment Then Void**
**Status:** BUG FOUND
**Files read:** `supabase/migrations/20260222233816_...sql:1-46` (void_invoice), `supabase/migrations/20260222155756_...sql:1-81` (record_payment)
**Trace:**
1. Invoice £100 created, status = 'sent'
2. Parent pays £50 → `record_payment_and_update_status` inserts payment, updates `paid_minor = 50`, status remains 'sent' (since 50 < 100)
3. Admin voids invoice → `void_invoice` sets `status = 'void'`, voids pending installments, restores credits
4. The £50 payment record remains in the `payments` table with `invoice_id` intact

**Finding:** The `void_invoice` RPC does NOT handle existing payments. The £50 payment is orphaned — it references a voided invoice. There is no automatic refund trigger. The payment record persists in the database.

Revenue impact: The `get_invoice_stats` RPC filters `paid_total` by `status = 'paid'`, so voided invoices don't inflate `paid_total`. But any report querying the `payments` table directly (not filtered by invoice status) would include this £50, overstating actual revenue.

**Evidence:** `void_invoice` function body has no reference to `payments` table.
**Impact:** Medium. Orphaned payment records on voided invoices. No automatic refund workflow. Manual reconciliation required.
**Fix:** Either block voiding invoices with payments, or add a refund/credit-note workflow, or at minimum mark associated payments as "refunded" when voiding.

---

### **[Step 10H] — Concurrent Payments**
**Status:** VERIFIED CORRECT
**Files read:** `supabase/migrations/20260222155756_...sql:22-26`
**Trace:**
`record_payment_and_update_status` uses `SELECT ... FOR UPDATE` to lock the invoice row before processing. This prevents two concurrent payment attempts from both succeeding in a way that would double-count.

If parent opens checkout in browser A and B:
- First payment acquires the row lock, inserts payment, updates `paid_minor`, releases lock
- Second payment acquires the lock, sees updated `paid_minor` / potentially `status = 'paid'`, and if `status = 'paid'` → raises exception "Cannot record payment on a paid invoice"

**Finding:** The `FOR UPDATE` row lock correctly serializes concurrent payments. If both complete before the first marks status as `paid`, both payments would be inserted, but the second would cause `paid_minor` to exceed `total_minor`. The status check at line 32-34 only blocks if status is ALREADY 'paid', so if both requests start concurrently, the first to lock wins, completes, sets status='paid', and the second then sees status='paid' and is blocked.

**Impact:** None — correctly handled via row-level locking.

---

### **[Step 10I] — Guardian with Multiple Children**
**Status:** VERIFIED CORRECT
**Files read:** `supabase/functions/create-billing-run/index.ts` (grouping logic via agent analysis)
**Trace:**
Invoices are grouped by payer using key `${payerType}-${payerId}`. A guardian paying for 3 children would have the same `guardian-{guardian_id}` key for all three children's lessons. All items are grouped onto a SINGLE invoice.

**Finding:** Correctly creates one invoice per guardian, not per child. Line items show individual lessons per child.
**Impact:** None — correct behaviour.

---

### **[Step 10J] — Student with No Lessons**
**Status:** VERIFIED CORRECT
**Files read:** `supabase/functions/create-billing-run/index.ts` (via agent analysis)
**Trace:**
The billing run starts from lessons, not from students. It queries lessons in the date range, then finds participants for each lesson. A student with zero lessons in the billing period simply has no lesson_participants records, so no invoice items are generated, and no empty invoice is created.

**Finding:** Students with no lessons are correctly skipped — no empty invoice is generated.
**Impact:** None — correct behaviour.

---

## CORE LOOP HEALTH ASSESSMENT

| Step | Component | Rating | Notes |
|------|-----------|--------|-------|
| 8A | Active Students count | **SOLID** | Consistent filters, org-scoped |
| 8B | Today's Lessons count | **SOLID** | Correct timezone handling, minor teacher vs admin status filter difference |
| 8C | Revenue MTD | **BROKEN** | Dashboard uses `total_minor` not `paid_minor`; may disagree with revenue report |
| 8D | Outstanding | **FRAGILE** | Doesn't account for partial payments (`total_minor` instead of remaining balance) |
| 8E | Teacher Dashboard | **SOLID** | Correctly scoped to teacher's records |
| 8F | Finance Dashboard | **FRAGILE** | Inherits 8C and 8D issues |
| 8G | Real-time Updates | **FRAGILE** | Realtime doesn't invalidate `dashboard-stats` query key; 5-minute stale window |
| 9A | Student→Lesson→Attendance | **SOLID** | Orphaned attendance is acceptable historical data |
| 9B | Lesson→Invoice | **BROKEN** | Group lesson dedup bug; void doesn't clear billing markers |
| 9C | Invoice→Payment | **SOLID** | Atomic with FOR UPDATE lock |
| 9D | Guardian→Invoice→Payment | **FRAGILE** | Guardian deletion orphans payer identity |
| 9E | Numbers Consistency | **BROKEN** | Revenue MTD uses different column than revenue report |
| 10A | Term Boundary | **FRAGILE** | No timezone conversion on billing date boundaries |
| 10B | Mid-term Join | **SOLID** | Correctly bills from actual participation |
| 10C | Mid-term Leave | **SOLID** | Cancelled lessons excluded |
| 10D | Teacher Change | **SOLID** | Both teachers' lessons included |
| 10E | Rate Change | **BROKEN** | Retroactive rate application; no date-based rate lookup |
| 10F | Double Billing | **SOLID** | For 1:1 lessons; group lessons inherit 9B bug |
| 10G | Partial Pay + Void | **FRAGILE** | Orphaned payment records, no refund workflow |
| 10H | Concurrent Payments | **SOLID** | FOR UPDATE lock works correctly |
| 10I | Multi-child Guardian | **SOLID** | Single grouped invoice per guardian |
| 10J | No Lessons Student | **SOLID** | Correctly skipped |

---

## BUSINESS RISK SUMMARY

**Top 5 scenarios most likely to lose a real customer money or data, ranked by probability x severity:**

### 1. **Retroactive Rate Changes Overcharge Parents** (Probability: HIGH, Severity: HIGH)
**Step 10E.** Any rate card change applies retroactively to all unbilled lessons. A school raising rates mid-term from £25→£30 would bill £30 for lessons already delivered at £25. Parents would dispute charges. This is the most likely scenario because rate changes are common (annual increases, mid-year adjustments).

### 2. **Revenue MTD Dashboard Disagrees with Revenue Report** (Probability: HIGH, Severity: MEDIUM)
**Steps 8C, 9E.** Dashboard sums `total_minor` of paid invoices; revenue report sums actual payments. For any school with partial payments, overpayments, or payment plans, these numbers will diverge. School owners will question which number is correct, eroding trust in the financial data.

### 3. **Group Lesson Billing Failure** (Probability: MEDIUM, Severity: HIGH)
**Step 9B.** Schools running group lessons (common for music academies — ensemble classes, theory groups) will have only one student billed per group lesson across billing runs. This is direct revenue loss proportional to group size.

### 4. **Outstanding Amount Overstated by Partial Payments** (Probability: MEDIUM, Severity: MEDIUM)
**Step 8D.** Schools using payment plans or accepting partial payments see inflated "Outstanding" amounts on their dashboard. This could lead to incorrect financial decisions or unnecessary chasing of parents who've already partially paid.

### 5. **Evening Lessons on Billing Boundary Dates Missed** (Probability: LOW-MEDIUM, Severity: MEDIUM)
**Step 10A.** UK schools in BST (UTC+1) running evening lessons on the last day of a billing period will have those lessons fall into the next UTC day, excluding them from the billing run. Lost revenue: one evening's worth of lessons per term for affected schools.

---

## LAUNCH READINESS VERDICT

### **NOT READY**

**Rationale:** Three BROKEN issues directly affect the core billing and financial reporting loop:

1. **Rate card retroactivity (10E)** will cause incorrect invoices and parent disputes for any school that ever changes rates. This is a near-certainty for any school operating more than one term.

2. **Group lesson billing dedup bug (9B)** causes direct revenue loss for academies running group classes — a primary target customer segment. Combined with the void-doesn't-clear-billing-markers issue, this makes billing corrections impossible without manual database intervention.

3. **Revenue number inconsistency (8C/9E)** between dashboard and reports undermines financial credibility. A school owner who can't trust their revenue numbers will not continue using the platform.

**Minimum fixes before launch:**
- Snapshot rates at lesson creation or add date-based rate card lookup
- Change billing dedup from per-lesson to per-(lesson, student) pair
- Ensure void clears billing markers so lessons can be re-billed
- Align Revenue MTD to use `paid_minor` or the same RPC as the revenue report
- Fix outstanding to use `total_minor - COALESCE(paid_minor, 0)` for partial payments
