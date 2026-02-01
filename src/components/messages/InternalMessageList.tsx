import { format } from 'date-fns';
import { Mail, MailOpen, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  InternalMessage, 
  useInternalMessages, 
  useMarkInternalRead 
} from '@/hooks/useInternalMessages';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useEffect, useState } from 'react';

interface InternalMessageListProps {
  view: 'inbox' | 'sent';
}

export function InternalMessageList({ view }: InternalMessageListProps) {
  const { data: messages, isLoading } = useInternalMessages(view);
  const markRead = useMarkInternalRead();
  const [expandedId, setExpandedId] = useState<string | undefined>();

  // Mark as read when expanded
  useEffect(() => {
    if (expandedId && view === 'inbox') {
      const msg = messages?.find(m => m.id === expandedId);
      if (msg && !msg.read_at) {
        markRead.mutate(expandedId);
      }
    }
  }, [expandedId, messages, view]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!messages?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {view === 'inbox' 
              ? 'No messages received yet.'
              : 'No messages sent yet.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Accordion 
      type="single" 
      collapsible 
      value={expandedId}
      onValueChange={setExpandedId}
      className="space-y-2"
    >
      {messages.map((msg) => {
        const isUnread = view === 'inbox' && !msg.read_at;
        const contactProfile = view === 'inbox' ? msg.sender_profile : msg.recipient_profile;
        const contactRole = view === 'inbox' ? msg.sender_role : msg.recipient_role;

        return (
          <AccordionItem 
            key={msg.id} 
            value={msg.id}
            className={`border rounded-lg px-4 ${isUnread ? 'bg-primary/5 border-primary/20' : ''}`}
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left w-full">
                <div className="flex-shrink-0">
                  {isUnread ? (
                    <Mail className="h-5 w-5 text-primary" />
                  ) : (
                    <MailOpen className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium truncate ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {msg.subject}
                    </span>
                    {isUnread && (
                      <Badge variant="default" className="text-xs">New</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{contactProfile?.full_name || 'Unknown'}</span>
                    <Badge variant={getRoleBadgeVariant(contactRole)} className="text-xs">
                      {contactRole}
                    </Badge>
                    <span className="text-xs">
                      {format(new Date(msg.created_at), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                {msg.body}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
