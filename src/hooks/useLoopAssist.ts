import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { parseActionFromResponse, ActionProposalData } from '@/components/loopassist/ActionCard';

export type ActionType =
  | 'create_invoice'
  | 'send_message'
  | 'create_lesson'
  | 'update_lesson'
  | 'create_student'
  | 'update_student'
  | 'send_email'
  | 'unknown';

export interface ActionField {
  field: string;
  value: string | number | boolean | null | undefined;
}

export interface ActionData {
  type: ActionType;
  fields: ActionField[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface AIConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIActionProposal {
  id: string;
  proposal: ActionProposalData;
  status: string;
  result?: Record<string, unknown>;
  created_at: string;
}

export interface PageContext {
  type: 'calendar' | 'student' | 'invoice' | 'lesson' | 'general';
  id?: string;
  name?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/looopassist-chat`;
const EXECUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/looopassist-execute`;

const QUESTION_WORDS = /^(who|what|when|where|how|why|show|list|send|mark|generate|draft|create|find|get|check|tell|give|which|are|is|do|can|will|should)\b/i;

function generateSmartTitle(content: string): string {
  const trimmed = content.trim();
  if (QUESTION_WORDS.test(trimmed)) {
    const sentenceEnd = trimmed.search(/[.?!\\n]/);
    if (sentenceEnd > 0 && sentenceEnd <= 40) {
      return trimmed.slice(0, sentenceEnd + 1);
    }
    return trimmed.length <= 40 ? trimmed : trimmed.slice(0, 40) + '…';
  }
  return trimmed.length <= 30 ? trimmed : trimmed.slice(0, 30) + '…';
}

export function useLoopAssist(externalPageContext?: PageContext) {
  const { user, session } = useAuth();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const contextHashRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageContext = externalPageContext || { type: 'general' as const };

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['ai-conversations', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as AIConversation[];
    },
    enabled: !!currentOrg?.id && !!user,
  });

  // Fetch messages for current conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['ai-messages', currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', currentConversationId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as AIMessage[]).reverse();
    },
    enabled: !!currentConversationId,
  });

  // Fetch pending action proposals for current conversation
  const { data: pendingProposals = [] } = useQuery({
    queryKey: ['ai-proposals', currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      const { data, error } = await supabase
        .from('ai_action_proposals')
        .select('*')
        .eq('conversation_id', currentConversationId)
        .eq('status', 'proposed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        proposal: item.proposal as unknown as ActionProposalData,
      })) as AIActionProposal[];
    },
    enabled: !!currentConversationId,
  });

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async (title?: string) => {
      if (!currentOrg?.id || !user?.id) throw new Error('No org or user');
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          org_id: currentOrg.id,
          user_id: user.id,
          title: title || 'New conversation',
        })
        .select()
        .single();
      if (error) throw error;
      return data as AIConversation;
    },
    onSuccess: (data) => {
      setCurrentConversationId(data.id);
      contextHashRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  // Send message with streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!currentOrg?.id || !user?.id || !session?.access_token) {
      toast({ title: 'Error', description: 'Please log in to use LoopAssist', variant: 'destructive' });
      throw new Error('Not authenticated');
    }

    let conversationId = currentConversationId;

    if (!conversationId) {
      const title = generateSmartTitle(content);
      const newConv = await createConversation.mutateAsync(title);
      conversationId = newConv.id;
    }

    const { error: msgError } = await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      org_id: currentOrg.id,
      user_id: user.id,
      role: 'user',
      content,
    });
    if (msgError) {
      throw new Error('Failed to send message');
    }

    queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });

    const MAX_HISTORY_MESSAGES = 20;
    const allMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    allMessages.push({ role: 'user', content });

    const historyMessages = allMessages.length > MAX_HISTORY_MESSAGES
      ? allMessages.slice(-MAX_HISTORY_MESSAGES)
      : [...allMessages];

    if (allMessages.length > MAX_HISTORY_MESSAGES) {
      historyMessages.unshift({
        role: 'system',
        content: `[Earlier conversation context truncated. ${allMessages.length - MAX_HISTORY_MESSAGES} earlier messages not shown.]`,
      });
    }

    setIsStreaming(true);
    setStreamingContent('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    timeoutRef.current = setTimeout(() => {
      abortController.abort();
    }, 45000);

    let assistantContent = '';

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: historyMessages,
          context: pageContext,
          orgId: currentOrg.id,
          lastContextHash: contextHashRef.current,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const newContextHash = response.headers.get('X-Context-Hash');
      if (newContextHash) {
        contextHashRef.current = newContextHash;
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.text) {
              assistantContent += parsed.text;
              setStreamingContent(assistantContent);
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              textBuffer = line + '\n' + textBuffer;
              break;
            }
            throw e;
          }
        }
      }

      // Process any remaining data in the buffer after stream ends
      if (textBuffer.trim()) {
        const remainingLines = textBuffer.split('\n');
        for (const line of remainingLines) {
          const trimmed = line.replace(/\r$/, '');
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.text) {
              assistantContent += parsed.text;
              setStreamingContent(assistantContent);
            }
          } catch { /* ignore final partial */ }
        }
      }

      if (assistantContent) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          org_id: currentOrg.id,
          user_id: user.id,
          role: 'assistant',
          content: assistantContent,
        });

        const actionData = parseActionFromResponse(assistantContent);
        const VALID_ACTION_TYPES = [
          'generate_billing_run', 'send_invoice_reminders', 'reschedule_lessons',
          'draft_email', 'mark_attendance', 'cancel_lesson', 'complete_lessons',
          'send_progress_report', 'bulk_complete_lessons', 'send_bulk_reminders',
        ];
        if (actionData && VALID_ACTION_TYPES.includes(actionData.action_type)) {
          // Cap entities to prevent abuse
          if (actionData.entities && actionData.entities.length > 50) {
            actionData.entities = actionData.entities.slice(0, 50);
          }
          await supabase.from('ai_action_proposals').insert([{
            org_id: currentOrg.id,
            user_id: user.id,
            conversation_id: conversationId,
            proposal: JSON.parse(JSON.stringify(actionData)),
            status: 'proposed',
          }]);
          queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
        }

        if (messages.length === 0) {
          const title = generateSmartTitle(content);
          await supabase
            .from('ai_conversations')
            .update({ title })
            .eq('id', conversationId);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    } catch (error) {
      if (assistantContent && conversationId && currentOrg?.id && user?.id) {
        try {
          await supabase.from('ai_messages').insert({
            conversation_id: conversationId,
            org_id: currentOrg.id,
            user_id: user.id,
            role: 'assistant',
            content: assistantContent + '\n\n_[Response interrupted — please try again]_',
          });
          queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });
        } catch {
          // Ignore save error — best effort
        }
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('LoopAssist took too long to respond — this can happen with complex queries. Try again or ask a simpler question.');
      } else {
        logger.error('LoopAssist error:', error);
        throw error instanceof Error ? error : new Error('Failed to get response');
      }
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [currentOrg?.id, user?.id, session?.access_token, currentConversationId, messages, pageContext, queryClient, createConversation, toast]);

  // Execute or cancel proposal
  const handleProposal = useMutation({
    mutationFn: async ({ proposalId, action }: { proposalId: string; action: 'confirm' | 'cancel' }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ proposalId, action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process action');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.action === 'confirm') {
        toast({ title: data.result?.message || 'Action executed successfully' });
      } else {
        toast({ title: 'Action cancelled' });
      }
      queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['ai-messages', currentConversationId] });
      setTimeout(() => {
        const messagesContainer = document.querySelector('[data-loop-assist-messages]');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 500);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to process action', variant: 'destructive' });
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('org_id', currentOrg.id);
      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      if (currentConversationId === deletedId) {
        setCurrentConversationId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  return {
    conversations,
    conversationsLoading,
    currentConversationId,
    setCurrentConversationId,
    messages,
    messagesLoading,
    isStreaming,
    streamingContent,
    pendingProposals,
    pageContext,

    createConversation: createConversation.mutate,
    sendMessage,
    cancelStreaming: useCallback(() => {
      abortControllerRef.current?.abort();
    }, []),
    handleProposal: handleProposal.mutate,
    handleProposalLoading: handleProposal.isPending,
    deleteConversation: deleteConversation.mutate,
  };
}
