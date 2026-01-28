import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Music, Clock, Flame, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useParentPracticeAssignments, useWeeklyProgress } from '@/hooks/usePractice';
import { useChildrenStreaks } from '@/hooks/usePracticeStreaks';
import { StreakBadge } from '@/components/practice/StreakBadge';
import { Skeleton } from '@/components/ui/skeleton';

export function ThisWeekFocus() {
  const { data: assignments = [], isLoading: assignmentsLoading } = useParentPracticeAssignments();
  const studentIds = [...new Set(assignments.map(a => a.student_id))];
  const { data: progress = [], isLoading: progressLoading } = useWeeklyProgress(studentIds);
  const { data: streaks = [] } = useChildrenStreaks();

  const isLoading = assignmentsLoading || progressLoading;

  // Create a map of student streaks
  const streakMap = new Map(streaks.map(s => [s.student_id, s]));

  // Get active assignments grouped by student
  const assignmentsByStudent = assignments.reduce((acc, assignment) => {
    const studentId = assignment.student_id;
    if (!acc[studentId]) {
      acc[studentId] = {
        studentName: assignment.student 
          ? `${assignment.student.first_name} ${assignment.student.last_name}`
          : 'Unknown',
        assignments: [],
      };
    }
    acc[studentId].assignments.push(assignment);
    return acc;
  }, {} as Record<string, { studentName: string; assignments: typeof assignments }>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-primary" />
            This Week's Focus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (studentIds.length === 0) {
    return null; // No active assignments, don't show the card
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-primary" />
            This Week's Focus
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/portal/practice" className="text-sm">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(assignmentsByStudent).map(([studentId, { studentName, assignments: studentAssignments }]) => {
          const studentProgress = progress.find(p => p.studentId === studentId);
          const streak = streakMap.get(studentId);
          
          return (
            <div key={studentId} className="space-y-3">
              {/* Student Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{studentName}</span>
                  {streak && streak.current_streak > 0 && (
                    <StreakBadge 
                      currentStreak={streak.current_streak} 
                      longestStreak={streak.longest_streak}
                      size="sm" 
                    />
                  )}
                </div>
                {studentProgress && (
                  <Badge variant={studentProgress.percentComplete >= 100 ? 'default' : 'secondary'}>
                    {studentProgress.percentComplete}%
                  </Badge>
                )}
              </div>

              {/* Progress Bar */}
              {studentProgress && (
                <div className="space-y-1">
                  <Progress value={studentProgress.percentComplete} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{studentProgress.actualMinutes} / {studentProgress.targetMinutes} min</span>
                    <span>{studentProgress.daysLogged} / {studentProgress.targetDays} days</span>
                  </div>
                </div>
              )}

              {/* Active Assignments */}
              <div className="space-y-2">
                {studentAssignments.slice(0, 2).map(assignment => (
                  <div 
                    key={assignment.id} 
                    className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <Music className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{assignment.title}</p>
                      {assignment.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {assignment.description}
                        </p>
                      )}
                      {(assignment.target_minutes_per_day || assignment.target_days_per_week) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {assignment.target_minutes_per_day && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {assignment.target_minutes_per_day} min/day
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {studentAssignments.length > 2 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{studentAssignments.length - 2} more assignments
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Quick Link to Practice */}
        <Button variant="outline" className="w-full" asChild>
          <Link to="/portal/practice" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Log Practice Session
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
