import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PortalSummaryStrip } from '@/components/portal/PortalSummaryStrip';
import { ChildCard } from '@/components/portal/ChildCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useParentSummary, useChildrenWithDetails } from '@/hooks/useParentPortal';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { RequestModal } from '@/components/portal/RequestModal';

export default function PortalHome() {
  const { profile } = useAuth();
  const { currentOrg } = useOrg();
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useParentSummary();
  const { data: children, isLoading: childrenLoading } = useChildrenWithDetails();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <PortalLayout>
      <PageHeader
        title={`${getGreeting()}, ${firstName}!`}
        description="View your children's lessons and manage payments"
        actions={
          <Button onClick={() => setRequestModalOpen(true)} variant="outline" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Send Message
          </Button>
        }
      />

      {/* Summary Strip */}
      <PortalSummaryStrip
        data={summary}
        isLoading={summaryLoading}
        currencyCode={currentOrg?.currency_code || 'GBP'}
      />

      {/* Children Cards */}
      <h2 className="text-lg font-semibold mb-4">Your Children</h2>
      {childrenLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !children || children.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">No students linked to your account yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please contact the school or teacher if you believe this is an error.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              currencyCode={currentOrg?.currency_code || 'GBP'}
            />
          ))}
        </div>
      )}

      <RequestModal open={requestModalOpen} onOpenChange={setRequestModalOpen} />
    </PortalLayout>
  );
}
