import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface ChildWithDetails {
  id: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive';
  dob: string | null;
  upcoming_lesson_count: number;
  next_lesson?: {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    teacher_name?: string;
    location_name?: string;
  };
  outstanding_balance: number;
}

export interface ParentLesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  location_id: string | null;
  location?: { name: string } | null;
  teacher_id: string | null;
  teacher_name?: string | null;
  notes_shared: string | null;
  online_meeting_url: string | null;
  is_online: boolean;
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
    attendance_status?: string | null;
  }>;
}

export interface ParentInvoice {
  id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  due_date: string;
  issue_date: string;
  total_minor: number;
  paid_minor: number | null;
  currency_code: string;
  payment_plan_enabled: boolean | null;
  installment_count: number | null;
  payer_guardian?: { full_name: string } | null;
  payer_student?: { first_name: string; last_name: string } | null;
}

export interface MessageRequest {
  id: string;
  request_type: 'cancellation' | 'reschedule' | 'general';
  subject: string;
  message: string;
  status: 'pending' | 'approved' | 'declined' | 'resolved';
  admin_response: string | null;
  created_at: string;
  student?: { first_name: string; last_name: string } | null;
  lesson?: { title: string; start_at: string } | null;
}

export function useGuardianInfo() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['guardian-info', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return null;

      const { data, error } = await supabase
        .from('guardians')
        .select('id, full_name, email, phone, org_id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentOrg,
    staleTime: STALE_STABLE,
  });
}

export function useGuardianId() {
  const guardianInfo = useGuardianInfo();
  return {
    guardianId: guardianInfo.data?.id || null,
    isLoading: guardianInfo.isLoading,
    orgId: guardianInfo.data?.org_id || null,
  };
}

export function useParentDashboardData() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['parent-dashboard-data', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return null;

      const { data, error } = await supabase.rpc('get_parent_dashboard_data', {
        _user_id: user.id,
        _org_id: currentOrg.id,
      });

      if (error) throw error;

      return data as {
        guardian_id: string;
        children: Array<{
          id: string;
          first_name: string;
          last_name: string;
          status: string;
          dob: string | null;
          upcoming_lesson_count: number;
          next_lesson: { id: string; title: string; start_at: string; end_at: string } | null;
          outstanding_balance: number;
        }>;
        next_lesson: { id: string; title: string; start_at: string; end_at: string; location_name: string | null } | null;
        outstanding_balance: number;
        overdue_count: number;
        oldest_unpaid_invoice_id: string | null;
      };
    },
    enabled: !!user && !!currentOrg,
  });
}

export function useChildrenWithDetails() {
  const dashboardQuery = useParentDashboardData();

  return {
    ...dashboardQuery,
    data: (dashboardQuery.data?.children || []).map((child) => ({
      id: child.id,
      first_name: child.first_name,
      last_name: child.last_name,
      status: child.status as 'active' | 'inactive',
      dob: child.dob,
      upcoming_lesson_count: child.upcoming_lesson_count,
      next_lesson: child.next_lesson || undefined,
      outstanding_balance: child.outstanding_balance,
    })) as ChildWithDetails[],
  };
}

interface ParticipantLesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  teacher_id: string | null;
  location_id: string | null;
  notes_shared: string | null;
  online_meeting_url: string | null;
  is_online: boolean;
  location: { name: string } | null;
  teacher: { display_name: string } | null;
}

interface ParticipantStudent {
  id: string;
  first_name: string;
  last_name: string;
}

