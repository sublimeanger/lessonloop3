import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/auditLog';
import { STALE_VOLATILE, STALE_SEMI_STABLE } from '@/config/query-stale-times';

// ── Types ───────────────────────────────────────────────────────────────

export type ContinuationRunStatus =
  | 'draft'
  | 'sent'
  | 'reminding'
  | 'deadline_passed'
  | 'completed';

export type ContinuationResponseType =
  | 'pending'
  | 'continuing'
  | 'withdrawing'
  | 'assumed_continuing'
  | 'no_response';

export interface ContinuationRunSummary {
  total_students: number;
  confirmed: number;
  withdrawing: number;
  pending: number;
  no_response: number;
  assumed_continuing: number;
}

export interface ContinuationRun {
  id: string;
  org_id: string;
  current_term_id: string;
  next_term_id: string;
  notice_deadline: string;
  reminder_schedule: number[];
  assumed_continuing: boolean;
  status: ContinuationRunStatus;
  sent_at: string | null;
  deadline_passed_at: string | null;
  completed_at: string | null;
  summary: ContinuationRunSummary;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  current_term?: { name: string; start_date: string; end_date: string };
  next_term?: { name: string; start_date: string; end_date: string };
}

export interface LessonSummaryItem {
  recurrence_id: string;
  day: string;
  time: string;
  teacher_name: string | null;
  instrument: string | null;
  duration_mins: number;
  rate_minor: number;
  lessons_next_term: number;
}

export interface ContinuationResponseEntry {
  id: string;
  run_id: string;
  student_id: string;
  guardian_id: string;
  lesson_summary: LessonSummaryItem[];
  response: ContinuationResponseType;
  response_at: string | null;
  response_method: string | null;
  withdrawal_reason: string | null;
  withdrawal_notes: string | null;
  is_processed: boolean;
  processed_at: string | null;
  next_term_fee_minor: number | null;
  initial_sent_at: string | null;
  reminder_count: number;
  created_at: string;
  // Joined
  student?: { id: string; first_name: string; last_name: string };
  guardian?: { id: string; full_name: string; email: string | null };
}

export interface CreateRunPreviewItem {
  student_name: string;
  guardian_name: string;
  guardian_email: string | null;
  lesson_count: number;
  fee_minor: number;
  has_email: boolean;
}

export interface CreateRunResult {
  run_id: string;
  total_students: number;
  summary: ContinuationRunSummary;
  preview: CreateRunPreviewItem[];
}

export interface SendResult {
  sent_count: number;
  failed: Array<{ guardian_name: string; email: string | null; error: string }>;
}

// ── Queries ─────────────────────────────────────────────────────────────

