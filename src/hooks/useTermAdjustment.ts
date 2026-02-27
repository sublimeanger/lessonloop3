import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface TermAdjustmentPreview {
  adjustment_id: string;
  student_name: string;
  term_name: string;
  original_day: string;
  original_time: string;
  original_remaining_lessons: number;
  original_remaining_dates: string[];
  teacher_name: string | null;
  location_name: string | null;
  new_day: string | null;
  new_time: string | null;
  new_lesson_count: number;
  new_lesson_dates: string[];
  new_teacher_name: string | null;
  new_location_name: string | null;
  lesson_rate_minor: number;
  lessons_difference: number;
  adjustment_amount_minor: number;
  vat_amount_minor: number;
  total_adjustment_minor: number;
  currency_code: string;
  has_rate_card: boolean;
  can_adjust_draft: boolean;
  existing_term_invoice: {
    id: string;
    invoice_number: string;
    total_minor: number;
    status: string;
  } | null;
}

export interface PreviewRequest {
  adjustment_type: 'withdrawal' | 'day_change';
  student_id: string;
  recurrence_id: string;
  effective_date: string;
  term_id?: string;
  new_day_of_week?: number;
  new_start_time?: string;
  new_teacher_id?: string;
  new_location_id?: string;
  manual_rate_minor?: number;
  notes?: string;
}

export interface ConfirmRequest {
  adjustment_id: string;
  adjustment_type: 'withdrawal' | 'day_change';
  student_id: string;
  recurrence_id: string;
  effective_date: string;
  generate_credit_note?: boolean;
  notes?: string;
}

export interface ConfirmResult {
  success: boolean;
  adjustment_id: string;
  cancelled_count: number;
  created_count: number;
  credit_note_invoice_id: string | null;
}

export function useTermAdjustmentPreview() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (req: PreviewRequest) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data, error } = await supabase.functions.invoke('process-term-adjustment', {
        body: { action: 'preview', org_id: currentOrg.id, ...req },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as TermAdjustmentPreview;
    },
    onError: (error) => {
      toast({
        title: 'Preview failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useTermAdjustmentConfirm() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (req: ConfirmRequest) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data, error } = await supabase.functions.invoke('process-term-adjustment', {
        body: { action: 'confirm', org_id: currentOrg.id, ...req },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as ConfirmResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['term-adjustments'] });

      const parts: string[] = [];
      if (data.cancelled_count > 0) {
        parts.push(`${data.cancelled_count} lesson${data.cancelled_count !== 1 ? 's' : ''} cancelled`);
      }
      if (data.created_count > 0) {
        parts.push(`${data.created_count} new lesson${data.created_count !== 1 ? 's' : ''} created`);
      }
      if (data.credit_note_invoice_id) {
        parts.push('credit note generated');
      }

      toast({
        title: 'Adjustment confirmed',
        description: parts.join(', ') || 'Adjustment applied successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Adjustment failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useTermAdjustments(studentId?: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['term-adjustments', currentOrg?.id, studentId],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      let query = supabase
        .from('term_adjustments')
        .select(`
          *,
          term:terms(name),
          student:students(first_name, last_name),
          credit_note:invoices!credit_note_invoice_id(id, invoice_number, total_minor)
        `)
        .eq('org_id', currentOrg.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg?.id,
  });
}
