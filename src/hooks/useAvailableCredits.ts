import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface AvailableCredit {
  id: string;
  student_id: string;
  credit_value_minor: number;
  expires_at: string | null;
  notes: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

/**
 * Fetches available (unredeemed, non-expired) credits for students linked to a payer.
 * For guardians: credits from all their linked students
 * For students (adult payer): credits for that student only
 */
export function useAvailableCreditsForPayer(
  payerType: 'guardian' | 'student',
  payerId: string | undefined
) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['available-credits-for-payer', currentOrg?.id, payerType, payerId],
    queryFn: async () => {
      if (!currentOrg?.id || !payerId) return [];

      if (payerType === 'student') {
        // For adult students paying for themselves, get their own credits
        const { data, error } = await supabase
          .from('available_credits')
          .select(`
            id,
            student_id,
            credit_value_minor,
            expires_at,
            notes,
            student:students!make_up_credits_student_id_fkey(id, first_name, last_name)
          `)
          .eq('org_id', currentOrg.id)
          .eq('student_id', payerId)
          .eq('credit_status', 'available')
          .order('expires_at', { ascending: true, nullsFirst: false });

        if (error) throw error;
        return (data || []) as unknown as AvailableCredit[];
      }

      // For guardians, get credits for all their linked students
      const { data: studentLinks, error: linksError } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', payerId);

      if (linksError) throw linksError;
      if (!studentLinks?.length) return [];

      const studentIds = studentLinks.map((l) => l.student_id);

      const { data, error } = await supabase
        .from('available_credits')
        .select(`
          id,
          student_id,
          credit_value_minor,
          expires_at,
          notes,
          student:students!make_up_credits_student_id_fkey(id, first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .in('student_id', studentIds)
        .eq('credit_status', 'available')
        .order('expires_at', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data || []) as unknown as AvailableCredit[];
    },
    enabled: !!currentOrg?.id && !!payerId,
  });
}

/**
 * Calculate total available credit value for a payer
 */
export function useTotalAvailableCredits(
  payerType: 'guardian' | 'student',
  payerId: string | undefined
) {
  const { data: credits = [], isLoading } = useAvailableCreditsForPayer(payerType, payerId);

  const total = credits.reduce((sum, c) => sum + c.credit_value_minor, 0);

  return { total, credits, isLoading };
}
