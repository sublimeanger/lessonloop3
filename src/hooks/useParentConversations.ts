import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useGuardianId } from '@/hooks/useParentPortal';

export interface ConversationMessage {
  id: string;
  subject: string;
  body: string;
  created_at: string;
  sender_user_id: string | null;
  recipient_id: string | null;
  recipient_type: string | null;
  message_type: string;
  status: string;
  read_at: string | null;
  thread_id: string | null;
  parent_message_id: string | null;
  sender_name?: string | null;
  sender_role?: 'staff' | 'parent';
}

export interface Conversation {
  threadId: string;
  subject: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderRole: 'staff' | 'parent';
  unreadCount: number;
  messages: ConversationMessage[];
}

/**
 * Groups flat message_log rows into conversation threads for the parent portal.
 * A thread is identified by thread_id (or the message's own id if it has no thread_id).
 */
export function useParentConversations() {
  const { currentOrg } = useOrg();
  const { guardianId } = useGuardianId();
  const queryClient = useQueryClient();

  // Realtime subscription for live updates
  useEffect(() => {
    if (!guardianId || !currentOrg?.id) return;

    const channel = supabase
      .channel(`parent-conversations-${guardianId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_log',
          filter: `org_id=eq.${currentOrg.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['parent-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guardianId, currentOrg?.id, queryClient]);

  const query = useQuery({
    queryKey: ['parent-conversations', currentOrg?.id, guardianId],
    queryFn: async () => {
      if (!currentOrg || !guardianId) return [];

      // Fetch all messages where this guardian is the recipient OR the sender
      const { data, error } = await supabase
        .from('message_log')
        .select('id, subject, body, created_at, sender_user_id, recipient_id, recipient_type, message_type, status, read_at, thread_id, parent_message_id')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) throw error;
      return (data || []) as ConversationMessage[];
    },
    enabled: !!currentOrg && !!guardianId,
  });

  // Resolve sender names from profiles
  const senderUserIds = useMemo(() => {
    if (!query.data) return [];
    const ids = new Set<string>();
    for (const msg of query.data) {
      if (msg.sender_user_id) ids.add(msg.sender_user_id);
    }
    return Array.from(ids);
  }, [query.data]);

  const { data: senderProfiles } = useQuery({
    queryKey: ['sender-profiles', senderUserIds.join(',')],
    queryFn: async () => {
      if (!senderUserIds.length) return {};
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderUserIds);
      const map: Record<string, string> = {};
      for (const p of data || []) {
        map[p.id] = p.full_name || 'Unknown';
      }
      return map;
    },
    enabled: senderUserIds.length > 0,
  });

  // Group into conversations
  const conversations: Conversation[] = useMemo(() => {
    if (!query.data || !guardianId) return [];

    const threadMap = new Map<string, ConversationMessage[]>();

    for (const msg of query.data) {
      const threadId = msg.thread_id || msg.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      // Annotate sender role and name
      const isParentSender = msg.message_type === 'parent_reply';
      const enriched: ConversationMessage = {
        ...msg,
        sender_role: isParentSender ? 'parent' : 'staff',
        sender_name: isParentSender
          ? 'You'
          : (senderProfiles?.[msg.sender_user_id || ''] || 'Staff'),
      };
      threadMap.get(threadId)!.push(enriched);
    }

    // Convert to Conversation objects
    const result: Conversation[] = [];
    for (const [threadId, messages] of threadMap) {
      // Sort chronologically
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const lastMsg = messages[messages.length - 1];
      // Use the first message's subject as the thread subject
      const subject = messages[0].subject.replace(/^Re:\s*/i, '');
      const unreadCount = messages.filter(
        m => !m.read_at && m.sender_role === 'staff' && m.status === 'sent'
      ).length;

      result.push({
        threadId,
        subject,
        lastMessageAt: lastMsg.created_at,
        lastMessagePreview: lastMsg.body.slice(0, 120),
        lastSenderRole: lastMsg.sender_role || 'staff',
        unreadCount,
        messages,
      });
    }

    // Sort conversations by last message time, newest first
    result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return result;
  }, [query.data, senderProfiles, guardianId]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    conversations,
    totalUnread,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
