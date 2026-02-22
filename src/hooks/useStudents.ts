import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/auditLog';

export type StudentStatus = 'active' | 'inactive';

export interface StudentListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  notes: string | null;
  status: StudentStatus;
  created_at: string;
}

async function fetchStudentsForRole(
  orgId: string,
  role: string | null,
  userId: string | undefined,
): Promise<StudentListItem[]> {
  if (role === 'teacher' && userId) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!teacher) return [];

    const { data: assignments, error: assignError } = await supabase
      .from('student_teacher_assignments')
      .select('student_id')
      .eq('teacher_id', teacher.id)
      .eq('org_id', orgId);

    if (assignError) throw assignError;

    const assignedIds = assignments?.map((a) => a.student_id) || [];
    if (assignedIds.length === 0) return [];

    const { data, error } = await supabase
      .from('students')
      .select()
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('id', assignedIds)
      .order('last_name', { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as StudentListItem[];
  }

  const { data, error } = await supabase
    .from('students')
    .select()
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as StudentListItem[];
}

export function useStudents() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['students', currentOrg?.id, currentRole, user?.id],
    queryFn: () => fetchStudentsForRole(currentOrg!.id, currentRole, user?.id),
    enabled: !!currentOrg,
    staleTime: 30_000,
  });
}

export function useToggleStudentStatus() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, newStatus, orgId }: { studentId: string; newStatus: StudentStatus; orgId: string }) => {
      const { error } = await supabase
        .from('students')
        .update({ status: newStatus })
        .eq('id', studentId)
        .eq('org_id', orgId);
      if (error) throw error;
      return { studentId, newStatus, orgId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
      if (user && result) {
        logAudit(result.orgId, user.id, 'student.status_changed', 'student', result.studentId, {
          after: { status: result.newStatus },
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    },
  });
}
