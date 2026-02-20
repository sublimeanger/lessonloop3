import { useState } from 'react';
import { logger } from '@/lib/logger';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Loader2, Plus, Clock, CheckCircle, XCircle, AlertCircle, Mail, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useMessageRequests } from '@/hooks/useParentPortal';
import { useParentMessages } from '@/hooks/useMessages';
import { RequestModal } from '@/components/portal/RequestModal';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

export default function PortalMessages() {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');

  const { data: requests, isLoading: requestsLoading } = useMessageRequests();
  const { data: messages, isLoading: messagesLoading, hasMore, loadMore, isFetchingMore } = useParentMessages();

  // Mark messages as read when inbox tab is viewed
  useEffect(() => {
    if (activeTab === 'inbox' && messages?.length) {
      const unreadIds = messages
        .filter(m => !m.read_at && m.status === 'sent')
        .map(m => m.id);

      if (unreadIds.length > 0) {
        supabase.functions.invoke('mark-messages-read', {
          body: { message_ids: unreadIds },
        }).catch((err: unknown) => logger.error('Failed to mark messages read:', err));
      }
    }
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
          <Button onClick={() => setRequestModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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

        {/* Inbox - messages received from staff */}
        <TabsContent value="inbox">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
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
            <div className="space-y-3">
              {messages.map((msg) => (
                <Card key={msg.id} className={!msg.read_at ? 'border-primary/20 bg-primary/5' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="font-medium">{msg.subject}</span>
                        {!msg.read_at && (
                          <Badge variant="default" className="text-xs">New</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(msg.created_at), 'd MMM yyyy, HH:mm')}
                      </span>
                    </div>
                    {/<[a-z][\s\S]*>/i.test(msg.body) ? (
                      <div
                        className="text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body) }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {msg.body}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
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

      <RequestModal open={requestModalOpen} onOpenChange={setRequestModalOpen} />
    </PortalLayout>
  );
}
