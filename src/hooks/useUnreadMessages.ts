import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useGuardianId } from '@/hooks/useParentPortal';

/**
 * Hook to get the count of unread messages for the current guardian
 */
export function useUnreadMessagesCount() {
  const { currentOrg } = useOrg();
  const { guardianId } = useGuardianId();
  const queryClient = useQueryClient();

  // Realtime subscription for instant unread count updates
  useEffect(() => {
    if (!guardianId || !currentOrg?.id) return;

    const channel = supabase
      .channel(`unread-messages-realtime-${guardianId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_log',
          filter: `recipient_id=eq.${guardianId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
          queryClient.invalidateQueries({ queryKey: ['parent-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guardianId, currentOrg?.id, queryClient]);

  return useQuery({
    queryKey: ['unread-messages-count', guardianId, currentOrg?.id],
    queryFn: async () => {
      if (!guardianId || !currentOrg) return 0;

      const { count, error } = await supabase
        .from('message_log')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .eq('recipient_type', 'guardian')
        .eq('recipient_id', guardianId)
        .is('read_at', null)
        .eq('status', 'sent');

      if (error) {
        logger.error('Error fetching unread messages count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!guardianId && !!currentOrg,
    refetchInterval: 60000,
  });
}

/**
 * Hook to mark messages as read when viewing the messages page
 */
export function useMarkMessagesAsRead() {
  const { currentOrg } = useOrg();
  const { guardianId } = useGuardianId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageIds?: string[]) => {
      if (!guardianId || !currentOrg) return;

      const { error } = await supabase.functions.invoke('mark-messages-read', {
        body: {
          guardian_id: guardianId,
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
      queryClient.invalidateQueries({ queryKey: ['parent-conversations'] });
    },
  });
}
