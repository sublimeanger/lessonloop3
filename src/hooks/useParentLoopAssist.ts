import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ParentAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-loopassist-chat`;

export function useParentLoopAssist() {
  const { session } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ParentAIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!session?.access_token) {
      toast({ title: 'Error', description: 'Please log in to use LoopAssist', variant: 'destructive' });
      throw new Error('Not authenticated');
    }

    const userMessage: ParentAIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    timeoutRef.current = setTimeout(() => abortController.abort(), 30000);

    let assistantContent = '';

    try {
      // Send only recent messages for context
      const historyMessages = [...messages, userMessage]
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: historyMessages }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
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
        for (const rl of remainingLines) {
          const trimmed = rl.replace(/\r$/, '');
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
        const assistantMessage: ParentAIMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantContent,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request timed out — please try again.');
      }
      throw error instanceof Error ? error : new Error('Failed to get response');
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [session?.access_token, messages, toast]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const cancelStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    clearMessages,
    cancelStreaming,
  };
}
