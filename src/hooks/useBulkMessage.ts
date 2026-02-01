import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

export interface FilterCriteria {
  location_ids?: string[];
  teacher_ids?: string[];
  status?: 'active' | 'inactive' | 'all';
  has_overdue_invoice?: boolean;
}

interface BulkMessagePayload {
  name: string;
  subject: string;
  body: string;
  filter_criteria: FilterCriteria;
}

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
}

// Hook to fetch filter options (locations, teachers)
export function useBulkMessageFilters() {
  const { currentOrg } = useOrg();

  const { data: locations } = useQuery({
    queryKey: ['bulk-message-locations', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('org_id', currentOrg.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });

  const { data: teachers } = useQuery({
    queryKey: ['bulk-message-teachers', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('org_memberships')
        .select(`
          user_id,
          profiles!inner(full_name)
        `)
        .eq('org_id', currentOrg.id)
        .in('role', ['owner', 'admin', 'teacher'])
        .eq('status', 'active');
      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.user_id,
        name: m.profiles?.full_name || 'Unknown',
      }));
    },
    enabled: !!currentOrg,
  });

  return { locations: locations || [], teachers: teachers || [] };
}

// Hook to preview recipient count based on filters
export function useRecipientPreview(filters: FilterCriteria) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['recipient-preview', currentOrg?.id, filters],
    queryFn: async () => {
      if (!currentOrg) return { count: 0, guardians: [] };

      // Build query for students
      let studentQuery = supabase
        .from('students')
        .select('id')
        .eq('org_id', currentOrg.id)
        .is('deleted_at', null);

      // Filter by status
      if (filters.status && filters.status !== 'all') {
        studentQuery = studentQuery.eq('status', filters.status);
      } else if (!filters.status) {
        studentQuery = studentQuery.eq('status', 'active');
      }

      // Filter by location
      if (filters.location_ids && filters.location_ids.length > 0) {
        studentQuery = studentQuery.in('default_location_id', filters.location_ids);
      }

      // Filter by teacher
      let studentIds: string[] = [];
      if (filters.teacher_ids && filters.teacher_ids.length > 0) {
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('org_id', currentOrg.id)
          .in('teacher_user_id', filters.teacher_ids);

        if (!assignments || assignments.length === 0) {
          return { count: 0, guardians: [] };
        }
        studentIds = assignments.map(a => a.student_id);
        studentQuery = studentQuery.in('id', studentIds);
      }

      const { data: students } = await studentQuery;
      if (!students || students.length === 0) {
        return { count: 0, guardians: [] };
      }

      const allStudentIds = students.map(s => s.id);

      // Get guardians linked to these students
      const { data: studentGuardians } = await supabase
        .from('student_guardians')
        .select('guardian_id')
        .in('student_id', allStudentIds);

      if (!studentGuardians || studentGuardians.length === 0) {
        return { count: 0, guardians: [] };
      }

      const guardianIds = [...new Set(studentGuardians.map(sg => sg.guardian_id))];

      // Fetch guardian details
      let guardianQuery = supabase
        .from('guardians')
        .select('id, full_name, email')
        .in('id', guardianIds)
        .is('deleted_at', null)
        .not('email', 'is', null);

      const { data: guardians } = await guardianQuery;

      let filteredGuardians = guardians || [];

      // Filter for overdue invoices if requested
      if (filters.has_overdue_invoice) {
        const { data: overdueInvoices } = await supabase
          .from('invoices')
          .select('payer_guardian_id')
          .eq('org_id', currentOrg.id)
          .eq('status', 'overdue')
          .not('payer_guardian_id', 'is', null);

        if (overdueInvoices && overdueInvoices.length > 0) {
          const overdueGuardianIds = new Set(overdueInvoices.map(i => i.payer_guardian_id));
          filteredGuardians = filteredGuardians.filter(g => overdueGuardianIds.has(g.id));
        } else {
          filteredGuardians = [];
        }
      }

      return {
        count: filteredGuardians.length,
        guardians: filteredGuardians as Guardian[],
      };
    },
    enabled: !!currentOrg,
    staleTime: 10000, // Cache for 10 seconds
  });
}

// Hook to send bulk message
export function useSendBulkMessage() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkMessagePayload) => {
      if (!currentOrg) throw new Error('No organisation selected');

      const { data, error } = await supabase.functions.invoke('send-bulk-message', {
        body: {
          org_id: currentOrg.id,
          ...payload,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      queryClient.invalidateQueries({ queryKey: ['message-batches'] });
      toast.success(
        `Sent ${data.sent_count} of ${data.recipient_count} messages`,
        {
          description: data.failed_count > 0
            ? `${data.failed_count} failed to send`
            : undefined,
        }
      );
    },
    onError: (error: Error) => {
      toast.error('Failed to send bulk message', {
        description: error.message,
      });
    },
  });
}

// Hook to fetch message batches (history)
export function useMessageBatches() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['message-batches', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('message_batches')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });
}
