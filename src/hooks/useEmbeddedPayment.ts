import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  customerId: string;
  amount: number;
  currency: string;
  description: string;
}

interface CreatePaymentIntentOptions {
  installmentId?: string;
  payRemaining?: boolean;
}

export function useEmbeddedPayment() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const createPaymentIntent = useCallback(async (
    invoiceId: string,
    options?: CreatePaymentIntentOptions,
  ): Promise<PaymentIntentResponse | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-create-payment-intent', {
        body: {
          invoiceId,
          installmentId: options?.installmentId,
          payRemaining: options?.payRemaining,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to create payment');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as PaymentIntentResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment setup failed';
      setError(message);
      toast({
        title: 'Payment Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  const clearError = useCallback(() => setError(null), []);

  return {
    createPaymentIntent,
    isCreating,
    error,
    clearError,
  };
}
