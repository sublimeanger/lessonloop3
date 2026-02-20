import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, Clock, User, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Reply, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRelatedStudent } from '@/hooks/useRelatedStudent';
import { EntityChip } from '@/components/looopassist/EntityChip';
import type { MessageLogEntry } from '@/hooks/useMessages';
import { sanitizeHtml, stripHtml } from '@/lib/sanitize';

// Check if a string contains HTML tags
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

interface MessageListProps {
  messages: MessageLogEntry[];
  isLoading?: boolean;
  emptyMessage?: string;
  onReply?: (message: MessageLogEntry) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isFetchingMore?: boolean;
}

function MessageCard({ message, onReply }: { message: MessageLogEntry; onReply?: (msg: MessageLogEntry) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: relatedStudent } = useRelatedStudent(message.related_id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="secondary" className="gap-1 bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3" />
            Sent
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'inapp':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-muted-foreground">
                    {getChannelIcon(message.channel)}
                  </span>
                  <span className="font-medium truncate">{message.subject}</span>
                  {getStatusBadge(message.status)}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
                  )}
                </div>

                {!isExpanded && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {stripHtml(message.body)}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    To: {message.recipient_name || message.recipient_email}
                  </span>
                  {relatedStudent && (
                    <EntityChip
                      type="student"
                      id={relatedStudent.id}
                      label={relatedStudent.name}
                      className="text-xs"
                    />
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(message.created_at), 'd MMM yyyy, HH:mm')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-3">
            {/* Full message body */}
            {isHtml(message.body) ? (
              <div
                className="text-sm bg-muted/50 rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body) }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm bg-muted/50 rounded-lg p-4">
                {message.body}
              </div>
            )}

            {/* Context and actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {message.sender && (
                <span className="text-xs text-muted-foreground">
                  From: {message.sender.full_name || 'System'}
                </span>
              )}
              {message.error_message && (
                <p className="text-xs text-destructive">
                  Error: {message.error_message}
                </p>
              )}
              <div className="ml-auto">
                {onReply && message.recipient_email && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(message);
                    }}
                  >
                    <Reply className="h-4 w-4" />
                    Reply
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function MessageList({ messages, isLoading, emptyMessage = 'No messages yet', onReply, hasMore, onLoadMore, isFetchingMore }: MessageListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium">No messages</h3>
          <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <MessageCard key={message.id} message={message} onReply={onReply} />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingMore}
            className="gap-2"
          >
            {isFetchingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFetchingMore ? 'Loading…' : 'Load more messages'}
          </Button>
        </div>
      )}
    </div>
  );
}
