import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface Installment {
  id: string;
  invoice_id: string;
  installment_number: number;
  amount_minor: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'void';
  paid_at: string | null;
  payment_id: string | null;
}

/** Fetch installments for a specific invoice */
export function useInstallments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['installments', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from('invoice_installments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('installment_number', { ascending: true });
      if (error) throw error;
      return data as Installment[];
    },
    enabled: !!invoiceId,
  });
}

/** Generate installments for an invoice via the generate_installments RPC */
export function useGenerateInstallments() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      invoiceId: string;
      count: number;
      frequency: 'weekly' | 'fortnightly' | 'monthly';
      startDate?: string;
      customSchedule?: Array<{ amount_minor: number; due_date: string }>;
    }) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');
      const { data, error } = await supabase.rpc('generate_installments', {
        _invoice_id: params.invoiceId,
        _org_id: currentOrg.id,
        _count: params.count,
        _frequency: params.frequency,
        _start_date: params.startDate || null,
        _custom_schedule: params.customSchedule
          ? JSON.stringify(params.customSchedule)
          : null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['installments', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Payment plan created', description: `${variables.count} installments generated.` });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

/** Remove payment plan — deletes pending/overdue installments and resets invoice flags */
export function useRemovePaymentPlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // Only delete pending/overdue installments (preserve paid records)
      const { error: deleteError } = await supabase
        .from('invoice_installments')
        .delete()
        .eq('invoice_id', invoiceId)
        .in('status', ['pending', 'overdue']);
      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ payment_plan_enabled: false, installment_count: null })
        .eq('id', invoiceId);
      if (updateError) throw updateError;
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['installments', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Payment plan removed' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

/** Fetch all active payment plans across the org (for dashboard widgets) */
export function useActivePaymentPlans() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['active-payment-plans', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_minor,
          paid_minor,
          currency_code,
          installment_count,
          payer_guardian:guardians(id, full_name),
          payer_student:students(id, first_name, last_name),
          invoice_installments(
            id, installment_number, amount_minor,
            due_date, status, paid_at
          )
        `)
        .eq('org_id', currentOrg.id)
        .eq('payment_plan_enabled', true)
        .in('status', ['sent', 'overdue'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });
}
