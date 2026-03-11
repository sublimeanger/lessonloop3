import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { toastError } from '@/lib/error-handler';
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
  guardian_count: number;
}

async function fetchStudentsForRole(
  orgId: string,
  role: string | null,
  userId: string | undefined,
): Promise<StudentListItem[]> {
  const { data, error } = await supabase.rpc('get_students_for_org', {
    _org_id: orgId,
    _role: role ?? null,
    _user_id: userId ?? null,
  });

  if (error) throw error;

  return ((data as any[]) || []).map((row) => ({
    ...row,
    guardian_count: Number(row.guardian_count ?? 0),
  })) as StudentListItem[];
}

export function useStudents() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['students', currentOrg?.id, currentRole, user?.id],
    queryFn: () => fetchStudentsForRole(currentOrg!.id, currentRole, user?.id),
    enabled: !!currentOrg,
    // Uses default SEMI_STABLE (2 min)
  });
}

export function useToggleStudentStatus() {
  
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
      // Archiving a student changes resource share counts (10.4)
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['shared-resources'] });
      if (user && result) {
        logAudit(result.orgId, user.id, 'student.status_changed', 'student', result.studentId, {
          after: { status: result.newStatus },
        });
      }
    },
    onError: (error: unknown) => {
      toastError(error, 'Error updating status');
    },
  });
}
