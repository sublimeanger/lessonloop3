import { useState, useMemo, useRef, useEffect } from 'react';
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

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface RecordPaymentModalProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the amount field (major units, e.g. 50.00 for £50).
      If omitted, defaults to the invoice outstanding balance. */
  defaultAmount?: number;
  /** Pre-fill the payment method. If omitted, defaults to 'card'. */
  defaultMethod?: PaymentMethod;
  /** Pre-fill the installment_id if recording against a specific
      installment. */
  installmentId?: string;
  /** Override the default modal title. */
  title?: string;
  /** Override the default submit button label. */
  submitLabel?: string;
  /** Optional callback fired after successful payment record. */
  onSuccess?: (paymentId: string) => void;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export function RecordPaymentModal({
  invoice,
  open,
  onOpenChange,
  defaultAmount,
  defaultMethod,
  installmentId,
  title,
  submitLabel,
  onSuccess,
}: RecordPaymentModalProps) {
  const { currentOrg } = useOrg();
  const recordPayment = useRecordPayment();
  const currency = currentOrg?.currency_code || 'GBP';

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod ?? 'bank_transfer');
  const [reference, setReference] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);

  const totalPaid = invoice?.payments?.reduce((sum, p) => sum + p.amount_minor, 0) || 0;
  const outstandingAmount = invoice ? Math.max(0, invoice.total_minor - totalPaid) : 0;

  // Pre-fill amount and method when the modal opens. Only prefill the
  // amount when an explicit defaultAmount is passed — otherwise leave
  // empty so the user clicks "Pay full amount" to commit to the full
  // outstanding balance (avoids a partial-payment accidentally becoming
  // a full-balance payment).
  useEffect(() => {
    if (!open) return;
    if (defaultAmount !== undefined) {
      setAmount(defaultAmount.toFixed(2));
    } else {
      setAmount('');
    }
    setMethod(defaultMethod ?? 'bank_transfer');
    setReference('');
  }, [open, defaultAmount, defaultMethod, invoice?.id]);

  const amountMinor = useMemo(() => {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  }, [amount]);

  const currencySymbol = useMemo(() =>
    new Intl.NumberFormat('en', { style: 'currency', currency })
      .formatToParts(0).find(p => p.type === 'currency')?.value || '£',
    [currency]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    try {
      const { result } = await recordPayment.mutateAsync({
        invoice_id: invoice.id,
        amount_minor: amountMinor,
        method,
        provider_reference: reference || undefined,
        installment_id: installmentId,
      });

      setAmount('');
      setReference('');
      onSuccess?.(result.payment_id);
      onOpenChange(false);
    } catch (err: unknown) {
      // Server hard-rejects overpayment; refocus the amount field so the
      // user can correct without reopening the modal. Toast is surfaced by
      // the mutation's onError.
      const message = err instanceof Error ? err.message : String(err);
      if (/exceed/i.test(message)) {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-w-md sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle>{title ?? 'Record Payment'}</DialogTitle>
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
                ref={amountInputRef}
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" type="submit" disabled={recordPayment.isPending || !amount}>
              {recordPayment.isPending ? 'Recording...' : (submitLabel ?? 'Record Payment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
