import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['payment-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });

      toast({
        title: 'Refund processed',
        description: `Refund of ${data.amountMinor ? `${(data.amountMinor / 100).toFixed(2)}` : ''} has been processed successfully.`,
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

  return {
    processRefund,
    isProcessing,
    error,
    clearError,
  };
}
