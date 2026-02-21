import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
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
const LESSONS_PAGE_SIZE = 50;

export function useStudentLessons(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useInfiniteQuery({
    queryKey: ['student-lessons', studentId, currentOrg?.id],
    queryFn: async ({ pageParam = 0 }) => {
      if (!studentId || !currentOrg) return { items: [], nextPage: null };

      const from = pageParam * LESSONS_PAGE_SIZE;
      const to = from + LESSONS_PAGE_SIZE - 1;

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
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        logger.error('Error fetching student lessons:', error);
        throw error;
      }

      const lessonParticipants = data || [];
      const lessonIds = lessonParticipants.map((lp: any) => lp.lesson_id);

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

      const items: StudentLesson[] = lessonParticipants.map((lp: any) => ({
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
      }));

      return {
        items,
        nextPage: items.length === LESSONS_PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!studentId && !!currentOrg,
    staleTime: 30_000,
  });
}

/**
 * Fetch invoices related to a specific student via all three paths:
 * 1. invoice_items.student_id (line-item linked)
 * 2. invoices.payer_student_id (student is direct payer)
 * 3. invoices.payer_guardian_id (guardian linked to this student is payer)
 */
export function useStudentInvoices(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['student-invoices', studentId, currentOrg?.id],
    queryFn: async () => {
      if (!studentId || !currentOrg) return [];

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

      // Run all three lookups in parallel
      const [itemsResult, directResult, guardiansResult] = await Promise.all([
        // Path 1: invoice_items with student_id
        supabase
          .from('invoice_items')
          .select('invoice_id')
          .eq('student_id', studentId),
        // Path 2: student is the direct payer
        supabase
          .from('invoices')
          .select(invoiceSelect)
          .eq('org_id', currentOrg.id)
          .eq('payer_student_id', studentId)
          .order('issue_date', { ascending: false }),
        // Path 3: get guardian IDs for this student
        supabase
          .from('student_guardians')
          .select('guardian_id')
          .eq('student_id', studentId),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (directResult.error) throw directResult.error;
      if (guardiansResult.error) throw guardiansResult.error;

      const invoiceIdsFromItems = [...new Set((itemsResult.data || []).map(i => i.invoice_id))];
      const guardianIds = (guardiansResult.data || []).map(sg => sg.guardian_id);

      // Collect direct-payer invoices
      const allInvoicesMap = new Map<string, any>();
      for (const inv of directResult.data || []) {
        allInvoicesMap.set(inv.id, inv);
      }

      // Fetch invoices from invoice_items path
      if (invoiceIdsFromItems.length > 0) {
        const { data, error } = await supabase
          .from('invoices')
          .select(invoiceSelect)
          .eq('org_id', currentOrg.id)
          .in('id', invoiceIdsFromItems)
          .order('issue_date', { ascending: false });
        if (error) throw error;
        for (const inv of data || []) {
          allInvoicesMap.set(inv.id, inv);
        }
      }

      // Fetch invoices where a linked guardian is the payer
      if (guardianIds.length > 0) {
        const { data, error } = await supabase
          .from('invoices')
          .select(invoiceSelect)
          .eq('org_id', currentOrg.id)
          .in('payer_guardian_id', guardianIds)
          .order('issue_date', { ascending: false });
        if (error) throw error;
        for (const inv of data || []) {
          allInvoicesMap.set(inv.id, inv);
        }
      }

      // Sort combined results by issue_date descending
      const combined = Array.from(allInvoicesMap.values()).sort(
        (a, b) => (b.issue_date || '').localeCompare(a.issue_date || '')
      );

      return mapInvoices(combined);
    },
    enabled: !!studentId && !!currentOrg,
    staleTime: 30_000,
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
