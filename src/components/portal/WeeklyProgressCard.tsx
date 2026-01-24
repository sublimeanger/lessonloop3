import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Calendar } from 'lucide-react';
import { useParentPracticeAssignments, useWeeklyProgress } from '@/hooks/usePractice';
import { useOrg } from '@/contexts/OrgContext';

export function WeeklyProgressCard() {
  const { data: assignments = [] } = useParentPracticeAssignments();
  const studentIds = [...new Set(assignments.map(a => a.student_id))];
  
  // Get org from one of the assignments
  const orgId = assignments[0]?.org_id;
  
  const { data: progress = [], isLoading } = useWeeklyProgress(studentIds);

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
        {progress.map(student => (
          <div key={student.studentId} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{student.studentName}</span>
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
        ))}
      </CardContent>
    </Card>
  );
}
