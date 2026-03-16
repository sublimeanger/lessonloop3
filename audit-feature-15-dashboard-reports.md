# Audit: Feature 15 — Dashboard & Reports

**Auditor:** Claude (Opus 4.6)
**Date:** 2026-03-16
**Scope:** Main dashboard, stats cards, FinanceDashboard, Reports page, all report types, RPCs, engagement metrics, exports, RLS/auth

---

## 1. Files Audited

### Pages
| # | File |
|---|------|
| 1 | `src/pages/Dashboard.tsx` |
| 2 | `src/pages/Reports.tsx` |
| 3 | `src/pages/reports/Revenue.tsx` |
| 4 | `src/pages/reports/Outstanding.tsx` |
| 5 | `src/pages/reports/LessonsDelivered.tsx` |
| 6 | `src/pages/reports/Cancellations.tsx` |
| 7 | `src/pages/reports/Payroll.tsx` |
| 8 | `src/pages/reports/Utilisation.tsx` |
| 9 | `src/pages/reports/TeacherPerformance.tsx` |
| 10 | `src/pages/portal/PortalHome.tsx` |

### Dashboard Components
| # | File |
|---|------|
| 11 | `src/components/dashboard/FinanceDashboard.tsx` |
| 12 | `src/components/dashboard/DashboardHero.tsx` |
| 13 | `src/components/dashboard/StatCard.tsx` |
| 14 | `src/components/dashboard/PaymentAnalyticsCard.tsx` |
| 15 | `src/components/dashboard/UrgentActionsBar.tsx` |
| 16 | `src/components/dashboard/TodayTimeline.tsx` |
| 17 | `src/components/dashboard/QuickActionsGrid.tsx` |
| 18 | `src/components/dashboard/FirstRunExperience.tsx` |
| 19 | `src/components/dashboard/LoopAssistWidget.tsx` |
| 20 | `src/components/dashboard/LoopAssistAlerts.tsx` |
| 21 | `src/components/dashboard/ContinuationWidget.tsx` |
| 22 | `src/components/dashboard/CalendarSyncBanner.tsx` |

### Report Components
| # | File |
|---|------|
| 23 | `src/components/reports/DateRangeFilter.tsx` |
| 24 | `src/components/reports/ReportPagination.tsx` |
| 25 | `src/components/reports/ReportSkeleton.tsx` |
| 26 | `src/components/reports/SortableTableHead.tsx` |

### Invoice/Stats Components
| # | File |
|---|------|
| 27 | `src/components/invoices/InvoiceStatsWidget.tsx` |
| 28 | `src/components/invoices/PaymentPlansDashboard.tsx` |

### Hooks
| # | File |
|---|------|
| 29 | `src/hooks/useReports.ts` — Dashboard stats, revenue, ageing, lessons delivered, cancellations, CSV exports |
| 30 | `src/hooks/usePaymentAnalytics.ts` — Payment analytics card data |
| 31 | `src/hooks/useTeacherDashboard.ts` — Teacher-specific dashboard stats |
| 32 | `src/hooks/useInvoices.ts` — Invoice stats (get_invoice_stats RPC) |
| 33 | `src/hooks/useRealtimeInvoices.ts` — Realtime invalidation |
| 34 | `src/hooks/useUrgentActions.ts` — Urgent actions bar |
| 35 | `src/hooks/useDataExport.ts` — CSV data export |
| 36 | `src/hooks/usePayroll.ts` — Payroll report |
| 37 | `src/hooks/useTeacherPerformance.ts` — Teacher performance report |

### SQL Migrations / RPCs
| # | File |
|---|------|
| 38 | `supabase/migrations/20260315220003_fix_outstanding_partial_payments.sql` — `get_invoice_stats` RPC |
| 39 | `supabase/migrations/20260312000000_invoice_stats_materialised_view.sql` — Materialised view (unused) |
| 40 | `supabase/migrations/20260222215025_...sql` — `get_revenue_report` RPC |
| 41 | `supabase/migrations/20260316210000_fix_billing_audit_findings.sql` — `get_unbilled_lesson_ids`, `delete_billing_run` |

