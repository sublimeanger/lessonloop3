import { useQuery } from '@tanstack/react-query';
import { STALE_REPORT, GC_REPORT } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { fromZonedTime } from 'date-fns-tz';
import { sanitiseCSVCell, currencySymbol } from '@/lib/utils';

// ==================== TYPES ====================

export interface TeacherPerformance {
  teacher_id: string;
  teacher_name: string;
  total_lessons: number;
  completed_lessons: number;
  cancelled_lessons: number;
  cancellation_rate: number;
  total_hours: number;
  active_student_count: number;
  retention_rate: number;
  revenue_generated: number;
  revenue_per_hour: number;
  // Benchmark deltas (positive = above avg for rates, negative = below)
  cancellation_rate_vs_avg: number;
  retention_rate_vs_avg: number;
  revenue_per_hour_vs_avg: number;
}

export interface TeacherPerformanceData {
  teachers: TeacherPerformance[];
  orgAvgCancellationRate: number;
  orgAvgRetentionRate: number;
  totalRevenue: number;
  totalTeachers: number;
  warnings?: string[];
}

// ==================== HOOK ====================

export function useTeacherPerformanceReport(startDate: string, endDate: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['teacher-performance-report', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<TeacherPerformanceData> => {
      if (!currentOrg) {
        return { teachers: [], orgAvgCancellationRate: 0, orgAvgRetentionRate: 0, totalRevenue: 0, totalTeachers: 0 };
      }

      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const rangeStart = fromZonedTime(new Date(`${startDate}T00:00:00`), orgTimezone).toISOString();
      const rangeEnd = fromZonedTime(new Date(`${endDate}T23:59:59`), orgTimezone).toISOString();

      // 1. Fetch lessons in date range
      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, teacher_id, status, start_at, end_at')
        .eq('org_id', currentOrg.id)
        .gte('start_at', rangeStart)
        .lte('start_at', rangeEnd)
        .limit(10000);

      if (lessonsError) throw lessonsError;

      const warnings: string[] = [];
      if ((lessons || []).length >= 10000) {
        warnings.push('Results may be incomplete — your date range contains more than 10,000 lessons. Try a shorter period.');
      }

      // Get unique teacher IDs from lessons
      const teacherIds = [...new Set((lessons || []).map(l => l.teacher_id).filter(Boolean) as string[])];

      if (teacherIds.length === 0) {
        return { teachers: [], orgAvgCancellationRate: 0, orgAvgRetentionRate: 0, totalRevenue: 0, totalTeachers: 0, warnings };
      }

      // 2. Fetch teacher display names
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, display_name')
        .in('id', teacherIds);

      const teacherNameMap = new Map<string, string>();
      for (const t of teachers || []) {
        teacherNameMap.set(t.id, t.display_name);
      }

      // 3. Aggregate lessons by teacher
      const teacherLessonMap = new Map<string, {
        total: number;
        completed: number;
        cancelled: number;
        totalMinutes: number;
        lessonIds: string[];
      }>();

      for (const lesson of lessons || []) {
        if (!lesson.teacher_id) continue;
        const stats = teacherLessonMap.get(lesson.teacher_id) || {
          total: 0, completed: 0, cancelled: 0, totalMinutes: 0, lessonIds: [],
        };
        stats.total += 1;
        stats.lessonIds.push(lesson.id);

        if (lesson.status === 'completed') {
          stats.completed += 1;
          const start = new Date(lesson.start_at);
          const end = new Date(lesson.end_at);
          stats.totalMinutes += Math.round((end.getTime() - start.getTime()) / 60000);
        } else if (lesson.status === 'cancelled') {
          stats.cancelled += 1;
        }

        teacherLessonMap.set(lesson.teacher_id, stats);
      }

      // 4. Fetch student-teacher assignments for active student counts & retention
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, teacher_id')
        .eq('org_id', currentOrg.id)
        .in('teacher_id', teacherIds);

      // 5. Fetch student statuses for retention calculation
      const assignedStudentIds = [...new Set((assignments || []).map(a => a.student_id))];
      const { data: students } = assignedStudentIds.length > 0
        ? await supabase
            .from('students')
            .select('id, status')
            .in('id', assignedStudentIds)
        : { data: [] };

      const studentStatusMap = new Map<string, string>();
      for (const s of students || []) {
        studentStatusMap.set(s.id, s.status);
      }

      // Build per-teacher student data
      const teacherStudentMap = new Map<string, { total: number; active: number }>();
      for (const a of assignments || []) {
        if (!a.teacher_id) continue;
        const stats = teacherStudentMap.get(a.teacher_id) || { total: 0, active: 0 };
        stats.total += 1;
        const status = studentStatusMap.get(a.student_id);
        if (status === 'active') {
          stats.active += 1;
        }
        teacherStudentMap.set(a.teacher_id, stats);
      }

      // 6. Fetch invoice_items linked to lessons in range for revenue per teacher
      const allLessonIds = (lessons || []).map(l => l.id);

      // Batch lesson ID queries in chunks of 500 to stay within query limits
      const CHUNK_SIZE = 500;
      const invoiceItems: { linked_lesson_id: string | null; amount_minor: number }[] = [];

      for (let i = 0; i < allLessonIds.length; i += CHUNK_SIZE) {
        const chunk = allLessonIds.slice(i, i + CHUNK_SIZE);
        const { data: items } = await supabase
          .from('invoice_items')
          .select('linked_lesson_id, amount_minor')
          .eq('org_id', currentOrg.id)
          .in('linked_lesson_id', chunk);
        if (items) invoiceItems.push(...items);
      }

      // Build lesson->teacher lookup
      const lessonTeacherMap = new Map<string, string>();
      for (const lesson of lessons || []) {
        if (lesson.teacher_id) {
          lessonTeacherMap.set(lesson.id, lesson.teacher_id);
        }
      }

      // Aggregate revenue per teacher
      const teacherRevenueMap = new Map<string, number>();
      for (const item of invoiceItems) {
        if (!item.linked_lesson_id) continue;
        const teacherId = lessonTeacherMap.get(item.linked_lesson_id);
        if (!teacherId) continue;
        teacherRevenueMap.set(teacherId, (teacherRevenueMap.get(teacherId) || 0) + item.amount_minor);
      }

      // 7. Build per-teacher performance
      const teacherPerformances: TeacherPerformance[] = [];
      let totalOrgRevenue = 0;

      for (const tid of teacherIds) {
        const lessonStats = teacherLessonMap.get(tid);
        if (!lessonStats || lessonStats.total === 0) continue;

        const studentStats = teacherStudentMap.get(tid) || { total: 0, active: 0 };
        const revenueMinor = teacherRevenueMap.get(tid) || 0;
        const totalHours = lessonStats.totalMinutes / 60;
        const cancellationRate = lessonStats.total > 0 ? (lessonStats.cancelled / lessonStats.total) * 100 : 0;
        const retentionRate = studentStats.total > 0 ? (studentStats.active / studentStats.total) * 100 : 0;
        const revenueGenerated = revenueMinor / 100;
        const revenuePerHour = totalHours > 0 ? revenueGenerated / totalHours : 0;

        totalOrgRevenue += revenueGenerated;

        teacherPerformances.push({
          teacher_id: tid,
          teacher_name: teacherNameMap.get(tid) || 'Unknown',
          total_lessons: lessonStats.total,
          completed_lessons: lessonStats.completed,
          cancelled_lessons: lessonStats.cancelled,
          cancellation_rate: cancellationRate,
          total_hours: Math.round(totalHours * 10) / 10,
          active_student_count: studentStats.active,
          retention_rate: retentionRate,
          revenue_generated: revenueGenerated,
          revenue_per_hour: Math.round(revenuePerHour * 100) / 100,
          // Placeholders — will be filled after org averages are computed
          cancellation_rate_vs_avg: 0,
          retention_rate_vs_avg: 0,
          revenue_per_hour_vs_avg: 0,
        });
      }

      // 8. Compute org averages
      const totalTeachers = teacherPerformances.length;

      const orgAvgCancellationRate = totalTeachers > 0
        ? teacherPerformances.reduce((sum, t) => sum + t.cancellation_rate, 0) / totalTeachers
        : 0;

      const orgAvgRetentionRate = totalTeachers > 0
        ? teacherPerformances.reduce((sum, t) => sum + t.retention_rate, 0) / totalTeachers
        : 0;

      const orgAvgRevenuePerHour = totalTeachers > 0
        ? teacherPerformances.reduce((sum, t) => sum + t.revenue_per_hour, 0) / totalTeachers
        : 0;

      // 9. Fill benchmark deltas
      for (const tp of teacherPerformances) {
        tp.cancellation_rate_vs_avg = tp.cancellation_rate - orgAvgCancellationRate;
        tp.retention_rate_vs_avg = tp.retention_rate - orgAvgRetentionRate;
        tp.revenue_per_hour_vs_avg = tp.revenue_per_hour - orgAvgRevenuePerHour;
      }

      return {
        teachers: teacherPerformances,
        orgAvgCancellationRate,
        orgAvgRetentionRate,
        totalRevenue: totalOrgRevenue,
        totalTeachers,
        warnings,
      };
    },
    enabled: !!currentOrg && !!startDate && !!endDate,
    staleTime: STALE_REPORT,
    gcTime: GC_REPORT,
  });
}

