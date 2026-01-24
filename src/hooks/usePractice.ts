import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

export interface PracticeAssignment {
  id: string;
  org_id: string;
  student_id: string;
  teacher_user_id: string;
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

// Hook for fetching assignments (for teachers/admins)
export function usePracticeAssignments(studentId?: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['practice-assignments', currentOrg?.id, studentId],
    queryFn: async () => {
      let query = supabase
        .from('practice_assignments')
        .select(`
          *,
          student:students(id, first_name, last_name)
        `)
        .eq('org_id', currentOrg!.id)
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PracticeAssignment[];
    },
    enabled: !!currentOrg?.id,
  });
}

// Hook for fetching practice logs (for teachers/admins)
export function usePracticeLogs(options?: { 
  studentId?: string; 
  unreviewed?: boolean;
  limit?: number;
}) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['practice-logs', currentOrg?.id, options],
    queryFn: async () => {
      let query = supabase
        .from('practice_logs')
        .select(`
          *,
          student:students(id, first_name, last_name),
          assignment:practice_assignments(id, title)
        `)
        .eq('org_id', currentOrg!.id)
        .order('practice_date', { ascending: false });

      if (options?.studentId) {
        query = query.eq('student_id', options.studentId);
      }

      if (options?.unreviewed) {
        query = query.is('reviewed_at', null);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PracticeLog[];
    },
    enabled: !!currentOrg?.id,
  });
}

// Hook for parent portal - get assignments for their children
export function useParentPracticeAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-practice-assignments', user?.id],
    queryFn: async () => {
      // First get guardian's children
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!guardian) return [];

      const { data: studentGuardians } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardian.id);

      const studentIds = studentGuardians?.map(sg => sg.student_id) || [];
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('practice_assignments')
        .select(`
          *,
          student:students(id, first_name, last_name)
        `)
        .in('student_id', studentIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PracticeAssignment[];
    },
    enabled: !!user?.id,
  });
}

// Hook for parent portal - get practice logs for their children
export function useParentPracticeLogs(studentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-practice-logs', user?.id, studentId],
    queryFn: async () => {
      // First get guardian's children
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!guardian) return [];

      const { data: studentGuardians } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardian.id);

      const studentIds = studentGuardians?.map(sg => sg.student_id) || [];
      if (studentIds.length === 0) return [];

      let query = supabase
        .from('practice_logs')
        .select(`
          *,
          student:students(id, first_name, last_name),
          assignment:practice_assignments(id, title)
        `)
        .in('student_id', studentId ? [studentId] : studentIds)
        .order('practice_date', { ascending: false })
        .limit(50);

      const { data, error } = await query;
      if (error) throw error;
      return data as PracticeLog[];
    },
    enabled: !!user?.id,
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

      // Get assignments for these students
      const { data: assignments } = await supabase
        .from('practice_assignments')
        .select('student_id, target_minutes_per_day, target_days_per_week')
        .in('student_id', studentIds)
        .eq('status', 'active');

      // Get this week's logs
      const { data: logs } = await supabase
        .from('practice_logs')
        .select('student_id, duration_minutes, practice_date')
        .in('student_id', studentIds)
        .gte('practice_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('practice_date', format(weekEnd, 'yyyy-MM-dd'));

      // Get student names
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .in('id', studentIds);

      const studentMap = new Map(students?.map(s => [s.id, `${s.first_name} ${s.last_name}`]));

      // Calculate progress per student
      const progressMap = new Map<string, WeeklyProgress>();

      studentIds.forEach(studentId => {
        const studentAssignment = assignments?.find(a => a.student_id === studentId);
        const studentLogs = logs?.filter(l => l.student_id === studentId) || [];
        
        const uniqueDays = new Set(studentLogs.map(l => l.practice_date));
        const totalMinutes = studentLogs.reduce((sum, l) => sum + l.duration_minutes, 0);
        
        const targetMinutes = (studentAssignment?.target_minutes_per_day || 30) * 
                             (studentAssignment?.target_days_per_week || 5);
        
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
  });
}

// Mutation to create assignment
export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();

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

  return useMutation({
    mutationFn: async (data: {
      org_id: string;
      student_id: string;
      assignment_id?: string;
      duration_minutes: number;
      practice_date?: string;
      notes?: string;
    }) => {
      const { error } = await supabase.from('practice_logs').insert({
        org_id: data.org_id,
        student_id: data.student_id,
        assignment_id: data.assignment_id || null,
        logged_by_user_id: user!.id,
        duration_minutes: data.duration_minutes,
        practice_date: data.practice_date || format(new Date(), 'yyyy-MM-dd'),
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
