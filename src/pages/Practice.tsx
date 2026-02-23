import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeacherPracticeReview } from '@/components/practice/TeacherPracticeReview';
import { CreateAssignmentModal } from '@/components/practice/CreateAssignmentModal';
import { usePracticeAssignments, usePracticeLogs, useWeeklyProgress } from '@/hooks/usePractice';
import { Plus, Music, Target, Users, TrendingUp, Circle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Practice() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const { data: assignments = [], isLoading: loadingAssignments } = usePracticeAssignments();
  const { data: recentLogsData } = usePracticeLogs({ limit: 10 });
  const recentLogs = useMemo(() => recentLogsData?.pages.flatMap(p => p.data) ?? [], [recentLogsData]);
  
  // Get unique student IDs from assignments
  const studentIds = [...new Set(assignments.map(a => a.student_id))];
  const { data: weeklyProgress = [] } = useWeeklyProgress(studentIds);

  // Stats
  const activeAssignments = assignments.filter(a => a.status === 'active').length;
  const unreviewedLogs = recentLogs.filter(l => !l.reviewed_at).length;
  const studentsWithProgress = weeklyProgress.filter(p => p.percentComplete > 0).length;

  return (
    <AppLayout>
      <PageHeader
        title="Practice"
        description="Manage practice assignments and review student progress"
        actions={
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Assignment
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Music className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAssignments}</p>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Target className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreviewedLogs}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{studentsWithProgress}</p>
                <p className="text-sm text-muted-foreground">Students Practicing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {weeklyProgress.length > 0 
                    ? Math.round(weeklyProgress.reduce((sum, p) => sum + p.percentComplete, 0) / weeklyProgress.length)
                    : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Avg. Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Practice Status */}
      {weeklyProgress.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Student Practice Status
              <span className="text-xs font-normal text-muted-foreground ml-auto">This week</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const onTrack = weeklyProgress.filter(p => p.percentComplete >= 70);
              const falling = weeklyProgress.filter(p => p.percentComplete > 0 && p.percentComplete < 70);
              const notStarted = weeklyProgress.filter(p => p.percentComplete === 0);

              const StatusChip = ({ name, percent, color }: { name: string; percent?: number; color: string }) => (
                <div className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                )}>
                  <Circle className={cn("h-2.5 w-2.5 fill-current", color)} />
                  <span className="font-medium truncate">{name}</span>
                  {percent !== undefined && percent > 0 && percent < 100 && (
                    <span className="text-xs text-muted-foreground ml-auto">{percent}%</span>
                  )}
                </div>
              );

              return (
                <div className="space-y-4">
                  {onTrack.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">On track ({onTrack.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {onTrack.map(p => (
                          <StatusChip key={p.studentId} name={p.studentName} color="text-success" />
                        ))}
                      </div>
                    </div>
                  )}
                  {falling.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Falling behind ({falling.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {falling.map(p => (
                          <StatusChip key={p.studentId} name={p.studentName} percent={p.percentComplete} color="text-warning" />
                        ))}
                      </div>
                    </div>
                  )}
                  {notStarted.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Not started ({notStarted.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {notStarted.map(p => (
                          <StatusChip key={p.studentId} name={p.studentName} color="text-destructive" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Review Panel */}
        <TeacherPracticeReview />

        {/* Assignments & Progress */}
        <div className="space-y-6">
          {/* Weekly Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Weekly Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyProgress.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No active assignments this week
                </p>
              ) : (
                <div className="space-y-4">
                  {weeklyProgress.map(progress => (
                    <div key={progress.studentId} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{progress.studentName}</span>
                        <span className="text-muted-foreground">
                          {progress.actualMinutes} / {progress.targetMinutes} min
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${progress.percentComplete}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">
                          {progress.percentComplete}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Active Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAssignments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : assignments.filter(a => a.status === 'active').length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12">
                  <Music className="h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">No practice logged</h3>
                  <p className="mt-2 max-w-sm mx-auto text-sm text-muted-foreground">Students can log practice from their portal</p>
                  <Button 
                    className="mt-6"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create Assignment
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments
                    .filter(a => a.status === 'active')
                    .slice(0, 5)
                    .map(assignment => (
                      <div 
                        key={assignment.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.student?.first_name} {assignment.student?.last_name}
                          </p>
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
        </div>
      </div>

      <CreateAssignmentModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </AppLayout>
  );
}
