import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';

export interface ParentCredit {
  id: string;
  student_id: string;
  credit_value_minor: number;
  expires_at: string | null;
  redeemed_at: string | null;
  applied_to_invoice_id: string | null;
  notes: string | null;
  issued_at: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

/**
 * Fetches make-up credits for a parent's linked students.
 * Returns available (unredeemed, non-expired) credits.
 */
export function useParentCredits() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-credits', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg?.id || !user?.id) return [];

      // Get guardian's student IDs
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (!guardian) return [];

      const { data: links } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardian.id);

      if (!links?.length) return [];

      const studentIds = links.map((l) => l.student_id);

      const { data, error } = await supabase
        .from('available_credits')
        .select(`
          id, student_id, credit_value_minor, expires_at,
          redeemed_at, applied_to_invoice_id, notes, issued_at,
          student:students!make_up_credits_student_id_fkey(id, first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .in('student_id', studentIds)
        .eq('credit_status', 'available')
        .order('expires_at', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data || []) as unknown as ParentCredit[];
    },
    enabled: !!currentOrg?.id && !!user?.id,
  });
}
