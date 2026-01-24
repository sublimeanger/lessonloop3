import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Calendar, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useParentPracticeLogs, PracticeLog } from '@/hooks/usePractice';

export function PracticeHistory() {
  const { data: logs = [], isLoading } = useParentPracticeLogs();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading practice history...
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No practice sessions logged yet. Use the timer above to start practicing!
        </CardContent>
      </Card>
    );
  }

  // Group logs by date
  const groupedLogs = logs.reduce((acc, log) => {
    const date = log.practice_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {} as Record<string, PracticeLog[]>);

  const sortedDates = Object.keys(groupedLogs).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Practice History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                </h4>
                <div className="space-y-3">
                  {groupedLogs[date].map(log => (
                    <div 
                      key={log.id} 
                      className="border rounded-lg p-4 bg-card"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {log.student?.first_name} {log.student?.last_name}
                            </span>
                            {log.reviewed_at && (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Reviewed
                              </Badge>
                            )}
                          </div>
                          {log.assignment && (
                            <p className="text-sm text-muted-foreground">
                              {log.assignment.title}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-primary font-medium">
                          <Clock className="h-4 w-4" />
                          {log.duration_minutes} min
                        </div>
                      </div>
                      
                      {log.notes && (
                        <p className="mt-3 text-sm text-muted-foreground bg-muted/50 rounded p-2">
                          {log.notes}
                        </p>
                      )}
                      
                      {log.teacher_feedback && (
                        <div className="mt-3 border-t pt-3">
                          <div className="flex items-center gap-1 text-sm font-medium text-primary mb-1">
                            <MessageSquare className="h-4 w-4" />
                            Teacher Feedback
                          </div>
                          <p className="text-sm">{log.teacher_feedback}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
