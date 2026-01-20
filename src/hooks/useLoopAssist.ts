import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

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
  proposal: Record<string, unknown>;
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

export function useLoopAssist(externalPageContext?: PageContext) {
  const { user, session } = useAuth();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
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
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as AIMessage[];
    },
    enabled: !!currentConversationId,
  });

  // Fetch pending action proposals
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
      return data as AIActionProposal[];
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
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  // Send message with streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!currentOrg?.id || !user?.id || !session?.access_token) {
      toast.error('Please log in to use LoopAssist');
      return;
    }

    let conversationId = currentConversationId;

    // Create conversation if needed
    if (!conversationId) {
      const newConv = await createConversation.mutateAsync(content.slice(0, 50));
      conversationId = newConv.id;
    }

    // Save user message
    const { error: msgError } = await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      org_id: currentOrg.id,
      user_id: user.id,
      role: 'user',
      content,
    });
    if (msgError) {
      toast.error('Failed to send message');
      return;
    }

    // Refresh messages to show user message
    queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });

    // Build message history for context
    const historyMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    historyMessages.push({ role: 'user', content });

    setIsStreaming(true);
    setStreamingContent('');

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
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
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setStreamingContent(assistantContent);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          org_id: currentOrg.id,
          user_id: user.id,
          role: 'assistant',
          content: assistantContent,
        });

        // Check for action proposals in the response
        if (assistantContent.includes('**Proposed Action:**')) {
          const actionMatch = assistantContent.match(/\*\*Proposed Action:\*\*\s*(\w+)/);
          if (actionMatch) {
            await supabase.from('ai_action_proposals').insert({
              org_id: currentOrg.id,
              user_id: user.id,
              conversation_id: conversationId,
              proposal: {
                type: actionMatch[1].toLowerCase().replace(/\s+/g, '_'),
                description: assistantContent,
              },
            });
            queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
          }
        }

        // Update conversation title if first message
        if (messages.length === 0) {
          await supabase
            .from('ai_conversations')
            .update({ title: content.slice(0, 50) })
            .eq('id', conversationId);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    } catch (error) {
      console.error('LoopAssist error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [currentOrg?.id, user?.id, session?.access_token, currentConversationId, messages, pageContext, queryClient, createConversation]);

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
        toast.success(data.result?.message || 'Action executed successfully');
      } else {
        toast.info('Action cancelled');
      }
      queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to process action');
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);
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
    // State
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

    // Actions
    createConversation: createConversation.mutate,
    sendMessage,
    handleProposal: handleProposal.mutate,
    deleteConversation: deleteConversation.mutate,
  };
}
