import { useMakeUpCredits } from '@/hooks/useMakeUpCredits';
import { useOrg } from '@/contexts/OrgContext';
import { Badge } from '@/components/ui/badge';
import { Gift } from 'lucide-react';

interface CreditBalanceBadgeProps {
  studentId: string;
  showIcon?: boolean;
}

export function CreditBalanceBadge({ studentId, showIcon = true }: CreditBalanceBadgeProps) {
  const { currentOrg } = useOrg();
  const { totalAvailableValue, isLoading } = useMakeUpCredits(studentId);

  if (isLoading || totalAvailableValue === 0) {
    return null;
  }

  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currentOrg?.currency_code || 'GBP',
  }).format(totalAvailableValue / 100);

  return (
    <Badge variant="secondary" className="gap-1">
      {showIcon && <Gift className="h-3 w-3" />}
      {formatted} credit
    </Badge>
  );
}
