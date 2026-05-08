# Audit Report — Feature 26: Payroll

**Date:** 2026-03-16
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Payroll view, open slot filtering, pay rate management, payroll period selection, payroll reports/export

---

## 1. Files Audited

| File | Purpose |
|------|---------|
| `src/hooks/usePayroll.ts` (295 lines) | Core payroll calculation hook + CSV export |
| `src/pages/reports/Payroll.tsx` (330 lines) | Payroll report UI page |
| `src/hooks/useTeachers.ts` | Teacher data model with pay fields |
| `src/config/routes.ts:141` | Route guard: `allowedRoles: ['owner', 'admin', 'teacher', 'finance']` |
| `src/hooks/useFeatureGate.ts:36` | Feature gate: `payroll_reports: ['academy', 'agency', 'custom']` |
| `src/pages/Reports.tsx:70` | Reports hub: payroll requires `payroll_reports` feature |
| `src/components/teachers/TeacherQuickView.tsx:207-214` | Pay rate display in teacher quick view |
| `src/lib/utils.ts:61-72` | `formatCurrency()` — used for payroll display |
| `src/lib/utils.ts:96-101` | `sanitiseCSVCell()` — CSV injection protection |
| `supabase/migrations/20260120001129_...` | `pay_rate_type` enum, teacher profile extensions |
| `supabase/migrations/20260130162532_...` | `teachers` table with pay_rate fields, `teachers_with_pay` view |
| `supabase/migrations/20260130162543_...` | `teachers_with_pay` view with `security_invoker`, CASE masking |
| `supabase/migrations/20260207194811_...` | Drop parent RLS on teachers, create `teacher_profiles_public` |
| `supabase/migrations/20260314120000_...` | `get_teachers_with_pay()` RPC (SECURITY DEFINER) |
| `supabase/migrations/20260305173228_...` | `is_open_slot` column + index on lessons |
| `supabase/migrations/20260315100200_...` | `clear_open_slot_on_participant` trigger |
| `supabase/migrations/20260315230000_...` | `prevent_past_open_slot` trigger |

---

## 2. Payroll Calculation Assessment

### Architecture
- **Calculation location:** Client-side (in `usePayroll.ts` hook via TanStack Query)
- **No server-side RPC** for payroll calculation — all logic runs in the browser
- **Pay rate storage:** `teachers` table columns `pay_rate_type` (enum: `per_lesson`, `hourly`, `percentage`) and `pay_rate_value` (numeric 10,2)
- **Pay rate access:** Secure RPC `get_teachers_with_pay()` with SECURITY DEFINER and explicit role check

### Pay Rate Types

| Type | Calculation | Correct? |
|------|------------|----------|
| `per_lesson` | `payRateValue` (flat amount per lesson) | Yes |
| `hourly` | `(durationMins / 60) * payRateValue` | Yes — handles partial hours correctly |
| `percentage` | `(payRateValue / 100) * (invoiceRevenue / 100)` | Yes — uses invoice_items.amount_minor |

### What Counts for Payroll
- **Only `status = 'completed'` lessons** — correct, excludes scheduled/cancelled/no-show
- **Open slots excluded** via `.or('is_open_slot.is.null,is_open_slot.eq.false')` — correct
- **Group lessons:** Teacher paid once per lesson (query is on `lessons` table, not `lesson_participants`) — correct
- **Duration:** Calculated from `start_at` / `end_at` timestamps — handles any duration including partial hours
- **Date range:** Timezone-aware using `fromZonedTime()` with org timezone — correct

### Currency Handling
- **Display:** Uses `formatCurrency()` with org `currency_code` — correct, not hardcoded
- **Pay rate value:** Stored as major units (numeric 10,2), divided by 100 in hook line 157: `(Number(teacherData?.pay_rate_value) || 0) / 100` — see finding PAY-01
- **CSV export:** Uses `currencySymbol()` — correct

### Period Selection
- **Default:** Previous calendar month (via `subMonths()`)
- **Custom range:** `DateRangeFilter` component with term presets — good UX
- **Term support:** Terms data passed to date filter for quick selection

---

## 3. Findings

