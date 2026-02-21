import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { findRateForDuration } from '@/hooks/useRateCards';
import type { Database } from '@/integrations/supabase/types';

type BillingRun = Database['public']['Tables']['billing_runs']['Row'];
type BillingRunType = Database['public']['Enums']['billing_run_type'];

export interface BillingRunWithDetails extends BillingRun {
  summary: {
    invoiceCount: number;
    totalAmount: number;
    invoiceIds?: string[];
  };
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
      return data as BillingRunWithDetails[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCreateBillingRun() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
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
      if (!currentOrg?.id || !user?.id) throw new Error('No organisation or user');

      // 1. Optimistic lock: insert billing_run with 'processing' status first
      //    The unique partial index prevents duplicates for same org + date range
      const { data: billingRun, error: runError } = await supabase
        .from('billing_runs')
        .insert({
          org_id: currentOrg.id,
          run_type: data.run_type,
          start_date: data.start_date,
          end_date: data.end_date,
          created_by: user.id,
          status: 'processing',
          billing_mode: data.billing_mode || 'delivered',
          term_id: data.term_id || null,
          summary: { invoiceCount: 0, totalAmount: 0, invoiceIds: [] },
        })
        .select()
        .single();

      if (runError) {
        // Unique constraint violation = duplicate billing run
        if (runError.code === '23505') {
          throw new Error('A billing run for this period already exists');
        }
        throw runError;
      }

      let invoiceIds: string[] = [];
      try {
        // 2. Fetch rate cards for per-lesson pricing
        const { data: rateCards } = await supabase
          .from('rate_cards')
          .select('*')
          .eq('org_id', currentOrg.id);

        const fallbackRate = data.fallback_rate_minor ?? 3000;

        // 3. Determine which lesson statuses to include based on billing mode
        const billingMode = data.billing_mode || 'delivered';
        const statusFilter: Array<'scheduled' | 'completed' | 'cancelled'> = billingMode === 'upfront'
          ? ['scheduled', 'completed']
          : ['completed'];

        // Get lessons in date range matching billing mode
        let lessonsQuery = supabase
          .from('lessons')
          .select(`
            id,
            title,
            start_at,
            end_at,
            lesson_participants(
              student:students(
                id,
                first_name,
                last_name,
                status,
                student_guardians(
                  guardian:guardians(id, full_name, email),
                  is_primary_payer
                )
              )
            )
          `)
          .eq('org_id', currentOrg.id)
          .gte('start_at', data.start_date)
          .lte('start_at', data.end_date);

        if (statusFilter.length === 1) {
          lessonsQuery = lessonsQuery.eq('status', statusFilter[0]);
        } else {
          lessonsQuery = lessonsQuery.in('status', statusFilter);
        }

        const { data: lessons, error: lessonsError } = await lessonsQuery;
        if (lessonsError) throw lessonsError;

        // Get already billed lesson IDs
        const { data: billedItems } = await supabase
          .from('invoice_items')
          .select('linked_lesson_id')
          .eq('org_id', currentOrg.id)
          .not('linked_lesson_id', 'is', null);

        const billedLessonIds = new Set(billedItems?.map((i) => i.linked_lesson_id) || []);
        const unbilledLessons = lessons?.filter((l) => !billedLessonIds.has(l.id)) || [];

        // Group lessons by payer with deduplication
        const payerGroups = new Map<
          string,
          {
            payerType: 'guardian' | 'student';
            payerId: string;
            payerName: string;
            payerEmail: string | null;
            lessons: typeof unbilledLessons;
            addedLessonIds: Set<string>;
          }
        >();

        unbilledLessons.forEach((lesson) => {
          lesson.lesson_participants?.forEach((lp: any) => {
            const student = lp.student;
            if (!student || student.status !== 'active') return;

            const primaryGuardian = student.student_guardians?.find(
              (sg: any) => sg.is_primary_payer
            )?.guardian;

            if (primaryGuardian) {
              const key = `guardian-${primaryGuardian.id}`;
              if (!payerGroups.has(key)) {
                payerGroups.set(key, {
                  payerType: 'guardian',
                  payerId: primaryGuardian.id,
                  payerName: primaryGuardian.full_name,
                  payerEmail: primaryGuardian.email,
                  lessons: [],
                  addedLessonIds: new Set(),
                });
              }
              const group = payerGroups.get(key)!;
              if (!group.addedLessonIds.has(lesson.id)) {
                group.lessons.push(lesson);
                group.addedLessonIds.add(lesson.id);
              }
            } else if (student.email) {
              const key = `student-${student.id}`;
              if (!payerGroups.has(key)) {
                payerGroups.set(key, {
                  payerType: 'student',
                  payerId: student.id,
                  payerName: `${student.first_name} ${student.last_name}`,
                  payerEmail: student.email,
                  lessons: [],
                  addedLessonIds: new Set(),
                });
              }
              const group = payerGroups.get(key)!;
              if (!group.addedLessonIds.has(lesson.id)) {
                group.lessons.push(lesson);
                group.addedLessonIds.add(lesson.id);
              }
            }
          });
        });

        // Count orphaned lessons (no payer resolved)
        const billedLessonIds2 = new Set<string>();
        for (const [, group] of payerGroups) {
          group.addedLessonIds.forEach(id => billedLessonIds2.add(id));
        }
        const skippedLessons = unbilledLessons.filter(l => !billedLessonIds2.has(l.id));
        const skippedCount = skippedLessons.length;

        invoiceIds = [];
        let totalAmount = 0;
        const failedPayers: Array<{ payerName: string; payerEmail: string | null; error: string }> = [];

        if (data.generate_invoices) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 14);

          for (const [, payer] of payerGroups) {
            try {
              // Calculate per-lesson rates based on duration and rate cards
              const lessonRates = payer.lessons.map((lesson) => {
                const durationMins = differenceInMinutes(new Date(lesson.end_at), new Date(lesson.start_at));
                return findRateForDuration(durationMins, rateCards || [], fallbackRate);
              });
              const subtotal = lessonRates.reduce((sum, r) => sum + r, 0);

              const vatRate = currentOrg.vat_enabled ? currentOrg.vat_rate : 0;
              const taxMinor = Math.round(subtotal * (vatRate / 100));
              const total = subtotal + taxMinor;

              const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                  org_id: currentOrg.id,
                  invoice_number: '',
                  due_date: dueDate.toISOString().split('T')[0],
                  payer_guardian_id: payer.payerType === 'guardian' ? payer.payerId : null,
                  payer_student_id: payer.payerType === 'student' ? payer.payerId : null,
                  subtotal_minor: subtotal,
                  tax_minor: taxMinor,
                  total_minor: total,
                  vat_rate: vatRate,
                  currency_code: currentOrg.currency_code,
                  status: 'draft',
                  term_id: data.term_id || null,
                })
                .select()
                .single();

              if (invoiceError) throw invoiceError;

              invoiceIds.push(invoice.id);
              totalAmount += total;

              const items = payer.lessons.map((lesson, idx) => ({
                invoice_id: invoice.id,
                org_id: currentOrg.id,
                description: lesson.title,
                quantity: 1,
                unit_price_minor: lessonRates[idx],
                amount_minor: lessonRates[idx],
                linked_lesson_id: lesson.id,
              }));

              const { error: itemsError } = await supabase
                .from('invoice_items')
                .insert(items);

              if (itemsError) throw itemsError;
            } catch (payerError: any) {
              console.error(`[BillingRun] Failed for payer ${payer.payerName} (${payer.payerEmail}):`, payerError);
              failedPayers.push({
                payerName: payer.payerName,
                payerEmail: payer.payerEmail,
                error: payerError.message || 'Unknown error',
              });
            }
          }
        }

        // Determine final status
        const totalPayers = payerGroups.size;
        const failedCount = failedPayers.length;
        let finalStatus: Database['public']['Enums']['billing_run_status'];
        if (failedCount === 0) {
          finalStatus = 'completed';
        } else if (failedCount < totalPayers) {
          finalStatus = 'partial';
        } else {
          finalStatus = 'failed';
        }

        const summary = {
          invoiceCount: invoiceIds.length,
          totalAmount,
          invoiceIds,
          skippedLessons: skippedCount,
          ...(failedPayers.length > 0 ? { failedPayers } : {}),
        };

        // Update billing run with final status and summary
        const { error: updateError } = await supabase
          .from('billing_runs')
          .update({
            status: finalStatus,
            summary,
          })
          .eq('id', billingRun.id);

        if (updateError) throw updateError;

        return { ...billingRun, status: finalStatus, summary };
      } catch (innerError) {
        // Clean up any invoices created during this failed run
        if (invoiceIds.length > 0) {
          try {
            await supabase
              .from('invoice_items')
              .delete()
              .in('invoice_id', invoiceIds);
            await supabase
              .from('invoices')
              .delete()
              .in('id', invoiceIds);
          } catch (cleanupError) {
            console.error('[BillingRun] Failed to clean up orphan invoices:', cleanupError);
          }
        }

        // Mark billing run as failed so the date range can be retried
        await supabase
          .from('billing_runs')
          .update({ status: 'failed' })
          .eq('id', billingRun.id);
        throw innerError;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      const summary = data.summary as any;
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

      if (summary.skippedLessons > 0) {
        toast({
          title: 'Warning',
          description: `${summary.skippedLessons} lesson${summary.skippedLessons === 1 ? '' : 's'} skipped — students have no primary payer configured`,
        });
      }
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Billing run failed: ' + error.message, variant: 'destructive' });
    },
  });
}