### Engagement/Misc
| # | File |
|---|------|
| 42 | `src/components/calendar/EngagementRating.tsx` — Per-lesson engagement rating |
| 43 | `src/components/shared/StatsGrid.tsx` |

---

## 2. Dashboard Stats Verification Table

### Handoff Fix Verification

| Fix | Expected | Actual | Verified? |
|-----|----------|--------|-----------|
| Revenue MTD uses `paid_minor` NOT `total_minor` | Dashboard queries `paid_minor` from paid invoices | `useDashboardStats` line 605-608: selects `paid_minor` from invoices where `status='paid'`; line 638: sums `paid_minor` | **YES** |
| Outstanding subtracts `paid_minor` | `get_invoice_stats` subtracts `paid_minor` from `total_minor` | Migration `20260315220003` line 17: `total_minor - COALESCE(paid_minor, 0)` | **YES** |
| Realtime invalidation (3 handlers added) | Dashboard stats invalidated on invoice/payment/notification changes | `useRealtimeInvoices` has 4 handlers: invoices, payments, message_requests, payment_notifications — all invalidate `dashboard-stats` | **YES** (4 handlers, exceeds requirement) |

### All Dashboard Stats

| Stat | Source | Calculation | Correct? |
|------|--------|-------------|----------|
| **Today's Lessons** | Direct query on `lessons` table | Count of lessons where `start_at` is today (org-timezone-aware) and `status != 'cancelled'` | **YES** |
| **Active Students** | Direct query on `students` table | Count where `status='active'` AND `deleted_at IS NULL` | **YES** |
| **Revenue (MTD)** | Direct query on `invoices` table | Sum of `paid_minor` for `status='paid'` invoices with `issue_date` in current month | **YES** — uses `paid_minor` per handoff fix |
| **Outstanding** | `get_invoice_stats` RPC | `total_minor - COALESCE(paid_minor, 0)` for `status IN ('sent','overdue')` | **YES** — subtracts paid per handoff fix |
| **Overdue Count** | `get_invoice_stats` RPC | Count where `status='overdue' OR (status='sent' AND due_date < CURRENT_DATE)` | **YES** — catches overdue-by-date even if status not updated |
| **This Week (lessons)** | Direct query on `lessons` table | Count of non-cancelled lessons in Mon-Sun week (org-TZ-aware) | **YES** |
| **This Week (hours)** | Computed from lesson durations | `(end_at - start_at)` for non-cancelled lessons, rounded to 1dp | **YES** |
| **Total Lessons** | Direct query with `count: 'exact'` | All lessons for org (no status filter) | **MINOR** — includes cancelled lessons in "all time" count |
| **Teacher Today** | Teacher dashboard hook | Lessons for `myTeacherId` where `status='scheduled'` and today | **YES** — but only counts `scheduled`, not `completed` (see DR-M3) |
| **Teacher This Month** | Teacher dashboard hook | Lessons for `myTeacherId` where `status='completed'` in current month | **YES** |
| **Teacher My Students** | `student_teacher_assignments` | Count of assignments for teacher | **MINOR** — counts all assignments, not filtered by student `status='active'` (see DR-M4) |
| **Teacher Hours (Week)** | Teacher dashboard hook | All lessons (any status) in week, duration summed | **MINOR** — includes cancelled lessons in hours (see DR-M5) |

### Finance Dashboard Stats

| Stat | Source | Calculation | Correct? |
|------|--------|-------------|----------|
| Revenue (MTD) | Same `useDashboardStats` | Same as above | **YES** |
| Outstanding | Same `useDashboardStats` | Same as above | **YES** |
| Overdue | `overdueCount` from `get_invoice_stats` | Count of overdue invoices | **YES** |
| Total Lessons | Same `useDashboardStats` | All lessons count | **YES** |

---

