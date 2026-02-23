// ⚠️ IMPORTANT: These limits are currently client-side only.
// Server-side enforcement via RLS/triggers is required before production.
// See: https://github.com/sublimeanger/lessonloop3/issues/XXX
import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE, GC_DEFAULT } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { activeStudentsQuery } from '@/lib/studentQuery';
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

      // Use SELECT with count instead of HEAD to avoid aborted request noise
      const [studentsResult, teachersResult, locationsResult] = await Promise.all([
        activeStudentsQuery(currentOrg.id)
          .then(r => ({ ...r, count: r.data?.length ?? 0 })),
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
    staleTime: STALE_STABLE,
    gcTime: GC_DEFAULT,
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
