import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  Calendar, 
  MessageSquare, 
  CheckCircle2, 
  User,
  Send,
  Music,
  Loader2
} from 'lucide-react';
import { usePracticeLogs, useAddPracticeFeedback, PracticeLog } from '@/hooks/usePractice';
import { toast } from 'sonner';

export function TeacherPracticeReview() {
  const [activeTab, setActiveTab] = useState('pending');
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = usePracticeLogs({ limit: 50 });
  const allLogs = useMemo(() => data?.pages.flatMap(p => p.data) ?? [], [data]);
  const pendingLogs = useMemo(() => allLogs.filter(l => !l.reviewed_at), [allLogs]);
  
  const addFeedback = useAddPracticeFeedback();

  const handleSubmitFeedback = async (logId: string) => {
    const feedback = feedbackText[logId]?.trim();
    if (!feedback) {
      toast.error('Please enter feedback');
      return;
    }

    try {
      await addFeedback.mutateAsync({ logId, feedback });
      toast.success('Feedback sent!');
      setFeedbackText(prev => ({ ...prev, [logId]: '' }));
    } catch (error: any) {
      toast.error(error.message || 'Failed to send feedback');
    }
  };

  const renderLogCard = (log: PracticeLog, showFeedbackInput: boolean) => (
    <div 
      key={log.id} 
      className="border rounded-lg p-4 bg-card"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {log.student?.first_name} {log.student?.last_name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(parseISO(log.practice_date), 'EEE, MMM d, yyyy')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-primary font-medium">
            <Clock className="h-4 w-4" />
            {log.duration_minutes} min
          </div>
          {log.reviewed_at && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Reviewed
            </Badge>
          )}
        </div>
      </div>
      
      {log.assignment && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <Music className="h-4 w-4" />
          {log.assignment.title}
        </div>
      )}
      
      {log.notes && (
        <div className="bg-muted/50 rounded p-3 text-sm mb-3">
          <span className="font-medium">Student notes: </span>
          {log.notes}
        </div>
      )}
      
      {log.teacher_feedback ? (
        <div className="border-t pt-3">
          <div className="flex items-center gap-1 text-sm font-medium text-primary mb-1">
            <MessageSquare className="h-4 w-4" />
            Your Feedback
          </div>
          <p className="text-sm">{log.teacher_feedback}</p>
        </div>
      ) : showFeedbackInput ? (
        <div className="border-t pt-3 space-y-2">
          <Textarea
            placeholder="Add feedback for the student..."
            value={feedbackText[log.id] || ''}
            onChange={(e) => setFeedbackText(prev => ({ 
              ...prev, 
              [log.id]: e.target.value 
            }))}
            rows={2}
          />
          <Button 
            size="sm" 
            onClick={() => handleSubmitFeedback(log.id)}
            disabled={addFeedback.isPending}
            className="gap-1"
          >
            <Send className="h-4 w-4" />
            Send Feedback
          </Button>
        </div>
      ) : null}
    </div>
  );

  const loadMoreButton = hasNextPage && (
    <div className="text-center py-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => fetchNextPage()}
        disabled={isFetchingNextPage}
      >
        {isFetchingNextPage ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
        ) : (
          'Load More'
        )}
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Practice Review
          {pendingLogs.length > 0 && (
            <Badge variant="secondary">{pendingLogs.length} pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending" className="gap-2">
                Pending Review
                {pendingLogs.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5">
                    {pendingLogs.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All Logs</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="pending" className="mt-0">
            <ScrollArea className="h-[500px]">
              <div className="p-6 space-y-4">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : pendingLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                    <p className="text-muted-foreground">All practice logs reviewed!</p>
                  </div>
                ) : (
                  pendingLogs.map(log => renderLogCard(log, true))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="all" className="mt-0">
            <ScrollArea className="h-[500px]">
              <div className="p-6 space-y-4">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : allLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No practice logs yet
                  </p>
                ) : (
                  <>
                    {allLogs.map(log => renderLogCard(log, !log.reviewed_at))}
                    {loadMoreButton}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
