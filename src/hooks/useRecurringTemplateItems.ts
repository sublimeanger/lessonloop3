import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type ItemRow = Database['public']['Tables']['recurring_template_items']['Row'];

export type { ItemRow };

export function useRecurringTemplateItems(templateId: string | null) {
  return useQuery({
    queryKey: ['recurring-template-items', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('recurring_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as ItemRow[];
    },
    enabled: !!templateId,
    staleTime: 60 * 1000,
  });
}

export function useSaveTemplateItems() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      templateId: string;
      orgId: string;
      items: Array<{ description: string; amount_minor: number; quantity: number }>;
    }) => {
      const { templateId, orgId, items } = input;

      // Full replace: delete all, insert all. Acceptable for small
      // per-template item counts.
      const { error: delErr } = await supabase
        .from('recurring_template_items')
        .delete()
        .eq('template_id', templateId);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const insertRows = items.map((item, idx) => ({
          template_id: templateId,
          org_id: orgId,
          description: item.description,
          amount_minor: item.amount_minor,
          quantity: item.quantity,
          order_index: idx,
        }));
        const { error: insErr } = await supabase
          .from('recurring_template_items')
          .insert(insertRows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['recurring-template-items', variables.templateId] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to save items',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
