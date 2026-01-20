import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  teacher_user_id: string;
  teacher_profile?: { display_name: string | null } | null;
  students: Array<{ id: string; first_name: string; last_name: string }>;
}

export interface ParentInvoice {
  id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  due_date: string;
  issue_date: string;
  total_minor: number;
  currency_code: string;
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

  return useQuery({
    queryKey: ['guardian-info', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('guardians')
        .select('id, full_name, email, phone, org_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useChildrenWithDetails() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['children-details', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return [];

      // Get students linked to this parent
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

      const studentIds = links.map(l => l.student_id);

      // Get students
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, status, dob')
        .in('id', studentIds);

      if (!students) return [];

      // Get upcoming lessons for each student
      const now = new Date().toISOString();
      const children: ChildWithDetails[] = [];

      for (const student of students) {
        // Get lesson participants for this student
        const { data: lessonParticipants } = await supabase
          .from('lesson_participants')
          .select(`
            lesson:lessons!inner (
              id,
              title,
              start_at,
              end_at,
              status,
              teacher_user_id
            )
          `)
          .eq('student_id', student.id)
          .gte('lesson.start_at', now)
          .eq('lesson.status', 'scheduled')
          .order('lesson(start_at)', { ascending: true })
          .limit(10);

        // Get outstanding invoices for this student/guardian
        const { data: invoices } = await supabase
          .from('invoices')
          .select('total_minor')
          .or(`payer_student_id.eq.${student.id},payer_guardian_id.eq.${guardianData.id}`)
          .in('status', ['sent', 'overdue']);

        const outstandingBalance = invoices?.reduce((sum, inv) => sum + inv.total_minor, 0) || 0;
        const lessons = lessonParticipants?.map(lp => (lp.lesson as any)) || [];

        children.push({
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          status: student.status as 'active' | 'inactive',
          dob: student.dob,
          upcoming_lesson_count: lessons.length,
          next_lesson: lessons[0] ? {
            id: lessons[0].id,
            title: lessons[0].title,
            start_at: lessons[0].start_at,
            end_at: lessons[0].end_at,
          } : undefined,
          outstanding_balance: outstandingBalance,
        });
      }

      return children;
    },
    enabled: !!user && !!currentOrg,
  });
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

      let studentIds = links.map(l => l.student_id);
      if (options?.studentId) {
        studentIds = studentIds.filter(id => id === options.studentId);
      }

      // Get lessons via participants
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
            teacher_user_id,
            location_id,
            location:locations(name)
          )
        `)
        .in('student_id', studentIds)
        .order('lesson(start_at)', { ascending: true });

      if (!participants) return [];

      // Group by lesson
      const lessonMap = new Map<string, ParentLesson>();
      for (const p of participants) {
        const lesson = p.lesson as any;
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
            teacher_user_id: lesson.teacher_user_id,
            students: [],
          });
        }
        const student = p.student as any;
        if (student) {
          lessonMap.get(lesson.id)!.students.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
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
          currency_code,
          payer_guardian:guardians(full_name),
          payer_student:students(first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .order('due_date', { ascending: false });

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'void');
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

  return useQuery({
    queryKey: ['message-requests', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return [];

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
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as MessageRequest[];
    },
    enabled: !!user && !!currentOrg,
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

  return useQuery({
    queryKey: ['parent-summary', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) {
        return {
          nextLesson: null,
          outstandingBalance: 0,
          overdueInvoices: 0,
          unreadMessages: 0,
        };
      }

      // Get next lesson
      const { data: guardianData } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      let nextLesson = null;
      let outstandingBalance = 0;
      let overdueInvoices = 0;

      if (guardianData) {
        // Get student IDs
        const { data: links } = await supabase
          .from('student_guardians')
          .select('student_id')
          .eq('guardian_id', guardianData.id);

        const studentIds = links?.map(l => l.student_id) || [];

        if (studentIds.length > 0) {
          // Next lesson
          const now = new Date().toISOString();
          const { data: lessonData } = await supabase
            .from('lesson_participants')
            .select(`
              lesson:lessons!inner (
                id,
                title,
                start_at,
                end_at,
                location:locations(name)
              )
            `)
            .in('student_id', studentIds)
            .gte('lesson.start_at', now)
            .order('lesson(start_at)', { ascending: true })
            .limit(1);

          if (lessonData && lessonData.length > 0) {
            const lesson = (lessonData[0] as any).lesson;
            nextLesson = {
              id: lesson.id,
              title: lesson.title,
              start_at: lesson.start_at,
              end_at: lesson.end_at,
              location_name: lesson.location?.name,
            };
          }
        }

        // Outstanding invoices
        const { data: invoices } = await supabase
          .from('invoices')
          .select('total_minor, status')
          .eq('payer_guardian_id', guardianData.id)
          .in('status', ['sent', 'overdue']);

        if (invoices) {
          outstandingBalance = invoices.reduce((sum, inv) => sum + inv.total_minor, 0);
          overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
        }
      }

      return {
        nextLesson,
        outstandingBalance,
        overdueInvoices,
        unreadMessages: 0, // TODO: implement when message read tracking is added
      };
    },
    enabled: !!user && !!currentOrg,
  });
}
