import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type RateCard = Tables<'rate_cards'>;
export type RateCardInsert = Omit<TablesInsert<'rate_cards'>, 'org_id'>;
export type RateCardUpdate = TablesUpdate<'rate_cards'>;

export function useRateCards() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['rate-cards', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('rate_cards')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('duration_mins', { ascending: true });

      if (error) throw error;
      return data as RateCard[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCreateRateCard() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rateCard: RateCardInsert) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      // If setting as default, unset other defaults first
      if (rateCard.is_default) {
        await supabase
          .from('rate_cards')
          .update({ is_default: false })
          .eq('org_id', currentOrg.id);
      }

      const { data, error } = await supabase
        .from('rate_cards')
        .insert({ ...rateCard, org_id: currentOrg.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
      toast({ title: 'Rate card created', description: 'The rate card has been added.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRateCard() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: RateCardUpdate & { id: string }) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      // If setting as default, unset other defaults first
      if (updates.is_default) {
        await supabase
          .from('rate_cards')
          .update({ is_default: false })
          .eq('org_id', currentOrg.id)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('rate_cards')
        .update(updates)
        .eq('id', id)
        .eq('org_id', currentOrg.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
      toast({ title: 'Rate card updated', description: 'The rate card has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRateCard() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      // Fetch all rate cards to check if this is the only one or the default
      const { data: allCards } = await supabase
        .from('rate_cards')
        .select('id, is_default')
        .eq('org_id', currentOrg.id);

      const cards = allCards || [];
      const target = cards.find(c => c.id === id);

      if (cards.length <= 1) {
        throw new Error('Cannot delete the only rate card. Create another one first.');
      }

      if (target?.is_default) {
        throw new Error('Cannot delete the default rate card. Set another card as default first.');
      }

      // Warn about students using this rate card (non-blocking)
      const { count: studentCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('default_rate_card_id', id);

      if ((studentCount ?? 0) > 0) {
        toast({
          title: `${studentCount} student${studentCount !== 1 ? 's' : ''} use this rate card`,
          description: 'They will fall back to the org default rate.',
        });
      }

      const { error } = await supabase
        .from('rate_cards')
        .delete()
        .eq('id', id)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
      toast({ title: 'Rate card deleted', description: 'The rate card has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Cannot delete rate card', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Find the best matching rate card for a lesson duration
 * Returns rate in minor units (pence)
 */
export function findRateForDuration(
  durationMins: number,
  rateCards: RateCard[],
  fallbackMinor: number = 3000
): number {
  if (!rateCards.length) return fallbackMinor;

  // First try exact match
  const exactMatch = rateCards.find((r) => r.duration_mins === durationMins);
  if (exactMatch) return exactMatch.rate_amount;

  // Then try default
  const defaultCard = rateCards.find((r) => r.is_default);
  if (defaultCard) return defaultCard.rate_amount;

  // Fall back to first card or fallback value
  return rateCards[0]?.rate_amount || fallbackMinor;
}
