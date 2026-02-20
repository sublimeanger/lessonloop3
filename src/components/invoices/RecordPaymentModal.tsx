import { useState, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRecordPayment } from '@/hooks/useInvoices';
import { useOrg } from '@/contexts/OrgContext';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrencyMinor } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface RecordPaymentModalProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export function RecordPaymentModal({ invoice, open, onOpenChange }: RecordPaymentModalProps) {
  const { currentOrg } = useOrg();
  const recordPayment = useRecordPayment();
  const currency = currentOrg?.currency_code || 'GBP';

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [confirmOverpay, setConfirmOverpay] = useState(false);

  const totalPaid = invoice?.payments?.reduce((sum, p) => sum + p.amount_minor, 0) || 0;
  const outstandingAmount = invoice ? invoice.total_minor - totalPaid : 0;

  const amountMinor = useMemo(() => {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  }, [amount]);

  const currencySymbol = useMemo(() =>
    new Intl.NumberFormat('en', { style: 'currency', currency })
      .formatToParts(0).find(p => p.type === 'currency')?.value || '£',
    [currency]
  );

  const isOverpayment = amountMinor > outstandingAmount && outstandingAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (isOverpayment && !confirmOverpay) {
      setConfirmOverpay(true);
      return;
    }

    await recordPayment.mutateAsync({
      invoice_id: invoice.id,
      amount_minor: amountMinor,
      method,
      provider_reference: reference || undefined,
    });

    setAmount('');
    setReference('');
    setConfirmOverpay(false);
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {invoice && (
              <>
                Invoice {invoice.invoice_number} • Outstanding:{' '}
                {formatCurrencyMinor(outstandingAmount, currency)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setConfirmOverpay(false);
                }}
                className="pl-7"
                placeholder="0.00"
                required
              />
            </div>
            {totalPaid > 0 && (
              <p className="text-xs text-muted-foreground">
                Already paid: {formatCurrencyMinor(totalPaid, currency)}
              </p>
            )}
            {isOverpayment && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This payment of {formatCurrencyMinor(amountMinor, currency)} exceeds the remaining balance of {formatCurrencyMinor(outstandingAmount, currency)}.
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setAmount((outstandingAmount / 100).toFixed(2))}
            >
              Pay full amount ({formatCurrencyMinor(outstandingAmount, currency)})
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference (Optional)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction ID, check number, etc."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPayment.isPending || !amount}>
              {recordPayment.isPending
                ? 'Recording...'
                : confirmOverpay
                  ? 'Confirm Overpayment'
                  : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
