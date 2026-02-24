import { useState } from 'react';
import { useIssueRefund, useRefunds } from '@/hooks/useRefunds';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyMinor } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertTriangle } from 'lucide-react';

interface RefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    amount_minor: number;
    invoice_id: string;
    provider: string;
  };
}

export function RefundModal({ open, onOpenChange, payment }: RefundModalProps) {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const issueRefund = useIssueRefund();
  const { data: existingRefunds } = useRefunds(payment.invoice_id);

  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const currency = currentOrg?.currency_code || 'GBP';

  // Calculate max refundable
  const totalRefunded = existingRefunds
    ?.filter((r) => r.payment_id === payment.id && ['pending', 'succeeded'].includes(r.status))
    .reduce((sum, r) => sum + r.amount_minor, 0) || 0;
  const maxRefundable = payment.amount_minor - totalRefunded;

  // Parse partial amount (convert major to minor)
  const partialMinor = Math.round(parseFloat(partialAmount || '0') * 100);
  const refundAmount = refundType === 'full' ? maxRefundable : partialMinor;

  const isValidAmount = refundAmount > 0 && refundAmount <= maxRefundable;

  const handleSubmit = async () => {
    if (!isValidAmount) return;

    try {
      const result = await issueRefund.mutateAsync({
        paymentId: payment.id,
        amountMinor: refundType === 'partial' ? partialMinor : undefined,
        reason: reason || undefined,
      });

      toast({
        title: 'Refund issued',
        description: `${formatCurrencyMinor(result.amountMinor, currency)} refund ${result.status === 'succeeded' ? 'processed' : 'is being processed'}.`,
      });

      // Reset and close
      setStep('form');
      setRefundType('full');
      setPartialAmount('');
      setReason('');
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refund failed';
      toast({ title: 'Refund failed', description: message, variant: 'destructive' });
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep('form');
      setRefundType('full');
      setPartialAmount('');
      setReason('');
    }
    onOpenChange(open);
  };

  if (maxRefundable <= 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>This payment has already been fully refunded.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
          <DialogDescription>
            Refund against payment of {formatCurrencyMinor(payment.amount_minor, currency)}.
            {totalRefunded > 0 && ` Already refunded: ${formatCurrencyMinor(totalRefunded, currency)}.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-4">
            <RadioGroup value={refundType} onValueChange={(v) => setRefundType(v as 'full' | 'partial')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full">
                  Full refund ({formatCurrencyMinor(maxRefundable, currency)})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial">Partial refund</Label>
              </div>
            </RadioGroup>

            {refundType === 'partial' && (
              <div>
                <Label htmlFor="amount">Amount</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {currency === 'GBP' ? '£' : '$'}
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(maxRefundable / 100).toFixed(2)}
                    className="pl-7"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {partialMinor > maxRefundable && (
                  <p className="text-xs text-destructive mt-1">
                    Cannot exceed {formatCurrencyMinor(maxRefundable, currency)}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Lesson cancelled, overpayment"
                className="mt-1"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                disabled={!isValidAmount}
                onClick={() => setStep('confirm')}
              >
                Review Refund
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Confirm refund of {formatCurrencyMinor(refundAmount, currency)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will reverse the payment and transfer back to the customer. This action cannot be undone.
                  </p>
                  {reason && (
                    <p className="text-sm mt-2">Reason: {reason}</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('form')}>Back</Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={issueRefund.isPending}
              >
                {issueRefund.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Refund'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
