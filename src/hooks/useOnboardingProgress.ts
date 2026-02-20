import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg, OrgType } from '@/contexts/OrgContext';

export interface OnboardingStatus {
  hasStudents: boolean;
  hasLessons: boolean;
  hasInvoices: boolean;
  hasLocations: boolean;
  hasTeachers: boolean;
  hasPolicyConfigured: boolean;
}

export function useOnboardingProgress() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['onboarding-progress', currentOrg?.id],
    queryFn: async (): Promise<OnboardingStatus> => {
      if (!currentOrg) throw new Error('No org');

      const [studentsResult, lessonsResult, invoicesResult, locationsResult, teachersResult] = await Promise.all([
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id)
          .eq('status', 'active'),
        supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id),
        supabase
          .from('locations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id),
        supabase
          .from('org_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id)
          .eq('status', 'active')
          .in('role', ['teacher', 'admin']),
      ]);

      return {
        hasStudents: (studentsResult.count || 0) > 0,
        hasLessons: (lessonsResult.count || 0) > 0,
        hasInvoices: (invoicesResult.count || 0) > 0,
        hasLocations: (locationsResult.count || 0) > 0,
        hasTeachers: (teachersResult.count || 0) > 1,
        hasPolicyConfigured: (currentOrg.parent_reschedule_policy ?? 'request_only') !== 'request_only',
      };
    },
    enabled: !!currentOrg,
    staleTime: 30 * 1000,
  });
}
