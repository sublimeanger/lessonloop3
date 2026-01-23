import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';

/**
 * Hook to get the count of unread messages for the current guardian
 */
export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['unread-messages-count', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return 0;

      // Get guardian ID for current user
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (!guardian) return 0;

      // Count unread messages where recipient_id matches guardian and read_at is null
      const { count, error } = await supabase
        .from('message_log')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .eq('recipient_type', 'guardian')
        .eq('recipient_id', guardian.id)
        .is('read_at', null)
        .eq('status', 'sent');

      if (error) {
        console.error('Error fetching unread messages count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user && !!currentOrg,
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook to mark messages as read when viewing the messages page
 */
export function useMarkMessagesAsRead() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageIds?: string[]) => {
      if (!user || !currentOrg) return;

      // Get guardian ID
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (!guardian) return;

      // We can't update message_log directly due to RLS, so we'll use an edge function
      // For now, we'll make the update through a function that has elevated permissions
      const { error } = await supabase.functions.invoke('mark-messages-read', {
        body: {
          guardian_id: guardian.id,
          org_id: currentOrg.id,
          message_ids: messageIds,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
      queryClient.invalidateQueries({ queryKey: ['parent-summary'] });
      queryClient.invalidateQueries({ queryKey: ['parent-messages'] });
    },
  });
}
