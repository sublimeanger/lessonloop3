import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type RecipientRow = Database['public']['Tables']['recurring_template_recipients']['Row'];

// Row joined with student name for UI display.
export interface RecipientWithStudent extends RecipientRow {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    status: string;
  } | null;
}

/**
 * Fetch recipients (both active and paused) for one template.
 * Used by the edit dialog to prepopulate chips and show paused
 * recipients with restore option.
 */
export function useRecurringTemplateRecipients(templateId: string | null) {
  return useQuery({
    queryKey: ['recurring-template-recipients', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('recurring_template_recipients')
        .select('*, student:students(id, first_name, last_name, status)')
        .eq('template_id', templateId)
        .order('added_at', { ascending: true });
      if (error) throw error;
      return (data || []) as RecipientWithStudent[];
    },
    enabled: !!templateId,
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch active-recipient counts for ALL templates in an org via a
 * SINGLE query, grouped client-side. Used by the Settings list to
 * display "No recipients" warning badges WITHOUT firing N queries
 * (one per card).
 */
export function useRecipientCountsForOrg(orgId: string | undefined) {
  return useQuery({
    queryKey: ['recurring-template-recipients-counts', orgId],
    queryFn: async () => {
      if (!orgId) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from('recurring_template_recipients')
        .select('template_id')
        .eq('org_id', orgId)
        .eq('is_active', true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.template_id] = (counts[row.template_id] || 0) + 1;
      }
      return counts;
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useSaveTemplateRecipients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      templateId: string;
      orgId: string;
      studentIds: string[];
      existingRecipients: RecipientRow[];
    }) => {
      const { templateId, orgId, studentIds, existingRecipients } = input;
      const newSet = new Set(studentIds);
      const existingByStudent = new Map(
        existingRecipients.map((r) => [r.student_id, r]),
      );

      // Upsert all currently-selected students. ON CONFLICT flips
      // is_active back true if they were previously paused.
      if (studentIds.length > 0) {
        const upsertRows = studentIds.map((sid) => ({
          template_id: templateId,
          student_id: sid,
          org_id: orgId,
          added_by: user?.id ?? null,
          is_active: true,
        }));
        const { error: upErr } = await supabase
          .from('recurring_template_recipients')
          .upsert(upsertRows, {
            onConflict: 'template_id,student_id',
            ignoreDuplicates: false,
          });
        if (upErr) throw upErr;
      }

      // Mark removed students as paused (preserve history).
      const toPause: string[] = [];
      for (const [sid, row] of existingByStudent) {
        if (!newSet.has(sid) && row.is_active) {
          toPause.push(row.id);
        }
      }
      if (toPause.length > 0) {
        const { error: pauseErr } = await supabase
          .from('recurring_template_recipients')
          .update({ is_active: false })
          .in('id', toPause);
        if (pauseErr) throw pauseErr;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['recurring-template-recipients', variables.templateId] });
      qc.invalidateQueries({ queryKey: ['recurring-template-recipients-counts'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to save recipients',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
