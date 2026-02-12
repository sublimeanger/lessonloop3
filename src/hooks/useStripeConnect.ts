import { useState, useCallback } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ConnectStatus {
  connected: boolean;
  status: string;
  onboardedAt: string | null;
  platformFeePercent: number;
  stripe: {
    status: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
    error?: boolean;
  } | null;
  dashboardUrl: string | null;
}

export function useStripeConnect() {
  const { currentOrg: org } = useOrg();
  const [isOnboarding, setIsOnboarding] = useState(false);
  const queryClient = useQueryClient();

  const { data: connectStatus, isLoading, refetch } = useQuery<ConnectStatus>({
    queryKey: ['stripe-connect-status', org?.id],
    queryFn: async () => {
      if (!org?.id) throw new Error('No org');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('stripe-connect-status', {
        body: { orgId: org.id },
      });

      if (res.error) throw new Error(res.error.message);
      return res.data as ConnectStatus;
    },
    enabled: !!org?.id,
    staleTime: 30_000,
  });

  const startOnboarding = useCallback(async () => {
    if (!org?.id) return;
    setIsOnboarding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('stripe-connect-onboard', {
        body: {
          orgId: org.id,
          refreshUrl: `${window.location.origin}/settings?tab=billing&connect=refresh`,
          returnUrl: `${window.location.origin}/settings?tab=billing&connect=return`,
        },
      });

      if (res.error) throw new Error(res.error.message);
      const { url } = res.data;
      if (url) {
        window.location.href = url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start onboarding';
      toast.error(message);
    } finally {
      setIsOnboarding(false);
    }
  }, [org?.id]);

  const refreshStatus = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    connectStatus: connectStatus ?? null,
    isLoading,
    isOnboarding,
    startOnboarding,
    refreshStatus,
    isConnected: connectStatus?.status === 'active',
    isPending: connectStatus?.status === 'pending',
    dashboardUrl: connectStatus?.dashboardUrl ?? null,
  };
}
