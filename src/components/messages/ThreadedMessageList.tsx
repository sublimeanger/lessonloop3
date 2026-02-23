import { useState, useMemo, useEffect } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessageThreads, useSearchMessageThreads } from '@/hooks/useMessageThreads';
import { ThreadCard } from './ThreadCard';

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface ThreadedMessageListProps {
  searchQuery?: string;
}

export function ThreadedMessageList({ searchQuery }: ThreadedMessageListProps) {
  const { threads, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMessageThreads();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(searchQuery || '', 300);
  const isServerSearch = debouncedQuery.trim().length >= 3;

  const { threads: searchResults, isLoading: searchLoading, isSearching } = useSearchMessageThreads(debouncedQuery);

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

  const filteredThreads = useMemo(() => {
    if (isServerSearch) return searchResults;
    if (!threads) return [];
    if (!searchQuery?.trim()) return threads;

    const query = searchQuery.toLowerCase();
    return threads.filter(thread =>
      thread.subject.toLowerCase().includes(query) ||
      thread.recipient_name?.toLowerCase().includes(query) ||
      thread.recipient_email.toLowerCase().includes(query)
    );
  }, [threads, searchQuery, isServerSearch, searchResults]);

  if (isLoading || (isSearching && searchLoading)) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 rounded-lg" />
                <Skeleton className="h-3 w-1/3 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-12 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!filteredThreads.length) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
            <Mail className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium mb-1">
            {searchQuery?.trim() ? 'No threads match your search' : 'No conversations yet'}
          </p>
          <p className="text-sm text-muted-foreground/70">
            {searchQuery?.trim()
              ? 'Try adjusting your search terms.'
              : 'Send a message to start a conversation.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full px-6"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading…
              </>
            ) : (
              'Load more threads'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
