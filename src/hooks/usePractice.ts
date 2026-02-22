import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

export interface PracticeAssignment {
  id: string;
  org_id: string;
  student_id: string;
  teacher_user_id: string;
  teacher_id?: string | null;
  title: string;
  description: string | null;
  target_minutes_per_day: number;
  target_days_per_week: number;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface PracticeLog {
  id: string;
  org_id: string;
  student_id: string;
  assignment_id: string | null;
  logged_by_user_id: string;
  practice_date: string;
  duration_minutes: number;
  notes: string | null;
  teacher_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  created_at: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  assignment?: {
    id: string;
    title: string;
  };
}

export interface WeeklyProgress {
  studentId: string;
  studentName: string;
  targetMinutes: number;
  actualMinutes: number;
  daysLogged: number;
  targetDays: number;
  percentComplete: number;
}

// Helper to get assigned student IDs for a teacher
async function getTeacherStudentIds(orgId: string, userId: string): Promise<string[] | null> {
  const { data: teacherRecord } = await supabase
    .from('teachers')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!teacherRecord) return [];

  const { data: assignments } = await supabase
    .from('student_teacher_assignments')
    .select('student_id')
    .eq('teacher_id', teacherRecord.id);

  return (assignments || []).map(a => a.student_id);
}

// Hook for fetching assignments (for teachers/admins)
export function usePracticeAssignments(studentId?: string) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  return useQuery({
    queryKey: ['practice-assignments', currentOrg?.id, studentId, user?.id, isAdmin],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      let query = supabase
        .from('practice_assignments')
        .select(`
          *,
          student:students!inner(id, first_name, last_name, status)
        `)
        .eq('org_id', currentOrg!.id)
        .eq('student.status', 'active')
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      } else if (!isAdmin && user) {
        // Teacher: scope to assigned students only
        const studentIds = await getTeacherStudentIds(currentOrg!.id, user.id);
        if (!studentIds || studentIds.length === 0) return [];
        query = query.in('student_id', studentIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PracticeAssignment[];
    },
    enabled: !!currentOrg?.id,
  });
}

// Hook for fetching practice logs (for teachers/admins)
const PRACTICE_LOG_PAGE_SIZE = 50;

export function usePracticeLogs(options?: { 
  studentId?: string; 
  unreviewed?: boolean;
  limit?: number;
}) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const pageSize = options?.limit || PRACTICE_LOG_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: ['practice-logs', currentOrg?.id, options, user?.id, isAdmin],
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('practice_logs')
        .select(`
          *,
          student:students!inner(id, first_name, last_name, status),
          assignment:practice_assignments(id, title)
        `)
        .eq('org_id', currentOrg!.id)
        .eq('student.status', 'active')
        .order('practice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options?.studentId) {
        query = query.eq('student_id', options.studentId);
      } else if (!isAdmin && user) {
        const studentIds = await getTeacherStudentIds(currentOrg!.id, user.id);
        if (!studentIds || studentIds.length === 0) return { data: [] as PracticeLog[], hasMore: false };
        query = query.in('student_id', studentIds);
      }

      if (options?.unreviewed) {
        query = query.is('reviewed_at', null);
      }

      if (pageParam) {
        query = query.lt('practice_date', pageParam);
      }

      query = query.limit(pageSize);

      const { data, error } = await query;
      if (error) throw error;
      const logs = data as PracticeLog[];
      return { data: logs, hasMore: logs.length >= pageSize };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.data.length === 0) return undefined;
      return lastPage.data[lastPage.data.length - 1].practice_date;
    },
    enabled: !!currentOrg?.id,
  });
}

// Hook for parent portal - get assignments for their children
export function useParentPracticeAssignments() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['parent-practice-assignments', user?.id, currentOrg?.id],
    queryFn: async () => {
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user!.id)
        .eq('org_id', currentOrg!.id)
        .maybeSingle();

      if (!guardian) return [];

      const { data: studentGuardians } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardian.id);

      const studentIds = studentGuardians?.map(sg => sg.student_id) || [];
      if (studentIds.length === 0) return [];

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('practice_assignments')
        .select(`
          *,
          student:students!inner(id, first_name, last_name, status)
        `)
        .in('student_id', studentIds)
        .eq('student.status', 'active')
        .eq('status', 'active')
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PracticeAssignment[];
    },
    enabled: !!user?.id && !!currentOrg?.id,
  });
}

// Hook for parent portal - get practice logs for their children
export function useParentPracticeLogs(studentId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useInfiniteQuery({
    queryKey: ['parent-practice-logs', user?.id, studentId, currentOrg?.id],
    queryFn: async ({ pageParam }) => {
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user!.id)
        .eq('org_id', currentOrg!.id)
        .maybeSingle();

      if (!guardian) return { data: [] as PracticeLog[], hasMore: false };

      const { data: studentGuardians } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardian.id);

      const studentIds = studentGuardians?.map(sg => sg.student_id) || [];
      if (studentIds.length === 0) return { data: [] as PracticeLog[], hasMore: false };

      let query = supabase
        .from('practice_logs')
        .select(`
          *,
          student:students!inner(id, first_name, last_name, status),
          assignment:practice_assignments(id, title)
        `)
        .in('student_id', studentId ? [studentId] : studentIds)
        .eq('student.status', 'active')
        .order('practice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (pageParam) {
        query = query.lt('practice_date', pageParam);
      }

      query = query.limit(PRACTICE_LOG_PAGE_SIZE);

      const { data, error } = await query;
      if (error) throw error;
      const logs = data as PracticeLog[];
      return { data: logs, hasMore: logs.length >= PRACTICE_LOG_PAGE_SIZE };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.data.length === 0) return undefined;
      return lastPage.data[lastPage.data.length - 1].practice_date;
    },
    enabled: !!user?.id && !!currentOrg?.id,
  });
}

