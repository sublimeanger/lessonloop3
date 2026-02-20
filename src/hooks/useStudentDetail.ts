import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface StudentLesson {
  id: string;
  lesson_id: string;
  lesson: {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    title: string;
    location_name: string | null;
    teacher_name: string | null;
  };
  attendance_status: string | null;
}

export interface StudentInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total_minor: number;
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

      // Fetch lesson participants with lesson details
      const { data, error } = await supabase
        .from('lesson_participants')
        .select(`
          id,
          lesson_id,
          lessons!inner (
            id,
            start_at,
            end_at,
            status,
            title,
            locations (name),
            teacher:teachers!lessons_teacher_id_fkey (display_name)
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching student lessons:', error);
        throw error;
      }

      const lessonParticipants = data || [];
      const lessonIds = lessonParticipants.map((lp: any) => lp.lesson_id);

      // Fetch attendance records for this student's lessons
      let attendanceMap: Record<string, string> = {};
      if (lessonIds.length > 0) {
        const { data: attendanceData, error: attError } = await supabase
          .from('attendance_records')
          .select('lesson_id, attendance_status')
          .eq('student_id', studentId)
          .in('lesson_id', lessonIds);

        if (!attError && attendanceData) {
          attendanceMap = Object.fromEntries(
            attendanceData.map((ar) => [ar.lesson_id, ar.attendance_status])
          );
        }
      }

      return lessonParticipants.map((lp: any) => ({
        id: lp.id,
        lesson_id: lp.lesson_id,
        attendance_status: attendanceMap[lp.lesson_id] || null,
        lesson: {
          id: lp.lessons.id,
          start_at: lp.lessons.start_at,
          end_at: lp.lessons.end_at,
          status: lp.lessons.status,
          title: lp.lessons.title,
          location_name: lp.lessons.locations?.name || null,
          teacher_name: lp.lessons.teacher?.display_name || null,
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
        logger.error('Error fetching invoice items:', itemError);
        throw itemError;
      }

      const invoiceIds = [...new Set((itemData || []).map(item => item.invoice_id))];

      // Build the common select string
      const invoiceSelect = `
        id,
        invoice_number,
        status,
        total_minor,
        due_date,
        issue_date,
        payer_guardian:guardians(full_name),
        payer_student:students(first_name, last_name)
      `;

      if (invoiceIds.length === 0) {
        // Also check if student is the payer directly
        const { data: directInvoices, error: directError } = await supabase
          .from('invoices')
          .select(invoiceSelect)
          .eq('org_id', currentOrg.id)
          .eq('payer_student_id', studentId)
          .order('issue_date', { ascending: false });

        if (directError) throw directError;

        return mapInvoices(directInvoices || []);
      }

      // Fetch invoices by IDs
      const { data, error } = await supabase
        .from('invoices')
        .select(invoiceSelect)
        .eq('org_id', currentOrg.id)
        .in('id', invoiceIds)
        .order('issue_date', { ascending: false });

      if (error) {
        logger.error('Error fetching invoices:', error);
        throw error;
      }

      return mapInvoices(data || []);
    },
    enabled: !!studentId && !!currentOrg,
  });
}

function mapInvoices(invoices: any[]): StudentInvoice[] {
  return invoices.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    total_minor: inv.total_minor,
    due_date: inv.due_date,
    issue_date: inv.issue_date,
    payer_name: inv.payer_guardian?.full_name ||
      (inv.payer_student ? `${inv.payer_student.first_name} ${inv.payer_student.last_name}` : null),
  }));
}
