import { useActiveDisputes } from '@/hooks/useDisputes';
import { useOrg } from '@/contexts/OrgContext';
import { formatCurrencyMinor } from '@/lib/utils';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DisputeAlertBanner() {
  const { currentOrg } = useOrg();
  const { data: disputes } = useActiveDisputes();

  if (!disputes || disputes.length === 0) return null;

  const totalDisputed = disputes.reduce((sum, d) => sum + d.amount_minor, 0);
  const currency = currentOrg?.currency_code || 'GBP';

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-destructive">
            {disputes.length} active payment {disputes.length === 1 ? 'dispute' : 'disputes'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrencyMinor(totalDisputed, currency)} in disputed payments.
            Respond in your Stripe dashboard to avoid automatic resolution in the customer's favour.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <a
            href="https://dashboard.stripe.com/disputes"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Stripe
          </a>
        </Button>
      </div>
    </div>
  );
}
