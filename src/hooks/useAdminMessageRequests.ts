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

      const updateData: Record<string, unknown> = { 
        status,
        responded_at: new Date().toISOString(),
      };
      if (adminResponse) {
        updateData.admin_response = adminResponse;
      }

      // Get the request first to find the guardian for notification
      const { data: request, error: fetchError } = await supabase
        .from('message_requests')
        .select('guardian_id, subject, guardians(email, full_name)')
        .eq('id', requestId)
        .eq('org_id', currentOrg.id)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('message_requests')
        .update(updateData)
        .eq('id', requestId)
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      // P2 Fix: Log notification to message_log when request is updated
      const guardian = request.guardians as { email: string | null; full_name: string } | null;
      if (guardian?.email && (status === 'approved' || status === 'declined')) {
        const statusMessage = status === 'approved' 
          ? 'Your request has been approved.'
          : 'Your request has been declined.';
        
        await supabase.from('message_log').insert({
          org_id: currentOrg.id,
          recipient_email: guardian.email,
          recipient_name: guardian.full_name,
          recipient_type: 'guardian',
          recipient_id: request.guardian_id,
          subject: `Update: ${request.subject}`,
          body: `${statusMessage}${adminResponse ? `\n\nResponse: ${adminResponse}` : ''}`,
          message_type: 'request_update',
          status: 'sent',
          sent_at: new Date().toISOString(),
          related_id: requestId,
        });
      }

      return { status, guardianNotified: !!guardian?.email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-message-requests'] });
      const notifyMsg = data.guardianNotified ? ' Parent has been notified.' : '';
      toast({ title: 'Request updated', description: `The request status has been updated.${notifyMsg}` });
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