## 3. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| **DR-H1** | **HIGH** | **get_revenue_report RPC uses `total_minor` instead of `paid_minor`** — The revenue report RPC sums `i.total_minor` for paid invoices. While `total_minor` represents the invoiced amount, if partial payments are recorded and the invoice is marked paid, `paid_minor` would more accurately reflect collected revenue. However, since status is already filtered to `'paid'`, `total_minor == paid_minor` should hold in most cases. **Real risk:** if an invoice is marked paid with a partial payment (e.g., admin override), revenue report will overstate. | `supabase/migrations/20260222215025_*.sql` line 30 | Change `SUM(i.total_minor)` to `SUM(i.paid_minor)` in `get_revenue_report` for both current and previous periods. |
| **DR-H2** | **HIGH** | **Ageing report ignores partial payments** — `useAgeingReport` fetches `total_minor` for outstanding invoices but does NOT subtract `paid_minor`. The `totalOutstanding` sum and per-invoice amounts use raw `total_minor`, overstating outstanding balances when partial payments exist. This contradicts the handoff fix applied to `get_invoice_stats`. | `src/hooks/useReports.ts` lines 160-220 | Fetch `paid_minor` alongside `total_minor`; use `(total_minor - paid_minor)` for outstanding calculations. Update bucket amounts and totals accordingly. |
| **DR-H3** | **HIGH** | **Payment Analytics outstanding also ignores partial payments** — `usePaymentAnalytics` calculates `outstandingMinor` as `total_minor - paid_minor` (correct), but the ageing report (DR-H2) does not — creating inconsistency between the two views. A user seeing the Payment Analytics "Outstanding" and the Outstanding Report "Total Outstanding" will see different numbers. | `src/hooks/usePaymentAnalytics.ts` line 89-91 vs `src/hooks/useReports.ts` line 216 | Fix DR-H2 to match PaymentAnalytics calculation. |
| **DR-M1** | **MEDIUM** | **Revenue MTD uses `issue_date` not payment date** — Dashboard stat "Revenue MTD" queries invoices where `issue_date` is in the current month and `status='paid'`. If an invoice was issued last month but paid this month, it won't appear in MTD. Conversely, if issued this month but paid next month (already marked paid), it appears in MTD of issue month. This may mislead about cash flow timing. | `src/hooks/useReports.ts` line 605-610 | Consider using `paid_at` from the payments table (or a `paid_date` on invoices) for cash-basis MTD. Alternatively, document this is accrual-basis. |
| **DR-M2** | **MEDIUM** | **Materialised view `invoice_stats_mv` is stale/orphaned** — The MV was created in migration `20260312000000` but `get_invoice_stats` was later replaced by the live-query version in `20260315220003`. The MV uses `status = 'outstanding'` which doesn't match the actual enum (`sent`/`overdue`). The MV is never referenced by any code. pg_cron schedule is commented out. | `supabase/migrations/20260312000000_*.sql` | Drop the unused materialised view and its index to avoid confusion and wasted storage. |
| **DR-M3** | **MEDIUM** | **Teacher "Today's Lessons" only counts `scheduled`** — The teacher dashboard hook filters `status='scheduled'` for today's lessons. Once a teacher completes a lesson (marking it `completed`), it disappears from their "today" count mid-day, which is confusing. The admin dashboard correctly uses `neq('status', 'cancelled')`. | `src/hooks/useTeacherDashboard.ts` line 81 | Change filter to `.neq('status', 'cancelled')` to match admin dashboard behaviour. |
| **DR-M4** | **MEDIUM** | **Teacher "My Students" count includes inactive/paused students** — `student_teacher_assignments` are counted without checking the student's `status`. Withdrawn or paused students still appear in the count. | `src/hooks/useTeacherDashboard.ts` line 87-89 | Join to students table and filter by `status = 'active'`. |
| **DR-M5** | **MEDIUM** | **Teacher "Hours (Week)" includes cancelled lessons** — The week lessons query has no status filter, so cancelled lessons contribute to the hours total. | `src/hooks/useTeacherDashboard.ts` lines 93-97 | Add `.neq('status', 'cancelled')` filter to weekly lessons query. |
| **DR-M6** | **MEDIUM** | **Dashboard date calculations not fully timezone-aware** — `useDashboardStats` uses `new Date()` and `format(today, 'yyyy-MM-dd')` before converting to org timezone. The `todayStr`, `monthStart`, `monthEnd` are computed in server/browser local time, not org timezone. While `todayStart`/`todayEnd` are then converted correctly, the month boundaries (`monthStart`/`monthEnd` for MTD) use local-TZ month start. If browser is in a different timezone than the org, MTD boundaries could be off by a day. | `src/hooks/useReports.ts` lines 558-565 | Use `toZonedTime(new Date(), orgTimezone)` before computing `todayStr`, `monthStart`, `monthEnd` to ensure all boundaries align with org timezone. |
| **DR-M7** | **MEDIUM** | **No auth check on `useDashboardStats` client query** — While `get_invoice_stats` RPC has an `is_org_staff` guard, the other dashboard queries (today's lessons, active students, MTD invoices, total lessons) rely solely on RLS. If RLS policies are misconfigured, these queries could leak cross-org data. The finance-sensitive data (invoices) is protected, but lesson/student counts could theoretically be visible. | `src/hooks/useReports.ts` lines 573-615 | Acceptable if RLS is verified correct on lessons, students, invoices tables. Recommend adding explicit `.eq('org_id', currentOrg.id)` on all queries (already present — confirmed). |
| **DR-L1** | **LOW** | **"Total Lessons" stat includes all statuses** — The "Total Lessons" stat card shows "All time" count but includes cancelled, draft, and scheduled lessons. It may be more useful to show only completed + scheduled. | `src/hooks/useReports.ts` line 613 | Consider adding `.neq('status', 'cancelled')` filter. |
| **DR-L2** | **LOW** | **InvoiceStatsWidget "Total" calculation** — `InvoiceStatsWidget` shows "Total" as `totalOutstanding + paid`. Since `totalOutstanding` already accounts for partial payments (from `get_invoice_stats`), but `paid_total` uses `total_minor` for paid invoices, the "Total" may not exactly equal sum of all invoice amounts. Minor discrepancy. | `src/components/invoices/InvoiceStatsWidget.tsx` line 30 | Use a dedicated `total_invoiced` field from the RPC rather than summing outstanding + paid. |
| **DR-L3** | **LOW** | **Payment Analytics chart tooltip has rounding artefact** — Chart data divides `amountMinor / 100` for display, then tooltip multiplies back `value * 100` to format. This round-trip could introduce floating point drift for very large amounts. | `src/components/dashboard/PaymentAnalyticsCard.tsx` lines 51-54, 110-113 | Keep data in minor units throughout and only format at display. |
| **DR-L4** | **LOW** | **CSV injection protection is good but quotes inconsistent** — `sanitiseCSVCell` prefixes formula chars with `'`, but some CSV export functions wrap in quotes while others don't. Consistent quoting would be safer. | `src/hooks/useReports.ts`, `src/hooks/useDataExport.ts` | Wrap all user-generated fields in double quotes consistently. |
| **DR-L5** | **LOW** | **Hardcoded `PoundSterling` icon** — The `PoundSterling` lucide icon is used for revenue/finance stats regardless of org currency. While the displayed value correctly uses org currency, the icon is always £. | `src/pages/Dashboard.tsx` line 33, `src/components/dashboard/FinanceDashboard.tsx` line 10 | Consider using a generic currency icon or mapping to org currency symbol. |
| **DR-L6** | **LOW** | **Reports page role filtering uses string comparison** — `report.roles.includes(currentRole)` works but `currentRole` type isn't validated against the allowed list. Parent role correctly gets no reports (redirected from dashboard). | `src/pages/Reports.tsx` line 185 | No action needed; works correctly. |
| **DR-L7** | **LOW** | **`useDataExport` invoice export doesn't include `paid_minor`** — The invoice CSV export includes `total_minor` but not `paid_minor` or `status`. Users can't see partial payment amounts from the export. (Status IS included actually — correction: it is included on line 149.) | `src/hooks/useDataExport.ts` | Add `paid_minor` to the invoice export select and CSV columns. |
| **DR-I1** | **INFO** | **Engagement metrics are per-lesson only** — `EngagementRating` is a 1-5 emoji rating per lesson note, set by the teacher. There are no aggregated engagement metrics (attendance rate, practice streaks, lesson frequency) on the dashboard. Practice streaks exist as a separate feature but are not surfaced on admin/teacher dashboards. | `src/components/calendar/EngagementRating.tsx` | Consider adding an engagement summary widget to the dashboard in a future iteration. |
| **DR-I2** | **INFO** | **No engagement metrics visible to parents on portal** — Portal home (`PortalHome.tsx`) shows upcoming lessons, invoices, and practice — but no engagement metrics. Handoff mentioned "engagement hidden from parents" — this is confirmed: no engagement score/rating is shown on the parent portal. | `src/pages/portal/PortalHome.tsx` | Confirmed as intended per handoff. |
| **DR-I3** | **INFO** | **No PDF export** — Reports support CSV export and browser print (via `window.print()`). There is no dedicated PDF generation. | All report pages | Browser print-to-PDF is adequate for now. |

---

## 4. Financial Accuracy Cross-Check

### Revenue MTD vs Revenue Report

| Source | What it measures | Basis |
|--------|-----------------|-------|
| Dashboard "Revenue MTD" | Sum of `paid_minor` for paid invoices with `issue_date` in current month | Accrual-ish (issue date, not payment date) |
| Revenue Report | Sum of `total_minor` for paid invoices with `issue_date` in range | **Uses `total_minor`** (see DR-H1) |
| Payment Analytics "Collected" | Sum of `amount_minor` from `payments` table in last 12 months | Cash basis (actual payments received) |

**Inconsistency:** Dashboard MTD uses `paid_minor`, Revenue Report RPC uses `total_minor`, Payment Analytics uses actual payment amounts. These three numbers WILL differ when partial payments exist. **DR-H1** addresses the Revenue Report side.

### Outstanding Consistency

| Source | Calculation | Consistent? |
|--------|------------|-------------|
| Dashboard "Outstanding" | `get_invoice_stats` → `total_minor - COALESCE(paid_minor, 0)` for sent/overdue | Correct |
| Outstanding (Ageing) Report | `total_minor` for sent/overdue — **NO paid_minor subtraction** | **INCORRECT** (DR-H2) |
| Payment Analytics "Outstanding" | `total_minor - paid_minor` for sent/overdue | Correct |
| InvoiceStatsWidget "Outstanding" | Uses `totalOutstanding` from `get_invoice_stats` | Correct |

**The Outstanding (Ageing) Report will show higher outstanding amounts than the dashboard and Payment Analytics when partial payments exist.** This is the most significant data consistency issue.

### Overdue Detection

`get_invoice_stats` catches invoices that are past due even if their `status` column hasn't been updated to `'overdue'`:
```sql
WHERE status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE)
```
This is a good defensive pattern. However, the Urgent Actions bar uses a different threshold — it checks for invoices overdue by more than 7 days:
```typescript
.lt('due_date', format(sevenDaysAgo, 'yyyy-MM-dd'))
```
This is intentional (grace period before surfacing as urgent) and not a bug.

---

## 5. RLS & Auth Assessment

### RPC Auth Checks

| RPC/Function | Auth Check | SECURITY DEFINER | Org-Scoped | Verdict |
|-------------|-----------|-----------------|------------|---------|
| `get_invoice_stats` | `is_org_staff(auth.uid(), _org_id)` | YES | YES | **PASS** |
| `get_revenue_report` | `is_org_finance_team(auth.uid(), _org_id)` | YES | YES | **PASS** |
| `get_unbilled_lesson_ids` | `is_org_finance_team(auth.uid(), _org_id)` | YES | YES | **PASS** |
| `delete_billing_run` | `is_org_admin(auth.uid(), _org_id)` | YES | YES | **PASS** |
| `get_teachers_with_pay` | (separate migration verified) | YES | YES | **PASS** |

### Dashboard Queries (non-RPC)

All direct Supabase queries in `useDashboardStats` include `.eq('org_id', currentOrg.id)`, so even without RLS, data is org-scoped. RLS provides defence-in-depth.

### Role-Based Dashboard Access

| Role | Dashboard View | Finance Data Visible | Reports Available | Correct? |
|------|---------------|---------------------|-------------------|----------|
| Owner/Admin | Full dashboard (solo or academy) | Revenue MTD, Outstanding, Payment Analytics | All reports | **YES** |
| Finance | `FinanceDashboard` (finance-only view) | Revenue MTD, Outstanding, Overdue count | Revenue, Outstanding, Payroll | **YES** |
| Teacher (academy) | `TeacherDashboard` (scoped to their data) | No financial data | Lessons Delivered, Payroll (own) | **YES** |
| Teacher (solo) | Full `SoloTeacherDashboard` | Revenue MTD, Outstanding | All reports | **YES** (they are the business owner) |
| Parent | Redirected to `/portal/home` | Own invoices only | None | **YES** |

### Cross-Org Security

- All RPCs check org membership via `is_org_staff` or `is_org_finance_team`.
- All client queries filter by `currentOrg.id`.
- RLS policies on `invoices`, `lessons`, `students` tables enforce org isolation.
- **No cross-org data leak vector identified.**

### Payment Analytics Visibility Control

The `PaymentAnalyticsCard` on the academy dashboard respects `currentOrg?.teacher_payment_analytics_enabled !== false` — teachers in academies only see payment analytics if the org setting permits it. Payment notification toasts similarly respect `teacher_payment_notifications_enabled`. **Both confirmed working.**

---

## 6. Timezone & Currency Assessment

### Timezone Handling

| Component | Timezone-Aware? | Method |
|-----------|----------------|--------|
| Dashboard "Today's Lessons" | YES | `fromZonedTime(new Date(todayStr + 'T00:00:00'), orgTimezone)` |
| Dashboard "This Week" | YES | Same conversion for week boundaries |
| Dashboard "Revenue MTD" | **PARTIAL** | Month boundaries computed in browser TZ before conversion (DR-M6) |
| Revenue Report | YES | Uses `toZonedTime` for month arithmetic in org TZ |
| Outstanding Report | YES | `toZonedTime(new Date(), orgTimezone)` for "today" reference |
| Lessons Delivered | YES | `fromZonedTime` for range start/end |
| Teacher Dashboard | YES | All boundaries computed with `fromZonedTime` |

### Currency Handling

| Component | Uses Org Currency? | Hardcoded Symbols? |
|-----------|-------------------|-------------------|
| Dashboard stats | YES — `currentOrg?.currency_code \|\| 'GBP'` | No (uses `Intl.NumberFormat`) |
| Revenue Report | YES — `formatCurrency(amount, currentOrg?.currency_code)` | No |
| Outstanding Report | YES — same pattern | No |
| Payment Analytics | YES — `formatCurrencyMinor` with org currency | No |
| CSV Exports | YES — `currencySymbol(currencyCode)` in headers | No |
| `PoundSterling` icon | **Cosmetic only** — icon name, not displayed text | Icon is always £ (DR-L5) |

**No hardcoded £ or $ in financial values.** Only the lucide icon name references "PoundSterling" which is cosmetic.

---

## 7. Export Assessment

| Report | CSV Export | Print | PDF | Role Gated |
|--------|----------|-------|-----|-----------|
| Revenue | YES (`exportRevenueToCSV`) | YES (`window.print()`) | No (print-to-PDF) | Owner/Admin/Finance only (page routing) |
| Outstanding | YES (`exportAgeingToCSV`) | YES | No | Owner/Admin/Finance only |
| Lessons Delivered | YES (`exportLessonsDeliveredToCSV`) | Not implemented | No | Owner/Admin/Teacher |
| Cancellations | YES (`exportCancellationToCSV`) | Not implemented | No | Owner/Admin |
| Payroll | YES (`exportPayrollToCSV`) | Not implemented | No | Owner/Admin/Finance/Teacher |
| Teacher Performance | YES (`exportTeacherPerformanceToCSV`) | Not implemented | No | Owner/Admin |
| Utilisation | YES (`exportUtilisationToCSV`) | Not implemented | No | Owner/Admin |
| Data Export (students) | YES | N/A | No | Uses RLS |
| Data Export (teachers) | YES | N/A | No | Uses RLS |
| Data Export (invoices) | YES | N/A | No | Uses RLS |

**CSV injection protection:** `sanitiseCSVCell` correctly prefixes formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote. UTF-8 BOM is included for Excel compatibility.

**Export respects role:** Reports are only accessible to authorised roles (page-level routing + feature gates). Exports are only shown when data is loaded, so the role check has already passed.

---

## 8. Realtime Invalidation Assessment

`useRealtimeInvoices` subscribes to 4 postgres_changes channels:

| Channel | Events | Invalidates |
|---------|--------|------------|
| `invoices` (org-filtered) | `*` | `invoice-stats`, `invoices`, `urgent-actions`, `dashboard-stats` |
| `payments` (org-filtered) | `*` | `invoice-stats`, `invoices`, `dashboard-stats` |
| `message_requests` (org-filtered) | `*` | `urgent-actions` |
| `payment_notifications` (org-filtered) | `INSERT` | `invoice-stats`, `invoices`, `dashboard-stats` + toast |

Additionally, `useRecordPayment` mutation invalidates `payment-analytics`, `teacher-dashboard-stats`, and `parent-summary` on success.

**Gap:** Payment analytics (`payment-analytics` query key) is NOT invalidated by the realtime channel — only by the `useRecordPayment` mutation. If a payment comes in via Stripe webhook (not through the UI), payment analytics won't update until the cache expires (`STALE_REPORT`). This is acceptable since payment analytics is a historical view with a long cache time.

---

## 9. Performance Assessment

| Concern | Assessment |
|---------|-----------|
| **N+1 queries** | `useDashboardStats` uses `Promise.all` to batch 6 queries — no N+1. Teacher dashboard uses `Promise.all` for 5 queries. Revenue report uses single RPC. |
| **Large dataset limits** | Reports have `limit(5000)` or `limit(10000)` with truncation warnings. Adequate for expected scale. |
| **Dashboard query count** | 6 parallel queries + `get_invoice_stats` RPC = 7 total on dashboard load. Acceptable. |
| **Caching** | Dashboard uses `STALE_REPORT` with `refetchInterval: STALE_STABLE`. Reports use `STALE_REPORT` + `GC_REPORT`. Appropriate. |
| **Ageing report** | Fetches up to 5000 invoices client-side and bucketing in JS. Could be slow for very large orgs. Consider server-side aggregation for scale. |

---

## 10. Summary of Critical Issues

### Must Fix Before Production

1. **DR-H2 (HIGH):** Ageing report ignores partial payments — outstanding amounts will be overstated. Direct contradiction of the handoff fix applied to `get_invoice_stats`.

2. **DR-H1 (HIGH):** Revenue report RPC uses `total_minor` instead of `paid_minor` — revenue could be overstated if invoices are marked paid with partial payments.

3. **DR-H3 (HIGH):** Inconsistency between Payment Analytics outstanding (correct) and Ageing Report outstanding (incorrect) will confuse users.

### Should Fix

4. **DR-M3:** Teacher today's count drops completed lessons mid-day.
5. **DR-M4:** Teacher student count includes inactive students.
6. **DR-M5:** Teacher weekly hours includes cancelled lessons.
7. **DR-M6:** Dashboard MTD month boundaries not fully timezone-aware.
8. **DR-M2:** Drop unused materialised view.

---

## 11. Verdict

### **NOT READY** — 3 HIGH severity findings

The handoff correctly fixed `get_invoice_stats` and dashboard Revenue MTD to use `paid_minor`, but the same fix was NOT consistently applied to:

1. The Outstanding (Ageing) Report — still uses raw `total_minor`
2. The Revenue Report RPC — still uses `total_minor` instead of `paid_minor`

These inconsistencies mean that **different reports will show different numbers for the same financial data**, which is unacceptable for a billing/invoicing product.

**After fixing DR-H1, DR-H2, and DR-H3, this feature will be production ready.** The remaining MEDIUM findings are quality-of-life improvements that should be addressed but are not blockers.

The auth/RLS posture is solid, timezone handling is mostly correct, currency handling is good, realtime invalidation is comprehensive, and CSV exports are properly sanitised.