export function useParentLessons(options?: { studentId?: string; status?: string }) {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['parent-lessons', user?.id, currentOrg?.id, options],
    queryFn: async () => {
      if (!user || !currentOrg) return [];

      // Get guardian and linked students
      const { data: guardianData } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (!guardianData) return [];

      const { data: links } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardianData.id);

      if (!links || links.length === 0) return [];

      // Filter to only active, non-deleted students
      const { data: activeStudents } = await supabase
        .from('students')
        .select('id')
        .in('id', links.map(l => l.student_id))
        .eq('status', 'active')
        .is('deleted_at', null);

      let studentIds = activeStudents?.map(s => s.id) || [];
      if (studentIds.length === 0) return [];
      if (options?.studentId) {
        studentIds = studentIds.filter(id => id === options.studentId);
      }

      // Limit past lessons to 3 months to avoid loading entire history
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Get lessons via participants, join teacher for display name
      const { data: participants } = await supabase
        .from('lesson_participants')
        .select(`
          student:students(id, first_name, last_name),
          lesson:lessons!inner (
            id,
            title,
            start_at,
            end_at,
            status,
            teacher_id,
            location_id,
            notes_shared,
            online_meeting_url,
            is_online,
            location:locations(name),
            teacher:teachers!lessons_teacher_id_fkey(display_name)
          )
        `)
        .in('student_id', studentIds)
        .gte('lesson.start_at', threeMonthsAgo.toISOString())
        .order('lesson(start_at)', { ascending: true });

      if (!participants) return [];

      // Get lesson IDs for fetching attendance
      const lessonIds = [...new Set(participants.map(p => {
        const lesson = p.lesson as ParticipantLesson | null;
        return lesson?.id;
      }).filter(Boolean))] as string[];

      // Fetch attendance records for these lessons and students
      const attendanceMap = new Map<string, string>(); // key: lessonId-studentId, value: status
      if (lessonIds.length > 0) {
        const { data: attendanceRecords } = await supabase
          .from('attendance_records')
          .select('lesson_id, student_id, attendance_status')
          .in('lesson_id', lessonIds)
          .in('student_id', studentIds);

        if (attendanceRecords) {
          for (const record of attendanceRecords) {
            attendanceMap.set(`${record.lesson_id}-${record.student_id}`, record.attendance_status);
          }
        }
      }

      // Group by lesson
      const lessonMap = new Map<string, ParentLesson>();
      for (const p of participants) {
        const lesson = p.lesson as ParticipantLesson | null;
        if (!lesson) continue;
        
        if (options?.status && lesson.status !== options.status) continue;

        if (!lessonMap.has(lesson.id)) {
          lessonMap.set(lesson.id, {
            id: lesson.id,
            title: lesson.title,
            start_at: lesson.start_at,
            end_at: lesson.end_at,
            status: lesson.status,
            location_id: lesson.location_id,
            location: lesson.location,
            teacher_id: lesson.teacher_id,
            teacher_name: lesson.teacher?.display_name || null,
            notes_shared: lesson.notes_shared || null,
            online_meeting_url: lesson.online_meeting_url || null,
            is_online: lesson.is_online || false,
            students: [],
          });
        }
        const student = p.student as ParticipantStudent | null;
        if (student) {
          const attendanceStatus = attendanceMap.get(`${lesson.id}-${student.id}`) || null;
          lessonMap.get(lesson.id)!.students.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            attendance_status: attendanceStatus,
          });
        }
      }

      return Array.from(lessonMap.values());
    },
    enabled: !!user && !!currentOrg,
  });
}

export function useParentInvoices(options?: { status?: string }) {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['parent-invoices', user?.id, currentOrg?.id, options],
    queryFn: async () => {
      if (!user || !currentOrg) return [];

      // Parent invoices are fetched via RLS policy
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          status,
          due_date,
          issue_date,
          total_minor,
          paid_minor,
          currency_code,
          payment_plan_enabled,
          installment_count,
          payer_guardian:guardians(full_name),
          payer_student:students(first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .in('status', ['sent', 'paid', 'overdue', 'void'])
        .order('due_date', { ascending: false });

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status as 'sent' | 'paid' | 'overdue' | 'void');
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as ParentInvoice[];
    },
    enabled: !!user && !!currentOrg,
  });
}

