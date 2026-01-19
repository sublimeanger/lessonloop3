import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { BarChart3, TrendingUp } from 'lucide-react';

export default function Reports() {
  return (
    <AppLayout>
      <PageHeader
        title="Reports"
        description="Analytics and insights for your teaching business"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports' },
        ]}
      />

      <EmptyState
        icon={BarChart3}
        title="Reports coming soon"
        description="Once you start teaching and billing, you'll see detailed reports on revenue, lesson hours, and student progress here."
      >
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Track revenue, outstanding payments, and utilisation</span>
        </div>
      </EmptyState>
    </AppLayout>
  );
}
