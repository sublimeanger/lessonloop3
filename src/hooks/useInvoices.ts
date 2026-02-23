import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE_VOLATILE } from '@/config/query-stale-times';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/auditLog';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { toastError } from '@/lib/error-handler';
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
  page?: number;
}

const PAGE_SIZE = 25;

export function useInvoices(filters: InvoiceFilters = {}) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['invoices', currentOrg?.id, filters],
    queryFn: async () => {
      if (!currentOrg?.id) return { data: [] as InvoiceWithDetails[], totalCount: 0 };

      const page = filters.page ?? 1;
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('invoices')
        .select(`
          *,
          payer_guardian:guardians(id, full_name, email),
          payer_student:students(id, first_name, last_name, email)
        `, { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .range(from, to);

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

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: (data || []) as InvoiceWithDetails[], totalCount: count ?? 0 };
    },
    enabled: !!currentOrg?.id,
    staleTime: STALE_VOLATILE,
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
        sent_count: number;
        paid_total: number;
        paid_count: number;
        void_count: number;
        total_count: number;
      };

      return {
        totalOutstanding: result.total_outstanding ?? 0,
        overdue: result.overdue ?? 0,
        overdueCount: result.overdue_count ?? 0,
        draftCount: result.draft_count ?? 0,
        sentCount: result.sent_count ?? 0,
        paid: result.paid_total ?? 0,
        paidCount: result.paid_count ?? 0,
        voidCount: result.void_count ?? 0,
        totalCount: result.total_count ?? 0,
      };
    },
    enabled: !!currentOrg?.id,
    // Uses default SEMI_STABLE (2 min)
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

      const { data: result, error } = await supabase.rpc('create_invoice_with_items', {
        _org_id: currentOrg.id,
        _due_date: data.due_date,
        _payer_guardian_id: data.payer_guardian_id ?? undefined,
        _payer_student_id: data.payer_student_id ?? undefined,
        _notes: data.notes ?? undefined,
        _credit_ids: data.credit_ids || [],
        _items: JSON.stringify(data.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_minor: item.unit_price_minor,
          linked_lesson_id: item.linked_lesson_id || null,
          student_id: item.student_id || null,
        }))),
      });

      if (error) throw error;
      return result as { id: string; invoice_number: string; total_minor: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      queryClient.invalidateQueries({ queryKey: ['available-credits-for-payer'] });
      toast({ title: 'Invoice created' });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('credits have already been redeemed') || message.toLowerCase().includes('credit') && message.toLowerCase().includes('redeemed')) {
        toast({
          title: 'Credit already used',
          description: 'One or more of the selected make-up credits has been redeemed since you started. Please refresh and try again.',
          variant: 'destructive',
        });
        queryClient.invalidateQueries({ queryKey: ['available-credits-for-payer'] });
        queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      } else {
        toastError(error, 'Failed to create invoice');
      }
    },
  });
}

const ALLOWED_TRANSITIONS: Record<string, InvoiceStatus[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'overdue', 'void'],
  overdue: ['paid', 'sent', 'void'],
  paid: [],
  void: [],
};

export function isValidStatusTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status, currentStatus, orgId }: { id: string; status: InvoiceStatus; currentStatus?: InvoiceStatus; orgId?: string }) => {
      // Client-side guard — server trigger also enforces this
      if (currentStatus && !isValidStatusTransition(currentStatus, status)) {
        throw new Error(`Cannot change invoice status from "${currentStatus}" to "${status}"`);
      }

      // Use atomic server-side void that also restores credits
      if (status === 'void') {
        if (!orgId) throw new Error('No organisation selected');
        const { error } = await supabase.rpc('void_invoice', {
          _invoice_id: id,
          _org_id: orgId,
        });
        if (error) throw error;
        return { id, status, currentStatus };
      }

      const { error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      return { id, status, currentStatus };
    },
    onSuccess: (result) => {
      if (result && currentOrg?.id && user?.id) {
        logAudit(currentOrg.id, user.id, `invoice_status_${result.status}`, 'invoice', result.id, {
          before: result.currentStatus ? { status: result.currentStatus } : null,
          after: { status: result.status },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      queryClient.invalidateQueries({ queryKey: ['available-credits-for-payer'] });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to update invoice');
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
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
        _provider_reference: data.provider_reference ?? undefined,
      });

      if (error) throw error;
      return { result, input: data };
    },
    onSuccess: ({ result, input }) => {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (currentOrg?.id && user?.id) {
        logAudit(currentOrg.id, user.id, 'payment_recorded', 'payment', parsed?.payment_id ?? null, {
          after: { invoice_id: input.invoice_id, amount_minor: input.amount_minor, method: input.method, new_status: parsed?.new_status },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      toast({ title: 'Payment recorded' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to record payment');
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
