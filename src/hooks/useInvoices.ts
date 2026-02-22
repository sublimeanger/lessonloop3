import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type InvoiceStatus = Database['public']['Enums']['invoice_status'];

export interface InvoiceWithDetails extends Invoice {
  items?: InvoiceItem[];
  payments?: Payment[];
  payer_guardian?: { id: string; full_name: string; email: string | null } | null;
  payer_student?: { id: string; first_name: string; last_name: string; email: string | null } | null;
}

export interface InvoiceFilters {
  status?: InvoiceStatus | 'all';
  payerType?: 'guardian' | 'student' | 'all';
  payerId?: string;
  teacherId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  termId?: string;
}

export function useInvoices(filters: InvoiceFilters = {}) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['invoices', currentOrg?.id, filters],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      let query = supabase
        .from('invoices')
        .select(`
          *,
          payer_guardian:guardians(id, full_name, email),
          payer_student:students(id, first_name, last_name, email)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.dueDateFrom) {
        query = query.gte('due_date', filters.dueDateFrom);
      }

      if (filters.dueDateTo) {
        query = query.lte('due_date', filters.dueDateTo);
      }

      if (filters.payerId) {
        if (filters.payerType === 'guardian') {
          query = query.eq('payer_guardian_id', filters.payerId);
        } else if (filters.payerType === 'student') {
          query = query.eq('payer_student_id', filters.payerId);
        }
      }

      if (filters.termId) {
        query = query.eq('term_id', filters.termId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InvoiceWithDetails[];
    },
    enabled: !!currentOrg?.id,
    staleTime: 30_000, // 30 seconds — avoid refetch on navigation
  });
}

export function useInvoice(id: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (!id || !currentOrg?.id) return null;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          payer_guardian:guardians(id, full_name, email, phone),
          payer_student:students(id, first_name, last_name, email, phone)
        `)
        .eq('id', id)
        .eq('org_id', currentOrg.id)
        .single();

      if (invoiceError) throw invoiceError;

      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select(`
          *,
          student:students(id, first_name, last_name),
          linked_lesson:lessons(id, title, start_at)
        `)
        .eq('invoice_id', id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', id)
        .order('paid_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      return {
        ...invoice,
        items: items || [],
        payments: payments || [],
      } as InvoiceWithDetails;
    },
    enabled: !!id && !!currentOrg?.id,
  });
}

