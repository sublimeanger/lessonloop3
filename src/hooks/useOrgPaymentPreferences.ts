import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
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
      // Use the restricted parent_org_info view to minimise data surface
      const { data, error } = await supabase
        .from('parent_org_info')
        .select('online_payments_enabled, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix')
        .eq('id', orgId!)
        .single();

      if (error) throw error;
      return data as unknown as OrgPaymentPreferences;
    },
    enabled: !!orgId,
    staleTime: STALE_STABLE,
  });
}
