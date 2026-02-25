import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/error-handler';
import { STALE_SEMI_STABLE } from '@/config/query-stale-times';
import type { LeadActivity, LeadFollowUp } from '@/hooks/useLeads';

// ---------------------------------------------------------------------------
// Activity hooks
// ---------------------------------------------------------------------------

/**
 * Fetch activities for a lead, ordered by created_at DESC.
 */
export function useLeadActivities(leadId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lead-activities', currentOrg?.id, leadId],
    queryFn: async (): Promise<LeadActivity[]> => {
      if (!currentOrg || !leadId) return [];

      const { data, error } = await db
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as LeadActivity[];
    },
    enabled: !!currentOrg && !!leadId,
    staleTime: STALE_SEMI_STABLE,
  });
}

/**
 * Add a note to a lead (creates a 'note_added' activity).
 */
export function useAddLeadNote() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, note }: { leadId: string; note: string }) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await db
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          org_id: currentOrg.id,
          activity_type: 'note_added',
          description: note,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Note added' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to add note');
    },
  });
}

/**
 * Log a call for a lead (creates a 'call_logged' activity).
 */
export function useLogLeadCall() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      leadId,
      summary,
      duration,
      outcome,
    }: {
      leadId: string;
      summary: string;
      duration?: number;
      outcome?: string;
    }) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await db
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          org_id: currentOrg.id,
          activity_type: 'call_logged',
          description: summary,
          metadata: { duration, outcome } as any,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Call logged' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to log call');
    },
  });
}

// ---------------------------------------------------------------------------
// Follow-up hooks
// ---------------------------------------------------------------------------

/**
 * Fetch follow-ups for a lead, ordered by due_at ASC.
 */
export function useLeadFollowUps(leadId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lead-follow-ups', currentOrg?.id, leadId],
    queryFn: async (): Promise<LeadFollowUp[]> => {
      if (!currentOrg || !leadId) return [];

      const { data, error } = await db
        .from('lead_follow_ups')
        .select('*')
        .eq('lead_id', leadId)
        .eq('org_id', currentOrg.id)
        .order('due_at', { ascending: true });

      if (error) throw error;
      return (data || []) as LeadFollowUp[];
    },
    enabled: !!currentOrg && !!leadId,
    staleTime: STALE_SEMI_STABLE,
  });
}

/**
 * Create a follow-up reminder for a lead.
 */
export function useCreateFollowUp() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, dueAt, note }: { leadId: string; dueAt: string; note?: string }) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await db
        .from('lead_follow_ups')
        .insert({
          lead_id: leadId,
          org_id: currentOrg.id,
          due_at: dueAt,
          note: note || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Also log an activity
      await db
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          org_id: currentOrg.id,
          activity_type: 'follow_up_scheduled',
          description: `Follow-up scheduled for ${new Date(dueAt).toLocaleDateString()}`,
          created_by: user.id,
        });

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-follow-ups', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', currentOrg?.id, variables.leadId] });
      toast({ title: 'Follow-up scheduled' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to schedule follow-up');
    },
  });
}

/**
 * Mark a follow-up as completed.
 */
export function useCompleteFollowUp() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ followUpId, leadId }: { followUpId: string; leadId: string }) => {
      if (!currentOrg) throw new Error('No organisation selected');

      const { error } = await db
        .from('lead_follow_ups')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', followUpId)
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      // Log an activity
      await db
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          org_id: currentOrg.id,
          activity_type: 'follow_up_completed',
          description: 'Follow-up completed',
          created_by: user?.id || null,
        });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-follow-ups', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', currentOrg?.id, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', currentOrg?.id, variables.leadId] });
      toast({ title: 'Follow-up completed' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to complete follow-up');
    },
  });
}
