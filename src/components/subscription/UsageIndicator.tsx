import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_NAMES } from '@/hooks/useFeatureGate';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface UsageIndicatorProps {
  currentStudents: number;
  currentTeachers: number;
  className?: string;
  showPlanName?: boolean;
}

/**
 * Shows current usage vs limits for students and teachers.
 * Designed for sidebar or settings page.
 */
export function UsageIndicator({ 
  currentStudents, 
  currentTeachers, 
  className,
  showPlanName = true 
}: UsageIndicatorProps) {
  const { plan, limits, canUpgrade, isTrialing, trialDaysRemaining } = useSubscription();

  const studentPercentage = Math.min(100, (currentStudents / limits.maxStudents) * 100);
  const teacherPercentage = Math.min(100, (currentTeachers / limits.maxTeachers) * 100);

  const isStudentNearLimit = studentPercentage >= 80;
  const isTeacherNearLimit = teacherPercentage >= 80;

  return (
    <div className={cn('space-y-4 rounded-lg border bg-card p-4', className)}>
      {showPlanName && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{PLAN_NAMES[plan]}</span>
          </div>
          {isTrialing && (
            <span className="text-xs text-muted-foreground">
              {trialDaysRemaining} days left
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {/* Students usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Students</span>
            <span className={cn(
              'font-medium',
              isStudentNearLimit ? 'text-warning' : 'text-foreground'
            )}>
              {currentStudents} / {limits.maxStudents}
            </span>
          </div>
          <Progress 
            value={studentPercentage} 
            className={cn(
              'h-1.5',
              isStudentNearLimit && '[&>div]:bg-warning'
            )}
          />
        </div>

        {/* Teachers usage (only show if limit > 1) */}
        {limits.maxTeachers > 1 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Teachers</span>
              <span className={cn(
                'font-medium',
                isTeacherNearLimit ? 'text-warning' : 'text-foreground'
              )}>
                {currentTeachers} / {limits.maxTeachers}
              </span>
            </div>
            <Progress 
              value={teacherPercentage} 
              className={cn(
                'h-1.5',
                isTeacherNearLimit && '[&>div]:bg-warning'
              )}
            />
          </div>
        )}
      </div>

      {canUpgrade && (isStudentNearLimit || isTeacherNearLimit) && (
        <Link 
          to="/settings?tab=billing" 
          className="block text-center text-xs font-medium text-primary hover:underline"
        >
          Upgrade for more capacity
        </Link>
      )}
    </div>
  );
}
