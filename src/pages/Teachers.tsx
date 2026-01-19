import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { GraduationCap, Plus, UserPlus } from 'lucide-react';

export default function Teachers() {
  return (
    <AppLayout>
      <PageHeader
        title="Teachers"
        description="Manage your teaching staff"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Teachers' },
        ]}
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Teacher
          </Button>
        }
      />

      <EmptyState
        icon={GraduationCap}
        title="No teachers added"
        description="Add teachers to your organisation to manage their schedules and students."
        actionLabel="Add First Teacher"
        onAction={() => {}}
      >
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <UserPlus className="h-4 w-4" />
          <span>Tip: Teachers will receive an invitation email to join</span>
        </div>
      </EmptyState>
    </AppLayout>
  );
}
