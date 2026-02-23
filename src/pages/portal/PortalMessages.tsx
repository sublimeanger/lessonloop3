import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { PortalErrorState } from '@/components/portal/PortalErrorState';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Loader2, Plus, Clock, CheckCircle, XCircle, AlertCircle, Mail, Pencil, Reply, ChevronDown, ChevronRight, User, Shield } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useMessageRequests } from '@/hooks/useParentPortal';
import { useParentConversations, type Conversation, type ConversationMessage } from '@/hooks/useParentConversations';
import { useParentReply } from '@/hooks/useParentReply';
import { useMarkMessagesAsRead } from '@/hooks/useUnreadMessages';
import { RequestModal } from '@/components/portal/RequestModal';
import { sanitizeHtml } from '@/lib/sanitize';
import { cn } from '@/lib/utils';

function formatMessageTime(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday, ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM, HH:mm');
}

function formatConversationDate(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM');
}

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isParent = msg.sender_role === 'parent';

  return (
    <div className={cn('flex', isParent ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] space-y-1')}>
        <div className="flex items-center gap-2 mb-0.5">
          {!isParent && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
              <Shield className="h-2.5 w-2.5" />
              {msg.sender_name || 'Staff'}
            </Badge>
          )}
          {isParent && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 ml-auto">
              <User className="h-2.5 w-2.5" />
              You
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatMessageTime(msg.created_at)}
          </span>
        </div>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm',
            isParent
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted/60 dark:bg-muted/30 rounded-bl-sm'
          )}
        >
          {/<[a-z][\s\S]*>/i.test(msg.body) ? (
            <div
              className={cn(
                'prose prose-sm max-w-none',
                isParent ? 'prose-invert [&_a]:text-primary-foreground' : 'dark:prose-invert [&_a]:text-primary'
              )}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body) }}
            />
          ) : (
            <p className="whitespace-pre-wrap">{msg.body}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationCard({
  conversation,
  isExpanded,
  onToggle,
}: {
  conversation: Conversation;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [replyBody, setReplyBody] = useState('');
  const replyMutation = useParentReply();
  const markAsRead = useMarkMessagesAsRead();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark unread messages as read when expanded
  useEffect(() => {
    if (!isExpanded || conversation.unreadCount === 0) return;
    const unreadIds = conversation.messages
      .filter(m => !m.read_at && m.sender_role === 'staff' && m.status === 'sent')
      .map(m => m.id);
    if (unreadIds.length > 0) {
      const timer = setTimeout(() => markAsRead.mutate(unreadIds), 800);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, conversation.messages, conversation.unreadCount]);

  // Scroll to bottom when expanded
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isExpanded, conversation.messages.length]);

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;
    // Find the last staff message to reply to (or the first message in thread)
    const staffMessages = conversation.messages.filter(m => m.sender_role === 'staff');
    const lastStaffMsg = staffMessages[staffMessages.length - 1] || conversation.messages[0];

    await replyMutation.mutateAsync({
      parentMessageId: lastStaffMsg.id,
      body: replyBody.trim(),
    });
    setReplyBody('');
  };

  const hasUnread = conversation.unreadCount > 0;

  return (
    <Card className={cn(
      'transition-all duration-150',
      hasUnread && !isExpanded && 'ring-1 ring-primary/20 bg-primary/[0.02]'
    )}>
      {/* Conversation header - clickable */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="pt-0.5 flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className={cn(
              'text-sm font-medium truncate',
              hasUnread && 'font-semibold text-primary'
            )}>
              {conversation.subject}
            </h4>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
              {formatConversationDate(conversation.lastMessageAt)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {conversation.lastSenderRole === 'parent' ? 'You: ' : ''}
            {conversation.lastMessagePreview.replace(/<[^>]*>/g, '')}
          </p>
        </div>

        {hasUnread && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs flex-shrink-0">
            {conversation.unreadCount}
          </Badge>
        )}

        <Badge variant="outline" className="text-[10px] flex-shrink-0">
          {conversation.messages.length}
        </Badge>
      </button>

      {/* Expanded conversation */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4 border-t">
          {/* Messages timeline */}
          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            {conversation.messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply area */}
          <div className="border-t pt-3 space-y-2">
            <Textarea
              placeholder="Write your reply…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              rows={2}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
              <Button
                size="sm"
                onClick={handleSendReply}
                disabled={!replyBody.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Reply className="h-4 w-4 mr-2" />
                )}
                Send Reply
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function PortalMessages() {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const { data: requests, isLoading: requestsLoading, isError: requestsError, refetch: refetchRequests } = useMessageRequests();
  const { conversations, totalUnread, isLoading: conversationsLoading, isError: conversationsError } = useParentConversations();

  const toggleThread = (threadId: string) => {
    setExpandedThread(prev => prev === threadId ? null : threadId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-success text-success-foreground"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case 'declined':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Declined</Badge>;
      case 'resolved':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'cancellation': return <Badge variant="outline">Cancellation</Badge>;
      case 'reschedule': return <Badge variant="outline">Reschedule</Badge>;
      case 'general': return <Badge variant="outline">General</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <PortalLayout>
      <PageHeader
        title="Messages"
        description="View your messages and requests"
        actions={
          <Button onClick={() => setRequestModalOpen(true)} className="gap-2 hidden sm:inline-flex">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            Inbox
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
                {totalUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
        </TabsList>

        {/* Inbox - conversation threads */}
        <TabsContent value="inbox">
          {conversationsLoading ? (
            <ListSkeleton count={3} />
          ) : conversationsError ? (
            <PortalErrorState />
          ) : conversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-4 text-lg font-medium">No messages yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Messages from your teacher will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv) => (
                <ConversationCard
                  key={conv.threadId}
                  conversation={conv}
                  isExpanded={expandedThread === conv.threadId}
                  onToggle={() => toggleThread(conv.threadId)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests - existing request flow */}
        <TabsContent value="requests">
          {requestsLoading ? (
            <ListSkeleton count={2} />
          ) : requestsError ? (
            <PortalErrorState onRetry={() => refetchRequests()} />
          ) : !requests || requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-4 text-lg font-medium">No requests yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send a request to communicate with the admin team.
                </p>
                <Button onClick={() => setRequestModalOpen(true)} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Send a Request
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTypeBadge(request.request_type)}
                        {getStatusBadge(request.status)}
                        {request.student && (
                          <Badge variant="secondary">
                            {request.student.first_name} {request.student.last_name}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(request.created_at), 'd MMM yyyy, HH:mm')}
                      </span>
                    </div>

                    <h3 className="font-medium mb-2">{request.subject}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {request.message}
                    </p>

                    {request.lesson && (
                      <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                        <span className="text-muted-foreground">Regarding lesson: </span>
                        <span className="font-medium">{request.lesson.title}</span>
                        <span className="text-muted-foreground">
                          {' '}on {format(parseISO(request.lesson.start_at), 'd MMM yyyy')}
                        </span>
                      </div>
                    )}

                    {request.admin_response && (
                      <div className="mt-4 p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 text-sm font-medium mb-2">
                          <AlertCircle className="h-4 w-4" />
                          Admin Response
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{request.admin_response}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mobile FAB for compose */}
      <button
        onClick={() => setRequestModalOpen(true)}
        className="fixed bottom-20 right-4 z-40 sm:hidden h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="New request"
      >
        <Pencil className="h-5 w-5" />
      </button>

      <RequestModal open={requestModalOpen} onOpenChange={setRequestModalOpen} />
    </PortalLayout>
  );
}
