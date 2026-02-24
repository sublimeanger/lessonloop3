import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { STALE_SEMI_STABLE } from '@/config/query-stale-times';

export interface Dispute {
  id: string;
  payment_id: string | null;
  invoice_id: string | null;
  stripe_dispute_id: string;
  amount_minor: number;
  currency_code: string;
  reason: string | null;
  status: string;
  evidence_due_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function useActiveDisputes() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['disputes', 'active', currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .eq('org_id', currentOrg!.id)
        .not('status', 'in', '("won","lost","warning_closed")')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Dispute[];
    },
    enabled: !!currentOrg?.id,
    staleTime: STALE_SEMI_STABLE,
  });
}
