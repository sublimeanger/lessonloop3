import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
}

interface ListResponse {
  paymentMethods: SavedCard[];
  defaultPaymentMethodId: string | null;
  autoPayEnabled: boolean;
}

export function useSavedPaymentMethods() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orgId = currentOrg?.id;

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['saved-payment-methods', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-list-payment-methods', {
        body: { orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ListResponse;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const removeMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const { data, error } = await supabase.functions.invoke('stripe-detach-payment-method', {
        body: { paymentMethodId, orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-payment-methods', orgId] });
      toast({ title: 'Card removed' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to remove card',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return {
    cards: data?.paymentMethods || [],
    defaultPaymentMethodId: data?.defaultPaymentMethodId || null,
    autoPayEnabled: data?.autoPayEnabled || false,
    isLoading,
    error,
    removeCard: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  };
}
