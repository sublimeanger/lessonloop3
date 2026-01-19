import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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

  return useMutation({
    mutationFn: async (data: {
      run_type: BillingRunType;
      start_date: string;
      end_date: string;
      generate_invoices: boolean;
      lesson_rate_minor: number;
    }) => {
      if (!currentOrg?.id || !user?.id) throw new Error('No organisation or user');

      // Get unbilled completed lessons in date range
      const { data: lessons, error: lessonsError } = await supabase
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
              student_guardians(
                guardian:guardians(id, full_name, email),
                is_primary_payer
              )
            )
          )
        `)
        .eq('org_id', currentOrg.id)
        .eq('status', 'completed')
        .gte('start_at', data.start_date)
        .lte('start_at', data.end_date);

      if (lessonsError) throw lessonsError;

      // Get already billed lesson IDs
      const { data: billedItems } = await supabase
        .from('invoice_items')
        .select('linked_lesson_id')
        .eq('org_id', currentOrg.id)
        .not('linked_lesson_id', 'is', null);

      const billedLessonIds = new Set(billedItems?.map((i) => i.linked_lesson_id) || []);
      const unbilledLessons = lessons?.filter((l) => !billedLessonIds.has(l.id)) || [];

      // Group lessons by payer (guardian or adult student)
      const payerGroups = new Map<
        string,
        {
          payerType: 'guardian' | 'student';
          payerId: string;
          payerName: string;
          payerEmail: string | null;
          lessons: typeof unbilledLessons;
        }
      >();

      unbilledLessons.forEach((lesson) => {
        lesson.lesson_participants?.forEach((lp: any) => {
          const student = lp.student;
          if (!student) return;

          // Find primary payer guardian
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
              });
            }
            payerGroups.get(key)!.lessons.push(lesson);
          } else if (student.email) {
            // Adult student pays for themselves
            const key = `student-${student.id}`;
            if (!payerGroups.has(key)) {
              payerGroups.set(key, {
                payerType: 'student',
                payerId: student.id,
                payerName: `${student.first_name} ${student.last_name}`,
                payerEmail: student.email,
                lessons: [],
              });
            }
            payerGroups.get(key)!.lessons.push(lesson);
          }
        });
      });

      let invoiceIds: string[] = [];
      let totalAmount = 0;

      if (data.generate_invoices) {
        // Generate invoices for each payer
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 2 weeks from now

        for (const [, payer] of payerGroups) {
          const subtotal = payer.lessons.length * data.lesson_rate_minor;
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
            })
            .select()
            .single();

          if (invoiceError) throw invoiceError;

          invoiceIds.push(invoice.id);
          totalAmount += total;

          // Create invoice items
          const items = payer.lessons.map((lesson) => ({
            invoice_id: invoice.id,
            org_id: currentOrg.id,
            description: lesson.title,
            quantity: 1,
            unit_price_minor: data.lesson_rate_minor,
            amount_minor: data.lesson_rate_minor,
            linked_lesson_id: lesson.id,
          }));

          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(items);

          if (itemsError) throw itemsError;
        }
      }

      // Create billing run record
      const { data: billingRun, error: runError } = await supabase
        .from('billing_runs')
        .insert({
          org_id: currentOrg.id,
          run_type: data.run_type,
          start_date: data.start_date,
          end_date: data.end_date,
          created_by: user.id,
          status: 'completed',
          summary: {
            invoiceCount: invoiceIds.length,
            totalAmount,
            invoiceIds,
          },
        })
        .select()
        .single();

      if (runError) throw runError;

      return billingRun;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      const summary = data.summary as any;
      toast.success(
        `Billing run completed: ${summary.invoiceCount} invoices created`
      );
    },
    onError: (error) => {
      toast.error('Billing run failed: ' + error.message);
    },
  });
}
