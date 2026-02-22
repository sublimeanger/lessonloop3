import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { activeStudentsQuery } from '@/lib/studentQuery';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, differenceInMonths, addMonths, parseISO, startOfWeek as getStartOfWeek } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { sanitiseCSVCell, currencySymbol } from '@/lib/utils';

// Helper: resolve teacher_id for the current user (returns null if not a teacher)
async function resolveTeacherId(orgId: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('teachers')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

// ==================== REVENUE REPORT ====================
export interface RevenueByMonth {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Jan 2026"
  paidAmount: number;
  invoiceCount: number;
  previousPaidAmount?: number;
}

export interface RevenueData {
  months: RevenueByMonth[];
  totalRevenue: number;
  averageMonthly: number;
  previousPeriodRevenue: number;
  growthPercent: number | null; // null if no previous data
}

export function useRevenueReport(startDate: string, endDate: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['revenue-report', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<RevenueData> => {
      if (!currentOrg) return { months: [], totalRevenue: 0, averageMonthly: 0, previousPeriodRevenue: 0, growthPercent: null };

      // issue_date is a DATE column (no time component), so the query
      // parameters don't need fromZonedTime conversion. However, we perform
      // all month arithmetic in the academy's timezone so that month
      // boundaries (e.g. start-of-month) align with the academy's local
      // calendar, avoiding BST edge-case drift.
      const orgTz = (currentOrg as any).timezone ?? 'Europe/London';

      // Parse dates into the academy's timezone for correct month arithmetic
      const startZoned = toZonedTime(parseISO(startDate), orgTz);
      const endZoned = toZonedTime(parseISO(endDate), orgTz);
      const durationMonths = differenceInMonths(endOfMonth(endZoned), startOfMonth(startZoned)) + 1;
      const prevStartDate = format(subMonths(startZoned, durationMonths), 'yyyy-MM-dd');
      const prevEndDate = format(subMonths(endZoned, durationMonths), 'yyyy-MM-dd');

      // Call server-side RPC for aggregated data
      const { data: rpcRows, error } = await supabase.rpc('get_revenue_report', {
        _org_id: currentOrg.id,
        _start_date: startDate,
        _end_date: endDate,
        _prev_start_date: prevStartDate,
        _prev_end_date: prevEndDate,
      });

      if (error) throw error;

      // Parse RPC results into maps
      const monthMap = new Map<string, { paidAmount: number; invoiceCount: number }>();
      const prevMonthMap = new Map<string, number>();

      for (const row of rpcRows || []) {
        if (row.period === 'current') {
          monthMap.set(row.month, {
            paidAmount: Number(row.paid_amount_minor) / 100,
            invoiceCount: Number(row.invoice_count),
          });
        } else {
          prevMonthMap.set(row.month, Number(row.paid_amount_minor) / 100);
        }
      }

      // Build continuous array of all months in range (in academy timezone)
      const months: RevenueByMonth[] = [];
      let cursor = startOfMonth(toZonedTime(parseISO(startDate), orgTz));
      const rangeEnd = startOfMonth(toZonedTime(parseISO(endDate), orgTz));
      let prevCursor = startOfMonth(toZonedTime(parseISO(prevStartDate), orgTz));

      while (cursor <= rangeEnd) {
        const key = format(cursor, 'yyyy-MM');
        const prevKey = format(prevCursor, 'yyyy-MM');
        const data = monthMap.get(key) || { paidAmount: 0, invoiceCount: 0 };
        months.push({
          month: key,
          monthLabel: format(cursor, 'MMM yyyy'),
          paidAmount: data.paidAmount,
          invoiceCount: data.invoiceCount,
          previousPaidAmount: prevMonthMap.get(prevKey) || 0,
        });
        cursor = addMonths(cursor, 1);
        prevCursor = addMonths(prevCursor, 1);
      }

      const totalRevenue = months.reduce((sum, m) => sum + m.paidAmount, 0);
      const averageMonthly = months.length > 0 ? totalRevenue / months.length : 0;
      const previousPeriodRevenue = Array.from(prevMonthMap.values()).reduce((sum, v) => sum + v, 0);
      const growthPercent = previousPeriodRevenue > 0
        ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : null;

      return { months, totalRevenue, averageMonthly, previousPeriodRevenue, growthPercent };
    },
    enabled: !!currentOrg && !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000, // 10 min — expensive aggregation
    gcTime: 15 * 60 * 1000,
  });
}

