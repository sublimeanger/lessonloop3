import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';

export type BillingInterval = 'monthly' | 'yearly';

export function useSubscriptionCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentOrg } = useOrg();

  const initiateSubscription = async (
    plan: 'solo_teacher' | 'academy' | 'agency',
    billingInterval: BillingInterval = 'monthly'
  ) => {
    if (!currentOrg) {
      toast({
        title: 'Error',
        description: 'No organisation selected',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscription-checkout', {
        body: {
          orgId: currentOrg.id,
          plan,
          billingInterval,
          successUrl: `${window.location.origin}/settings?tab=billing`,
          cancelUrl: `${window.location.origin}/settings?tab=billing`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (data?.url) {
        // Redirect to Stripe Checkout or Customer Portal
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Subscription failed';
      toast({
        title: 'Subscription Error',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    if (!currentOrg) {
      toast({
        title: 'Error',
        description: 'No organisation selected',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
        body: {
          orgId: currentOrg.id,
          returnUrl: `${window.location.origin}/settings?tab=billing`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to open billing portal');
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open billing portal';
      toast({
        title: 'Billing Portal Error',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return {
    initiateSubscription,
    openCustomerPortal,
    isLoading,
  };
}
