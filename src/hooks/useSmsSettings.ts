import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

export interface SmsSettings {
  org_id: string;
  sms_enabled: boolean;
  twilio_phone_number: string | null;
  monthly_sms_limit: number;
  sms_sent_this_month: number;
  current_month: string;
}

const DEFAULTS: Omit<SmsSettings, 'org_id'> = {
  sms_enabled: false,
  twilio_phone_number: null,
  monthly_sms_limit: 500,
  sms_sent_this_month: 0,
  current_month: new Date().toISOString().slice(0, 10),
};

export function useSmsSettings() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sms-settings', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('org_sms_settings')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;
      return data
        ? (data as unknown as SmsSettings)
        : ({ org_id: orgId, ...DEFAULTS } as SmsSettings);
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Omit<SmsSettings, 'org_id'>>) => {
      if (!orgId) throw new Error('No org selected');

      const { data, error } = await supabase
        .from('org_sms_settings')
        .upsert(
          { org_id: orgId, ...DEFAULTS, ...query.data, ...updates } as Record<string, unknown>,
          { onConflict: 'org_id' },
        )
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SmsSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['sms-settings', orgId], data);
      toast.success('SMS settings saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  return {
    settings: query.data ?? ({ org_id: orgId ?? '', ...DEFAULTS } as SmsSettings),
    isLoading: query.isLoading,
    updateSettings: (updates: Partial<Omit<SmsSettings, 'org_id'>>) =>
      mutation.mutate(updates),
    isSaving: mutation.isPending,
  };
}
