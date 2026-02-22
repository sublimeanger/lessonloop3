import { Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useOrg } from '@/contexts/OrgContext';

interface PortalFeatureDisabledProps {
  featureLabel: string;
}

/**
 * Shown to parents when they navigate to a portal page whose
 * feature is not included in the academy's current plan.
 * Deliberately hides pricing / plan details from parents.
 */
export function PortalFeatureDisabled({ featureLabel }: PortalFeatureDisabledProps) {
  const { currentOrg } = useOrg();
  const orgName = currentOrg?.name || 'your academy';

  return (
    <Card className="mx-auto max-w-md mt-12">
      <CardContent className="flex flex-col items-center text-center py-10 px-6">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Info className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{featureLabel} isn't available</h3>
        <p className="text-sm text-muted-foreground">
          This feature isn't enabled on {orgName}'s current plan.
          Contact {orgName} for more information.
        </p>
      </CardContent>
    </Card>
  );
}
