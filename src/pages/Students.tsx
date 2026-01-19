import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { Users, Plus, UserPlus } from 'lucide-react';

export default function Students() {
  return (
    <AppLayout>
      <PageHeader
        title="Students"
        description="Manage your students and their information"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Students' },
        ]}
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        }
      />

      <EmptyState
        icon={Users}
        title="No students yet"
        description="Add your first student to start scheduling lessons and tracking their progress."
        actionLabel="Add Your First Student"
        onAction={() => {}}
      >
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <UserPlus className="h-4 w-4" />
          <span>Tip: You can also import students from a spreadsheet</span>
        </div>
      </EmptyState>
    </AppLayout>
  );
}
