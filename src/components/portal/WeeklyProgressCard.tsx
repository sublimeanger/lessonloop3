import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Target, Calendar } from 'lucide-react';
import { useParentPracticeAssignments, useWeeklyProgress } from '@/hooks/usePractice';
import { useChildrenStreaks } from '@/hooks/usePracticeStreaks';
import { StreakBadge } from '@/components/practice/StreakBadge';
import { useChildFilter } from '@/contexts/ChildFilterContext';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

function ProgressRing({ actual, target }: { actual: number; target: number }) {
  const pct = Math.min(actual / target, 1);
  const remaining = Math.max(1 - pct, 0);
  const data = [
    { value: pct },
    { value: remaining },
  ];

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={38}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill="hsl(var(--primary))" />
            <Cell fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold">{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

export function WeeklyProgressCard() {
  const { selectedChildId } = useChildFilter();
  const { data: allAssignments = [] } = useParentPracticeAssignments();
  const assignments = useMemo(
    () => selectedChildId ? allAssignments.filter(a => a.student_id === selectedChildId) : allAssignments,
    [allAssignments, selectedChildId]
  );
  const studentIds = [...new Set(assignments.map(a => a.student_id))];
  
  const { data: progress = [], isLoading } = useWeeklyProgress(studentIds);
  const { data: streaks = [] } = useChildrenStreaks();

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
          const metGoal = student.percentComplete >= 100;
          return (
            <div key={student.studentId} className="space-y-3">
              <div className="flex items-center gap-4">
                <ProgressRing actual={student.actualMinutes} target={student.targetMinutes || 60} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{student.studentName}</span>
                    {streak && streak.current_streak > 0 && (
                      <StreakBadge 
                        currentStreak={streak.current_streak} 
                        longestStreak={streak.longest_streak}
                        size="sm" 
                      />
                    )}
                  </div>
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
              </div>

              {metGoal && (
                <div className="bg-primary/10 text-primary rounded-lg px-3 py-2 text-sm font-medium text-center">
                  🎉 {student.studentName} hit their practice goal this week! Keep it up!
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
