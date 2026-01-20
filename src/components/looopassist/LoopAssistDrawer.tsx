import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useLoopAssist, AIMessage, AIConversation } from '@/hooks/useLoopAssist';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { renderMessageWithChips } from './EntityChip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LoopAssistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoopAssistDrawer({ open, onOpenChange }: LoopAssistDrawerProps) {
  const { pageContext } = useLoopAssistUI();
  
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    isStreaming,
    streamingContent,
    pendingProposals,
    createConversation,
    sendMessage,
    handleProposal,
    deleteConversation,
  } = useLoopAssist(pageContext);

  const [input, setInput] = useState('');
  const [showConversationList, setShowConversationList] = useState(!currentConversationId);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const message = input;
    setInput('');
    setShowConversationList(false);
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setShowConversationList(false);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setShowConversationList(false);
  };

  const suggestedPrompts = getSuggestedPrompts(pageContext.type);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!showConversationList && currentConversationId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowConversationList(true)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <SheetTitle>LoopAssist</SheetTitle>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewConversation}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Context indicator */}
        {pageContext.type !== 'general' && (
          <div className="border-b bg-muted/50 px-4 py-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Context:</span>
              <Badge variant="secondary" className="capitalize">
                {pageContext.type}
                {pageContext.name && `: ${pageContext.name}`}
              </Badge>
            </div>
          </div>
        )}

        {showConversationList ? (
          <ConversationList
            conversations={conversations}
            onSelect={handleSelectConversation}
            onDelete={deleteConversation}
            onNew={handleNewConversation}
          />
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.length === 0 && !isStreaming && (
                  <div className="space-y-4">
                    <div className="text-center text-muted-foreground">
                      <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary/50" />
                      <p className="text-sm">How can I help you today?</p>
                    </div>
                    {suggestedPrompts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {suggestedPrompts.map((prompt, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="h-auto whitespace-normal text-left text-xs"
                            onClick={() => {
                              setInput(prompt);
                            }}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

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
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                )}

                {/* Pending proposals */}
                {pendingProposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-lg border bg-accent/50 p-3">
                    <p className="mb-2 text-sm font-medium">Action pending confirmation</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleProposal({ proposalId: proposal.id, action: 'confirm' })}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProposal({ proposalId: proposal.id, action: 'cancel' })}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask LoopAssist..."
                  disabled={isStreaming}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon">
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

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
  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <Button variant="outline" className="mb-4 w-full gap-2" onClick={onNew}>
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>

        {conversations.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No conversations yet</p>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="group flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                onClick={() => onSelect(conv.id)}
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

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <div className="whitespace-pre-wrap">
          {isUser ? message.content : renderMessageWithChips(message.content)}
        </div>
      </div>
    </div>
  );
}

function getSuggestedPrompts(contextType: string): string[] {
  switch (contextType) {
    case 'calendar':
      return [
        "What lessons do I have today?",
        "Show me this week's schedule summary",
        "Any cancellations this week?",
      ];
    case 'student':
      return [
        "Draft a progress update email for this student",
        "Show lesson history for this student",
        "Any outstanding invoices?",
      ];
    case 'invoice':
      return [
        "Send a payment reminder",
        "Show payment history",
        "Draft a follow-up email",
      ];
    default:
      return [
        "What's my revenue this month?",
        "Show me outstanding invoices",
        "How many lessons this week?",
        "Who has the most cancellations?",
      ];
  }
}