export function useContinuationRuns() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['continuation-runs', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await (supabase as any)
        .from('term_continuation_runs')
        .select(`
          *,
          current_term:terms!term_continuation_runs_current_term_id_fkey(name, start_date, end_date),
          next_term:terms!term_continuation_runs_next_term_id_fkey(name, start_date, end_date)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ContinuationRun[];
    },
    enabled: !!currentOrg?.id,
    staleTime: STALE_SEMI_STABLE,
  });
}

export function useContinuationRun(runId: string | null) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['continuation-run', currentOrg?.id, runId],
    queryFn: async () => {
      if (!currentOrg?.id || !runId) return null;

      const { data, error } = await (supabase as any)
        .from('term_continuation_runs')
        .select(`
          *,
          current_term:terms!term_continuation_runs_current_term_id_fkey(name, start_date, end_date),
          next_term:terms!term_continuation_runs_next_term_id_fkey(name, start_date, end_date)
        `)
        .eq('id', runId)
        .eq('org_id', currentOrg.id)
        .single();

      if (error) throw error;
      return data as ContinuationRun;
    },
    enabled: !!currentOrg?.id && !!runId,
    staleTime: STALE_VOLATILE,
  });
}

export function useContinuationResponses(
  runId: string | null,
  filter?: ContinuationResponseType
) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['continuation-responses', currentOrg?.id, runId, filter],
    queryFn: async () => {
      if (!currentOrg?.id || !runId) return [];

      let query = (supabase as any)
        .from('term_continuation_responses')
        .select(`
          *,
          student:students(id, first_name, last_name),
          guardian:guardians(id, full_name, email)
        `)
        .eq('run_id', runId)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: true });

      if (filter) {
        query = query.eq('response', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContinuationResponseEntry[];
    },
    enabled: !!currentOrg?.id && !!runId,
    staleTime: STALE_VOLATILE,
  });
}

export function useParentContinuationPending() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-continuation-pending', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg?.id || !user?.id) return [];

      // Find guardian for current user
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!guardian) return [];

      const { data, error } = await (supabase as any)
        .from('term_continuation_responses')
        .select(`
          *,
          student:students(id, first_name, last_name),
          run:term_continuation_runs(
            id, status, notice_deadline, assumed_continuing,
            next_term:terms!term_continuation_runs_next_term_id_fkey(name, start_date, end_date)
          )
        `)
        .eq('guardian_id', guardian.id)
        .eq('org_id', currentOrg.id)
        .eq('response', 'pending');

      if (error) throw error;
      // Only include responses where the run is actively collecting
      return ((data || []) as any[]).filter(
        (r: any) => r.run && ['sent', 'reminding'].includes(r.run.status)
      );
    },
    enabled: !!currentOrg?.id && !!user?.id,
    staleTime: STALE_VOLATILE,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────

export function useCreateContinuationRun() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      current_term_id: string;
      next_term_id: string;
      notice_deadline: string;
      assumed_continuing: boolean;
      reminder_schedule: number[];
    }) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data: result, error } = await supabase.functions.invoke(
        'create-continuation-run',
        {
          body: {
            action: 'create',
            org_id: currentOrg.id,
            ...data,
          },
        }
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result as CreateRunResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuation-runs'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create continuation run',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSendContinuationRun() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (runId: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data: result, error } = await supabase.functions.invoke(
        'create-continuation-run',
        {
          body: {
            action: 'send',
            org_id: currentOrg.id,
            run_id: runId,
          },
        }
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result as SendResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['continuation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-responses'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-run'] });

      const failedCount = data.failed?.length || 0;
      if (failedCount === 0) {
        toast({
          title: `Notifications sent to ${data.sent_count} families`,
        });
      } else {
        toast({
          title: `Sent to ${data.sent_count} families, ${failedCount} failed`,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to send notifications',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSendContinuationReminders() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (runId: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data: result, error } = await supabase.functions.invoke(
        'create-continuation-run',
        {
          body: {
            action: 'send_reminders',
            org_id: currentOrg.id,
            run_id: runId,
          },
        }
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['continuation-responses'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-run'] });
      toast({
        title: `Reminders sent to ${data.reminded_count} families`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to send reminders',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useProcessDeadline() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (runId: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data: result, error } = await supabase.functions.invoke(
        'create-continuation-run',
        {
          body: {
            action: 'process_deadline',
            org_id: currentOrg.id,
            run_id: runId,
          },
        }
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result as { summary: ContinuationRunSummary };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['continuation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-run'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-responses'] });
      toast({
        title: 'Deadline processed',
        description: `${data.summary.confirmed + data.summary.assumed_continuing} continuing, ${data.summary.withdrawing} withdrawing, ${data.summary.no_response} no response`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to process deadline',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRespondToContinuation() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      response_id: string;
      response: ContinuationResponseType;
      withdrawal_reason?: string;
      withdrawal_notes?: string;
    }) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { error } = await (supabase as any)
        .from('term_continuation_responses')
        .update({
          response: data.response,
          response_at: new Date().toISOString(),
          response_method: 'admin_manual',
          withdrawal_reason: data.withdrawal_reason || null,
          withdrawal_notes: data.withdrawal_notes || null,
        })
        .eq('id', data.response_id)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuation-responses'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-run'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-runs'] });
      toast({ title: 'Response updated' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update response',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBulkProcessContinuation() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      run_id: string;
      next_term_end_date: string;
      next_term_start_date: string;
      process_type: 'confirmed' | 'withdrawals' | 'all';
    }) => {
      if (!currentOrg?.id || !user?.id) {
        throw new Error('No organisation selected');
      }

      // Get responses to process
      const responseFilter: ContinuationResponseType[] =
        data.process_type === 'confirmed'
          ? ['continuing', 'assumed_continuing']
          : data.process_type === 'withdrawals'
            ? ['withdrawing']
            : ['continuing', 'assumed_continuing', 'withdrawing'];

      const { data: responses, error: respError } = await (supabase as any)
        .from('term_continuation_responses')
        .select('id, student_id, response, lesson_summary, run_id')
        .eq('run_id', data.run_id)
        .eq('org_id', currentOrg.id)
        .eq('is_processed', false)
        .in('response', responseFilter);

      if (respError) throw respError;

      let processedCount = 0;
      let extendedCount = 0;
      let withdrawnCount = 0;

      for (const resp of responses || []) {
        if (['continuing', 'assumed_continuing'].includes(resp.response)) {
          // Extend recurrences into next term
          const lessons = resp.lesson_summary || [];
          for (const lesson of lessons) {
            if (!lesson.recurrence_id) continue;

            // Check current end_date of recurrence
            const { data: rec } = await (supabase as any)
              .from('recurrence_rules')
              .select('id, end_date')
              .eq('id', lesson.recurrence_id)
              .single();

            if (rec && rec.end_date && rec.end_date < data.next_term_end_date) {
              await (supabase as any)
                .from('recurrence_rules')
                .update({ end_date: data.next_term_end_date })
                .eq('id', lesson.recurrence_id);
            }
          }
          extendedCount++;
        } else if (resp.response === 'withdrawing') {
          // For withdrawals, we create term adjustments via the edge function
          const lessons = resp.lesson_summary || [];
          let anyWithdrawalSucceeded = false;
          for (const lesson of lessons) {
            if (!lesson.recurrence_id) continue;

            try {
              // Preview — use next term start date so cancellation begins from the correct boundary
              const { data: previewResult, error: prevError } =
                await supabase.functions.invoke('process-term-adjustment', {
                  body: {
                    action: 'preview',
                    org_id: currentOrg.id,
                    adjustment_type: 'withdrawal',
                    student_id: resp.student_id,
                    recurrence_id: lesson.recurrence_id,
                    effective_date: data.next_term_start_date,
                  },
                });

              if (prevError || previewResult?.error) continue;

              // Confirm
              const { data: confirmResult } =
                await supabase.functions.invoke('process-term-adjustment', {
                  body: {
                    action: 'confirm',
                    org_id: currentOrg.id,
                    adjustment_type: 'withdrawal',
                    student_id: resp.student_id,
                    recurrence_id: lesson.recurrence_id,
                    effective_date: data.next_term_start_date,
                    adjustment_id: previewResult.adjustment_id,
                    generate_credit_note: true,
                  },
                });

              if (confirmResult?.adjustment_id) {
                anyWithdrawalSucceeded = true;
                // Store term_adjustment_id
                await (supabase as any)
                  .from('term_continuation_responses')
                  .update({ term_adjustment_id: confirmResult.adjustment_id })
                  .eq('id', resp.id);
              }
            } catch {
              // Continue processing other lessons for this response
            }
          }

          // Only count and mark processed if at least one withdrawal succeeded
          if (!anyWithdrawalSucceeded && lessons.length > 0) continue;
          withdrawnCount++;
        }

        // Mark as processed
        await (supabase as any)
          .from('term_continuation_responses')
          .update({
            is_processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('id', resp.id);

        processedCount++;
      }

      // If all responses are now processed, mark run as completed
      const { data: unprocessed } = await (supabase as any)
        .from('term_continuation_responses')
        .select('id')
        .eq('run_id', data.run_id)
        .eq('is_processed', false)
        .limit(1);

      if (!unprocessed || unprocessed.length === 0) {
        await (supabase as any)
          .from('term_continuation_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', data.run_id);
      }

      logAudit(
        currentOrg.id,
        user.id,
        'continuation_run.processed',
        'term_continuation_run',
        data.run_id,
        {
          after: { processedCount, extendedCount, withdrawnCount },
        }
      );

      return { processedCount, extendedCount, withdrawnCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['continuation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-run'] });
      queryClient.invalidateQueries({ queryKey: ['continuation-responses'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      queryClient.invalidateQueries({ queryKey: ['term-adjustments'] });

      const parts: string[] = [];
      if (data.extendedCount > 0) {
        parts.push(`${data.extendedCount} student${data.extendedCount !== 1 ? 's' : ''} extended`);
      }
      if (data.withdrawnCount > 0) {
        parts.push(`${data.withdrawnCount} withdrawal${data.withdrawnCount !== 1 ? 's' : ''} processed`);
      }

      toast({
        title: 'Processing complete',
        description: parts.join(', ') || `${data.processedCount} responses processed`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Processing failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useParentRespondToContinuation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      run_id: string;
      student_id: string;
      response: 'continuing' | 'withdrawing';
      withdrawal_reason?: string;
      withdrawal_notes?: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke(
        'continuation-respond',
        { body: data }
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['parent-continuation-pending'],
      });
      toast({
        title:
          data.response === 'continuing'
            ? `${data.student_name} confirmed for next term`
            : `Withdrawal recorded for ${data.student_name}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to submit response',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
