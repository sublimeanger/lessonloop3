import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRelatedStudent(studentId: string | null | undefined) {
  return useQuery({
    queryKey: ['related-student', studentId],
    queryFn: async () => {
      if (!studentId) return null;

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('id', studentId)
        .maybeSingle();

      if (error) throw error;
      return data ? { id: data.id, name: `${data.first_name} ${data.last_name}` } : null;
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
