import { useState, useMemo } from 'react';
import { Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessageThreads } from '@/hooks/useMessageThreads';
import { ThreadCard } from './ThreadCard';

interface ThreadedMessageListProps {
  searchQuery?: string;
}

export function ThreadedMessageList({ searchQuery }: ThreadedMessageListProps) {
  const { data: threads, isLoading } = useMessageThreads();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  // Client-side search filtering
  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    if (!searchQuery?.trim()) return threads;

    const query = searchQuery.toLowerCase();
    return threads.filter(thread =>
      thread.subject.toLowerCase().includes(query) ||
      thread.recipient_name?.toLowerCase().includes(query) ||
      thread.recipient_email.toLowerCase().includes(query)
    );
  }, [threads, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!filteredThreads.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchQuery?.trim()
              ? 'No threads match your search.'
              : 'No message threads yet. Send a message to start a conversation.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {filteredThreads.map(thread => (
        <ThreadCard
          key={thread.thread_id}
          thread={thread}
          isExpanded={expandedThreads.has(thread.thread_id)}
          onToggle={() => toggleThread(thread.thread_id)}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
        />
      ))}
    </div>
  );
}
