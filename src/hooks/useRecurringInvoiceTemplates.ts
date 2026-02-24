import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type RecurringTemplate = Database['public']['Tables']['recurring_invoice_templates']['Row'];
type RecurringTemplateInsert = Database['public']['Tables']['recurring_invoice_templates']['Insert'];

export type { RecurringTemplate };

export function useRecurringInvoiceTemplates() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['recurring-invoice-templates', currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_invoice_templates')
        .select('*')
        .eq('org_id', currentOrg!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RecurringTemplate[];
    },
    enabled: !!currentOrg?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateRecurringTemplate() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      frequency: string;
      billing_mode: string;
      auto_send: boolean;
      next_run_date: string;
    }) => {
      const { data, error } = await supabase
        .from('recurring_invoice_templates')
        .insert({
          org_id: currentOrg!.id,
          created_by: user!.id,
          name: input.name,
          frequency: input.frequency,
          billing_mode: input.billing_mode,
          auto_send: input.auto_send,
          next_run_date: input.next_run_date,
        } satisfies RecurringTemplateInsert)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoice-templates'] });
      toast({ title: 'Template created', description: 'Recurring billing template has been created.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create template', description: err.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRecurringTemplate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      frequency?: string;
      billing_mode?: string;
      auto_send?: boolean;
      next_run_date?: string;
      active?: boolean;
    }) => {
      const { id, ...updates } = input;
      const { error } = await supabase
        .from('recurring_invoice_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoice-templates'] });
      toast({ title: 'Template updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update template', description: err.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRecurringTemplate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_invoice_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoice-templates'] });
      toast({ title: 'Template deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete template', description: err.message, variant: 'destructive' });
    },
  });
}
