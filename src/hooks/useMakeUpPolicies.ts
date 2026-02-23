import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';

export type AbsenceReason =
  | 'sick'
  | 'school_commitment'
  | 'family_emergency'
  | 'holiday'
  | 'teacher_cancelled'
  | 'weather_closure'
  | 'no_show'
  | 'other';

export type Eligibility = 'automatic' | 'waitlist' | 'admin_discretion' | 'not_eligible';

export interface MakeUpPolicy {
  id: string;
  org_id: string;
  absence_reason: AbsenceReason;
  eligibility: Eligibility;
  description: string | null;
  releases_slot: boolean;
}

const ABSENCE_REASON_LABELS: Record<AbsenceReason, { emoji: string; label: string }> = {
  sick: { emoji: '🤒', label: 'Sick' },
  school_commitment: { emoji: '🏫', label: 'School commitment' },
  family_emergency: { emoji: '🏠', label: 'Family emergency' },
  holiday: { emoji: '✈️', label: 'Holiday' },
  teacher_cancelled: { emoji: '👩‍🏫', label: 'Teacher cancelled' },
  weather_closure: { emoji: '🌧️', label: 'Weather closure' },
  no_show: { emoji: '👻', label: 'No show' },
  other: { emoji: '📋', label: 'Other' },
};

const ELIGIBILITY_OPTIONS: { value: Eligibility; label: string }[] = [
  { value: 'automatic', label: 'Automatic credit' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'admin_discretion', label: 'Admin discretion' },
  { value: 'not_eligible', label: 'Not eligible' },
];

export { ABSENCE_REASON_LABELS, ELIGIBILITY_OPTIONS };

export function useMakeUpPolicies() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const seeded = useRef(false);

  const { data: policies, isLoading, refetch } = useQuery({
    queryKey: ['make_up_policies', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from('make_up_policies')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('absence_reason');
      if (error) throw error;
      return data as MakeUpPolicy[];
    },
    enabled: !!currentOrg?.id,
  });

  // Auto-seed if no policies exist
  useEffect(() => {
    if (!currentOrg?.id || isLoading || seeded.current) return;
    if (policies && policies.length === 0) {
      seeded.current = true;
      supabase.rpc('seed_make_up_policies', { _org_id: currentOrg.id }).then(({ error }) => {
        if (error) {
          logger.error('Failed to seed make-up policies:', error);
        } else {
          refetch();
        }
      });
    }
  }, [currentOrg?.id, policies, isLoading, refetch]);

  const updatePolicy = useMutation({
    mutationFn: async (params: { id: string; eligibility?: Eligibility; releases_slot?: boolean }) => {
      const update: Record<string, unknown> = {};
      if (params.eligibility !== undefined) update.eligibility = params.eligibility;
      if (params.releases_slot !== undefined) update.releases_slot = params.releases_slot;
      const { error } = await supabase
        .from('make_up_policies')
        .update(update)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_policies'] });
      toast({ title: 'Policy updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error updating policy', description: err.message, variant: 'destructive' });
    },
  });

  return { policies: policies ?? [], isLoading, updatePolicy };
}

export function useWaitlistExpiry() {
  const { currentOrg, refreshOrganisations } = useOrg();
  const { toast } = useToast();

  const updateExpiry = useMutation({
    mutationFn: async (weeks: number) => {
      if (!currentOrg?.id) throw new Error('No org');
      const { error } = await supabase
        .from('organisations')
        .update({ make_up_waitlist_expiry_weeks: weeks })
        .eq('id', currentOrg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Waitlist expiry updated' });
      refreshOrganisations();
    },
    onError: (err: Error) => {
      toast({ title: 'Error updating expiry', description: err.message, variant: 'destructive' });
    },
  });

  return {
    expiryWeeks: currentOrg?.make_up_waitlist_expiry_weeks ?? 8,
    updateExpiry,
  };
}
