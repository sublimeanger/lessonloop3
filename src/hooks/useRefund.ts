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
      // Fetch payment to calculate max refundable
      const { data: payment, error: paymentErr } = await supabase
        .from('payments')
        .select('amount_minor')
        .eq('id', paymentId)
        .single();

      if (paymentErr || !payment) throw new Error('Payment not found');

      const { data: existingRefunds } = await (supabase as any)
        .from('refunds')
        .select('amount_minor')
        .eq('payment_id', paymentId)
        .eq('status', 'succeeded');

      const totalRefunded = (existingRefunds || []).reduce(
        (sum: number, r: any) => sum + r.amount_minor, 0
      );
      const maxRefundable = payment.amount_minor - totalRefunded;
      const refundAmount = amount != null ? Math.round(amount) : maxRefundable;

      if (refundAmount <= 0) throw new Error('Refund amount must be greater than zero');
      if (refundAmount > maxRefundable) throw new Error(`Maximum refundable amount is ${maxRefundable}`);

      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Insert refund record directly
      const { data: refundRecord, error: insertErr } = await (supabase as any)
        .from('refunds')
        .insert({
          payment_id: paymentId,
          invoice_id: invoiceId,
          org_id: orgId,
          amount_minor: refundAmount,
          reason: reason || null,
          status: 'succeeded',
          stripe_refund_id: null,
          refunded_by: userId,
        })
        .select('id')
        .single();

      if (insertErr) throw new Error('Failed to create refund record');

      // Recalculate invoice paid_minor
      const { error: recalcErr } = await (supabase as any).rpc('recalculate_invoice_paid', {
        _invoice_id: invoiceId,
      });

      if (recalcErr) {
        console.error('Failed to recalculate invoice after manual refund:', recalcErr);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['payment-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      toast({
        title: 'Refund recorded',
        description: `Refund of ${formatCurrencyMinor(refundAmount, currencyCode)} has been recorded successfully.`,
      });

      return { success: true, refundId: refundRecord?.id, amountMinor: refundAmount, status: 'succeeded' };
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
