import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Clock, User, CheckCircle, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { MessageLogEntry } from '@/hooks/useMessages';

// Strip HTML tags from message body for preview
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

interface MessageListProps {
  messages: MessageLogEntry[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function MessageList({ messages, isLoading, emptyMessage = 'No messages yet' }: MessageListProps) {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
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
    <div className="space-y-3">
      {messages.map((message) => (
        <Card key={message.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-muted-foreground">
                    {getChannelIcon(message.channel)}
                  </span>
                  <span className="font-medium truncate">{message.subject}</span>
                  {getStatusBadge(message.status)}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {stripHtml(message.body)}
                </p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    To: {message.recipient_name || message.recipient_email}
                  </span>
                  {message.sender && (
                    <span>From: {message.sender.full_name || 'System'}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(message.created_at), 'd MMM yyyy, HH:mm')}
                  </span>
                </div>

                {message.error_message && (
                  <p className="mt-2 text-xs text-destructive">
                    Error: {message.error_message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