// Hook for weekly progress calculation
export function useWeeklyProgress(studentIds: string[]) {
  const { currentOrg } = useOrg();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: ['weekly-progress', currentOrg?.id, studentIds, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (studentIds.length === 0) return [];

      const [{ data: assignments }, { data: logs }, { data: students }] = await Promise.all([
        supabase
          .from('practice_assignments')
          .select('student_id, target_minutes_per_day, target_days_per_week')
          .in('student_id', studentIds)
          .eq('status', 'active'),
        supabase
          .from('practice_logs')
          .select('student_id, duration_minutes, practice_date')
          .in('student_id', studentIds)
          .gte('practice_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('practice_date', format(weekEnd, 'yyyy-MM-dd')),
        supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', studentIds),
      ]);

      const studentMap = new Map(students?.map(s => [s.id, `${s.first_name} ${s.last_name}`]));

      // Calculate progress per student
      const progressMap = new Map<string, WeeklyProgress>();

      studentIds.forEach(studentId => {
        const studentAssignment = assignments?.find(a => a.student_id === studentId);
        const studentLogs = logs?.filter(l => l.student_id === studentId) || [];
        
        const uniqueDays = new Set(studentLogs.map(l => l.practice_date));
        const totalMinutes = studentLogs.reduce((sum, l) => sum + l.duration_minutes, 0);
        
        const targetMinutes = Math.max(1,
          (studentAssignment?.target_minutes_per_day || 30) * 
          (studentAssignment?.target_days_per_week || 5));
        
        progressMap.set(studentId, {
          studentId,
          studentName: studentMap.get(studentId) || 'Unknown',
          targetMinutes,
          actualMinutes: totalMinutes,
          daysLogged: uniqueDays.size,
          targetDays: studentAssignment?.target_days_per_week || 5,
          percentComplete: Math.min(100, Math.round((totalMinutes / targetMinutes) * 100)),
        });
      });

      return Array.from(progressMap.values());
    },
    enabled: !!currentOrg?.id && studentIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to avoid redundant 3-query recomputation
  });
}

// Mutation to create assignment
export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      title: string;
      description?: string;
      target_minutes_per_day?: number;
      target_days_per_week?: number;
      start_date?: string;
      end_date?: string;
    }) => {
      // Teachers can only create assignments for their assigned students
      if (!isAdmin && user && currentOrg) {
        const { data: teacherRecord } = await supabase
          .from('teachers')
          .select('id')
          .eq('org_id', currentOrg.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (teacherRecord) {
          const { data: sta } = await supabase
            .from('student_teacher_assignments')
            .select('id')
            .eq('teacher_id', teacherRecord.id)
            .eq('student_id', data.student_id)
            .maybeSingle();
          if (!sta) throw new Error('You can only create assignments for your assigned students');
        }
      }

      const { error } = await supabase.from('practice_assignments').insert({
        org_id: currentOrg!.id,
        teacher_user_id: user!.id,
        student_id: data.student_id,
        title: data.title,
        description: data.description || null,
        target_minutes_per_day: data.target_minutes_per_day || 30,
        target_days_per_week: data.target_days_per_week || 5,
        start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
        end_date: data.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['parent-practice-assignments'] });
    },
  });
}

// Mutation to log practice
export function useLogPractice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      assignment_id?: string;
      duration_minutes: number;
      practice_date?: string;
      notes?: string;
    }) => {
      if (!currentOrg?.id) throw new Error('No organisation context');
      if (!data.duration_minutes || data.duration_minutes < 1) {
        throw new Error('Practice must be at least 1 minute');
      }
      if (data.duration_minutes > 720) {
        throw new Error('Practice cannot exceed 12 hours');
      }

      const practiceDate = data.practice_date || format(new Date(), 'yyyy-MM-dd');

      // Deduplication: check for same student, date, duration within last 60s
      const { data: existing } = await supabase
        .from('practice_logs')
        .select('id')
        .eq('student_id', data.student_id)
        .eq('practice_date', practiceDate)
        .eq('duration_minutes', data.duration_minutes)
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .maybeSingle();
      if (existing) throw new Error('This session was already logged');

      const { error } = await supabase.from('practice_logs').insert({
        org_id: currentOrg.id,
        student_id: data.student_id,
        assignment_id: data.assignment_id || null,
        logged_by_user_id: user!.id,
        duration_minutes: data.duration_minutes,
        practice_date: practiceDate,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-logs'] });
      queryClient.invalidateQueries({ queryKey: ['parent-practice-logs'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-progress'] });
      // Invalidate streak queries so badges update immediately
      queryClient.invalidateQueries({ queryKey: ['practice-streak'] });
      queryClient.invalidateQueries({ queryKey: ['practice-streaks'] });
      queryClient.invalidateQueries({ queryKey: ['children-streaks'] });
    },
  });
}

// Mutation to add teacher feedback
export function useAddPracticeFeedback() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ logId, feedback }: { logId: string; feedback: string }) => {
      const { error } = await supabase
        .from('practice_logs')
        .update({
          teacher_feedback: feedback,
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: user!.id,
        })
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-logs'] });
      queryClient.invalidateQueries({ queryKey: ['parent-practice-logs'] });
    },
  });
}
