import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useSubscription } from './useSubscription';

export interface UsageCounts {
  students: number;
  teachers: number;
  locations: number;
}

export interface UsageStatus {
  counts: UsageCounts;
  limits: {
    maxStudents: number;
    maxTeachers: number;
  };
  usage: {
    studentsPercentage: number;
    teachersPercentage: number;
    isStudentNearLimit: boolean;
    isTeacherNearLimit: boolean;
    isStudentAtLimit: boolean;
    isTeacherAtLimit: boolean;
  };
  canAddStudent: boolean;
  canAddTeacher: boolean;
  isLoading: boolean;
}

export function useUsageCounts(): UsageStatus {
  const { currentOrg } = useOrg();
  const { limits } = useSubscription();

  const { data: counts, isLoading } = useQuery({
    queryKey: ['usage-counts', currentOrg?.id],
    queryFn: async (): Promise<UsageCounts> => {
      if (!currentOrg) return { students: 0, teachers: 0, locations: 0 };

      // Fetch counts in parallel
      const [studentsResult, teachersResult, locationsResult] = await Promise.all([
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id)
          .eq('status', 'active'),
        supabase
          .from('org_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id)
          .eq('status', 'active')
          .in('role', ['owner', 'admin', 'teacher']),
        supabase
          .from('locations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id),
      ]);

      return {
        students: studentsResult.count || 0,
        teachers: teachersResult.count || 0,
        locations: locationsResult.count || 0,
      };
    },
    enabled: !!currentOrg,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Refresh every minute
  });

  const studentCount = counts?.students || 0;
  const teacherCount = counts?.teachers || 0;

  const studentsPercentage = limits.maxStudents > 0 
    ? Math.min(100, (studentCount / limits.maxStudents) * 100)
    : 0;
  const teachersPercentage = limits.maxTeachers > 0 
    ? Math.min(100, (teacherCount / limits.maxTeachers) * 100)
    : 0;

  return {
    counts: counts || { students: 0, teachers: 0, locations: 0 },
    limits: {
      maxStudents: limits.maxStudents,
      maxTeachers: limits.maxTeachers,
    },
    usage: {
      studentsPercentage,
      teachersPercentage,
      isStudentNearLimit: studentsPercentage >= 80,
      isTeacherNearLimit: teachersPercentage >= 80,
      isStudentAtLimit: studentCount >= limits.maxStudents,
      isTeacherAtLimit: teacherCount >= limits.maxTeachers,
    },
    canAddStudent: studentCount < limits.maxStudents,
    canAddTeacher: teacherCount < limits.maxTeachers,
    isLoading,
  };
}
