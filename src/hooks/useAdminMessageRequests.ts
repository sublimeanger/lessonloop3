import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface AdminMessageRequest {
  id: string;
  request_type: 'cancellation' | 'reschedule' | 'general';
  subject: string;
  message: string;
  status: 'pending' | 'approved' | 'declined' | 'resolved';
  admin_response: string | null;
  created_at: string;
  guardian?: { id: string; full_name: string; email: string | null } | null;
  student?: { id: string; first_name: string; last_name: string } | null;
  lesson?: { id: string; title: string; start_at: string } | null;
}

export function useAdminMessageRequests(options?: { status?: string }) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['admin-message-requests', currentOrg?.id, options],
    queryFn: async () => {
      if (!currentOrg) return [];

      let query = supabase
        .from('message_requests')
        .select(`
          id,
          request_type,
          subject,
          message,
          status,
          admin_response,
          created_at,
          guardian:guardians(id, full_name, email),
          student:students(id, first_name, last_name),
          lesson:lessons(id, title, start_at)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AdminMessageRequest[];
    },
    enabled: !!currentOrg,
  });
}

export function useUpdateMessageRequest() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      requestId,
      status,
      adminResponse,
    }: {
      requestId: string;
      status: 'approved' | 'declined' | 'resolved';
      adminResponse?: string;
    }) => {
      if (!currentOrg) throw new Error('No organisation');

      const updateData: Record<string, unknown> = { status };
      if (adminResponse) {
        updateData.admin_response = adminResponse;
      }

      const { error } = await supabase
        .from('message_requests')
        .update(updateData)
        .eq('id', requestId)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-message-requests'] });
      toast({ title: 'Request updated', description: 'The request status has been updated.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePendingRequestsCount() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['pending-requests-count', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return 0;

      const { count, error } = await supabase
        .from('message_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentOrg,
  });
}
