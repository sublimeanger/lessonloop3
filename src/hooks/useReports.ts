import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { sanitiseCSVCell } from '@/lib/utils';

// ==================== REVENUE REPORT ====================
export interface RevenueByMonth {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Jan 2026"
  paidAmount: number;
  invoiceCount: number;
}

export interface RevenueData {
  months: RevenueByMonth[];
  totalRevenue: number;
  averageMonthly: number;
}

export function useRevenueReport(startDate: string, endDate: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['revenue-report', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<RevenueData> => {
      if (!currentOrg) return { months: [], totalRevenue: 0, averageMonthly: 0 };

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, total_minor, issue_date, status')
        .eq('org_id', currentOrg.id)
        .eq('status', 'paid')
        .gte('issue_date', startDate)
        .lte('issue_date', endDate);

      if (error) throw error;

      // Group by month
      const monthMap = new Map<string, { paidAmount: number; invoiceCount: number }>();
      
      for (const inv of invoices || []) {
        const monthKey = inv.issue_date.substring(0, 7); // YYYY-MM
        const existing = monthMap.get(monthKey) || { paidAmount: 0, invoiceCount: 0 };
        existing.paidAmount += inv.total_minor / 100;
        existing.invoiceCount += 1;
        monthMap.set(monthKey, existing);
      }

      // Build sorted array
      const months: RevenueByMonth[] = [];
      const sortedKeys = Array.from(monthMap.keys()).sort();
      
      for (const key of sortedKeys) {
        const data = monthMap.get(key)!;
        const date = new Date(key + '-01');
        months.push({
          month: key,
          monthLabel: format(date, 'MMM yyyy'),
          paidAmount: data.paidAmount,
          invoiceCount: data.invoiceCount,
        });
      }

      const totalRevenue = months.reduce((sum, m) => sum + m.paidAmount, 0);
      const averageMonthly = months.length > 0 ? totalRevenue / months.length : 0;

      return { months, totalRevenue, averageMonthly };
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
}

export function useAgeingReport() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['ageing-report', currentOrg?.id],
    queryFn: async (): Promise<AgeingData> => {
      if (!currentOrg) {
        return { buckets: [], totalOutstanding: 0, totalOverdue: 0 };
      }

      // Fetch outstanding invoices (sent or overdue)
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, due_date, total_minor, status,
          payer_guardian:guardians!invoices_payer_guardian_id_fkey(full_name),
          payer_student:students!invoices_payer_student_id_fkey(first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .in('status', ['sent', 'overdue']);

      if (error) throw error;

      const today = new Date();
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

      return { buckets, totalOutstanding, totalOverdue };
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
}

export function useLessonsDeliveredReport(startDate: string, endDate: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lessons-delivered-report', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<LessonsDeliveredData> => {
      if (!currentOrg) {
        return { byTeacher: [], byLocation: [], totalCompleted: 0, totalCancelled: 0, totalMinutes: 0 };
      }

      // Fetch lessons in date range with teacher_id
      const { data: lessons, error } = await supabase
        .from('lessons')
        .select('id, teacher_id, teacher_user_id, location_id, start_at, end_at, status')
        .eq('org_id', currentOrg.id)
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDate}T23:59:59`);

      if (error) throw error;

      // Get unique teacher IDs (prefer teacher_id, fallback to teacher_user_id for legacy)
      const teacherIds = [...new Set((lessons || []).map(l => l.teacher_id).filter(Boolean) as string[])];
      const legacyTeacherUserIds = [...new Set((lessons || []).filter(l => !l.teacher_id).map(l => l.teacher_user_id))];
      const locationIds = [...new Set((lessons || []).filter(l => l.location_id).map(l => l.location_id!))];

      // Fetch teachers from new table
      const { data: teachers } = teacherIds.length > 0
        ? await supabase
            .from('teachers')
            .select('id, display_name')
            .in('id', teacherIds)
        : { data: [] };

      // Fetch legacy teacher profiles for backward compatibility
      const { data: legacyProfiles } = legacyTeacherUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', legacyTeacherUserIds)
        : { data: [] };

      // Fetch locations
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds);

      // Build maps - map teacher_id to name
      const teacherNameMap = new Map<string, string>();
      for (const t of teachers || []) {
        teacherNameMap.set(t.id, t.display_name);
      }
      // Legacy fallback for teacher_user_id
      for (const p of legacyProfiles || []) {
        teacherNameMap.set(p.id, p.full_name || 'Unknown');
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

        // Use teacher_id if available, fallback to teacher_user_id for legacy data
        const teacherKey = lesson.teacher_id || lesson.teacher_user_id;
        
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

      return { byTeacher, byLocation, totalCompleted, totalCancelled, totalMinutes };
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
}

export function useCancellationReport(startDate: string, endDate: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['cancellation-report', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<CancellationData> => {
      if (!currentOrg) {
        return { totalScheduled: 0, totalCompleted: 0, totalCancelled: 0, cancellationRate: 0, byReason: [], byTeacher: [] };
      }

      // Fetch all lessons in date range with teacher_id
      const { data: lessons, error } = await supabase
        .from('lessons')
        .select('id, teacher_id, teacher_user_id, status')
        .eq('org_id', currentOrg.id)
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDate}T23:59:59`);

      if (error) throw error;

      // Fetch attendance records for cancellation reasons
      const lessonIds = (lessons || []).filter(l => l.status === 'cancelled').map(l => l.id);
      const { data: attendance } = lessonIds.length > 0 
        ? await supabase
            .from('attendance_records')
            .select('lesson_id, attendance_status, cancellation_reason')
            .in('lesson_id', lessonIds)
        : { data: [] };

      // Get teacher IDs (prefer teacher_id, fallback to teacher_user_id for legacy)
      const teacherIds = [...new Set((lessons || []).map(l => l.teacher_id).filter(Boolean) as string[])];
      const legacyTeacherUserIds = [...new Set((lessons || []).filter(l => !l.teacher_id).map(l => l.teacher_user_id))];
      
      // Fetch teachers from new table
      const { data: teachers } = teacherIds.length > 0
        ? await supabase
            .from('teachers')
            .select('id, display_name')
            .in('id', teacherIds)
        : { data: [] };

      // Fetch legacy profiles for backward compatibility  
      const { data: legacyProfiles } = legacyTeacherUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', legacyTeacherUserIds)
        : { data: [] };

      const teacherNameMap = new Map<string, string>();
      for (const t of teachers || []) {
        teacherNameMap.set(t.id, t.display_name);
      }
      for (const p of legacyProfiles || []) {
        teacherNameMap.set(p.id, p.full_name || 'Unknown');
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

      // By teacher - use teacher_id if available, fallback to teacher_user_id
      const teacherStatsMap = new Map<string, { cancelled: number; total: number }>();
      for (const lesson of lessons || []) {
        const teacherKey = lesson.teacher_id || lesson.teacher_user_id;
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

      return { totalScheduled, totalCompleted, totalCancelled, cancellationRate, byReason, byTeacher };
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
        return { todayLessons: 0, activeStudents: 0, outstandingAmount: 0, hoursThisWeek: 0, revenueMTD: 0, lessonsThisWeek: 0, totalLessons: 0 };
      }

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
      const weekStartStr = format(startOfWeek, 'yyyy-MM-dd');
      const weekEndStr = format(new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // Today's lessons
      const { data: todayLessonsData } = await supabase
        .from('lessons')
        .select('id')
        .eq('org_id', currentOrg.id)
        .gte('start_at', `${todayStr}T00:00:00`)
        .lte('start_at', `${todayStr}T23:59:59`)
        .eq('status', 'scheduled');

      // Active students
      const { data: studentsData } = await supabase
        .from('students')
        .select('id')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active');

      // Outstanding invoices
      const { data: outstandingData } = await supabase
        .from('invoices')
        .select('total_minor')
        .eq('org_id', currentOrg.id)
        .in('status', ['sent', 'overdue']);

      // Hours this week (completed lessons)
      const { data: weekLessons } = await supabase
        .from('lessons')
        .select('start_at, end_at, status')
        .eq('org_id', currentOrg.id)
        .gte('start_at', `${weekStartStr}T00:00:00`)
        .lte('start_at', `${weekEndStr}T23:59:59`);

      // Revenue MTD
      const { data: mtdInvoices } = await supabase
        .from('invoices')
        .select('total_minor')
        .eq('org_id', currentOrg.id)
        .eq('status', 'paid')
        .gte('issue_date', monthStart)
        .lte('issue_date', monthEnd);

      // Total lessons ever (for new user detection)
      const { count: totalLessonsCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id);

      const todayLessons = todayLessonsData?.length || 0;
      const activeStudents = studentsData?.length || 0;
      const outstandingAmount = (outstandingData || []).reduce((sum, inv) => sum + inv.total_minor, 0) / 100;
      
      let hoursThisWeek = 0;
      let lessonsThisWeek = 0;
      for (const lesson of weekLessons || []) {
        lessonsThisWeek += 1;
        if (lesson.status === 'completed') {
          const start = new Date(lesson.start_at);
          const end = new Date(lesson.end_at);
          hoursThisWeek += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      }

      const revenueMTD = (mtdInvoices || []).reduce((sum, inv) => sum + inv.total_minor, 0) / 100;

      return { 
        todayLessons, 
        activeStudents, 
        outstandingAmount, 
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        revenueMTD,
        lessonsThisWeek,
        totalLessons: totalLessonsCount || 0,
      };
    },
    enabled: !!currentOrg,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ==================== CSV EXPORT HELPERS ====================
export function exportRevenueToCSV(data: RevenueData, orgName: string): void {
  const rows = ['Month,Paid Amount (£),Invoice Count'];
  for (const m of data.months) {
    rows.push(`${m.monthLabel},${m.paidAmount.toFixed(2)},${m.invoiceCount}`);
  }
  rows.push('');
  rows.push(`Total,${data.totalRevenue.toFixed(2)},`);
  rows.push(`Average Monthly,${data.averageMonthly.toFixed(2)},`);
  downloadCSV(rows.join('\n'), `revenue_${orgName}_report.csv`);
}

export function exportAgeingToCSV(data: AgeingData, orgName: string): void {
  const rows = ['Invoice Number,Payer,Due Date,Days Overdue,Amount (£),Bucket'];
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

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
