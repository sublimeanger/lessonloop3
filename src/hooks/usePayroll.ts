import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { sanitiseCSVCell, currencySymbol } from '@/lib/utils';

export interface TeacherPayrollSummary {
  teacherId: string;          // Now teachers.id
  teacherName: string;
  payRateType: 'per_lesson' | 'hourly' | 'percentage' | null;
  payRateValue: number;
  completedLessons: number;
  totalMinutes: number;
  totalHours: number;
  grossOwed: number;
  lessons: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    durationMins: number;
    calculatedPay: number;
  }[];
}

export interface PayrollData {
  teachers: TeacherPayrollSummary[];
  totalGrossOwed: number;
  dateRange: { start: string; end: string };
}

export function usePayroll(startDate: string, endDate: string) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  return useQuery({
    queryKey: ['payroll', currentOrg?.id, startDate, endDate, user?.id, isAdmin],
    queryFn: async (): Promise<PayrollData> => {
      if (!currentOrg || !startDate || !endDate) {
        return { teachers: [], totalGrossOwed: 0, dateRange: { start: '', end: '' } };
      }

      // Fetch completed lessons in date range - now with teacher_id
      let lessonsQuery = supabase
        .from('lessons')
        .select('id, title, start_at, end_at, teacher_id, status')
        .eq('org_id', currentOrg.id)
        .eq('status', 'completed')
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDate}T23:59:59`);

      // If teacher, filter by their teacher_id (lookup via user_id)
      if (!isAdmin && user) {
        // First, find the teacher record for this user
        const { data: teacherRecord } = await supabase
          .from('teachers')
          .select('id')
          .eq('org_id', currentOrg.id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (teacherRecord) {
          lessonsQuery = lessonsQuery.eq('teacher_id', teacherRecord.id);
        }
      }

      const { data: lessons, error: lessonsError } = await lessonsQuery.limit(10000);
      if (lessonsError) throw lessonsError;

      // Get unique teacher IDs (prefer teacher_id, fallback to teacher_user_id)
      const teacherIds = [...new Set((lessons || [])
        .map(l => l.teacher_id)
        .filter(Boolean)
      )] as string[];
      
      if (teacherIds.length === 0) {
        return { 
          teachers: [], 
          totalGrossOwed: 0, 
          dateRange: { start: startDate, end: endDate } 
        };
      }

      // Fetch teacher details from the new teachers table (includes pay rates)
      const { data: teachersData, error: tError } = await supabase
        .from('teachers_with_pay')  // Use view that includes pay data for admins
        .select('id, display_name, pay_rate_type, pay_rate_value')
        .eq('org_id', currentOrg.id)
        .in('id', teacherIds);
      if (tError) {
        // Fallback to base teachers table if view fails
        const { data: fallbackTeachers } = await supabase
          .from('teachers')
          .select('id, display_name')
          .eq('org_id', currentOrg.id)
          .in('id', teacherIds);
        
        // Build teacher map without pay data
        const teacherMap = new Map<string, {
          name: string;
          payRateType: 'per_lesson' | 'hourly' | 'percentage' | null;
          payRateValue: number;
        }>();
        
        for (const t of fallbackTeachers || []) {
          teacherMap.set(t.id, {
            name: t.display_name,
            payRateType: null,
            payRateValue: 0,
          });
        }
        
        return calculatePayroll(lessons || [], teacherMap, startDate, endDate);
      }

      // Build teacher map
      const teacherMap = new Map<string, {
        name: string;
        payRateType: 'per_lesson' | 'hourly' | 'percentage' | null;
        payRateValue: number;
      }>();

      for (const tid of teacherIds) {
        const teacherData = teachersData?.find(t => t.id === tid);
        
        teacherMap.set(tid, {
          name: teacherData?.display_name || 'Unknown',
          payRateType: teacherData?.pay_rate_type as 'per_lesson' | 'hourly' | 'percentage' | null,
          payRateValue: Number(teacherData?.pay_rate_value) || 0,
        });
      }

      return calculatePayroll(lessons || [], teacherMap, startDate, endDate);
    },
    enabled: !!currentOrg && !!startDate && !!endDate,
  });
}

function calculatePayroll(
  lessons: any[],
  teacherMap: Map<string, { name: string; payRateType: 'per_lesson' | 'hourly' | 'percentage' | null; payRateValue: number }>,
  startDate: string,
  endDate: string
): PayrollData {
  const teacherIds = [...teacherMap.keys()];
  const teacherSummaries: TeacherPayrollSummary[] = [];

  for (const tid of teacherIds) {
    const teacherLessons = lessons.filter(l => l.teacher_id === tid);
    const teacherInfo = teacherMap.get(tid)!;
    
    let totalMinutes = 0;
    const lessonDetails: TeacherPayrollSummary['lessons'] = [];

    for (const lesson of teacherLessons) {
      const start = new Date(lesson.start_at);
      const end = new Date(lesson.end_at);
      const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
      totalMinutes += durationMins;

      // Calculate pay for this lesson
      let calculatedPay = 0;
      switch (teacherInfo.payRateType) {
        case 'per_lesson':
          calculatedPay = teacherInfo.payRateValue;
          break;
        case 'hourly':
          calculatedPay = (durationMins / 60) * teacherInfo.payRateValue;
          break;
        case 'percentage':
          // For percentage, we'd need lesson revenue - for now use 0
          calculatedPay = 0;
          break;
        default:
          calculatedPay = 0;
      }

      lessonDetails.push({
        id: lesson.id,
        title: lesson.title,
        startAt: lesson.start_at,
        endAt: lesson.end_at,
        durationMins,
        calculatedPay,
      });
    }

    const grossOwed = lessonDetails.reduce((sum, l) => sum + l.calculatedPay, 0);

    teacherSummaries.push({
      teacherId: tid,
      teacherName: teacherInfo.name,
      payRateType: teacherInfo.payRateType,
      payRateValue: teacherInfo.payRateValue,
      completedLessons: teacherLessons.length,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      grossOwed,
      lessons: lessonDetails,
    });
  }

  // Sort by name
  teacherSummaries.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  const totalGrossOwed = teacherSummaries.reduce((sum, t) => sum + t.grossOwed, 0);

  return {
    teachers: teacherSummaries,
    totalGrossOwed,
    dateRange: { start: startDate, end: endDate },
  };
}

export function exportPayrollToCSV(data: PayrollData, orgName: string, currencyCode = 'GBP'): void {
  const rows: string[] = [];
  const sym = currencySymbol(currencyCode);
  
  // Header
  rows.push(`Teacher,Pay Rate Type,Pay Rate Value,Completed Lessons,Total Hours,Gross Owed (${sym})`);
  
  // Data rows
  for (const teacher of data.teachers) {
    rows.push([
      `"${sanitiseCSVCell(teacher.teacherName)}"`,
      teacher.payRateType || 'Not set',
      teacher.payRateValue.toFixed(2),
      teacher.completedLessons,
      teacher.totalHours.toFixed(2),
      teacher.grossOwed.toFixed(2),
    ].join(','));
  }
  
  // Total row
  rows.push('');
  rows.push(`Total,,,,,${data.totalGrossOwed.toFixed(2)}`);
  
  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `payroll_${orgName}_${data.dateRange.start}_to_${data.dateRange.end}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