export function useMessageRequests() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const { guardianId } = useGuardianId();

  return useQuery({
    queryKey: ['message-requests', user?.id, currentOrg?.id, guardianId],
    queryFn: async () => {
      if (!user || !currentOrg || !guardianId) return [];

      const { data, error } = await supabase
        .from('message_requests')
        .select(`
          id,
          request_type,
          subject,
          message,
          status,
          admin_response,
          created_at,
          student:students(first_name, last_name),
          lesson:lessons(title, start_at)
        `)
        .eq('org_id', currentOrg.id)
        .eq('guardian_id', guardianId)
        .in('request_type', ['cancellation', 'reschedule'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as MessageRequest[];
    },
    enabled: !!user && !!currentOrg && !!guardianId,
  });
}

export function useCreateMessageRequest() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      request_type: 'cancellation' | 'reschedule' | 'general';
      subject: string;
      message: string;
      student_id?: string;
      lesson_id?: string;
    }) => {
      if (!user || !currentOrg) throw new Error('Not authenticated');

      // Get guardian ID
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .single();

      if (!guardian) throw new Error('Guardian not found');

      // Verify student_id belongs to this guardian's linked children
      if (data.student_id) {
        const { data: link } = await supabase
          .from('student_guardians')
          .select('id')
          .eq('guardian_id', guardian.id)
          .eq('student_id', data.student_id)
          .maybeSingle();
        if (!link) throw new Error('Student not linked to your account');
      }

      // Verify lesson_id belongs to one of this guardian's children
      if (data.lesson_id) {
        const { data: children } = await supabase
          .from('student_guardians')
          .select('student_id')
          .eq('guardian_id', guardian.id);
        const childIds = (children || []).map((c) => c.student_id);

        if (childIds.length > 0) {
          const { data: participant } = await supabase
            .from('lesson_participants')
            .select('id')
            .eq('lesson_id', data.lesson_id)
            .in('student_id', childIds)
            .maybeSingle();
          if (!participant) throw new Error('Lesson not linked to your children');
        } else {
          throw new Error('No children linked to your account');
        }
      }

      const { error } = await supabase.from('message_requests').insert({
        org_id: currentOrg.id,
        guardian_id: guardian.id,
        request_type: data.request_type,
        subject: data.subject,
        message: data.message,
        student_id: data.student_id || null,
        lesson_id: data.lesson_id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-requests'] });
      toast({ title: 'Request sent', description: 'Your message has been sent to the admin team.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useParentSummary() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const dashboardQuery = useParentDashboardData();

  return useQuery({
    queryKey: ['parent-summary', user?.id, currentOrg?.id, dashboardQuery.dataUpdatedAt],
    queryFn: async () => {
      const dashData = dashboardQuery.data;
      if (!user || !currentOrg || !dashData) {
        return {
          nextLesson: null,
          outstandingBalance: 0,
          overdueInvoices: 0,
          unreadMessages: 0,
          oldestUnpaidInvoiceId: null,
        };
      }

      // Only unread messages still needs a separate query
      let unreadMessages = 0;
      if (dashData.guardian_id) {
        const { count } = await supabase
          .from('message_log')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', currentOrg.id)
          .eq('recipient_type', 'guardian')
          .eq('recipient_id', dashData.guardian_id)
          .is('read_at', null)
          .eq('status', 'sent');

        unreadMessages = count || 0;
      }

      // Fetch online_meeting_url for next lesson if available
      let nextLessonMeetingUrl: string | null = null;
      if (dashData.next_lesson?.id) {
        const { data: lessonData } = await supabase
          .from('lessons')
          .select('online_meeting_url')
          .eq('id', dashData.next_lesson.id)
          .single();
        nextLessonMeetingUrl = lessonData?.online_meeting_url || null;
      }

      return {
        nextLesson: dashData.next_lesson ? {
          id: dashData.next_lesson.id,
          title: dashData.next_lesson.title,
          start_at: dashData.next_lesson.start_at,
          end_at: dashData.next_lesson.end_at,
          location_name: dashData.next_lesson.location_name,
          online_meeting_url: nextLessonMeetingUrl,
        } : null,
        outstandingBalance: dashData.outstanding_balance,
        overdueInvoices: dashData.overdue_count,
        unreadMessages,
        oldestUnpaidInvoiceId: dashData.oldest_unpaid_invoice_id,
      };
    },
    enabled: !!user && !!currentOrg && !!dashboardQuery.data,
  });
}
