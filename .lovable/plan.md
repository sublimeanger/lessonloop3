

# Attendance Report — Build Plan

## Summary
Add an Attendance report page with filters, summary cards, trend chart, sortable student table, and CSV export. Uses client-side queries against `attendance_records` joined with `lessons` and `students`.

## Files to Modify

### 1. `src/pages/Reports.tsx`
- Import `UserCheck` from lucide-react
- Add attendance entry after 'lessons' in the `reports` array

### 2. `src/config/routes.ts`
- Add lazy import: `const AttendanceReport = lazy(() => import('@/pages/reports/AttendanceReport'))`
- Add route after cancellations line (~146): `{ path: '/reports/attendance', component: AttendanceReport, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Attendance Report' }`

## Files to Create

### 3. `src/hooks/useAttendanceReport.ts`
Data hook using TanStack Query. Fetches from `attendance_records` table filtered by org + date range. Joins student names from `students` table and teacher info from `lessons`.

**Query approach** (no RPC — attendance_records has RLS):
- Fetch `attendance_records` where `org_id = orgId`, `recorded_at` in date range
- Fetch `lessons` for those lesson_ids to get teacher info
- Fetch `students` for those student_ids to get names
- Use `fetchAllPages` pattern for >1000 rows

**Client-side aggregation**:
- Per-student: total, present, absent, late, teacher_cancelled, student_cancelled counts, attendance rate %
- Summary: overall rates
- Trend: weekly/monthly buckets with rates over time

**Teacher filtering**: For teacher role, filter lessons by `teacher_user_id` = current user.

**CSV export**: `exportAttendanceToCSV()` following the `downloadCSV` pattern from useReports.ts.

### 4. `src/pages/reports/AttendanceReport.tsx`
Full report page matching existing report styling (same as Revenue/Cancellations pattern).

**Layout**:
- `AppLayout` + `PageHeader` with breadcrumbs + Print/Export CSV buttons
- `DateRangeFilter` (default last 30 days) with term presets
- Teacher filter dropdown (admin/owner only)
- Status filter: All / Present / Absent / Late / Cancelled

**Summary cards** (row of 4):
- Total Lessons | Attendance Rate % | Absence Rate % | Cancellation Rate %

**Chart** (recharts BarChart):
- Weekly/monthly buckets, attendance rate % and absence rate % as two bars
- Auto-selects weekly if range ≤ 90 days, monthly otherwise

**Table** (using `useSortableTable` + `SortableTableHead`):
- Columns: Student Name | Total | Present | Absent | Late | Teacher Cancelled | Student Cancelled | Rate %
- Teacher Name column for admin/owner
- Rows link to `/students/:id`
- `ReportPagination` for paging

**States**: Loading (`ReportSkeleton`), empty (`EmptyState`), error, data with fade transition during refetch.

## Technical Details

- Attendance rate = `present / (total - teacher_cancelled) * 100`
- Date range → UTC via `fromZonedTime` using org timezone
- Attendance status enum values: `present`, `absent`, `late`, `cancelled_by_teacher`, `cancelled_by_student`
- No database migration needed — all data queryable via existing tables with RLS

