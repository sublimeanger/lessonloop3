import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

/**
 * Subscribes to real-time invoice changes and invalidates
 * invoice-related queries (stats, list, urgent actions) on any change.
 */
export function useRealtimeInvoices() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`invoices-realtime-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['invoice-stats', orgId] });
          queryClient.invalidateQueries({ queryKey: ['invoices', orgId] });
          queryClient.invalidateQueries({ queryKey: ['urgent-actions', orgId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['invoice-stats', orgId] });
          queryClient.invalidateQueries({ queryKey: ['invoices', orgId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_requests',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['urgent-actions', orgId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);
}
