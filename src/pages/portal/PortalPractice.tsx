import { usePageMeta } from '@/hooks/usePageMeta';
import { useMemo } from 'react';
import { PortalErrorState } from '@/components/portal/PortalErrorState';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PracticeTimer } from '@/components/portal/PracticeTimer';
import { PracticeHistory } from '@/components/portal/PracticeHistory';
import { WeeklyProgressCard } from '@/components/portal/WeeklyProgressCard';
import { PracticeTrendsChart } from '@/components/practice/PracticeTrendsChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChildrenStreaks, PracticeStreak } from '@/hooks/usePracticeStreaks';
import { useParentPracticeAssignments } from '@/hooks/usePractice';
import { StreakDisplay } from '@/components/practice/StreakBadge';
import { Flame } from 'lucide-react';
import { useChildFilter } from '@/contexts/ChildFilterContext';
import { usePortalFeatures } from '@/hooks/usePortalFeatures';
import { PortalFeatureDisabled } from '@/components/portal/PortalFeatureDisabled';

export default function PortalPractice() {
  usePageMeta('Practice | Parent Portal', 'Track practice progress');
  const { practiceEnabled } = usePortalFeatures();
  const { selectedChildId } = useChildFilter();
  const { data: streaks = [], isError: streaksError, refetch: refetchStreaks } = useChildrenStreaks();
  const { data: assignments = [], isError: assignmentsError, refetch: refetchAssignments } = useParentPracticeAssignments();
  
  // Filter by selected child
  const filteredAssignments = useMemo(
    () => selectedChildId ? assignments.filter(a => a.student_id === selectedChildId) : assignments,
    [assignments, selectedChildId]
  );
  const studentIds = [...new Set(filteredAssignments.map(a => a.student_id))];

  const activeStreaks = useMemo(() => {
    const filtered = selectedChildId
      ? streaks.filter((s: PracticeStreak & { students?: { id: string } }) => s.students?.id === selectedChildId)
      : streaks;
    return filtered.filter(s => s.current_streak > 0 || s.longest_streak > 0);
  }, [streaks, selectedChildId]);
  if (!practiceEnabled) {
    return (
      <PortalLayout>
        <PortalFeatureDisabled featureLabel="Practice Tracking" />
      </PortalLayout>
    );
  }

  const practiceError = streaksError || assignmentsError;

  if (practiceError) {
    return (
      <PortalLayout>
        <PortalErrorState onRetry={() => { refetchStreaks(); refetchAssignments(); }} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <PageHeader
        title="Practice"
        description="Track practice sessions and view progress"
      />
      
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PracticeTimer />
          
          {/* Streak Display for each child */}
          {activeStreaks.length > 0 && (
            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Practice Streaks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeStreaks.map((streak: PracticeStreak & { students?: { id: string; first_name: string; last_name: string } }) => (
                  <div key={streak.id} className="border-b last:border-0 pb-4 last:pb-0">
                    {streak.students && (
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {streak.students.first_name} {streak.students.last_name}
                      </p>
                    )}
                    <StreakDisplay
                      currentStreak={streak.current_streak}
                      longestStreak={streak.longest_streak}
                      lastPracticeDate={streak.last_practice_date}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          <WeeklyProgressCard />
          
          {/* Practice Trends per child */}
          {studentIds.map(sid => (
            <PracticeTrendsChart key={sid} studentId={sid} />
          ))}
        </div>
        <div>
          <PracticeHistory />
        </div>
      </div>
    </PortalLayout>
  );
}
