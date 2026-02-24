import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { STALE_VOLATILE } from '@/config/query-stale-times';

export interface Refund {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount_minor: number;
  reason: string | null;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  stripe_refund_id: string | null;
  created_at: string;
  completed_at: string | null;
  initiated_by: string | null;
}

export function useRefunds(invoiceId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['refunds', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .eq('org_id', currentOrg!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Refund[];
    },
    enabled: !!invoiceId && !!currentOrg?.id,
    staleTime: STALE_VOLATILE,
  });
}

export function useIssueRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      amountMinor,
      reason,
    }: {
      paymentId: string;
      amountMinor?: number;
      reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('stripe-refund', {
        body: { paymentId, amountMinor, reason },
      });

      if (error) throw error;
      return data as {
        refundId: string;
        stripeRefundId: string;
        amountMinor: number;
        status: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
