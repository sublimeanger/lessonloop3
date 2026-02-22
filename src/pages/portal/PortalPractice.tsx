import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PracticeTimer } from '@/components/portal/PracticeTimer';
import { PracticeHistory } from '@/components/portal/PracticeHistory';
import { WeeklyProgressCard } from '@/components/portal/WeeklyProgressCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChildrenStreaks, PracticeStreak } from '@/hooks/usePracticeStreaks';
import { StreakDisplay } from '@/components/practice/StreakBadge';
import { Flame } from 'lucide-react';

export default function PortalPractice() {
  const { data: streaks = [] } = useChildrenStreaks();
  
  // Filter to streaks with activity
  const activeStreaks = streaks.filter(s => s.current_streak > 0 || s.longest_streak > 0);

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
            <Card>
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
        </div>
        <div>
          <PracticeHistory />
        </div>
      </div>
    </PortalLayout>
  );
}
