import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { MapPin, Plus, Building } from 'lucide-react';

export default function Locations() {
  return (
    <AppLayout>
      <PageHeader
        title="Locations"
        description="Manage your teaching venues and rooms"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Locations' },
        ]}
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        }
      />

      <EmptyState
        icon={MapPin}
        title="No locations set up"
        description="Add your teaching locations to organise lessons by venue and manage room availability."
        actionLabel="Add First Location"
        onAction={() => {}}
      >
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Building className="h-4 w-4" />
          <span>Tip: You can add multiple rooms within each location</span>
        </div>
      </EmptyState>
    </AppLayout>
  );
}
