import { useState } from 'react';
import { format } from 'date-fns';
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
import { useReplyToMessage, MessageThread } from '@/hooks/useMessageThreads';
import { ThreadMessageItem } from './ThreadMessageItem';

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
  const latestMessage = thread.messages[thread.messages.length - 1];

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;

    await replyMutation.mutateAsync({
      parentMessageId: latestMessage.id,
      threadId: thread.thread_id,
      recipientEmail: thread.recipient_email,
      recipientName: thread.recipient_name,
      recipientType: latestMessage.recipient_type,
      recipientId: latestMessage.recipient_id,
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
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium truncate">{thread.subject}</span>
                {thread.message_count > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    {thread.message_count} messages
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">
                  {thread.recipient_name || thread.recipient_email}
                </span>
                <span className="text-xs">
                  {format(new Date(thread.latest_message_at), 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {/* Thread messages */}
            <div className="divide-y">
              {thread.messages.map((msg) => (
                <ThreadMessageItem key={msg.id} message={msg} />
              ))}
            </div>

            {/* Reply section */}
            <div className="p-4 bg-background border-t">
              {replyingTo === thread.thread_id ? (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Write your reply..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={3}
                  />
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
