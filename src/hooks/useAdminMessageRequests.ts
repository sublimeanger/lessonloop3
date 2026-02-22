import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
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
  lesson?: { id: string; title: string; start_at: string; end_at: string; teacher_id: string | null; location_id: string | null } | null;
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
          lesson:lessons(id, title, start_at, end_at, teacher_id, location_id)
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

export interface UpdateRequestPayload {
  requestId: string;
  status: 'approved' | 'declined' | 'resolved';
  adminResponse?: string;
  /** For reschedule approvals: the new lesson start time (ISO string) */
  newStartAt?: string;
  /** For reschedule approvals: the new lesson end time (ISO string) */
  newEndAt?: string;
  /** The lesson ID to update (for reschedule/cancellation) */
  lessonId?: string;
  /** The request type to determine what calendar action to take */
  requestType?: 'cancellation' | 'reschedule' | 'general';
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
      newStartAt,
      newEndAt,
      lessonId,
      requestType,
    }: UpdateRequestPayload) => {
      if (!currentOrg) throw new Error('No organisation');

      const updateData: Record<string, unknown> = { 
        status,
        responded_at: new Date().toISOString(),
      };
      if (adminResponse) {
        updateData.admin_response = adminResponse;
      }

      // --- Calendar actions on approval ---
      let calendarAction: 'rescheduled' | 'cancelled' | null = null;

      if (status === 'approved' && lessonId) {
        if (requestType === 'reschedule' && newStartAt && newEndAt) {
          // Fetch the lesson to get teacher_id and location_id for validation
          const { data: lessonData } = await supabase
            .from('lessons')
            .select('teacher_id, location_id')
            .eq('id', lessonId)
            .eq('org_id', currentOrg.id)
            .single();

          // --- Validation: check for closure dates ---
          const newDateStr = newStartAt.slice(0, 10); // YYYY-MM-DD
          const { data: closureDates } = await supabase
            .from('closure_dates')
            .select('id, reason')
            .eq('org_id', currentOrg.id)
            .eq('date', newDateStr)
            .or(
              lessonData?.location_id
                ? `applies_to_all_locations.eq.true,location_id.eq.${lessonData.location_id}`
                : 'applies_to_all_locations.eq.true'
            );

          if (closureDates && closureDates.length > 0) {
            throw new Error(`Cannot reschedule: ${newDateStr} is a closure date (${closureDates[0].reason})`);
          }

          // --- Validation: check for teacher lesson overlaps ---
          if (lessonData?.teacher_id) {
            const { data: conflicts } = await supabase
              .from('lessons')
              .select('id, title, start_at')
              .eq('org_id', currentOrg.id)
              .eq('teacher_id', lessonData.teacher_id)
              .neq('id', lessonId)
              .neq('status', 'cancelled')
              .lt('start_at', newEndAt)
              .gt('end_at', newStartAt);

            if (conflicts && conflicts.length > 0) {
              throw new Error(`Conflict: teacher already has "${conflicts[0].title}" at that time`);
            }
          }

          // Actually reschedule the lesson on the calendar
          const { error: lessonError } = await supabase
            .from('lessons')
            .update({ start_at: newStartAt, end_at: newEndAt })
            .eq('id', lessonId)
            .eq('org_id', currentOrg.id);

          if (lessonError) throw new Error(`Failed to reschedule lesson: ${lessonError.message}`);
          calendarAction = 'rescheduled';
        } else if (requestType === 'cancellation') {
          // Actually cancel the lesson on the calendar
          const { data: sessionData } = await supabase.auth.getSession();
          const { error: lessonError } = await supabase
            .from('lessons')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: sessionData.session?.user.id || null,
              cancellation_reason: `Cancelled via parent request: ${adminResponse || 'Approved by admin'}`,
            })
            .eq('id', lessonId)
            .eq('org_id', currentOrg.id);

          if (lessonError) throw new Error(`Failed to cancel lesson: ${lessonError.message}`);
          calendarAction = 'cancelled';
        }
      }

      // Update the request record
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

      // Send email notification to guardian
      const guardian = request.guardians as { email: string | null; full_name: string } | null;
      if (guardian?.email && (status === 'approved' || status === 'declined' || status === 'resolved')) {
        const statusLabel = status === 'approved' 
          ? 'approved'
          : status === 'declined' 
            ? 'declined'
            : 'resolved';
        
        let statusMessage = `Your request "${request.subject}" has been ${statusLabel}.`;
        if (calendarAction === 'rescheduled') {
          statusMessage += ' The lesson has been rescheduled on the calendar.';
        } else if (calendarAction === 'cancelled') {
          statusMessage += ' The lesson has been cancelled on the calendar.';
        }

        const fullBody = adminResponse 
          ? `${statusMessage}\n\nResponse from your teacher:\n${adminResponse}\n\nView details in your parent portal.`
          : `${statusMessage}\n\nView details in your parent portal.`;

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          await supabase.functions.invoke('send-message', {
            body: {
              org_id: currentOrg.id,
              sender_user_id: sessionData.session?.user.id,
              recipient_type: 'guardian',
              recipient_id: request.guardian_id,
              recipient_email: guardian.email,
              recipient_name: guardian.full_name,
              subject: `Update: ${request.subject}`,
              body: fullBody,
              related_id: requestId,
              message_type: 'request_update',
            },
          });
        } catch (emailError) {
          logger.error('Error sending notification email:', emailError);
        }
      }

      return { status, calendarAction, guardianNotified: !!guardian?.email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-message-requests'] });
      // Also invalidate calendar data since lessons may have changed
      if (data.calendarAction) {
        queryClient.invalidateQueries({ queryKey: ['calendar-lessons'] });
        queryClient.invalidateQueries({ queryKey: ['today-lessons'] });
      }
      const actionMsg = data.calendarAction === 'rescheduled' 
        ? ' Lesson rescheduled on the calendar.'
        : data.calendarAction === 'cancelled'
          ? ' Lesson cancelled on the calendar.'
          : '';
      const notifyMsg = data.guardianNotified ? ' Parent notified by email.' : '';
      toast({ title: 'Request updated', description: `The request has been updated.${actionMsg}${notifyMsg}` });
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
