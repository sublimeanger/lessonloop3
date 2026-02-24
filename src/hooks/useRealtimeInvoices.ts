import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyMinor } from '@/lib/utils';

/**
 * Subscribes to real-time invoice changes and invalidates
 * invoice-related queries (stats, list, urgent actions) on any change.
 * Also listens for payment_notifications to show teacher toast alerts.
 */
export function useRealtimeInvoices() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const orgId = currentOrg?.id;
  const currencyCode = currentOrg?.currency_code || 'GBP';

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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_notifications',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const n = payload.new as {
            payer_name?: string;
            amount_minor?: number;
            invoice_number?: string;
          };
          toast({
            title: 'Payment Received!',
            description: `${n.payer_name || 'A parent'} paid ${formatCurrencyMinor(n.amount_minor || 0, currencyCode)} for ${n.invoice_number || 'an invoice'}`,
          });
          queryClient.invalidateQueries({ queryKey: ['invoice-stats', orgId] });
          queryClient.invalidateQueries({ queryKey: ['invoices', orgId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient, toast, currencyCode]);
}
