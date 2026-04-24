import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RunTemplateResult {
  run_id: string;
  outcome: 'completed' | 'partial' | 'failed' | 'cancelled' | 'running';
  invoice_count: number;
  recipients_skipped: number;
  recipients_total: number;
  invoice_ids: string[];
  period_start: string;
  period_end: string;
}

export interface RunTemplateOutcome {
  runResult: RunTemplateResult;
  sentCount: number;
  sendFailures: Array<{ invoice_id: string; error: string }>;
}

export function useRunRecurringTemplate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      templateId: string;
      autoSend: boolean;
    }): Promise<RunTemplateOutcome> => {
      const { data, error } = await supabase.rpc(
        'generate_invoices_from_template' as never,
        {
          _template_id: args.templateId,
          _triggered_by: 'manual',
          _source: 'recurring_manual_run',
        } as never,
      );
      if (error) throw error;
      const runResult = data as unknown as RunTemplateResult;

      let sentCount = 0;
      const sendFailures: Array<{ invoice_id: string; error: string }> = [];

      if (args.autoSend && runResult.invoice_ids?.length > 0) {
        for (const invoiceId of runResult.invoice_ids) {
          try {
            const { data: sendData, error: sendErr } =
              await supabase.functions.invoke('send-invoice-email', {
                body: { invoiceId, isReminder: false },
              });

            if (sendErr) {
              sendFailures.push({ invoice_id: invoiceId, error: sendErr.message });
              continue;
            }

            if (
              sendData &&
              typeof sendData === 'object' &&
              'error' in sendData &&
              (sendData as { error?: unknown }).error
            ) {
              sendFailures.push({
                invoice_id: invoiceId,
                error: String((sendData as { error: unknown }).error),
              });
              continue;
            }

            sentCount++;
          } catch (e: unknown) {
            sendFailures.push({
              invoice_id: invoiceId,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }

      return { runResult, sentCount, sendFailures };
    },
    onSuccess: ({ runResult, sentCount, sendFailures }, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoice-templates'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-template-runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });

      const invoiceCount = runResult.invoice_count ?? 0;
      const skipped = runResult.recipients_skipped ?? 0;
      const sentSuffix =
        variables.autoSend && invoiceCount > 0
          ? ` Sent ${sentCount}${
              sendFailures.length ? ` (${sendFailures.length} failed)` : ''
            }.`
          : '';

      if (runResult.outcome === 'completed') {
        toast({
          title: 'Recurring run completed',
          description: `Generated ${invoiceCount} invoice(s).${sentSuffix}`,
        });
      } else if (runResult.outcome === 'partial') {
        toast({
          title: 'Recurring run completed with errors',
          description: `Generated ${invoiceCount}; ${skipped} recipient(s) skipped.${sentSuffix}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Recurring run failed',
          description: `${skipped} recipient(s) skipped, no invoices generated.`,
          variant: 'destructive',
        });
      }
    },
    onError: (err: Error) => {
      toast({
        title: 'Run failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
