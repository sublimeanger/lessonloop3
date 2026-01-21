import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useStripePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const initiatePayment = async (invoiceId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: {
          invoiceId,
          successUrl: `${window.location.origin}/portal/invoices`,
          cancelUrl: `${window.location.origin}/portal/invoices`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (data?.url) {
        // Redirect to Stripe Checkout
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
  };

  return {
    initiatePayment,
    isLoading,
  };
}
