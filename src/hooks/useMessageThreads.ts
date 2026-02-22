import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/** Lightweight message used for thread listing (no body) */
export interface ThreadListingMessage {
  id: string;
  subject: string;
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

/** Full message with body — loaded when a thread is expanded */
export interface ThreadMessage extends ThreadListingMessage {
  body: string;
  org_id: string;
}

export interface MessageThread {
  thread_id: string;
  subject: string;
  recipient_name: string | null;
  recipient_email: string;
  message_count: number;
  latest_message_at: string;
  has_unread: boolean;
  message_ids: string[];
  latest_status: string;
  related_id: string | null;
  recipient_type: string | null;
  recipient_id: string | null;
}

const PAGE_SIZE = 100;

function groupMessagesIntoThreads(messages: ThreadListingMessage[]): MessageThread[] {
  const threadMap = new Map<string, MessageThread>();

  for (const msg of messages) {
    const threadId = msg.thread_id || msg.id;

    if (threadMap.has(threadId)) {
      const thread = threadMap.get(threadId)!;
      thread.message_ids.push(msg.id);
      thread.message_count++;
      if (!msg.read_at && msg.status === 'sent') {
        thread.has_unread = true;
      }
      if (new Date(msg.created_at) > new Date(thread.latest_message_at)) {
        thread.latest_message_at = msg.created_at;
        thread.latest_status = msg.status;
      }
      if (!thread.related_id && msg.related_id) {
        thread.related_id = msg.related_id;
      }
    } else {
      threadMap.set(threadId, {
        thread_id: threadId,
        subject: msg.subject,
        recipient_name: msg.recipient_name,
        recipient_email: msg.recipient_email,
        recipient_type: msg.recipient_type,
        recipient_id: msg.recipient_id,
        message_count: 1,
        latest_message_at: msg.created_at,
        has_unread: !msg.read_at && msg.status === 'sent',
        message_ids: [msg.id],
        latest_status: msg.status,
        related_id: msg.related_id,
      });
    }
  }

  return Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.latest_message_at).getTime() - new Date(a.latest_message_at).getTime()
  );
}

/**
 * Fetches thread listing data with cursor-based pagination.
 */
export function useMessageThreads() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();

  // Realtime subscription for instant message updates
  useEffect(() => {
    if (!currentOrg?.id) return;

    const channel = supabase
      .channel(`message-log-realtime-${currentOrg.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_log',
          filter: `org_id=eq.${currentOrg.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['message-threads'] });
          queryClient.invalidateQueries({ queryKey: ['thread-messages'] });
          queryClient.invalidateQueries({ queryKey: ['message-log'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrg?.id, queryClient]);

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['message-threads', currentOrg?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!currentOrg) return { messages: [] as ThreadListingMessage[], nextCursor: undefined };

      let query = supabase
        .from('message_log')
        .select('id, subject, recipient_email, recipient_name, recipient_type, recipient_id, related_id, sender_user_id, status, created_at, sent_at, read_at, thread_id, parent_message_id, channel, message_type')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      const nextCursor = messages && messages.length >= PAGE_SIZE
        ? messages[messages.length - 1].created_at
        : undefined;

      return { messages: messages || [], nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!currentOrg,
    staleTime: 30_000,
  });

  // Merge all pages into threads
  const threads = useMemo(() => {
    if (!infiniteQuery.data?.pages) return [];
    const allMessages = infiniteQuery.data.pages.flatMap(page => page.messages);
    return groupMessagesIntoThreads(allMessages);
  }, [infiniteQuery.data?.pages]);

  return {
    threads,
    isLoading: infiniteQuery.isLoading,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
  };
}

/**
 * Loads full message bodies for a specific thread — only called when expanded.
 */
export function useThreadMessages(threadId: string | null, enabled: boolean) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['thread-messages', currentOrg?.id, threadId],
    queryFn: async (): Promise<ThreadMessage[]> => {
      if (!currentOrg || !threadId) return [];

      // Validate threadId is a valid UUID before interpolation
      if (!/^[a-f0-9-]{36}$/i.test(threadId)) return [];
      const { data: messages, error } = await supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .or(`thread_id.eq.${threadId},id.eq.${threadId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!messages?.length) return [];

      // Attach sender profiles
      const senderIds = [...new Set(messages.map(m => m.sender_user_id).filter(Boolean))];
      let profileMap = new Map<string, { full_name: string; email: string }>();
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', senderIds as string[]);
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return messages.map(msg => ({
        ...msg,
        sender_profile: msg.sender_user_id ? profileMap.get(msg.sender_user_id) || null : null,
      }));
    },
    enabled: !!currentOrg && !!threadId && enabled,
    staleTime: 30_000,
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      queryClient.invalidateQueries({ queryKey: ['thread-messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      toast({ title: 'Reply sent', description: 'Your reply has been sent.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
