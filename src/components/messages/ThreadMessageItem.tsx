import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ThreadMessage } from '@/hooks/useMessageThreads';
import { useRelatedStudent } from '@/hooks/useRelatedStudent';
import { useOrg } from '@/contexts/OrgContext';
import { EntityChip } from '@/components/loopassist/EntityChip';
import { sanitizeHtml } from '@/lib/sanitize';

interface ThreadMessageItemProps {
  message: ThreadMessage;
}

export function ThreadMessageItem({ message }: ThreadMessageItemProps) {
  const { currentOrg } = useOrg();
  const { data: relatedStudent } = useRelatedStudent(message.related_id, currentOrg?.id);

  return (
    <div className="p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground flex-wrap">
        <span className="font-medium text-foreground">
          {message.sender_profile?.full_name || 'You'}
        </span>
        <span>→</span>
        <span>{message.recipient_name || message.recipient_email}</span>
        {relatedStudent && (
          <EntityChip
            type="student"
            id={relatedStudent.id}
            label={relatedStudent.name}
            className="text-xs"
          />
        )}
        <span className="text-xs ml-auto">
          {format(new Date(message.created_at), 'dd MMM yyyy, HH:mm')}
        </span>
      </div>
      {/<[a-z][\s\S]*>/i.test(message.body) ? (
        <div
          className="text-sm prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body) }}
        />
      ) : (
        <div className="whitespace-pre-wrap text-sm">{message.body}</div>
      )}
      {message.status === 'sent' && (
        <Badge variant="outline" className="mt-2 text-xs">Sent</Badge>
      )}
      {message.status === 'failed' && (
        <Badge variant="destructive" className="mt-2 text-xs">Failed</Badge>
      )}
    </div>
  );
}