// ==================== CSV EXPORT ====================

export function exportTeacherPerformanceToCSV(
  data: TeacherPerformanceData,
  orgName: string,
  currencyCode = 'GBP',
): void {
  const sym = currencySymbol(currencyCode);
  const rows = [`Teacher,Lessons,Hours,Cancellation Rate,Students,Retention Rate,Revenue (${sym}),Revenue/hr (${sym})`];

  for (const t of data.teachers) {
    rows.push(
      `"${sanitiseCSVCell(t.teacher_name)}",${t.total_lessons},${t.total_hours.toFixed(1)},${t.cancellation_rate.toFixed(1)}%,${t.active_student_count},${t.retention_rate.toFixed(1)}%,${t.revenue_generated.toFixed(2)},${t.revenue_per_hour.toFixed(2)}`
    );
  }

  rows.push('');
  rows.push('Summary');
  rows.push(`Total Teachers,${data.totalTeachers}`);
  rows.push(`Org Avg Cancellation Rate,${data.orgAvgCancellationRate.toFixed(1)}%`);
  rows.push(`Org Avg Retention Rate,${data.orgAvgRetentionRate.toFixed(1)}%`);
  rows.push(`Total Revenue (${sym}),${data.totalRevenue.toFixed(2)}`);

  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `teacher_performance_${orgName}_report.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
