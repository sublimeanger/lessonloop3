import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyMinor } from '@/lib/utils';

interface RefundResult {
  success: boolean;
  refundId?: string;
  stripeRefundId?: string;
  amountMinor?: number;
  status?: string;
  error?: string;
}

export function useRefund() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const processRefund = useCallback(async (
    paymentId: string,
    amount?: number,
    reason?: string,
    currencyCode: string = 'GBP',
  ): Promise<RefundResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-process-refund', {
        body: { paymentId, amount, reason },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to process refund');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Invalidate related queries (12.1)
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['payment-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      toast({
        title: 'Refund processed',
        description: `Refund of ${data.amountMinor ? formatCurrencyMinor(data.amountMinor, currencyCode) : ''} has been processed successfully.`,
      });

      return { success: true, ...data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refund failed';
      setError(message);
      toast({
        title: 'Refund failed',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient, toast]);

  const clearError = useCallback(() => setError(null), []);

  const processManualRefund = useCallback(async (
    paymentId: string,
    invoiceId: string,
    orgId: string,
    amount?: number,
    reason?: string,
    currencyCode: string = 'GBP',
  ): Promise<RefundResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      const refundAmount = amount != null ? Math.round(amount) : undefined;

      // Use the record_manual_refund RPC which handles auth, validation,
      // refund insertion, invoice recalculation, and audit logging atomically.
      const { data: result, error: rpcErr } = await (supabase as any).rpc('record_manual_refund', {
        _payment_id: paymentId,
        _invoice_id: invoiceId,
        _org_id: orgId,
        _amount_minor: refundAmount ?? null,
        _reason: reason || null,
      });

      if (rpcErr) throw new Error(rpcErr.message || 'Failed to create refund record');

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['payment-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      toast({
        title: 'Refund recorded',
        description: `Refund of ${formatCurrencyMinor(result.amount_minor, currencyCode)} has been recorded successfully.`,
      });

      return { success: true, refundId: result.refund_id, amountMinor: result.amount_minor, status: 'succeeded' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refund failed';
      setError(message);
      toast({
        title: 'Refund failed',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient, toast]);

  return {
    processRefund,
    processManualRefund,
    isProcessing,
    error,
    clearError,
  };
}
