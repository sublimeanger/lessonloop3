import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

/**
 * MSG-L4: Count unread parent replies/enquiries in message_log for the bell.
 * These are messages where message_type is 'parent_reply' or 'parent_enquiry'.
 */
export function useUnreadParentReplies() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['unread-parent-replies', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return 0;

      const { count, error } = await supabase
        .from('message_log')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .in('message_type', ['parent_reply', 'parent_enquiry'])
        .eq('recipient_type', 'staff')
        .is('read_at', null)
        .eq('status', 'sent');

      if (error) return 0;
      return count || 0;
    },
    enabled: !!currentOrg,
    refetchInterval: 60000,
  });
}

/**
 * MSG-L4: Count unread payment notifications for the bell.
 */
export function useUnreadPaymentNotifications() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['unread-payment-notifications', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return 0;

      const { count, error } = await supabase
        .from('payment_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .eq('read', false);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!currentOrg,
    refetchInterval: 60000,
  });
}
