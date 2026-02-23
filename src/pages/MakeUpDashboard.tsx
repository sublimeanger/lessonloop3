import { useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWaitlist, useWaitlistStats } from '@/hooks/useMakeUpWaitlist';
import { MakeUpStatsCards } from '@/components/makeups/MakeUpStatsCards';
import { NeedsActionSection } from '@/components/makeups/NeedsActionSection';
import { WaitlistTable } from '@/components/makeups/WaitlistTable';
import { AddToWaitlistDialog } from '@/components/makeups/AddToWaitlistDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';

const MakeUpDashboard = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [teacherFilter, setTeacherFilter] = useState<string | undefined>();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: stats, isLoading: statsLoading } = useWaitlistStats();
  const { entries: matchedEntries, isLoading: matchedLoading } = useWaitlist({ status: 'matched' });
  const { entries: allEntries, isLoading: allLoading, refetch } = useWaitlist({
    status: statusFilter,
    teacherId: teacherFilter,
  });

  return (
    <AppLayout>
      <PageHeader
        title="Make-Up Lessons"
        description="Manage waitlist, match open slots, and offer make-up lessons"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add to Waitlist
            </Button>
          </div>
        }
      />

      <div className="space-y-6">

      {/* Summary cards */}
      <MakeUpStatsCards stats={stats} isLoading={statsLoading} />

      {/* Needs Action (matched entries) */}
      {(matchedEntries?.length ?? 0) > 0 && (
        <NeedsActionSection entries={matchedEntries ?? []} isLoading={matchedLoading} />
      )}

      {/* Full waitlist table */}
      <WaitlistTable
        entries={allEntries ?? []}
        isLoading={allLoading}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        teacherFilter={teacherFilter}
        onTeacherFilterChange={setTeacherFilter}
      />

        <AddToWaitlistDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      </div>
    </AppLayout>
  );
};

export default MakeUpDashboard;
