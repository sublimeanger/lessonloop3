import { useQuery } from '@tanstack/react-query';
import { STALE_REPORT, GC_REPORT } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { fromZonedTime } from 'date-fns-tz';
import { startOfWeek, format, differenceInDays, parseISO } from 'date-fns';
import { sanitiseCSVCell } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────

export interface AttendanceStudentRow {
  studentId: string;
  studentName: string;
  teacherName: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  teacherCancelled: number;
  studentCancelled: number;
  attendanceRate: number; // 0–100
}

export interface AttendanceSummary {
  totalRecords: number;
  attendanceRate: number;
  absenceRate: number;
  cancellationRate: number;
}

export interface AttendanceTrendBucket {
  bucketLabel: string;
  bucketStart: string;
  total: number;
  present: number;
  attendanceRate: number;
  absenceRate: number;
}

export interface AttendanceReportData {
  students: AttendanceStudentRow[];
  summary: AttendanceSummary;
  trend: AttendanceTrendBucket[];
}

// ─── Pagination helper ───────────────────────────────────

const PAGE_SIZE = 1000;
const SAFETY_CAP = 10000;

async function fetchAllPages<T>(queryBuilder: any): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (offset < SAFETY_CAP) {
    const { data, error } = await queryBuilder.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

// ─── Resolve teacher_id ──────────────────────────────────

async function resolveTeacherId(orgId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('teachers')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// ─── Hook ────────────────────────────────────────────────

export function useAttendanceReport(
  startDate: string,
  endDate: string,
  teacherFilter?: string | null,
  statusFilter?: string | null,
) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const tz = currentOrg?.timezone || 'Europe/London';

  return useQuery<AttendanceReportData>({
    queryKey: ['attendance-report', currentOrg?.id, startDate, endDate, teacherFilter, statusFilter],
    queryFn: async () => {
      if (!currentOrg || !user) {
        return { students: [], summary: { totalRecords: 0, attendanceRate: 0, absenceRate: 0, cancellationRate: 0 }, trend: [] };
      }

      const startUtc = fromZonedTime(`${startDate}T00:00:00`, tz).toISOString();
      const endUtc = fromZonedTime(`${endDate}T23:59:59`, tz).toISOString();

      // 1. Fetch lessons in range
      let lessonsQuery = supabase
        .from('lessons')
        .select('id, teacher_id, teacher_user_id, start_at')
        .eq('org_id', currentOrg.id)
        .gte('start_at', startUtc)
        .lte('start_at', endUtc)
        .in('status', ['completed', 'scheduled', 'cancelled']);

      // Teacher role filter
      let resolvedTeacherId: string | null = null;
      if (!isAdmin) {
        resolvedTeacherId = await resolveTeacherId(currentOrg.id, user.id);
        if (resolvedTeacherId) {
          lessonsQuery = lessonsQuery.eq('teacher_id', resolvedTeacherId);
        }
      } else if (teacherFilter) {
        lessonsQuery = lessonsQuery.eq('teacher_id', teacherFilter);
      }

      const lessons = await fetchAllPages<any>(lessonsQuery.order('start_at'));
      if (lessons.length === 0) {
        return { students: [], summary: { totalRecords: 0, attendanceRate: 0, absenceRate: 0, cancellationRate: 0 }, trend: [] };
      }

      const lessonIds = lessons.map((l: any) => l.id);
      const lessonMap = new Map<string, any>();
      for (const l of lessons) lessonMap.set(l.id, l);

      // 2. Fetch attendance records
      let arQuery = supabase
        .from('attendance_records')
        .select('lesson_id, student_id, attendance_status')
        .eq('org_id', currentOrg.id)
        .in('lesson_id', lessonIds);

      if (statusFilter && statusFilter !== 'all') {
        const statusMap: Record<string, string[]> = {
          present: ['present'],
          absent: ['absent'],
          late: ['late'],
          cancelled: ['cancelled_by_teacher', 'cancelled_by_student'],
        };
        const statuses = statusMap[statusFilter];
        if (statuses) arQuery = arQuery.in('attendance_status', statuses);
      }

      const records = await fetchAllPages<any>(arQuery);

      // 3. Fetch teacher names (for admin display)
      let teacherNameMap = new Map<string, string>();
      if (isAdmin) {
        const teacherIds = [...new Set(lessons.map((l: any) => l.teacher_id).filter(Boolean))];
        if (teacherIds.length > 0) {
          const { data: teachers } = await supabase
            .from('teachers')
            .select('id, display_name')
            .in('id', teacherIds);
          if (teachers) {
            for (const t of teachers) teacherNameMap.set(t.id, t.display_name || 'Unknown');
          }
        }
      }

      // 4. Fetch student names
      const studentIds = [...new Set(records.map((r: any) => r.student_id))];
      let studentNameMap = new Map<string, { firstName: string; lastName: string }>();
      if (studentIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', studentIds);
        if (students) {
          for (const s of students) {
            studentNameMap.set(s.id, { firstName: s.first_name, lastName: s.last_name });
          }
        }
      }

      // 5. Aggregate per student
      const studentAgg = new Map<string, {
        teacherName: string;
        total: number; present: number; absent: number; late: number;
        teacherCancelled: number; studentCancelled: number;
      }>();

      for (const r of records) {
        const lesson = lessonMap.get(r.lesson_id);
        if (!studentAgg.has(r.student_id)) {
          const tName = lesson?.teacher_id ? (teacherNameMap.get(lesson.teacher_id) || '') : '';
          studentAgg.set(r.student_id, {
            teacherName: tName,
            total: 0, present: 0, absent: 0, late: 0,
            teacherCancelled: 0, studentCancelled: 0,
          });
        }
        const agg = studentAgg.get(r.student_id)!;
        agg.total++;
        switch (r.attendance_status) {
          case 'present': agg.present++; break;
          case 'absent': agg.absent++; break;
          case 'late': agg.late++; break;
          case 'cancelled_by_teacher': agg.teacherCancelled++; break;
          case 'cancelled_by_student': agg.studentCancelled++; break;
        }
      }

      const studentRows: AttendanceStudentRow[] = [];
      for (const [sid, agg] of studentAgg) {
        const name = studentNameMap.get(sid);
        const denominator = agg.total - agg.teacherCancelled;
        studentRows.push({
          studentId: sid,
          studentName: name ? `${name.firstName} ${name.lastName}` : 'Unknown',
          teacherName: agg.teacherName,
          total: agg.total,
          present: agg.present,
          absent: agg.absent,
          late: agg.late,
          teacherCancelled: agg.teacherCancelled,
          studentCancelled: agg.studentCancelled,
          attendanceRate: denominator > 0 ? (agg.present / denominator) * 100 : 0,
        });
      }

      // 6. Summary
      const totals = { total: 0, present: 0, absent: 0, late: 0, teacherCancelled: 0, studentCancelled: 0 };
      for (const r of studentRows) {
        totals.total += r.total;
        totals.present += r.present;
        totals.absent += r.absent;
        totals.late += r.late;
        totals.teacherCancelled += r.teacherCancelled;
        totals.studentCancelled += r.studentCancelled;
      }
      const denom = totals.total - totals.teacherCancelled;
      const summary: AttendanceSummary = {
        totalRecords: totals.total,
        attendanceRate: denom > 0 ? (totals.present / denom) * 100 : 0,
        absenceRate: denom > 0 ? (totals.absent / denom) * 100 : 0,
        cancellationRate: totals.total > 0 ? ((totals.teacherCancelled + totals.studentCancelled) / totals.total) * 100 : 0,
      };

      // 7. Trend data
      const daySpan = differenceInDays(parseISO(endDate), parseISO(startDate));
      const useWeekly = daySpan <= 90;

      const buckets = new Map<string, { total: number; present: number; absent: number }>();
      for (const r of records) {
        const lesson = lessonMap.get(r.lesson_id);
        if (!lesson) continue;
        const lessonDate = parseISO(lesson.start_at);
        const bucketKey = useWeekly
          ? format(startOfWeek(lessonDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
          : format(lessonDate, 'yyyy-MM');

        if (!buckets.has(bucketKey)) buckets.set(bucketKey, { total: 0, present: 0, absent: 0 });
        const b = buckets.get(bucketKey)!;
        b.total++;
        if (r.attendance_status === 'present') b.present++;
        if (r.attendance_status === 'absent') b.absent++;
      }

      const trend: AttendanceTrendBucket[] = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, b]) => ({
          bucketLabel: useWeekly ? `w/c ${format(parseISO(key), 'dd MMM')}` : format(parseISO(key + '-01'), 'MMM yyyy'),
          bucketStart: key,
          total: b.total,
          present: b.present,
          attendanceRate: b.total > 0 ? (b.present / b.total) * 100 : 0,
          absenceRate: b.total > 0 ? (b.absent / b.total) * 100 : 0,
        }));

      return { students: studentRows, summary, trend };
    },
    enabled: !!currentOrg?.id && !!user,
    staleTime: STALE_REPORT,
    gcTime: GC_REPORT,
  });
}

// ─── CSV Export ──────────────────────────────────────────

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

export function exportAttendanceToCSV(data: AttendanceReportData, orgName: string, showTeacher: boolean) {
  const headers = showTeacher
    ? ['Student', 'Teacher', 'Total', 'Present', 'Absent', 'Late', 'Teacher Cancelled', 'Student Cancelled', 'Attendance Rate %']
    : ['Student', 'Total', 'Present', 'Absent', 'Late', 'Teacher Cancelled', 'Student Cancelled', 'Attendance Rate %'];

  const rows = [headers.join(',')];
  for (const s of data.students) {
    const cols = showTeacher
      ? [sanitiseCSVCell(s.studentName), sanitiseCSVCell(s.teacherName), s.total, s.present, s.absent, s.late, s.teacherCancelled, s.studentCancelled, s.attendanceRate.toFixed(1)]
      : [sanitiseCSVCell(s.studentName), s.total, s.present, s.absent, s.late, s.teacherCancelled, s.studentCancelled, s.attendanceRate.toFixed(1)];
    rows.push(cols.join(','));
  }

  downloadCSV(rows.join('\n'), `attendance_${orgName}_${new Date().toISOString().slice(0, 10)}.csv`);
}