// ==================== OUTSTANDING AGEING REPORT ====================
export interface AgeingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  invoices: {
    id: string;
    invoiceNumber: string;
    payerName: string;
    dueDate: string;
    totalMinor: number;
    daysOverdue: number;
  }[];
  totalAmount: number;
  count: number;
}

export interface AgeingData {
  buckets: AgeingBucket[];
  totalOutstanding: number;
  totalOverdue: number;
  truncated: boolean;
}

export function useAgeingReport(issueDateFrom?: string, issueDateTo?: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['ageing-report', currentOrg?.id, issueDateFrom, issueDateTo],
    queryFn: async (): Promise<AgeingData> => {
      if (!currentOrg) {
        return { buckets: [], totalOutstanding: 0, totalOverdue: 0, truncated: false };
      }

      // Fetch outstanding invoices (sent or overdue)
      // issue_date is a DATE column — no timezone conversion needed for the query itself
      let query = supabase
        .from('invoices')
        .select(`
          id, invoice_number, due_date, total_minor, status,
          payer_guardian:guardians!invoices_payer_guardian_id_fkey(full_name),
          payer_student:students!invoices_payer_student_id_fkey(first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .in('status', ['sent', 'overdue']);

      if (issueDateFrom) query = query.gte('issue_date', issueDateFrom);
      if (issueDateTo) query = query.lte('issue_date', issueDateTo);

      const { data: invoices, error } = await query.limit(5000);

      if (error) throw error;

      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const today = toZonedTime(new Date(), orgTimezone);
      today.setHours(0, 0, 0, 0);

      // Define buckets
      const bucketDefs = [
        { label: 'Current (0-7 days)', minDays: 0, maxDays: 7 },
        { label: '8-14 days', minDays: 8, maxDays: 14 },
        { label: '15-30 days', minDays: 15, maxDays: 30 },
        { label: '30+ days', minDays: 31, maxDays: null },
      ];

      const buckets: AgeingBucket[] = bucketDefs.map((def) => ({
        ...def,
        invoices: [],
        totalAmount: 0,
        count: 0,
      }));

      let totalOutstanding = 0;
      let totalOverdue = 0;

      for (const inv of invoices || []) {
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.max(0, differenceInDays(today, dueDate));
        
        const payerName = inv.payer_guardian?.full_name 
          || (inv.payer_student ? `${inv.payer_student.first_name} ${inv.payer_student.last_name}` : 'Unknown');

        const invoiceData = {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          payerName,
          dueDate: inv.due_date,
          totalMinor: inv.total_minor,
          daysOverdue,
        };

        totalOutstanding += inv.total_minor / 100;
        if (daysOverdue > 0) {
          totalOverdue += inv.total_minor / 100;
        }

        // Find matching bucket
        for (const bucket of buckets) {
          const inRange = daysOverdue >= bucket.minDays && 
            (bucket.maxDays === null || daysOverdue <= bucket.maxDays);
          if (inRange) {
            bucket.invoices.push(invoiceData);
            bucket.totalAmount += inv.total_minor / 100;
            bucket.count += 1;
            break;
          }
        }
      }

      const truncated = (invoices || []).length >= 5000;
      return { buckets, totalOutstanding, totalOverdue, truncated };
    },
    enabled: !!currentOrg,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ==================== LESSONS DELIVERED REPORT ====================
export interface LessonsDeliveredTeacher {
  teacherId: string;
  teacherName: string;
  completedLessons: number;
  totalMinutes: number;
  cancelledLessons: number;
}

export interface LessonsDeliveredLocation {
  locationId: string | null;
  locationName: string;
  completedLessons: number;
  totalMinutes: number;
}

export interface LessonsDeliveredData {
  byTeacher: LessonsDeliveredTeacher[];
  byLocation: LessonsDeliveredLocation[];
  totalCompleted: number;
  totalCancelled: number;
  totalMinutes: number;
  warnings?: string[];
}

export function useLessonsDeliveredReport(startDate: string, endDate: string) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'finance';

  return useQuery({
    queryKey: ['lessons-delivered-report', currentOrg?.id, startDate, endDate, user?.id, isAdmin],
    queryFn: async (): Promise<LessonsDeliveredData> => {
      if (!currentOrg) {
        return { byTeacher: [], byLocation: [], totalCompleted: 0, totalCancelled: 0, totalMinutes: 0 };
      }

      // If teacher role, resolve their teacher_id first
      let teacherFilter: string | null = null;
      if (!isAdmin && user) {
        teacherFilter = await resolveTeacherId(currentOrg.id, user.id);
      }

      // Fetch lessons in date range with teacher_id (timezone-aware)
      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const rangeStart = fromZonedTime(new Date(`${startDate}T00:00:00`), orgTimezone).toISOString();
      const rangeEnd = fromZonedTime(new Date(`${endDate}T23:59:59`), orgTimezone).toISOString();

      let lessonsQuery = supabase
        .from('lessons')
        .select('id, teacher_id, location_id, start_at, end_at, status')
        .eq('org_id', currentOrg.id)
        .gte('start_at', rangeStart)
        .lte('start_at', rangeEnd);

      if (teacherFilter) {
        lessonsQuery = lessonsQuery.eq('teacher_id', teacherFilter);
      }

      const { data: lessons, error } = await lessonsQuery.limit(10000);

      const warnings: string[] = [];
      if ((lessons || []).length >= 10000) {
        warnings.push('Results may be incomplete — your date range contains more than 10,000 lessons. Try a shorter period.');
      }
      // Get unique teacher IDs
      const teacherIds = [...new Set((lessons || []).map(l => l.teacher_id).filter(Boolean) as string[])];
      const locationIds = [...new Set((lessons || []).filter(l => l.location_id).map(l => l.location_id!))];

      // Fetch teachers
      const { data: teachers } = teacherIds.length > 0
        ? await supabase
            .from('teachers')
            .select('id, display_name')
            .in('id', teacherIds)
        : { data: [] };

      // Fetch locations
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds);

      // Build maps
      const teacherNameMap = new Map<string, string>();
      for (const t of teachers || []) {
        teacherNameMap.set(t.id, t.display_name);
      }

      const locationNameMap = new Map<string, string>();
      for (const loc of locations || []) {
        locationNameMap.set(loc.id, loc.name);
      }

      // Aggregate by teacher
      const teacherMap = new Map<string, { completed: number; cancelled: number; minutes: number }>();
      const locationMap = new Map<string | null, { completed: number; minutes: number }>();

      let totalCompleted = 0;
      let totalCancelled = 0;
      let totalMinutes = 0;

      for (const lesson of lessons || []) {
        const start = new Date(lesson.start_at);
        const end = new Date(lesson.end_at);
        const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);

        const teacherKey = lesson.teacher_id || 'unassigned';
        
        // Teacher aggregation
        const teacherStats = teacherMap.get(teacherKey) || { completed: 0, cancelled: 0, minutes: 0 };
        if (lesson.status === 'completed') {
          teacherStats.completed += 1;
          teacherStats.minutes += durationMins;
          totalCompleted += 1;
          totalMinutes += durationMins;
        } else if (lesson.status === 'cancelled') {
          teacherStats.cancelled += 1;
          totalCancelled += 1;
        }
        teacherMap.set(teacherKey, teacherStats);

        // Location aggregation (only completed)
        if (lesson.status === 'completed') {
          const locKey = lesson.location_id;
          const locStats = locationMap.get(locKey) || { completed: 0, minutes: 0 };
          locStats.completed += 1;
          locStats.minutes += durationMins;
          locationMap.set(locKey, locStats);
        }
      }

      // Build result arrays
      const byTeacher: LessonsDeliveredTeacher[] = [];
      for (const [tid, stats] of teacherMap) {
        byTeacher.push({
          teacherId: tid,
          teacherName: teacherNameMap.get(tid) || 'Unknown',
          completedLessons: stats.completed,
          totalMinutes: stats.minutes,
          cancelledLessons: stats.cancelled,
        });
      }
      byTeacher.sort((a, b) => b.completedLessons - a.completedLessons);

      const byLocation: LessonsDeliveredLocation[] = [];
      for (const [locId, stats] of locationMap) {
        byLocation.push({
          locationId: locId,
          locationName: locId ? (locationNameMap.get(locId) || 'Unknown') : 'Online / Unassigned',
          completedLessons: stats.completed,
          totalMinutes: stats.minutes,
        });
      }
      byLocation.sort((a, b) => b.completedLessons - a.completedLessons);

      return { byTeacher, byLocation, totalCompleted, totalCancelled, totalMinutes, warnings };
    },
    enabled: !!currentOrg && !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ==================== CANCELLATION RATE REPORT ====================
export interface CancellationData {
  totalScheduled: number;
  totalCompleted: number;
  totalCancelled: number;
  cancellationRate: number;
  byReason: { reason: string; count: number }[];
  byTeacher: { teacherName: string; cancelled: number; total: number; rate: number }[];
  warnings?: string[];
}

export function useCancellationReport(startDate: string, endDate: string) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'finance';

  return useQuery({
    queryKey: ['cancellation-report', currentOrg?.id, startDate, endDate, user?.id, isAdmin],
    queryFn: async (): Promise<CancellationData> => {
      if (!currentOrg) {
        return { totalScheduled: 0, totalCompleted: 0, totalCancelled: 0, cancellationRate: 0, byReason: [], byTeacher: [] };
      }

      // If teacher role, resolve their teacher_id first
      let teacherFilter: string | null = null;
      if (!isAdmin && user) {
        teacherFilter = await resolveTeacherId(currentOrg.id, user.id);
      }

      // Fetch all lessons in date range with teacher_id (timezone-aware)
      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const rangeStart = fromZonedTime(new Date(`${startDate}T00:00:00`), orgTimezone).toISOString();
      const rangeEnd = fromZonedTime(new Date(`${endDate}T23:59:59`), orgTimezone).toISOString();

      let lessonsQuery = supabase
        .from('lessons')
        .select('id, teacher_id, status')
        .eq('org_id', currentOrg.id)
        .gte('start_at', rangeStart)
        .lte('start_at', rangeEnd);

      if (teacherFilter) {
        lessonsQuery = lessonsQuery.eq('teacher_id', teacherFilter);
      }

      const { data: lessons, error } = await lessonsQuery.limit(10000);

      const warnings: string[] = [];
      if ((lessons || []).length >= 10000) {
        warnings.push('Results may be incomplete — your date range contains more than 10,000 lessons. Try a shorter period.');
      }

      // Fetch attendance records for cancellation reasons
      const lessonIds = (lessons || []).filter(l => l.status === 'cancelled').map(l => l.id);
      const { data: attendance } = lessonIds.length > 0 
        ? await supabase
            .from('attendance_records')
            .select('lesson_id, attendance_status, cancellation_reason')
            .in('lesson_id', lessonIds)
            .limit(10000)
        : { data: [] };

      // Get teacher IDs
      const teacherIds = [...new Set((lessons || []).map(l => l.teacher_id).filter(Boolean) as string[])];
      
      // Fetch teachers
      const { data: teachers } = teacherIds.length > 0
        ? await supabase
            .from('teachers')
            .select('id, display_name')
            .in('id', teacherIds)
        : { data: [] };

      const teacherNameMap = new Map<string, string>();
      for (const t of teachers || []) {
        teacherNameMap.set(t.id, t.display_name);
      }

      // Calculate stats
      const totalScheduled = lessons?.length || 0;
      const totalCompleted = lessons?.filter(l => l.status === 'completed').length || 0;
      const totalCancelled = lessons?.filter(l => l.status === 'cancelled').length || 0;
      const cancellationRate = totalScheduled > 0 ? (totalCancelled / totalScheduled) * 100 : 0;

      // Group by reason
      const reasonMap = new Map<string, number>();
      for (const att of attendance || []) {
        if (att.attendance_status.includes('cancelled')) {
          const reason = att.cancellation_reason || att.attendance_status.replace('cancelled_by_', 'By ');
          reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
        }
      }
      const byReason = Array.from(reasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      // By teacher
      const teacherStatsMap = new Map<string, { cancelled: number; total: number }>();
      for (const lesson of lessons || []) {
        const teacherKey = lesson.teacher_id || 'unassigned';
        const stats = teacherStatsMap.get(teacherKey) || { cancelled: 0, total: 0 };
        stats.total += 1;
        if (lesson.status === 'cancelled') {
          stats.cancelled += 1;
        }
        teacherStatsMap.set(teacherKey, stats);
      }

      const byTeacher = Array.from(teacherStatsMap.entries())
        .map(([tid, stats]) => ({
          teacherName: teacherNameMap.get(tid) || 'Unknown',
          cancelled: stats.cancelled,
          total: stats.total,
          rate: stats.total > 0 ? (stats.cancelled / stats.total) * 100 : 0,
        }))
        .sort((a, b) => b.rate - a.rate);

      return { totalScheduled, totalCompleted, totalCancelled, cancellationRate, byReason, byTeacher, warnings };
    },
    enabled: !!currentOrg && !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ==================== DASHBOARD STATS ====================
export interface DashboardStats {
  todayLessons: number;
  activeStudents: number;
  outstandingAmount: number;
  overdueCount: number;
  hoursThisWeek: number;
  revenueMTD: number;
  lessonsThisWeek: number;
  totalLessons: number; // Total lessons ever scheduled
}

export function useDashboardStats() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['dashboard-stats', currentOrg?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!currentOrg) {
        return { todayLessons: 0, activeStudents: 0, outstandingAmount: 0, overdueCount: 0, hoursThisWeek: 0, revenueMTD: 0, lessonsThisWeek: 0, totalLessons: 0 };
      }

      const today = new Date();
      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const todayStr = format(today, 'yyyy-MM-dd');
      const mondayStart = getStartOfWeek(today, { weekStartsOn: 1 });
      const weekStartStr = format(mondayStart, 'yyyy-MM-dd');
      const weekEndStr = format(new Date(mondayStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // Timezone-aware date ranges
      const todayStart = fromZonedTime(new Date(`${todayStr}T00:00:00`), orgTimezone).toISOString();
      const todayEnd = fromZonedTime(new Date(`${todayStr}T23:59:59`), orgTimezone).toISOString();
      const weekStartISO = fromZonedTime(new Date(`${weekStartStr}T00:00:00`), orgTimezone).toISOString();
      const weekEndISO = fromZonedTime(new Date(`${weekEndStr}T23:59:59`), orgTimezone).toISOString();

      // Run all independent queries in parallel
      const [
        { data: todayLessonsData },
        { count: activeStudentsCount },
        { data: invoiceStatsRaw },
        { data: weekLessons },
        { data: mtdInvoices },
        { count: totalLessonsCount },
      ] = await Promise.all([
        supabase
          .from('lessons')
          .select('id')
          .eq('org_id', currentOrg.id)
          .gte('start_at', todayStart)
          .lte('start_at', todayEnd)
          .eq('status', 'scheduled'),
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id)
          .eq('status', 'active')
          .is('deleted_at', null),
        supabase.rpc('get_invoice_stats', { _org_id: currentOrg.id }),
        supabase
          .from('lessons')
          .select('start_at, end_at, status')
          .eq('org_id', currentOrg.id)
          .gte('start_at', weekStartISO)
          .lte('start_at', weekEndISO)
          .limit(5000),
        supabase
          .from('invoices')
          .select('total_minor')
          .eq('org_id', currentOrg.id)
          .eq('status', 'paid')
          .gte('issue_date', monthStart)
          .lte('issue_date', monthEnd)
          .limit(5000),
        supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id),
      ]);

      const invoiceStats = invoiceStatsRaw as {
        total_outstanding: number;
        overdue: number;
        paid_total: number;
      } | null;

      const todayLessons = todayLessonsData?.length || 0;
      const activeStudents = activeStudentsCount || 0;
      const outstandingAmount = (invoiceStats?.total_outstanding ?? 0) / 100;
      const overdueCount = invoiceStats?.overdue ?? 0;
      
      let hoursThisWeek = 0;
      let lessonsThisWeek = 0;
      for (const lesson of weekLessons || []) {
        if (lesson.status === 'cancelled') continue;
        lessonsThisWeek += 1;
        const start = new Date(lesson.start_at);
        const end = new Date(lesson.end_at);
        hoursThisWeek += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }

      const revenueMTD = (mtdInvoices || []).reduce((sum, inv) => sum + inv.total_minor, 0) / 100;

      return { 
        todayLessons, 
        activeStudents, 
        outstandingAmount, 
        overdueCount,
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        revenueMTD,
        lessonsThisWeek,
        totalLessons: totalLessonsCount || 0,
      };
    },
    enabled: !!currentOrg,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ==================== CSV EXPORT HELPERS ====================
export function exportRevenueToCSV(data: RevenueData, orgName: string, currencyCode = 'GBP'): void {
  const sym = currencySymbol(currencyCode);
  const rows = [`Month,Paid Amount (${sym}),Invoice Count`];
  for (const m of data.months) {
    rows.push(`${m.monthLabel},${m.paidAmount.toFixed(2)},${m.invoiceCount}`);
  }
  rows.push('');
  rows.push(`Total,${data.totalRevenue.toFixed(2)},`);
  rows.push(`Average Monthly,${data.averageMonthly.toFixed(2)},`);
  downloadCSV(rows.join('\n'), `revenue_${orgName}_report.csv`);
}

export function exportAgeingToCSV(data: AgeingData, orgName: string, currencyCode = 'GBP'): void {
  const sym = currencySymbol(currencyCode);
  const rows = [`Invoice Number,Payer,Due Date,Days Overdue,Amount (${sym}),Bucket`];
  for (const bucket of data.buckets) {
    for (const inv of bucket.invoices) {
      rows.push(`${inv.invoiceNumber},"${sanitiseCSVCell(inv.payerName)}",${inv.dueDate},${inv.daysOverdue},${(inv.totalMinor / 100).toFixed(2)},${bucket.label}`);
    }
  }
  rows.push('');
  rows.push(`Total Outstanding,,,,,${data.totalOutstanding.toFixed(2)}`);
  downloadCSV(rows.join('\n'), `outstanding_ageing_${orgName}_report.csv`);
}

export function exportLessonsDeliveredToCSV(data: LessonsDeliveredData, orgName: string): void {
  const rows = ['By Teacher'];
  rows.push('Teacher,Completed Lessons,Total Hours,Cancelled');
  for (const t of data.byTeacher) {
    rows.push(`"${sanitiseCSVCell(t.teacherName)}",${t.completedLessons},${(t.totalMinutes / 60).toFixed(1)},${t.cancelledLessons}`);
  }
  rows.push('');
  rows.push('By Location');
  rows.push('Location,Completed Lessons,Total Hours');
  for (const l of data.byLocation) {
    rows.push(`"${sanitiseCSVCell(l.locationName)}",${l.completedLessons},${(l.totalMinutes / 60).toFixed(1)}`);
  }
  downloadCSV(rows.join('\n'), `lessons_delivered_${orgName}_report.csv`);
}

export function exportCancellationToCSV(data: CancellationData, orgName: string): void {
  const rows = ['Summary'];
  rows.push(`Total Scheduled,${data.totalScheduled}`);
  rows.push(`Total Completed,${data.totalCompleted}`);
  rows.push(`Total Cancelled,${data.totalCancelled}`);
  rows.push(`Cancellation Rate,${data.cancellationRate.toFixed(1)}%`);
  rows.push('');
  rows.push('By Reason');
  rows.push('Reason,Count');
  for (const r of data.byReason) {
    rows.push(`"${sanitiseCSVCell(r.reason)}",${r.count}`);
  }
  rows.push('');
  rows.push('By Teacher');
  rows.push('Teacher,Cancelled,Total,Rate');
  for (const t of data.byTeacher) {
    rows.push(`"${sanitiseCSVCell(t.teacherName)}",${t.cancelled},${t.total},${t.rate.toFixed(1)}%`);
  }
  downloadCSV(rows.join('\n'), `cancellation_${orgName}_report.csv`);
}

export function exportUtilisationToCSV(rooms: { roomName: string; locationName: string; capacity: number | null; lessonCount: number; bookedMinutes: number; availableMinutes: number; utilisationPercent: number }[], orgName: string): void {
  const rows = ['Room Name,Location,Capacity,Lesson Count,Booked Hours,Available Hours,Utilisation %'];
  for (const r of rooms) {
    rows.push(`"${sanitiseCSVCell(r.roomName)}","${sanitiseCSVCell(r.locationName)}",${r.capacity ?? ''},${r.lessonCount},${(r.bookedMinutes / 60).toFixed(1)},${(r.availableMinutes / 60).toFixed(1)},${r.utilisationPercent.toFixed(1)}`);
  }
  downloadCSV(rows.join('\n'), `utilisation_${orgName}_report.csv`);
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
