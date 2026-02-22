import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { PortalErrorState } from '@/components/portal/PortalErrorState';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Loader2, Plus, Clock, CheckCircle, XCircle, AlertCircle, Mail, Pencil } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useMessageRequests } from '@/hooks/useParentPortal';
import { useParentMessages } from '@/hooks/useMessages';
import { RequestModal } from '@/components/portal/RequestModal';
import { useMarkMessagesAsRead } from '@/hooks/useUnreadMessages';
import { sanitizeHtml } from '@/lib/sanitize';
import { cn } from '@/lib/utils';

function formatMessageTime(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday, ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM, HH:mm');
}

export default function PortalMessages() {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const queryClient = useQueryClient();

  const { data: requests, isLoading: requestsLoading, isError: requestsError, refetch: refetchRequests } = useMessageRequests();
  const { data: messages, isLoading: messagesLoading, isError: messagesError, hasMore, loadMore, isFetchingMore } = useParentMessages();
  const markAsRead = useMarkMessagesAsRead();

  const lastMarkedKey = useRef('');

  useEffect(() => {
    if (activeTab !== 'inbox' || !messages?.length) return;

    const unreadIds = messages
      .filter(m => !m.read_at && m.status === 'sent')
      .map(m => m.id);

    if (unreadIds.length === 0) return;

    const key = unreadIds.join(',');
    if (key === lastMarkedKey.current) return;

    const now = new Date().toISOString();
    queryClient.setQueriesData(
      { queryKey: ['parent-messages'], exact: false },
      (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((msg: any) =>
              unreadIds.includes(msg.id) ? { ...msg, read_at: now } : msg
            ),
          })),
        };
      }
    );

    queryClient.setQueriesData(
      { queryKey: ['unread-messages-count'], exact: false },
      () => 0
    );

    const timer = setTimeout(() => {
      lastMarkedKey.current = key;
      markAsRead.mutate(unreadIds);
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeTab, messages]);

  const unreadCount = messages?.filter(m => !m.read_at && m.status === 'sent').length || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="default" className="gap-1 bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Declined
          </Badge>
        );
      case 'resolved':
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'cancellation':
        return <Badge variant="outline">Cancellation</Badge>;
      case 'reschedule':
        return <Badge variant="outline">Reschedule</Badge>;
      case 'general':
        return <Badge variant="outline">General</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
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

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); lastMarkedKey.current = ''; }} className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            Inbox
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
        </TabsList>

        {/* Inbox - chat bubble style */}
        <TabsContent value="inbox">
          {messagesLoading ? (
            <ListSkeleton count={3} />
          ) : messagesError ? (
            <PortalErrorState />
          ) : !messages || messages.length === 0 ? (
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
            <div className="space-y-2">
              {messages.map((msg) => {
                const isUnread = !msg.read_at;
                return (
                  <div key={msg.id} className="flex items-start gap-3">
                    {/* Unread dot */}
                    <div className="pt-3 flex-shrink-0 w-2.5">
                      {isUnread && (
                        <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </div>

                    {/* Chat bubble */}
                    <div
                      className={cn(
                        'flex-1 rounded-2xl rounded-tl-sm px-4 py-3 transition-all duration-150',
                        'bg-muted/60 dark:bg-muted/30',
                        isUnread && 'bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/15'
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <h4 className={cn('text-sm font-semibold leading-tight', isUnread && 'text-primary')}>
                          {msg.subject}
                        </h4>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatMessageTime(msg.created_at)}
                        </span>
                      </div>
                      {/<[a-z][\s\S]*>/i.test(msg.body) ? (
                        <div
                          className="text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body) }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {msg.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => loadMore()}
                    disabled={isFetchingMore}
                    className="gap-2"
                  >
                    {isFetchingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isFetchingMore ? 'Loading…' : 'Load more messages'}
                  </Button>
                </div>
              )}
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
