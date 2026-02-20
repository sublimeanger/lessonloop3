import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface OrgPaymentPreferences {
  online_payments_enabled: boolean;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_reference_prefix: string | null;
}

export function useOrgPaymentPreferences() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ['org-payment-prefs', orgId],
    queryFn: async (): Promise<OrgPaymentPreferences> => {
      const { data, error } = await supabase
        .from('organisations')
        .select('online_payments_enabled, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix')
        .eq('id', orgId!)
        .single();

      if (error) throw error;
      return data as OrgPaymentPreferences;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}
