import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { usePracticeAssignments, usePracticeLogs, useWeeklyProgress, useAddPracticeFeedback } from '@/hooks/usePractice';
import { usePracticeStreak } from '@/hooks/usePracticeStreaks';
import { CreateAssignmentModal } from '@/components/practice/CreateAssignmentModal';
import { StreakDisplay } from '@/components/practice/StreakBadge';
import { Plus, Music, Target, Clock, CheckCircle, MessageSquare, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface StudentPracticePanelProps {
  studentId: string;
  studentName: string;
}

export function StudentPracticePanel({ studentId, studentName }: StudentPracticePanelProps) {
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedbackLogId, setFeedbackLogId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const { data: assignments = [], isLoading: loadingAssignments } = usePracticeAssignments(studentId);
  const { data: logs = [], isLoading: loadingLogs } = usePracticeLogs({ studentId, limit: 20 });
  const { data: weeklyProgress = [] } = useWeeklyProgress([studentId]);
  const { data: streak } = usePracticeStreak(studentId);
  const addFeedback = useAddPracticeFeedback();

  const progress = weeklyProgress[0];
  const activeAssignments = assignments.filter(a => a.status === 'active');
  const pendingReview = logs.filter(l => !l.reviewed_at);

  const handleSubmitFeedback = async () => {
    if (!feedbackLogId || !feedbackText.trim()) return;
    
    try {
      await addFeedback.mutateAsync({ logId: feedbackLogId, feedback: feedbackText.trim() });
      toast({ title: 'Feedback sent' });
      setFeedbackLogId(null);
      setFeedbackText('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  if (loadingAssignments || loadingLogs) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Streak Display */}
      {streak && streak.current_streak > 0 && (
        <Card>
          <CardContent className="pt-6">
            <StreakDisplay
              currentStreak={streak.current_streak}
              longestStreak={streak.longest_streak}
              lastPracticeDate={streak.last_practice_date}
            />
          </CardContent>
        </Card>
      )}

      {/* Weekly Progress */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              This Week's Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Practice time</span>
                <span className="font-medium">
                  {progress.actualMinutes} / {progress.targetMinutes} min
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-3">
                  <div 
                    className="bg-primary h-3 rounded-full transition-all"
                    style={{ width: `${progress.percentComplete}%` }}
                  />
                </div>
                <span className="text-sm font-bold w-12 text-right">
                  {progress.percentComplete}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Days practiced</span>
                <span className="font-medium">
                  {progress.daysLogged} / {progress.targetDays} days
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Practice Assignments
            </CardTitle>
            <CardDescription>Active assignments for this student</CardDescription>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New Assignment
          </Button>
        </CardHeader>
        <CardContent>
          {activeAssignments.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Music className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No active assignments</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an assignment to set practice goals for {studentName.split(' ')[0]}.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setShowCreateModal(true)}>
                Create Assignment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAssignments.map(assignment => (
                <div key={assignment.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{assignment.title}</span>
                      <Badge variant="outline" className="text-xs">Active</Badge>
                    </div>
                    {assignment.description && (
                      <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{assignment.target_minutes_per_day} min/day</p>
                    <p>{assignment.target_days_per_week} days/week</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Review */}
      {pendingReview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Pending Review
              <Badge variant="secondary">{pendingReview.length}</Badge>
            </CardTitle>
            <CardDescription>Practice sessions awaiting your feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingReview.map(log => (
                <div key={log.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{log.duration_minutes} min</span>
                      <span className="text-sm text-muted-foreground">
                        on {format(parseISO(log.practice_date), 'dd MMM yyyy')}
                      </span>
                    </div>
                    {log.assignment?.title && (
                      <Badge variant="outline" className="text-xs">{log.assignment.title}</Badge>
                    )}
                  </div>
                  {log.notes && (
                    <p className="text-sm text-muted-foreground bg-muted rounded p-2">{log.notes}</p>
                  )}
                  {feedbackLogId === log.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Write your feedback..."
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={handleSubmitFeedback}
                          disabled={addFeedback.isPending || !feedbackText.trim()}
                        >
                          {addFeedback.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Send Feedback
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => { setFeedbackLogId(null); setFeedbackText(''); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setFeedbackLogId(log.id)}
                    >
                      Add Feedback
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Practice Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Practice History
          </CardTitle>
          <CardDescription>Recent practice sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No practice logged yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Practice sessions will appear here once the student logs them.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {log.reviewed_at ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <span className="font-medium">{log.duration_minutes} min</span>
                      {log.assignment?.title && (
                        <span className="text-sm text-muted-foreground ml-2">• {log.assignment.title}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(log.practice_date), 'dd MMM')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateAssignmentModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        preselectedStudentId={studentId}
      />
    </div>
  );
}
