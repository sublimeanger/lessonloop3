import { useState, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Sparkles, Send, Square, X, RotateCcw, Trash2 } from 'lucide-react';
import { useParentLoopAssist, ParentAIMessage } from '@/hooks/useParentLoopAssist';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const SUGGESTED_PROMPTS = [
  "When is my child's next lesson?",
  "How is their practice going?",
  "Show my invoices",
  "How has attendance been this month?",
];

interface ParentLoopAssistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ParentLoopAssist({ open, onOpenChange }: ParentLoopAssistProps) {
  const {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    clearMessages,
    cancelStreaming,
  } = useParentLoopAssist();

  const [input, setInput] = useState('');
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  useEffect(() => {
    if (open) {
      setTimeout(() => chatInputRef.current?.focus(), 300);
    }
  }, [open]);

  const doSend = useCallback(async (content: string) => {
    setFailedMessage(null);
    try {
      await sendMessage(content);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get response';
      toast({ title: errorMsg, variant: 'destructive' });
      setFailedMessage(content);
    }
  }, [sendMessage]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const message = input;
    setInput('');
    if (chatInputRef.current) chatInputRef.current.style.height = 'auto';
    await doSend(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
  };

  const showLanding = messages.length === 0 && !isStreaming;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg" hideCloseButton>
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <SheetTitle>LoopAssist</SheetTitle>
              <Badge variant="secondary" className="text-xs">Parent</Badge>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearMessages}
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        {showLanding ? (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <div className="text-center py-4">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary/50" />
                <h3 className="text-base font-medium">Hi there! 👋</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  I can help you check on lessons, practice, and invoices.
                </p>
              </div>

              <div className="flex gap-2 items-end">
                <Textarea
                  ref={chatInputRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  rows={1}
                  className="flex-1 min-h-[36px] max-h-[96px] resize-none py-2 text-sm"
                />
                <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal text-left text-xs"
                    onClick={() => doSend(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {failedMessage && !isStreaming && (
                  <div className="flex flex-col items-end">
                    <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-destructive/10 border border-destructive/20">
                      <div className="whitespace-pre-wrap text-foreground">{failedMessage}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={() => doSend(failedMessage)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                )}

                {isStreaming && streamingContent && (
                  <MessageBubble
                    message={{
                      id: 'streaming',
                      role: 'assistant',
                      content: streamingContent,
                      created_at: new Date().toISOString(),
                    }}
                  />
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex items-start">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                        <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex gap-3 items-end">
                <Textarea
                  ref={chatInputRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 min-h-[36px] max-h-[96px] resize-none py-2 text-sm"
                />
                {isStreaming ? (
                  <Button onClick={cancelStreaming} size="icon" variant="destructive" title="Stop" className="shrink-0">
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({ message }: { message: ParentAIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
            <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// Removed: ParentLoopAssistButton is no longer needed - LoopAssist opens from the Header
