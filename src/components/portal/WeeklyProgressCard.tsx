import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Calendar } from 'lucide-react';
import { useParentPracticeAssignments, useWeeklyProgress } from '@/hooks/usePractice';
import { useChildrenStreaks } from '@/hooks/usePracticeStreaks';
import { StreakBadge } from '@/components/practice/StreakBadge';

export function WeeklyProgressCard() {
  const { data: assignments = [] } = useParentPracticeAssignments();
  const studentIds = [...new Set(assignments.map(a => a.student_id))];
  
  const { data: progress = [], isLoading } = useWeeklyProgress(studentIds);
  const { data: streaks = [] } = useChildrenStreaks();

  // Create a map of student streaks
  const streakMap = new Map(streaks.map(s => [s.student_id, s]));

  if (isLoading || studentIds.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          This Week's Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {progress.map(student => {
          const streak = streakMap.get(student.studentId);
          return (
          <div key={student.studentId} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{student.studentName}</span>
                {streak && streak.current_streak > 0 && (
                  <StreakBadge 
                    currentStreak={streak.current_streak} 
                    longestStreak={streak.longest_streak}
                    size="sm" 
                  />
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {student.percentComplete}% complete
              </span>
            </div>
            
            <Progress value={student.percentComplete} className="h-3" />
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {student.actualMinutes} / {student.targetMinutes} min
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {student.daysLogged} / {student.targetDays} days
              </div>
            </div>
          </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
