import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { Receipt, Plus, CreditCard } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';

export default function Invoices() {
  const { isParent } = useRole();

  return (
    <AppLayout>
      <PageHeader
        title={isParent ? 'Invoices & Payments' : 'Invoices'}
        description={isParent ? 'View and pay your invoices' : 'Create and manage invoices'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: isParent ? 'Invoices & Payments' : 'Invoices' },
        ]}
        actions={
          !isParent && (
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          )
        }
      />

      <EmptyState
        icon={Receipt}
        title={isParent ? 'No invoices yet' : 'No invoices created'}
        description={
          isParent
            ? 'You don\'t have any invoices yet. They will appear here when your teacher creates them.'
            : 'Create your first invoice to start billing students. Invoices can be generated automatically from lessons.'
        }
        actionLabel={!isParent ? 'Create First Invoice' : undefined}
        onAction={!isParent ? () => {} : undefined}
      >
        {!isParent && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span>Tip: Set up payment integration to accept online payments</span>
          </div>
        )}
      </EmptyState>
    </AppLayout>
  );
}
