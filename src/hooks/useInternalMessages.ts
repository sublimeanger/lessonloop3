import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface InternalMessage {
  id: string;
  org_id: string;
  sender_user_id: string;
  sender_role: string;
  recipient_user_id: string;
  recipient_role: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender_profile?: { full_name: string; email: string } | null;
  recipient_profile?: { full_name: string; email: string } | null;
}

export interface StaffMember {
  user_id: string;
  role: string;
  full_name: string;
  email: string;
}

export function useInternalMessages(view: 'inbox' | 'sent' = 'inbox') {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['internal-messages', currentOrg?.id, view, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return [];

      // Query messages based on view
      let query = supabase
        .from('internal_messages')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (view === 'inbox') {
        query = query.eq('recipient_user_id', user.id);
      } else {
        query = query.eq('sender_user_id', user.id);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      // Get unique user IDs for profile lookup
      const userIds = new Set<string>();
      messages?.forEach(msg => {
        userIds.add(msg.sender_user_id);
        userIds.add(msg.recipient_user_id);
      });

      // Fetch profiles for all users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Attach profile info to messages
      return (messages || []).map(msg => ({
        ...msg,
        sender_profile: profileMap.get(msg.sender_user_id) || null,
        recipient_profile: profileMap.get(msg.recipient_user_id) || null,
      })) as InternalMessage[];
    },
    enabled: !!currentOrg && !!user,
  });
}

export function useUnreadInternalCount() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['internal-messages-unread', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return 0;

      const { count, error } = await supabase
        .from('internal_messages')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .eq('recipient_user_id', user.id)
        .is('read_at', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentOrg && !!user,
  });
}

export function useStaffMembers() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['staff-members', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      // Get all staff memberships
      const { data: memberships, error: memberError } = await supabase
        .from('org_memberships')
        .select('user_id, role')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin', 'teacher']);

      if (memberError) throw memberError;

      const userIds = memberships?.map(m => m.user_id) || [];
      
      // Get profiles for these users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profileError) throw profileError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Combine and filter out current user
      return (memberships || [])
        .filter(m => m.user_id !== user?.id)
        .map(m => ({
          user_id: m.user_id,
          role: m.role,
          full_name: profileMap.get(m.user_id)?.full_name || 'Unknown',
          email: profileMap.get(m.user_id)?.email || '',
        })) as StaffMember[];
    },
    enabled: !!currentOrg,
  });
}

export function useSendInternalMessage() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      recipientUserId,
      recipientRole,
      subject,
      body,
      threadId,
      parentMessageId,
    }: {
      recipientUserId: string;
      recipientRole: string;
      subject: string;
      body: string;
      threadId?: string;
      parentMessageId?: string;
    }) => {
      if (!currentOrg || !user || !currentRole) {
        throw new Error('Not authenticated');
      }

      // Get sender's profile for the email notification
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          org_id: currentOrg.id,
          sender_user_id: user.id,
          sender_role: currentRole,
          recipient_user_id: recipientUserId,
          recipient_role: recipientRole,
          subject,
          body,
          thread_id: threadId || null,
          parent_message_id: parentMessageId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Send email notification (best-effort, don't fail if this errors)
      try {
        await supabase.functions.invoke('notify-internal-message', {
          body: {
            org_id: currentOrg.id,
            recipient_user_id: recipientUserId,
            sender_name: senderProfile?.full_name || 'A team member',
            sender_role: currentRole,
            subject,
            body,
          },
        });
      } catch (emailError) {
        logger.error('Failed to send email notification:', emailError);
        // Don't throw - the message was saved successfully
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
      toast({ title: 'Message sent', description: 'Your message has been sent and the recipient notified by email.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMarkInternalRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('internal_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
      queryClient.invalidateQueries({ queryKey: ['internal-messages-unread'] });
    },
  });
}
