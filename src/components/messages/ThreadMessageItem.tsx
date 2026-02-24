import React from 'react';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThreadMessage } from '@/hooks/useMessageThreads';
import { useRelatedStudent } from '@/hooks/useRelatedStudent';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { EntityChip } from '@/components/loopassist/EntityChip';
import { sanitizeHtml } from '@/lib/sanitize';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

interface ThreadMessageItemProps {
  message: ThreadMessage;
}

export const ThreadMessageItem = React.memo(function ThreadMessageItem({ message }: ThreadMessageItemProps) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { data: relatedStudent } = useRelatedStudent(message.related_id, currentOrg?.id);

  const isOutgoing = message.sender_user_id === user?.id;
  const senderName = message.sender_profile?.full_name || (isOutgoing ? 'You' : message.recipient_name || 'Unknown');

  return (
    <div className={`flex gap-2 px-3 sm:px-4 py-2 ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 mt-1">
        <AvatarFallback className={`text-micro sm:text-xs font-semibold ${isOutgoing ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {getInitials(senderName === 'You' ? (message.sender_profile?.full_name || 'You') : senderName)}
        </AvatarFallback>
      </Avatar>

      {/* Bubble */}
      <div className={`max-w-[85%] sm:max-w-[75%] ${isOutgoing ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            isOutgoing
              ? 'bg-primary/10 rounded-br-sm'
              : 'bg-muted/50 rounded-bl-sm'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center gap-1.5 mb-1 text-xs text-muted-foreground ${isOutgoing ? 'justify-end' : ''}`}>
            <span className="font-medium text-foreground">{senderName}</span>
            {relatedStudent && (
              <EntityChip
                type="student"
                id={relatedStudent.id}
                label={relatedStudent.name}
                className="text-micro"
              />
            )}
          </div>

          {/* Body */}
          {/<[a-z][\s\S]*>/i.test(message.body) ? (
            <div
              className="text-sm prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body) }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm">{message.body}</div>
          )}

          {/* Footer: timestamp + status */}
          <div className={`flex items-center gap-1.5 mt-1.5 text-micro text-muted-foreground ${isOutgoing ? 'justify-end' : ''}`}>
            <span>{format(new Date(message.created_at), 'HH:mm')}</span>
            {message.status === 'sent' && (
              <Check className="h-3 w-3 text-primary/70" />
            )}
            {message.status === 'failed' && (
              <X className="h-3 w-3 text-destructive" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
