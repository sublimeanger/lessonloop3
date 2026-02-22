import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type BillingRun = Database['public']['Tables']['billing_runs']['Row'];
type BillingRunType = Database['public']['Enums']['billing_run_type'];

export interface BillingRunSummary {
  invoiceCount: number;
  totalAmount: number;
  invoiceIds?: string[];
  skippedLessons?: number;
  skippedForCancellation?: number;
  failedPayers?: Array<{ payerName: string; payerEmail: string | null; error: string; payerType?: 'guardian' | 'student'; payerId?: string }>;
}

export interface BillingRunWithDetails extends Omit<BillingRun, 'summary'> {
  summary: BillingRunSummary;
}

export function useBillingRuns() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['billing-runs', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('billing_runs')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as BillingRunWithDetails[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCreateBillingRun() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      run_type: BillingRunType;
      start_date: string;
      end_date: string;
      generate_invoices: boolean;
      fallback_rate_minor?: number;
      billing_mode?: 'delivered' | 'upfront';
      term_id?: string;
    }) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data: result, error } = await supabase.functions.invoke('create-billing-run', {
        body: {
          action: 'create',
          org_id: currentOrg.id,
          run_type: data.run_type,
          start_date: data.start_date,
          end_date: data.end_date,
          generate_invoices: data.generate_invoices,
          fallback_rate_minor: data.fallback_rate_minor,
          billing_mode: data.billing_mode,
          term_id: data.term_id,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result as { id: string; status: string; summary: BillingRunSummary };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      const summary = data.summary;
      const failed = summary.failedPayers?.length || 0;

      if (data.status === 'completed') {
        toast({ title: `Billing run completed: ${summary.invoiceCount} invoices created` });
      } else if (data.status === 'partial') {
        toast({
          title: 'Warning',
          description: `${summary.invoiceCount} of ${summary.invoiceCount + failed} invoices created. ${failed} failed — check billing run details`,
        });
      } else {
        toast({ title: 'Error', description: `Billing run failed: all ${failed} invoices could not be created`, variant: 'destructive' });
      }

      if (summary.skippedLessons && summary.skippedLessons > 0) {
        toast({
          title: 'Warning',
          description: `${summary.skippedLessons} lesson${summary.skippedLessons === 1 ? '' : 's'} skipped — students have no primary payer configured`,
        });
      }

      if (summary.skippedForCancellation && summary.skippedForCancellation > 0) {
        toast({
          title: 'Teacher cancellations excluded',
          description: `${summary.skippedForCancellation} lesson-student record${summary.skippedForCancellation === 1 ? '' : 's'} excluded due to teacher cancellations`,
        });
      }
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Billing run failed: ' + error.message, variant: 'destructive' });
    },
  });
}

export function useRetryBillingRunPayers() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ billingRunId, failedPayers }: {
      billingRunId: string;
      failedPayers: NonNullable<BillingRunSummary['failedPayers']>;
    }) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const failedPayerIds = failedPayers.map(fp => fp.payerId).filter(Boolean) as string[];

      const { data: result, error } = await supabase.functions.invoke('create-billing-run', {
        body: {
          action: 'retry',
          org_id: currentOrg.id,
          billing_run_id: billingRunId,
          failed_payer_ids: failedPayerIds,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result as { newInvoiceCount: number; stillFailed: NonNullable<BillingRunSummary['failedPayers']>; finalStatus: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });

      if (data.stillFailed.length === 0) {
        toast({ title: `Retry successful: ${data.newInvoiceCount} invoice${data.newInvoiceCount !== 1 ? 's' : ''} created` });
      } else {
        toast({
          title: 'Partial retry',
          description: `${data.newInvoiceCount} created, ${data.stillFailed.length} still failed`,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({ title: 'Retry failed', description: error.message, variant: 'destructive' });
    },
  });
}
