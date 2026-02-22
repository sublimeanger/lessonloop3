import { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { 
  MessageSquare, 
  ChevronDown, 
  ChevronRight, 
  Reply,
  User,
  Loader2 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useReplyToMessage, useThreadMessages, MessageThread } from '@/hooks/useMessageThreads';
import { useRelatedStudent } from '@/hooks/useRelatedStudent';
import { useOrg } from '@/contexts/OrgContext';
import { EntityChip } from '@/components/loopassist/EntityChip';
import { ThreadMessageItem } from './ThreadMessageItem';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/** Check if a guardian recipient is still active */
function useRecipientActive(recipientType: string | null, recipientId: string | null, orgId: string | undefined) {
  return useQuery({
    queryKey: ['recipient-active', recipientType, recipientId],
    queryFn: async () => {
      if (!recipientId || recipientType !== 'guardian') return { active: true, email: null };
      const { data } = await supabase
        .from('guardians')
        .select('id, deleted_at, email')
        .eq('id', recipientId)
        .maybeSingle();
      if (!data) return { active: false, email: null };
      return { active: data.deleted_at === null && !!data.email, email: data.email };
    },
    enabled: !!recipientId && !!orgId && recipientType === 'guardian',
    staleTime: 60_000,
  });
}

interface ThreadCardProps {
  thread: MessageThread;
  isExpanded: boolean;
  onToggle: () => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
}

export function ThreadCard({ thread, isExpanded, onToggle, replyingTo, setReplyingTo }: ThreadCardProps) {
  const replyMutation = useReplyToMessage();
  const [replyBody, setReplyBody] = useState('');
  const { toast } = useToast();

  // Lazy-load full message bodies only when expanded
  const { data: messages, isLoading: messagesLoading } = useThreadMessages(
    thread.thread_id,
    isExpanded
  );

  const latestMessage = messages?.[messages.length - 1];
  const { currentOrg } = useOrg();
  const { data: relatedStudent } = useRelatedStudent(thread.related_id, currentOrg?.id);
  const { data: recipientStatus } = useRecipientActive(thread.recipient_type, thread.recipient_id, currentOrg?.id);

  const isRecipientInactive = recipientStatus && !recipientStatus.active;

  const handleSendReply = async () => {
    if (!replyBody.trim() || !latestMessage) return;

    if (isRecipientInactive) {
      toast({ title: 'Cannot send reply', description: 'This recipient is no longer active.', variant: 'destructive' });
      return;
    }

    await replyMutation.mutateAsync({
      parentMessageId: latestMessage.id,
      threadId: thread.thread_id,
      recipientEmail: thread.recipient_email,
      recipientName: thread.recipient_name,
      recipientType: thread.recipient_type,
      recipientId: thread.recipient_id,
      subject: thread.subject,
      body: replyBody.trim(),
    });

    setReplyBody('');
    setReplyingTo(null);
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium truncate">{thread.subject}</span>
                {thread.message_count > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    {thread.message_count} messages
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <User className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {thread.recipient_name || thread.recipient_email}
                </span>
                {isRecipientInactive && (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    Inactive
                  </Badge>
                )}
                {relatedStudent && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <EntityChip
                      type="student"
                      id={relatedStudent.id}
                      label={relatedStudent.name}
                      className="text-xs"
                    />
                  </span>
                )}
                <span className="text-xs ml-auto flex-shrink-0">
                  {format(new Date(thread.latest_message_at), 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {/* Thread messages — lazy loaded */}
            <div className="divide-y">
              {messagesLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                messages?.map((msg, idx) => {
                  const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
                  const prevDate = idx > 0 ? format(new Date(messages[idx - 1].created_at), 'yyyy-MM-dd') : null;
                  const showSeparator = idx === 0 || msgDate !== prevDate;
                  const dateObj = new Date(msg.created_at);
                  const dateLabel = isToday(dateObj) ? 'Today' : isYesterday(dateObj) ? 'Yesterday' : format(dateObj, 'd MMM yyyy');

                  return (
                    <div key={msg.id}>
                      {showSeparator && (
                        <div className="flex items-center gap-2 px-4 py-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{dateLabel}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <ThreadMessageItem message={msg} />
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply section */}
            <div className="p-3 sm:p-4 bg-background border-t">
              {replyingTo === thread.thread_id ? (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Write your reply..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSendReply(); } }}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Press Ctrl+Enter to send</p>
                  <div className="flex items-center gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyBody('');
                      }}
                    >
                      Cancel
                    </Button>
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
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setReplyingTo(thread.thread_id)}
                  className="gap-2"
                >
                  <Reply className="h-4 w-4" />
                  Reply
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
