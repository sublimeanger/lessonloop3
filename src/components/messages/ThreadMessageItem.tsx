import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ThreadMessage } from '@/hooks/useMessageThreads';

interface ThreadMessageItemProps {
  message: ThreadMessage;
}

export function ThreadMessageItem({ message }: ThreadMessageItemProps) {
  return (
    <div className="p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {message.sender_profile?.full_name || 'You'}
        </span>
        <span>→</span>
        <span>{message.recipient_name || message.recipient_email}</span>
        <span className="text-xs ml-auto">
          {format(new Date(message.created_at), 'dd MMM yyyy, HH:mm')}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm">{message.body}</div>
      {message.status === 'sent' && (
        <Badge variant="outline" className="mt-2 text-xs">Sent</Badge>
      )}
      {message.status === 'failed' && (
        <Badge variant="destructive" className="mt-2 text-xs">Failed</Badge>
      )}
    </div>
  );
}