export function useInvoiceStats() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['invoice-stats', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return null;

      const { data, error } = await supabase.rpc('get_invoice_stats', {
        _org_id: currentOrg.id,
      });

      if (error) throw error;

      const result = data as {
        total_outstanding: number;
        overdue: number;
        overdue_count: number;
        draft_count: number;
        paid_total: number;
        paid_count: number;
      };

      return {
        totalOutstanding: result.total_outstanding ?? 0,
        overdue: result.overdue ?? 0,
        overdueCount: result.overdue_count ?? 0,
        draft: 0,
        draftCount: result.draft_count ?? 0,
        sent: 0,
        sentCount: 0,
        paid: result.paid_total ?? 0,
        paidCount: result.paid_count ?? 0,
      };
    },
    enabled: !!currentOrg?.id,
    staleTime: 60_000, // 1 minute — stats don't change frequently
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      due_date: string;
      payer_guardian_id?: string | null;
      payer_student_id?: string | null;
      notes?: string;
      vat_rate?: number;
      credit_ids?: string[];
      items: Array<{
        description: string;
        quantity: number;
        unit_price_minor: number;
        linked_lesson_id?: string | null;
        student_id?: string | null;
      }>;
    }) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price_minor,
        0
      );
      const vatRate = data.vat_rate ?? (currentOrg.vat_enabled ? currentOrg.vat_rate : 0);
      const taxMinor = Math.round(subtotal * (vatRate / 100));
      
      let creditOffsetMinor = 0;
      if (data.credit_ids && data.credit_ids.length > 0) {
        const { data: credits, error: creditsError } = await supabase
          .from('make_up_credits')
          .select('id, credit_value_minor')
          .in('id', data.credit_ids)
          .is('redeemed_at', null);

        if (creditsError) throw creditsError;
        creditOffsetMinor = credits?.reduce((sum, c) => sum + c.credit_value_minor, 0) || 0;
      }

      const totalMinor = Math.max(0, subtotal + taxMinor - creditOffsetMinor);

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          org_id: currentOrg.id,
          invoice_number: '',
          due_date: data.due_date,
          payer_guardian_id: data.payer_guardian_id || null,
          payer_student_id: data.payer_student_id || null,
          notes: data.notes || null,
          vat_rate: vatRate,
          subtotal_minor: subtotal,
          tax_minor: taxMinor,
          credit_applied_minor: creditOffsetMinor,
          total_minor: totalMinor,
          currency_code: currentOrg.currency_code,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const itemsToInsert = data.items.map((item) => ({
        invoice_id: invoice.id,
        org_id: currentOrg.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_minor: item.unit_price_minor,
        amount_minor: item.quantity * item.unit_price_minor,
        linked_lesson_id: item.linked_lesson_id || null,
        student_id: item.student_id || null,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      if (data.credit_ids && data.credit_ids.length > 0) {
        const { error: redeemError } = await supabase
          .from('make_up_credits')
          .update({
            redeemed_at: new Date().toISOString(),
            notes: `Applied to invoice_id:${invoice.id}`,
          })
          .in('id', data.credit_ids);

        if (redeemError) {
          logger.error('Failed to mark credits as redeemed:', redeemError);
          // Invoice is created but credits weren't marked as redeemed
          // Return the invoice but flag the issue for the caller
          return { ...invoice, _creditRedemptionFailed: true };
        }
      }

      return invoice;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      queryClient.invalidateQueries({ queryKey: ['available-credits-for-payer'] });
      if (data._creditRedemptionFailed) {
        toast({ title: 'Warning', description: 'Invoice created, but credits could not be marked as redeemed. Please check the credits manually.', variant: 'destructive' });
      } else {
        toast({ title: 'Invoice created' });
      }
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to create invoice: ' + error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Restore make-up credits when voiding an invoice
      if (status === 'void') {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('credit_applied_minor')
          .eq('id', id)
          .single();

        if (invoice && invoice.credit_applied_minor > 0) {
          const { error: restoreError } = await supabase
            .from('make_up_credits')
            .update({ redeemed_at: null, notes: `Credit restored — invoice ${id} voided` })
            .like('notes', `%${id}%`)
            .not('redeemed_at', 'is', null);

          if (restoreError) {
            logger.error('Failed to restore credits on void:', restoreError);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      queryClient.invalidateQueries({ queryKey: ['available-credits-for-payer'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to update invoice: ' + error.message, variant: 'destructive' });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      invoice_id: string;
      amount_minor: number;
      method: Database['public']['Enums']['payment_method'];
      provider_reference?: string;
    }) => {
      if (data.amount_minor <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }
      if (data.amount_minor > 10_000_000) {
        throw new Error('Payment amount exceeds maximum allowed (£100,000)');
      }

      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data: result, error } = await supabase.rpc('record_payment_and_update_status', {
        _org_id: currentOrg.id,
        _invoice_id: data.invoice_id,
        _amount_minor: data.amount_minor,
        _currency_code: currentOrg.currency_code,
        _method: data.method,
        _provider_reference: data.provider_reference || null,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      toast({ title: 'Payment recorded' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to record payment: ' + error.message, variant: 'destructive' });
    },
  });
}

export function useUnbilledLessons(
  dateRange: { from: string; to: string },
  teacherId?: string,
  billingMode: 'delivered' | 'upfront' = 'delivered'
) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['unbilled-lessons', currentOrg?.id, dateRange, teacherId, billingMode],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data: unbilledIds, error: rpcError } = await supabase.rpc('get_unbilled_lesson_ids', {
        _org_id: currentOrg.id,
        _start: dateRange.from,
        _end: dateRange.to,
      });

      if (rpcError) throw rpcError;
      if (!unbilledIds || unbilledIds.length === 0) return [];

      let lessonsQuery = supabase
        .from('lessons')
        .select(`
          id,
          title,
          start_at,
          end_at,
          status,
          teacher_id,
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
        .in('id', unbilledIds as string[]);

      if (billingMode === 'delivered') {
        lessonsQuery = lessonsQuery.eq('status', 'completed');
      } else {
        lessonsQuery = lessonsQuery.in('status', ['scheduled', 'completed'] as const);
      }

      if (teacherId) {
        lessonsQuery = lessonsQuery.eq('teacher_id', teacherId);
      }

      const { data: lessons, error: lessonsError } = await lessonsQuery;
      if (lessonsError) throw lessonsError;

      return lessons || [];
    },
    enabled: !!currentOrg?.id && !!dateRange.from && !!dateRange.to,
  });
}
