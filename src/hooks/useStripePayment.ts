import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { platform } from '@/lib/platform';

export function useStripePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const initiatePayment = useCallback(async (
    invoiceId: string,
    options?: {
      installmentId?: string;
      payRemaining?: boolean;
    }
  ) => {
    if (platform.isNative) {
      toast({
        title: 'Not available in app',
        description: 'Please visit lessonloop.net in your browser to pay invoices.',
      });
      return;
    }
    if (isLoading) return; // Prevent double-clicks
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: {
          invoiceId,
          installmentId: options?.installmentId,
          payRemaining: options?.payRemaining,
          successUrl: `${window.location.origin}/portal/invoices`,
          cancelUrl: `${window.location.origin}/portal/invoices`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      toast({
        title: 'Payment Error',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [isLoading, toast]);

  return {
    initiatePayment,
    isLoading,
  };
}
