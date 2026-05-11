import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/error-handler';

const PAGE_SIZE = 50;

export interface MessageTemplate {
  id: string;
  org_id: string;
  name: string;
  subject: string;
  body: string;
  channel: 'email' | 'inapp';
  created_at: string;
  updated_at: string;
}

export interface MessageLogEntry {
  id: string;
  org_id: string;
  channel: string;
  subject: string;
  body: string;
  sender_user_id: string | null;
  recipient_type: 'guardian' | 'student' | 'teacher' | 'parent' | null;
  recipient_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  related_id: string | null;
  message_type: string;
  status: string;
  sent_at: string | null;
  read_at: string | null;
  error_message: string | null;
  created_at: string;
  // Joined data
  sender?: { full_name: string | null } | null;
  guardian?: { full_name: string; email: string | null } | null;
  student?: { first_name: string; last_name: string } | null;
}

export interface SendMessageData {
  recipient_type: 'guardian' | 'student' | 'teacher';
  recipient_id: string;
  /** @deprecated Server resolves email from DB; client value is ignored. */
  recipient_email?: string;
  /** @deprecated Server resolves name from DB; client value is ignored. */
  recipient_name?: string;
  subject: string;
  body: string;
  related_id?: string; // e.g., student_id for context
  message_type?: string;
  /** When false, only creates in-app message without sending email. Defaults to false. */
  send_email?: boolean;
}

// Fetch message templates for the org
export function useMessageTemplates() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['message-templates', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('name');

      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: !!currentOrg,
  });
}

// Cursor-based paginated message log with filters
export function useMessageLog(filters?: {
  studentId?: string;
  guardianId?: string;
  recipientType?: string;
  channel?: string;
  /** Filter by message_type (e.g. 'invoice_reminder', 'custom', 'progress_report'). */
  messageType?: string;
  /** Filter by status; accepts a single value or array (e.g. 'draft', ['draft','queued']). */
  status?: string | string[];
}) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['message-log', currentOrg?.id, filters],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      if (!currentOrg || !user) return { data: [], nextCursor: null };

      let query = supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (filters?.guardianId) {
        query = query.eq('recipient_id', filters.guardianId);
      }
      if (filters?.recipientType) {
        query = query.eq('recipient_type', filters.recipientType);
      }
      if (filters?.channel) {
        query = query.eq('channel', filters.channel);
      }
      if (filters?.studentId) {
        query = query.eq('related_id', filters.studentId);
      }
      if (filters?.messageType) {
        query = query.eq('message_type', filters.messageType);
      }
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as unknown as MessageLogEntry[];
      return {
        data: rows,
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!currentOrg && !!user,
  });

  // Flatten pages for backwards-compatible .data usage
  const allMessages = infiniteQuery.data?.pages.flatMap((p) => p.data) ?? [];

  return {
    data: allMessages,
    isLoading: infiniteQuery.isLoading,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    hasMore: infiniteQuery.hasNextPage ?? false,
    loadMore: infiniteQuery.fetchNextPage,
    isFetchingMore: infiniteQuery.isFetchingNextPage,
  };
}

// Cursor-based paginated messages for a specific student
export function useStudentMessages(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['student-messages', currentOrg?.id, studentId],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      if (!currentOrg || !studentId) return { data: [], nextCursor: null };

      let query = supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('related_id', studentId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as unknown as MessageLogEntry[];
      return {
        data: rows,
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!currentOrg && !!studentId,
  });

  const allMessages = infiniteQuery.data?.pages.flatMap((p) => p.data) ?? [];

  return {
    data: allMessages,
    isLoading: infiniteQuery.isLoading,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    hasMore: infiniteQuery.hasNextPage ?? false,
    loadMore: infiniteQuery.fetchNextPage,
    isFetchingMore: infiniteQuery.isFetchingNextPage,
  };
}

// Cursor-based paginated messages for parent portal
export function useParentMessages() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  const { data: guardianId } = useQuery({
    queryKey: ['parent-guardian-id', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return null;
      const { data } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!currentOrg && !!user,
    staleTime: STALE_STABLE,
  });

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['parent-messages', currentOrg?.id, user?.id, guardianId],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      if (!currentOrg || !user || !guardianId) return { data: [], nextCursor: null };

      let query = supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('recipient_id', guardianId)
        .eq('recipient_type', 'guardian')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as MessageLogEntry[];
      return {
        data: rows,
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!currentOrg && !!user && !!guardianId,
  });

  const allMessages = infiniteQuery.data?.pages.flatMap((p) => p.data) ?? [];

  return {
    data: allMessages,
    isLoading: infiniteQuery.isLoading,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    hasMore: infiniteQuery.hasNextPage ?? false,
    loadMore: infiniteQuery.fetchNextPage,
    isFetchingMore: infiniteQuery.isFetchingNextPage,
  };
}

