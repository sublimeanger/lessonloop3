import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

/**
 * Subscribes to real-time invoice and payment changes in the parent portal.
 * Instantly updates the invoice list when payments are confirmed by webhooks.
 */
export function useRealtimePortalPayments() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`portal-payments-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
          queryClient.invalidateQueries({ queryKey: ['parent-installments'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payments',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
          queryClient.invalidateQueries({ queryKey: ['parent-installments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);
}
