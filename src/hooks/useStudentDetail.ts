import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface StudentLesson {
  id: string;
  lesson_id: string;
  lesson: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    subject: string | null;
    location_name: string | null;
    teacher_name: string | null;
  };
  attendance_status: string | null;
}

export interface StudentInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total_amount_pence: number;
  due_date: string | null;
  issue_date: string | null;
  payer_name: string | null;
}

/**
 * Fetch lessons for a specific student via lesson_participants
 */
export function useStudentLessons(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['student-lessons', studentId, currentOrg?.id],
    queryFn: async () => {
      if (!studentId || !currentOrg) return [];

      const { data, error } = await supabase
        .from('lesson_participants')
        .select(`
          id,
          lesson_id,
          attendance_status,
          lessons!inner (
            id,
            start_time,
            end_time,
            status,
            subject,
            locations (name),
            teacher:profiles!lessons_teacher_user_id_fkey (full_name)
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching student lessons:', error);
        throw error;
      }

      return (data || []).map((lp: any) => ({
        id: lp.id,
        lesson_id: lp.lesson_id,
        attendance_status: lp.attendance_status,
        lesson: {
          id: lp.lessons.id,
          start_time: lp.lessons.start_time,
          end_time: lp.lessons.end_time,
          status: lp.lessons.status,
          subject: lp.lessons.subject,
          location_name: lp.lessons.locations?.name || null,
          teacher_name: lp.lessons.teacher?.full_name || null,
        },
      })) as StudentLesson[];
    },
    enabled: !!studentId && !!currentOrg,
  });
}

/**
 * Fetch invoices related to a specific student via invoice_items
 */
export function useStudentInvoices(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['student-invoices', studentId, currentOrg?.id],
    queryFn: async () => {
      if (!studentId || !currentOrg) return [];

      // First get invoice IDs from invoice_items for this student
      const { data: itemData, error: itemError } = await supabase
        .from('invoice_items')
        .select('invoice_id')
        .eq('student_id', studentId);

      if (itemError) {
        console.error('Error fetching invoice items:', itemError);
        throw itemError;
      }

      const invoiceIds = [...new Set((itemData || []).map(item => item.invoice_id))];

      if (invoiceIds.length === 0) {
        // Also check if student is the payer directly
        const { data: directInvoices, error: directError } = await supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            status,
            total_amount_pence,
            due_date,
            issue_date,
            payer_guardian:guardians!invoices_payer_guardian_id_fkey (full_name),
            payer_student:students!invoices_payer_student_id_fkey (first_name, last_name)
          `)
          .eq('org_id', currentOrg.id)
          .eq('payer_student_id', studentId)
          .order('issue_date', { ascending: false });

        if (directError) throw directError;

        return (directInvoices || []).map((inv: any) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          status: inv.status,
          total_amount_pence: inv.total_amount_pence,
          due_date: inv.due_date,
          issue_date: inv.issue_date,
          payer_name: inv.payer_guardian?.full_name || 
            (inv.payer_student ? `${inv.payer_student.first_name} ${inv.payer_student.last_name}` : null),
        })) as StudentInvoice[];
      }

      // Fetch invoices by IDs
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          status,
          total_amount_pence,
          due_date,
          issue_date,
          payer_guardian:guardians!invoices_payer_guardian_id_fkey (full_name),
          payer_student:students!invoices_payer_student_id_fkey (first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .in('id', invoiceIds)
        .order('issue_date', { ascending: false });

      if (error) {
        console.error('Error fetching invoices:', error);
        throw error;
      }

      return (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        status: inv.status,
        total_amount_pence: inv.total_amount_pence,
        due_date: inv.due_date,
        issue_date: inv.issue_date,
        payer_name: inv.payer_guardian?.full_name || 
          (inv.payer_student ? `${inv.payer_student.first_name} ${inv.payer_student.last_name}` : null),
      })) as StudentInvoice[];
    },
    enabled: !!studentId && !!currentOrg,
  });
}
