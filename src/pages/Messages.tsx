import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { MessageSquare, Plus, Bell } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';

export default function Messages() {
  const { isParent } = useRole();

  return (
    <AppLayout>
      <PageHeader
        title="Messages"
        description={isParent ? 'Communicate with your teacher' : 'Send messages to students and guardians'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Messages' },
        ]}
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Message
          </Button>
        }
      />

      <EmptyState
        icon={MessageSquare}
        title="No messages yet"
        description={
          isParent
            ? 'You haven\'t received any messages yet. Your teacher will contact you here with updates and reminders.'
            : 'Send your first message to a student or guardian. Use messages for lesson reminders, updates, and announcements.'
        }
        actionLabel="Compose Message"
        onAction={() => {}}
      >
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span>Tip: Set up automated reminders for upcoming lessons</span>
        </div>
      </EmptyState>
    </AppLayout>
  );
}
