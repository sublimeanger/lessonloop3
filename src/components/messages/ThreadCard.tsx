import { useState } from 'react';
import { formatDistanceToNowStrict, isToday, isYesterday, format } from 'date-fns';
import { 
  ChevronDown, 
  ChevronRight, 
  Reply,
  Loader2,

  Mail
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) {
    return formatDistanceToNowStrict(d, { addSuffix: false }).replace(' seconds', 's').replace(' second', 's').replace(' minutes', 'm').replace(' minute', 'm').replace(' hours', 'h').replace(' hour', 'h');
  }
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM');
}

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
  const [replySendEmail, setReplySendEmail] = useState(false);
  const { toast } = useToast();

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
      send_email: replySendEmail,
    });

    setReplyBody('');
    setReplySendEmail(false);
    setReplyingTo(null);
  };

  return (
    <Card className={`overflow-hidden rounded-2xl transition-all duration-150 hover:shadow-elevated active:scale-[0.995] ${thread.has_unread ? 'border-l-4 border-l-primary' : ''}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-muted/40 transition-colors">
            {/* Chevron */}
            <div className="flex-shrink-0 text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>

            {/* Avatar */}
            <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(thread.recipient_name)}
              </AvatarFallback>
            </Avatar>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                {thread.has_unread && (
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                )}
                <span className="font-semibold text-sm sm:text-base truncate">{thread.subject}</span>
                {thread.message_count > 1 && (
                  <Badge variant="secondary" className="rounded-full text-xs px-2 py-0 h-5 font-medium">
                    {thread.message_count}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <span className="truncate">
                  {thread.recipient_name || thread.recipient_email}
                </span>
                {isRecipientInactive && (
                  <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0 h-4 rounded-full">
                    Inactive
                  </Badge>
                )}
                {relatedStudent && (
                  <span onClick={(e) => e.stopPropagation()} className="hidden sm:inline-flex">
                    <EntityChip
                      type="student"
                      id={relatedStudent.id}
                      label={relatedStudent.name}
                      className="text-xs"
                    />
                  </span>
                )}
                <span className="text-xs ml-auto flex-shrink-0 tabular-nums">
                  {relativeTime(thread.latest_message_at)}
                </span>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {/* Messages area with inset styling */}
            <div className="mx-2 sm:mx-3 my-2 sm:my-3 bg-muted/20 rounded-xl overflow-hidden">
              {messagesLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4 rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-xl" />
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
                        <div className="flex justify-center py-3">
                          <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
                            {dateLabel}
                          </span>
                        </div>
                      )}
                      <ThreadMessageItem message={msg} />
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply section */}
            <div className="p-3 sm:p-4 border-t bg-background">
              {replyingTo === thread.thread_id ? (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Write your reply…"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSendReply(); } }}
                    rows={3}
                    className="rounded-xl resize-none focus-visible:ring-primary/20"
                  />
                  <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <Label htmlFor="reply-email-toggle" className="text-xs cursor-pointer flex-1">
                      Also send via email
                    </Label>
                    <Switch
                      id="reply-email-toggle"
                      checked={replySendEmail}
                      onCheckedChange={setReplySendEmail}
                      className="scale-90"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘ Enter</kbd> to send
                    </span>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyBody('');
                          setReplySendEmail(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleSendReply}
                        disabled={!replyBody.trim() || replyMutation.isPending}
                        className="rounded-full px-4"
                      >
                        {replyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : (
                          <Reply className="h-4 w-4 mr-1.5" />
                        )}
                        {replySendEmail ? 'Send & Email' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setReplyingTo(thread.thread_id)}
                  className="gap-2 rounded-full"
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
