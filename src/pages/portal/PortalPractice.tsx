import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PracticeTimer } from '@/components/portal/PracticeTimer';
import { PracticeHistory } from '@/components/portal/PracticeHistory';
import { WeeklyProgressCard } from '@/components/portal/WeeklyProgressCard';

export default function PortalPractice() {
  return (
    <PortalLayout>
      <PageHeader
        title="Practice"
        description="Track practice sessions and view progress"
      />
      
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PracticeTimer />
          <WeeklyProgressCard />
        </div>
        <div>
          <PracticeHistory />
        </div>
      </div>
    </PortalLayout>
  );
}