| ID | Severity | Area | Finding | Detail |
|----|----------|------|---------|--------|
| PAY-01 | **CRITICAL** | Calculation | `pay_rate_value` divided by 100 incorrectly | DB stores `numeric(10,2)` as major units (e.g. `25.00` for £25). Hook line 157 does `/ 100`, converting £25 to £0.25. This means **all payroll calculations are off by 100x**. The RPC returns raw DB value; the hook should NOT divide by 100. |
| PAY-02 | **HIGH** | Security | Teacher role can access payroll route but RPC denies pay data | Route allows `teacher` role (routes.ts:141). RPC `get_teachers_with_pay` only allows owner/admin/finance. When teacher accesses payroll, RPC fails, fallback query returns teachers without pay rates — all calculations show £0. Teacher sees a broken/useless report. |
| PAY-03 | **HIGH** | Security | `teachers_with_pay` view inconsistency with RPC | View uses `is_org_admin()` which checks `owner/admin` only. RPC checks `owner/admin/finance`. Finance users can access pay data via RPC but NOT via the view. The view is not used by payroll code (RPC is used), but any other code using the view would deny finance access. |
| PAY-04 | **MEDIUM** | UI | Hardcoded `£` in warning message | `Payroll.tsx:310`: `£0 — no invoice linked yet` should use `fmtCurrency(0)` or the org currency symbol. Breaks for non-GBP orgs. |
| PAY-05 | **MEDIUM** | Calculation | Invoice revenue lookup unbounded | `usePayroll.ts:86`: `invoice_items` query uses `.in('linked_lesson_id', lessonIds)` — if a period has >1000 lessons, this could hit Supabase's PostgREST `in()` limit. Should batch or use a join-based RPC. |
| PAY-06 | **MEDIUM** | Security | CSV export not role-restricted separately | `exportPayrollToCSV()` is a pure client function triggered by button click. If a teacher reaches the payroll page (allowed by route), the export button renders even if data is £0/broken. Should hide export for non-admin roles or gate behind pay data availability. |
| PAY-07 | **LOW** | Calculation | Duplicate error check | `usePayroll.ts:97`: `if (lessonsError) throw lessonsError;` is checked twice (first at line 76). Dead code — `lessonsError` was already thrown. |
| PAY-08 | **LOW** | Architecture | Client-side calculation risk | All payroll math runs in browser. While functional, any pay rate or lesson data manipulation via browser devtools could alter displayed values. Not exploitable (display-only, no write-back), but a server-side calculation RPC would be more auditable for real payroll. |
| PAY-09 | **LOW** | UI | Payroll.tsx `isAdmin` excludes finance | `Payroll.tsx:29`: `isAdmin = currentRole === 'owner' || currentRole === 'admin'` — does NOT include `finance`. Finance users see "View your payroll summary" instead of "Calculate gross pay for all teachers". Cosmetic only — finance still gets full data via RPC. |
| PAY-10 | **LOW** | Export | CSV formula injection protection present | `sanitiseCSVCell()` correctly prefixes cells starting with `=`, `+`, `-`, `@` with `'`. BOM included for Excel. Good. |
| PAY-11 | **INFO** | Feature Gate | Solo teacher plan excluded | `payroll_reports` gated to `academy/agency/custom` — solo teachers cannot access. Correct, since solo teachers have no employees to pay. Trial plan also excluded. |

---

## 4. Verdict

### PRODUCTION READY

All findings resolved. Typecheck and build pass.

### Fixes Applied

| ID | Fix | Commit |
|----|-----|--------|
| PAY-01 | Removed erroneous `/ 100` on `pay_rate_value` at `usePayroll.ts:157`. DB stores major units; no conversion needed. | fix(payroll) |
| PAY-02 | Updated `get_teachers_with_pay` RPC to allow teacher role (returns only their own record via `user_id` match). Migration `20260316330000`. | fix(payroll) |
| PAY-03 | Already resolved — `teachers_with_pay` view was dropped in migration `20260315220010` (TCH-07). RPC is the canonical access path and includes finance. | Prior commit |
| PAY-04 | Replaced hardcoded `£0` with `fmtCurrency(0)` at `Payroll.tsx:310`. | fix(payroll) |
| PAY-05 | Added chunked batching (500) for `invoice_items` `.in()` query to stay within PostgREST limits. | fix(payroll) |
| PAY-06 | Resolved by PAY-02 — teachers now get valid data from RPC, so the existing `data.teachers.length > 0` guard on export is sufficient. | fix(payroll) |
| PAY-07 | Removed duplicate `if (lessonsError) throw lessonsError` at line 97. | fix(payroll) |
| PAY-09 | Updated `isAdmin` in `Payroll.tsx:29` to include `finance` role. | fix(payroll) |

### Remaining Acceptable Items

- **PAY-08 (LOW):** Client-side calculation is display-only with no write-back — acceptable for MVP.
- **PAY-10 (INFO):** CSV injection protection verified solid.
- **PAY-11 (INFO):** Feature gating correctly excludes solo/trial plans.
