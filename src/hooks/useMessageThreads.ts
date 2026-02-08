import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ThreadMessage {
  id: string;
  org_id: string;
  subject: string;
  body: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_type: string | null;
  recipient_id: string | null;
  related_id: string | null;
  sender_user_id: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
  thread_id: string | null;
  parent_message_id: string | null;
  channel: string;
  message_type: string;
  sender_profile?: { full_name: string; email: string } | null;
}

export interface MessageThread {
  thread_id: string;
  subject: string;
  recipient_name: string | null;
  recipient_email: string;
  message_count: number;
  latest_message_at: string;
  has_unread: boolean;
  messages: ThreadMessage[];
}

export function useMessageThreads() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['message-threads', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      // Get all messages with thread info
      const { data: messages, error } = await supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(messages?.map(m => m.sender_user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', senderIds as string[]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Group by thread_id (or use message id as thread for standalone messages)
      const threadMap = new Map<string, MessageThread>();

      for (const msg of messages || []) {
        const threadId = msg.thread_id || msg.id;
        const msgWithProfile = {
          ...msg,
          sender_profile: msg.sender_user_id ? profileMap.get(msg.sender_user_id) || null : null,
        };

        if (threadMap.has(threadId)) {
          const thread = threadMap.get(threadId)!;
          thread.messages.push(msgWithProfile);
          thread.message_count++;
          if (new Date(msg.created_at) > new Date(thread.latest_message_at)) {
            thread.latest_message_at = msg.created_at;
          }
        } else {
          threadMap.set(threadId, {
            thread_id: threadId,
            subject: msg.subject,
            recipient_name: msg.recipient_name,
            recipient_email: msg.recipient_email,
            message_count: 1,
            latest_message_at: msg.created_at,
            has_unread: false, // For outbound messages, we track via status
            messages: [msgWithProfile],
          });
        }
      }

      // Sort messages within each thread by date (oldest first)
      for (const thread of threadMap.values()) {
        thread.messages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      // Convert to array and sort by latest message
      return Array.from(threadMap.values()).sort(
        (a, b) => new Date(b.latest_message_at).getTime() - new Date(a.latest_message_at).getTime()
      );
    },
    enabled: !!currentOrg,
  });
}

export function useReplyToMessage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      parentMessageId,
      threadId,
      recipientEmail,
      recipientName,
      recipientType,
      recipientId,
      subject,
      body,
    }: {
      parentMessageId: string;
      threadId: string;
      recipientEmail: string;
      recipientName: string | null;
      recipientType: string | null;
      recipientId: string | null;
      subject: string;
      body: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      // Call send-message edge function with threading info included atomically
      const { data: result, error } = await supabase.functions.invoke('send-message', {
        body: {
          org_id: currentOrg.id,
          sender_user_id: user.id,
          recipient_type: recipientType || 'guardian',
          recipient_id: recipientId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
          body,
          message_type: 'reply',
          thread_id: threadId,
          parent_message_id: parentMessageId,
        },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      toast({ title: 'Reply sent', description: 'Your reply has been sent.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