// Send a message via edge function
export function useSendMessage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SendMessageData) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('send-message', {
        body: {
          org_id: currentOrg.id,
          ...data,
        },
      });

      if (error) throw error;
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['message-log'] });
      await queryClient.cancelQueries({ queryKey: ['student-messages'] });

      // Snapshot previous data for rollback
      const previousLog = queryClient.getQueryData(['message-log', currentOrg?.id, undefined]);

      // Optimistically add the message to the log
      const optimisticMessage: MessageLogEntry = {
        id: crypto.randomUUID(),
        org_id: currentOrg?.id || '',
        channel: 'email',
        subject: data.subject,
        body: data.body,
        sender_user_id: user?.id || null,
        recipient_type: data.recipient_type,
        recipient_id: data.recipient_id,
        recipient_email: data.recipient_email || '',
        recipient_name: data.recipient_name ?? null,
        related_id: data.related_id || null,
        message_type: data.message_type || 'manual',
        status: 'pending',
        sent_at: null,
        read_at: null,
        error_message: null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueriesData<{ pages: { data: MessageLogEntry[]; nextCursor: string | null }[]; pageParams: unknown[] }>(
        { queryKey: ['message-log'] },
        (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: [
              { ...old.pages[0], data: [optimisticMessage, ...old.pages[0].data] },
              ...old.pages.slice(1),
            ],
          };
        }
      );

      return { previousLog };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      queryClient.invalidateQueries({ queryKey: ['student-messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      // Parent sees new message via realtime sub on message_log or email notification (5.4)
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
      toast({ title: 'Message sent', description: 'Your message has been sent successfully.' });
    },
    onError: (error: unknown, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousLog) {
        queryClient.setQueryData(['message-log', currentOrg?.id, undefined], context.previousLog);
      }
      toastError(error, 'Error sending message');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      queryClient.invalidateQueries({ queryKey: ['student-messages'] });
    },
  });
}

// Discard a draft message_log row. Hard-delete because drafts are user-owned
// authoring state; the audit trail is the proposal that created the draft.
export function useDiscardDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentOrg } = useOrg();

  return useMutation({
    mutationFn: async (draftId: string) => {
      if (!currentOrg) throw new Error('No organisation selected');
      const { error } = await supabase
        .from('message_log')
        .delete()
        .eq('id', draftId)
        .eq('org_id', currentOrg.id)
        .eq('status', 'draft');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      toast({ title: 'Draft discarded' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to discard draft');
    },
  });
}

// Send a draft message: posts to send-message with the draft's content, then
// deletes the draft row. send-message inserts a fresh log row with status='sent'
// (or 'pending' if Resend not configured), so the audit trail still shows the
// outbound message — only the draft is removed.
export function useSendDraft() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (draft: MessageLogEntry) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!draft.recipient_id || !draft.recipient_type) {
        throw new Error('Draft is missing recipient information — open and edit before sending.');
      }
      // Send the draft's content (server resolves email from DB by recipient_id/_type).
      const { error: sendError } = await supabase.functions.invoke('send-message', {
        body: {
          org_id: currentOrg.id,
          recipient_type: draft.recipient_type,
          recipient_id: draft.recipient_id,
          subject: draft.subject,
          body: draft.body,
          related_id: draft.related_id ?? undefined,
          message_type: draft.message_type === 'custom' ? 'manual' : draft.message_type,
          send_email: draft.channel !== 'inapp',
        },
      });
      if (sendError) throw sendError;
      // Delete the draft now that it's been sent.
      const { error: delError } = await supabase
        .from('message_log')
        .delete()
        .eq('id', draft.id)
        .eq('org_id', currentOrg.id)
        .eq('status', 'draft');
      if (delError) {
        // The send succeeded but cleanup failed — surface a non-blocking warning
        // rather than rolling back, since the user's intent (send) was honoured.
        console.warn('[useSendDraft] failed to delete draft after send', delError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      toast({ title: 'Draft sent' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to send draft');
    },
  });
}

// Create/update message template
export function useCreateMessageTemplate() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; subject: string; body: string; channel?: 'email' | 'inapp' }) => {
      if (!currentOrg) throw new Error('No org selected');
      if (!data.name.trim()) throw new Error('Template name is required');
      if (!data.subject.trim()) throw new Error('Template subject is required');
      if (!data.body.trim()) throw new Error('Template body is required');

      const { error } = await supabase.from('message_templates').insert({
        org_id: currentOrg.id,
        name: data.name,
        subject: data.subject,
        body: data.body,
        channel: data.channel || 'email',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'Template created' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to create template');
    },
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'Template deleted' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to delete template');
    },
  });
}
