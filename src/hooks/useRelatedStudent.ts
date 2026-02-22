import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRelatedStudent(studentId: string | null | undefined, orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['related-student', studentId, orgId],
    queryFn: async () => {
      if (!studentId || !orgId) return null;

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('id', studentId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;
      return data ? { id: data.id, name: `${data.first_name} ${data.last_name}` } : null;
    },
    enabled: !!studentId && !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}
