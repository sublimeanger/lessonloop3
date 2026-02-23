import { useState, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  ChevronLeft,
  Sparkles,
  Square,
  X,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useLoopAssist, AIMessage, AIConversation } from '@/hooks/useLoopAssist';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useProactiveAlerts, ProactiveAlert } from '@/hooks/useProactiveAlerts';
import { useLoopAssistFirstRun } from '@/hooks/useLoopAssistFirstRun';
import { preprocessEntityChips, EntityChip } from './EntityChip';
import { ActionCard, stripActionBlock, parseActionFromResponse } from './ActionCard';
import { ResultCard, parseResultFromResponse, stripResultBlock } from './ResultCard';
import { MessageFeedback } from './MessageFeedback';
import { ProactiveAlerts } from './ProactiveAlerts';
import { ProactiveWelcome } from './ProactiveWelcome';
import { LoopAssistIntroModal, useLoopAssistIntro } from './LoopAssistIntroModal';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface LoopAssistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FailedMessage {
  content: string;
  id: string;
}

type DrawerView = 'landing' | 'chat' | 'history';

export function LoopAssistDrawer({ open, onOpenChange }: LoopAssistDrawerProps) {
  const { pageContext, consumePendingMessage } = useLoopAssistUI();
  const { showIntro, setShowIntro, checkAndShowIntro } = useLoopAssistIntro();
  const { alerts } = useProactiveAlerts();
  const { proactiveMessage, dismissProactiveMessage } = useLoopAssistFirstRun();
  
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    isStreaming,
    streamingContent,
    pendingProposals,
    sendMessage,
    cancelStreaming,
    handleProposal,
    handleProposalLoading,
    deleteConversation,
  } = useLoopAssist(pageContext);

  const [input, setInput] = useState('');
  const [view, setView] = useState<DrawerView>('landing');
  const [failedMessage, setFailedMessage] = useState<FailedMessage | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  // On open: default to landing, or chat if pending message
  useEffect(() => {
    if (open) {
      checkAndShowIntro();
      const pending = consumePendingMessage();
      if (pending) {
        setView('chat');
        doSend(pending);
      } else {
        setView('landing');
      }
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
      setFailedMessage({ content, id: Date.now().toString() });
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
    const lineHeight = 20;
    const maxHeight = lineHeight * 4 + 16;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setView('chat');
    setFailedMessage(null);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setView('chat');
    setFailedMessage(null);
  };

  const handleConfirmAction = (proposalId: string) => {
    handleProposal({ proposalId, action: 'confirm' });
  };

  const handleCancelAction = (proposalId: string) => {
    handleProposal({ proposalId, action: 'cancel' });
  };

  const handleRetry = () => {
    if (failedMessage) {
      doSend(failedMessage.content);
    }
  };

  const suggestedPrompts = getSuggestedPrompts(pageContext.type, alerts);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg" hideCloseButton>
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(view === 'chat' || view === 'history') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setView('landing');
                    setCurrentConversationId(null);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <SheetTitle>LoopAssist</SheetTitle>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewConversation}>
                <Plus className="h-4 w-4" />
              </Button>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        {/* Context indicator */}
        {pageContext.type !== 'general' && (
          <div className="border-b bg-muted/50 px-4 py-2" data-tour="loopassist-context">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Context:</span>
              <Badge variant="secondary" className="capitalize">
                {pageContext.type}
                {pageContext.name && `: ${pageContext.name}`}
              </Badge>
            </div>
          </div>
        )}

        {view === 'landing' && (
          <LandingView
            alerts={alerts}
            proactiveMessage={proactiveMessage}
            suggestedPrompts={suggestedPrompts}
            conversations={conversations}
            onSendMessage={(msg) => {
              setView('chat');
              doSend(msg);
            }}
            onSelectConversation={handleSelectConversation}
            onViewAllHistory={() => setView('history')}
            onDismissProactive={dismissProactiveMessage}
            dismissProactiveMessage={dismissProactiveMessage}
          />
        )}

        {view === 'chat' && (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.length === 0 && !isStreaming && (
                  <div className="text-center text-muted-foreground">
                    <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary/50" />
                    <p className="text-sm">Start a new conversation</p>
                  </div>
                )}

                {messages.map((message) => (
                  <div key={message.id} className="group">
                    <MessageBubble message={message} conversationId={currentConversationId} />
                  </div>
                ))}

                {/* Failed message with retry */}
                {failedMessage && !isStreaming && (
                  <div className="flex flex-col items-end">
                    <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-destructive/10 border border-destructive/20">
                      <div className="whitespace-pre-wrap text-foreground">{failedMessage.content}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={handleRetry}
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
                    conversationId={null}
                  />
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex items-start">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <TypingIndicator />
                    </div>
                  </div>
                )}

                {/* Pending action proposals */}
                {pendingProposals.map((proposal) => (
                  <ActionCard
                    key={proposal.id}
                    proposalId={proposal.id}
                    proposal={proposal.proposal}
                    onConfirm={handleConfirmAction}
                    onCancel={handleCancelAction}
                    isLoading={handleProposalLoading}
                  />
                ))}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="border-t p-4" data-tour="loopassist-input">
              <div className="flex gap-3 items-end">
                <Textarea
                  ref={chatInputRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask LoopAssist..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 min-h-[36px] max-h-[96px] resize-none py-2 text-sm"
                />
                {isStreaming ? (
                  <Button onClick={cancelStreaming} size="icon" variant="destructive" title="Stop generating" className="shrink-0">
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

        {view === 'history' && (
          <ConversationList
            conversations={conversations}
            onSelect={handleSelectConversation}
            onDelete={deleteConversation}
            onNew={handleNewConversation}
          />
        )}
      </SheetContent>

      {/* Intro Modal */}
      <LoopAssistIntroModal open={showIntro} onOpenChange={setShowIntro} />
    </Sheet>
  );
}

// ─── Landing View ───
function LandingView({
  alerts,
  proactiveMessage,
  suggestedPrompts,
  conversations,
  onSendMessage,
  onSelectConversation,
  onViewAllHistory,
  onDismissProactive,
  dismissProactiveMessage,
}: {
  alerts: ProactiveAlert[];
  proactiveMessage: { title: string; message: string; suggestedPrompts: string[] } | null;
  suggestedPrompts: string[];
  conversations: AIConversation[];
  onSendMessage: (msg: string) => void;
  onSelectConversation: (id: string) => void;
  onViewAllHistory: () => void;
  onDismissProactive: () => void;
  dismissProactiveMessage: () => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Proactive Welcome (first run only) */}
        {proactiveMessage && (
          <ProactiveWelcome
            title={proactiveMessage.title}
            message={proactiveMessage.message}
            suggestedPrompts={proactiveMessage.suggestedPrompts}
            onPromptClick={(prompt) => {
              dismissProactiveMessage();
              onSendMessage(prompt);
            }}
            onDismiss={onDismissProactive}
          />
        )}

        {/* Proactive Alerts */}
        {!proactiveMessage && alerts.length > 0 && (
          <ProactiveAlerts alerts={alerts} onSuggestedAction={onSendMessage} />
        )}

        {/* Main input area */}
        {!proactiveMessage && (
          <div className="space-y-3">
            <div className="text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary/50" />
              <p className="text-sm text-muted-foreground">How can I help you today?</p>
            </div>

            {/* Quick input */}
            <div className="flex gap-2" data-tour="loopassist-input">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask LoopAssist..."
                className="flex-1 text-sm"
              />
              <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Suggested prompts */}
            {suggestedPrompts.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center" data-tour="loopassist-prompts">
                {suggestedPrompts.map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal text-left text-xs"
                    onClick={() => onSendMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Recent conversations</p>
              {conversations.length > 5 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={onViewAllHistory}
                >
                  View all
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {conversations.slice(0, 5).map((conv) => (
                <button
                  key={conv.id}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate text-xs">{conv.title}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(conv.updated_at), 'dd/MM')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Typing Indicator ───
function TypingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-1" aria-label="LoopAssist is thinking">
      <div className="flex items-center gap-1 h-5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[typing-bounce_1.4s_ease-in-out_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[typing-bounce_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[typing-bounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
      {elapsed > 10 && (
        <p className="text-[10px] text-muted-foreground">
          {elapsed > 30 ? 'Almost there…' : 'Thinking…'}
        </p>
      )}
    </div>
  );
}

// ─── Conversation List ───
function ConversationList({
  conversations,
  onSelect,
  onDelete,
  onNew,
}: {
  conversations: AIConversation[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(conv =>
        conv.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <Button variant="outline" className="mb-3 w-full gap-2" onClick={onNew}>
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>

        {conversations.length > 0 && (
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        )}

        {conversations.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No conversations yet</p>
        ) : filteredConversations.length === 0 && searchQuery ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No conversations matching &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                className="group flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => onSelect(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(conv.id);
                  }
                }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{conv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(conv.updated_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Message Bubble ───
function MessageBubble({ message, conversationId }: { message: AIMessage; conversationId: string | null }) {
  const isUser = message.role === 'user';
  const rawContent = isUser ? message.content : stripActionBlock(message.content);
  const displayContent = isUser ? rawContent : stripResultBlock(rawContent);
  const processedContent = isUser ? displayContent : preprocessEntityChips(displayContent);
  const hasAction = !isUser && parseActionFromResponse(message.content);
  const resultData = !isUser ? parseResultFromResponse(message.content) : null;

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{displayContent}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mb-1 [&_h2]:mb-1 [&_h3]:mb-1 [&_pre]:bg-background/50 [&_pre]:text-xs [&_pre]:p-2 [&_pre]:rounded">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em>{children}</em>,
                a: ({ href, children }) => <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                li: ({ children }) => <li className="my-0">{children}</li>,
                span: ({ node, ...props }: any) => {
                  const entityType = props['data-entity-type'];
                  if (entityType) {
                    return (
                      <EntityChip
                        type={entityType}
                        id={props['data-entity-id'] || ''}
                        label={props['data-entity-label'] || ''}
                        className="mx-0.5 inline-flex"
                      />
                    );
                  }
                  return <span {...props} />;
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </div>
        )}
        {hasAction && (
          <div className="mt-2 text-xs text-muted-foreground italic">
            Action proposal below ↓
          </div>
        )}
      </div>
      {resultData && (
        <div className="max-w-[85%]">
          <ResultCard result={resultData} />
        </div>
      )}
      {!isUser && message.id !== 'streaming' && conversationId && (
        <MessageFeedback 
          messageId={message.id} 
          conversationId={conversationId}
          className="mt-1 opacity-0 group-hover:opacity-100 hover:opacity-100"
        />
      )}
    </div>
  );
}

function getSuggestedPrompts(contextType: string, alerts: ProactiveAlert[]): string[] {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const isMorning = hour >= 6 && hour < 12;
  const isEvening = hour >= 17;
  const isMonday = dayOfWeek === 1;
  const isFriday = dayOfWeek === 5;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isEndOfMonth = dayOfMonth >= daysInMonth - 3;
  const isStartOfMonth = dayOfMonth <= 3;

  const hasOverdue = alerts.some(a => a.type === 'overdue');
  const hasUnmarked = alerts.some(a => a.type === 'unmarked');

  const prompts: string[] = [];

  switch (contextType) {
    case 'calendar':
      if (hasUnmarked) prompts.push("Mark yesterday's lessons as complete");
      if (isMorning) prompts.push("What's on my schedule today?");
      else if (isEvening) prompts.push("What lessons do I have tomorrow?");
      else prompts.push("What's on my schedule today?");
      if (isFriday) prompts.push("Wrap up this week's attendance");
      prompts.push("Reschedule tomorrow's lessons by 30 minutes");
      break;

    case 'student':
      prompts.push("Draft a progress update for this student's parents");
      prompts.push("Show lesson history for this student");
      if (hasOverdue) prompts.push("Send invoice reminder for this student");
      prompts.push("What is this student's practice streak?");
      break;

    case 'invoice':
      prompts.push("Send a payment reminder for this invoice");
      prompts.push("Show payment history");
      prompts.push("Draft a follow-up email");
      break;

    default:
      if (hasOverdue) prompts.push("Send reminders for all overdue invoices");
      if (hasUnmarked) prompts.push("Mark all past lessons as complete");

      if (isMonday && isMorning) {
        prompts.push("What's my week looking like?");
      } else if (isFriday) {
        prompts.push("How did this week go?");
      } else if (isWeekend) {
        prompts.push("What's coming up next week?");
      } else if (isMorning) {
        prompts.push("What's on today?");
      } else if (isEvening) {
        prompts.push("Summary of today");
      }

      if (isEndOfMonth) {
        prompts.push("Generate invoices for this month");
      } else if (isStartOfMonth) {
        prompts.push("Revenue summary for last month");
      }

      prompts.push("Show me outstanding invoices");
      prompts.push("What's my completion rate this month?");
      break;
  }

  return [...new Set(prompts)].slice(0, 4);
}
