import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { Calendar, Plus } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';

export default function CalendarPage() {
  const { isParent } = useRole();

  return (
    <AppLayout>
      <PageHeader
        title={isParent ? 'Schedule' : 'Calendar'}
        description={isParent ? 'View upcoming lessons' : 'Manage your teaching schedule'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: isParent ? 'Schedule' : 'Calendar' },
        ]}
        actions={
          !isParent && (
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Lesson
            </Button>
          )
        }
      />

      <EmptyState
        icon={Calendar}
        title="No lessons scheduled"
        description={
          isParent
            ? 'You don\'t have any upcoming lessons. Contact your teacher to book a session.'
            : 'Start by scheduling your first lesson. Click the button above to add a new lesson to your calendar.'
        }
        actionLabel={!isParent ? 'Schedule First Lesson' : undefined}
        onAction={!isParent ? () => {} : undefined}
      />
    </AppLayout>
  );
}
