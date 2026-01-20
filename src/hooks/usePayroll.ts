import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';

export interface TeacherPayrollSummary {
  teacherUserId: string;
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

      // Fetch completed lessons in date range
      let lessonsQuery = supabase
        .from('lessons')
        .select('id, title, start_at, end_at, teacher_user_id, status')
        .eq('org_id', currentOrg.id)
        .eq('status', 'completed')
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDate}T23:59:59`);

      // If teacher, only show their own
      if (!isAdmin && user) {
        lessonsQuery = lessonsQuery.eq('teacher_user_id', user.id);
      }

      const { data: lessons, error: lessonsError } = await lessonsQuery;
      if (lessonsError) throw lessonsError;

      // Get unique teacher IDs
      const teacherIds = [...new Set((lessons || []).map(l => l.teacher_user_id))];
      
      if (teacherIds.length === 0) {
        return { 
          teachers: [], 
          totalGrossOwed: 0, 
          dateRange: { start: startDate, end: endDate } 
        };
      }

      // Fetch teacher profiles with pay rates
      const { data: teacherProfiles, error: tpError } = await supabase
        .from('teacher_profiles')
        .select('user_id, display_name, pay_rate_type, pay_rate_value')
        .eq('org_id', currentOrg.id)
        .in('user_id', teacherIds);
      if (tpError) throw tpError;

      // Fetch user profiles for names
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', teacherIds);
      if (pError) throw pError;

      // Build teacher map
      const teacherMap = new Map<string, {
        name: string;
        payRateType: 'per_lesson' | 'hourly' | 'percentage' | null;
        payRateValue: number;
      }>();

      for (const tid of teacherIds) {
        const profile = profiles?.find(p => p.id === tid);
        const teacherProfile = teacherProfiles?.find(tp => tp.user_id === tid);
        
        teacherMap.set(tid, {
          name: teacherProfile?.display_name || profile?.full_name || profile?.email || 'Unknown',
          payRateType: teacherProfile?.pay_rate_type as 'per_lesson' | 'hourly' | 'percentage' | null,
          payRateValue: Number(teacherProfile?.pay_rate_value) || 0,
        });
      }

      // Calculate payroll per teacher
      const teacherSummaries: TeacherPayrollSummary[] = [];

      for (const tid of teacherIds) {
        const teacherLessons = (lessons || []).filter(l => l.teacher_user_id === tid);
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
          teacherUserId: tid,
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
    },
    enabled: !!currentOrg && !!startDate && !!endDate,
  });
}

export function exportPayrollToCSV(data: PayrollData, orgName: string): void {
  const rows: string[] = [];
  
  // Header
  rows.push('Teacher,Pay Rate Type,Pay Rate Value,Completed Lessons,Total Hours,Gross Owed (£)');
  
  // Data rows
  for (const teacher of data.teachers) {
    rows.push([
      `"${teacher.teacherName}"`,
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
