import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

export interface MessagingSettings {
  org_id: string;
  parent_can_initiate: boolean;
  parent_can_message_owner: boolean;
  parent_can_message_admin: boolean;
  parent_can_message_teacher: boolean;
  auto_assign_to_teacher: boolean;
  notify_staff_on_new_message: boolean;
  notify_parent_on_reply: boolean;
}

const DEFAULTS: Omit<MessagingSettings, 'org_id'> = {
  parent_can_initiate: true,
  parent_can_message_owner: true,
  parent_can_message_admin: true,
  parent_can_message_teacher: false,
  auto_assign_to_teacher: false,
  notify_staff_on_new_message: true,
  notify_parent_on_reply: true,
};

export function useMessagingSettings() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messaging-settings', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('org_messaging_settings')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;
      // Return defaults merged with whatever exists
      return data
        ? (data as MessagingSettings)
        : ({ org_id: orgId, ...DEFAULTS } as MessagingSettings);
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Omit<MessagingSettings, 'org_id'>>) => {
      if (!orgId) throw new Error('No org selected');

      const { data, error } = await supabase
        .from('org_messaging_settings')
        .upsert(
          { org_id: orgId, ...DEFAULTS, ...query.data, ...updates },
          { onConflict: 'org_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data as MessagingSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['messaging-settings', orgId], data);
      toast.success('Messaging settings saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  return {
    settings: query.data ?? ({ org_id: orgId ?? '', ...DEFAULTS } as MessagingSettings),
    isLoading: query.isLoading,
    updateSetting: (key: keyof Omit<MessagingSettings, 'org_id'>, value: boolean) =>
      mutation.mutate({ [key]: value }),
    isSaving: mutation.isPending,
  };
}
