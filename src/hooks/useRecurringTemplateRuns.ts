import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Run = Database['public']['Tables']['recurring_template_runs']['Row'];
type ErrorRow = Database['public']['Tables']['recurring_template_run_errors']['Row'];

export type RunRow = Run & { parent_run_id?: string | null };

export interface RunWithTemplate extends RunRow {
  template: { id: string; name: string } | null;
}

export interface RunDetail {
  run: RunRow;
  errors: ErrorRow[];
  parent: RunRow | null;
}

export interface RetryResult {
  run_id: string | null;
  parent_run_id: string;
  outcome: 'completed' | 'partial' | 'failed' | 'completed_empty';
  invoice_count: number;
  recipients_skipped: number;
  recipients_total: number;
  invoice_ids: string[];
  period_start: string;
  period_end: string;
  note?: string;
}

export interface CancelResult {
  run_id: string;
  voided_invoice_count: number;
}

/**
 * All runs for one template, ordered newest first. Limit 50 — detail
 * page shows the latest, older runs are rarely inspected.
 */
export function useRecurringTemplateRuns(templateId: string | null) {
  return useQuery({
    queryKey: ['recurring-template-runs', templateId],
    queryFn: async () => {
      if (!templateId) return [] as RunRow[];
      const { data, error } = await supabase
        .from('recurring_template_runs')
        .select('*')
        .eq('template_id', templateId)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as RunRow[];
    },
    enabled: !!templateId,
    staleTime: 60 * 1000,
  });
}

/**
 * Full detail for one run — the run row, its error rows, and its
 * parent run (if this run was itself a retry).
 */
export function useRecurringTemplateRun(runId: string | null) {
  return useQuery({
    queryKey: ['recurring-template-run', runId],
    queryFn: async (): Promise<RunDetail | null> => {
      if (!runId) return null;

      const [runRes, errorsRes] = await Promise.all([
        supabase
          .from('recurring_template_runs')
          .select('*')
          .eq('id', runId)
          .maybeSingle(),
        supabase
          .from('recurring_template_run_errors')
          .select('*')
          .eq('run_id', runId)
          .order('occurred_at', { ascending: true }),
      ]);

      if (runRes.error) throw runRes.error;
      if (errorsRes.error) throw errorsRes.error;
      if (!runRes.data) return null;

      const run = runRes.data as RunRow;
      let parent: RunRow | null = null;
      if (run.parent_run_id) {
        const { data: parentData, error: parentErr } = await supabase
          .from('recurring_template_runs')
          .select('*')
          .eq('id', run.parent_run_id)
          .maybeSingle();
        if (parentErr) throw parentErr;
        parent = (parentData as RunRow | null) ?? null;
      }

      return {
        run,
        errors: (errorsRes.data || []) as ErrorRow[],
        parent,
      };
    },
    enabled: !!runId,
    staleTime: 30 * 1000,
  });
}

/**
 * Org-wide recent partial/failed runs in the last 14 days. Single
 * query joined with template name. Used by dashboard card + failure
 * banner. Limit 10.
 */
export function useRecentPartialOrFailedRuns(orgId: string | undefined) {
  return useQuery({
    queryKey: ['recurring-template-runs-recent-partial-failed', orgId],
    queryFn: async () => {
      if (!orgId) return [] as RunWithTemplate[];
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const { data, error } = await supabase
        .from('recurring_template_runs')
        .select('*, template:recurring_invoice_templates!template_id(id, name)')
        .eq('org_id', orgId)
        .in('outcome', ['partial', 'failed'])
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as RunWithTemplate[];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useCancelTemplateRun() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string): Promise<CancelResult> => {
      // TODO: cancel_template_run is typed in types.ts post-Phase 2,
      // but we cast here for defensive parity with other RPC hooks.
      const { data, error } = await (supabase.rpc as any)(
        'cancel_template_run',
        { _run_id: runId },
      );
      if (error) throw error;
      return data as CancelResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-template-runs'] });
      qc.invalidateQueries({ queryKey: ['recurring-template-run'] });
      qc.invalidateQueries({ queryKey: ['recurring-template-runs-recent-partial-failed'] });
      qc.invalidateQueries({ queryKey: ['recurring-invoice-templates'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to cancel run',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRetryFailedRecipients() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string): Promise<RetryResult> => {
      // TODO: remove `as any` once types.ts regenerates post-deploy of
      // C1's migration (retry_failed_recipients RPC).
      const { data, error } = await (supabase.rpc as any)(
        'retry_failed_recipients',
        { _run_id: runId },
      );
      if (error) throw error;
      return data as RetryResult;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['recurring-template-runs'] });
      qc.invalidateQueries({ queryKey: ['recurring-template-run'] });
      qc.invalidateQueries({ queryKey: ['recurring-template-runs-recent-partial-failed'] });
      qc.invalidateQueries({ queryKey: ['recurring-invoice-templates'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });

      if (result.outcome === 'completed_empty') {
        toast({
          title: 'Nothing to retry',
          description: 'No retryable error rows on this run.',
        });
        return;
      }

      if (result.outcome === 'completed') {
        toast({
          title: 'Retry completed',
          description: `Generated ${result.invoice_count} invoice(s).`,
        });
      } else if (result.outcome === 'partial') {
        toast({
          title: 'Retry completed with errors',
          description: `Generated ${result.invoice_count}; ${result.recipients_skipped} recipient(s) still failed.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Retry failed',
          description: `${result.recipients_skipped} recipient(s) failed, no invoices generated.`,
          variant: 'destructive',
        });
      }
    },
    onError: (err: Error) => {
      toast({
        title: 'Retry failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
