import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export interface RecalcFailure {
  id: string;
  created_at: string;
  after: {
    source?: string;
    attempts?: number;
    error?: string;
    refund_id?: string;
    stripe_refund_id?: string;
    stripe_payment_intent?: string;
    amount_minor?: number;
  };
}

/**
 * Reads recent (7d) invoice_recalc_failed audit entries for an
 * invoice, filtered to exclude failures superseded by a successful
 * manual retry. Empty array means no banner shown.
 */
export function useInvoiceRecalcFailures(invoiceId: string | undefined) {
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: ['invoice-recalc-failures', invoiceId, currentOrg?.id],
    queryFn: async (): Promise<RecalcFailure[]> => {
      if (!invoiceId || !currentOrg?.id) return [];
      const { data, error } = await (supabase.rpc as any)(
        'get_recent_recalc_failures_for_invoice',
        { _invoice_id: invoiceId, _org_id: currentOrg.id },
      );
      if (error) {
        // Non-fatal — banner simply won't render. Don't toast; the
        // RPC may not exist yet if migration is mid-deploy, and a
        // missing banner is strictly less alarming than a spurious
        // error toast on every invoice detail load.
        logger.warn('Failed to fetch recalc failures', error);
        return [];
      }
      return (data ?? []) as RecalcFailure[];
    },
    enabled: !!invoiceId && !!currentOrg?.id,
    // Short stale time — operators retrying via the banner expect
    // immediate-ish feedback after the mutation completes.
    staleTime: 10_000,
  });
}

/**
 * Manual retry trigger for recalculate_invoice_paid. Admin/finance
 * surface only. On success, invalidates the invoice and the
 * recalc-failures query so the banner disappears.
 */
export function useAdminRecalculateInvoice() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');
      const { data, error } = await (supabase.rpc as any)(
        'admin_recalculate_invoice_paid',
        { _invoice_id: invoiceId, _org_id: currentOrg.id },
      );
      if (error) throw error;
      return data as {
        net_paid: number;
        total_minor: number;
        new_status: string;
        overpayment_minor: number;
      };
    },
    onSuccess: (result, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-recalc-failures', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      toast({
        title: 'Recalculation complete',
        description: `Invoice status: ${result.new_status}. Banner should now clear.`,
      });
    },
    onError: (error) => {
      toastError(error, 'Failed to recalculate invoice');
    },
  });
}
