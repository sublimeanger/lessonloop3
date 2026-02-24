import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useRefund } from '@/hooks/useRefund';
import { formatCurrencyMinor } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

const REFUND_REASONS = [
  { value: 'requested_by_customer', label: 'Customer request' },
  { value: 'lesson_cancelled', label: 'Lesson cancelled' },
  { value: 'duplicate', label: 'Duplicate payment' },
  { value: 'overcharged', label: 'Overcharged' },
  { value: 'other', label: 'Other' },
];

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
  paymentAmount: number;      // amount_minor of the original payment
  alreadyRefunded?: number;   // total already refunded in minor units
  method?: string;
  paidAt?: string;
  invoiceNumber?: string;
  currencyCode?: string;
}

export function RefundDialog({
  open,
  onOpenChange,
  paymentId,
  paymentAmount,
  alreadyRefunded = 0,
  method,
  paidAt,
  invoiceNumber,
  currencyCode = 'GBP',
}: RefundDialogProps) {
  const maxRefundable = paymentAmount - alreadyRefunded;
  const [step, setStep] = useState<'form' | 'confirm' | 'success' | 'error'>('form');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [customAmount, setCustomAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const { processRefund, isProcessing } = useRefund();
  const isDesktop = useMediaQuery('(min-width: 640px)');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep('form');
        setRefundType('full');
        setCustomAmount('');
        setReason('');
        setNotes('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const refundAmountMinor = refundType === 'full'
    ? maxRefundable
    : Math.round(parseFloat(customAmount || '0') * 100);

  const isValidAmount = refundAmountMinor > 0 && refundAmountMinor <= maxRefundable;

  const handleConfirm = useCallback(async () => {
    if (!paymentId || !isValidAmount) return;

    const reasonText = [
      REFUND_REASONS.find(r => r.value === reason)?.label || reason,
      notes,
    ].filter(Boolean).join(': ');

    const result = await processRefund(
      paymentId,
      refundType === 'partial' ? refundAmountMinor : undefined,
      reasonText || undefined,
    );

    if (result.success) {
      setStep('success');
      setTimeout(() => {
        onOpenChange(false);
      }, 2500);
    } else {
      setStep('error');
    }
  }, [paymentId, isValidAmount, reason, notes, processRefund, refundType, refundAmountMinor, onOpenChange]);

  const content = (
    <div className="space-y-5 px-1">
      <AnimatePresence mode="wait">
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Payment Summary */}
            <div className="rounded-xl bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {invoiceNumber || 'Payment'}
                </span>
                {method && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {method.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrencyMinor(paymentAmount, currencyCode)}
              </p>
              {paidAt && (
                <p className="text-xs text-muted-foreground">
                  Paid on {new Date(paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {alreadyRefunded > 0 && (
                <p className="text-xs text-amber-600">
                  Already refunded: {formatCurrencyMinor(alreadyRefunded, currencyCode)}
                </p>
              )}
            </div>

            {/* Refund Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Refund amount</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundType('full')}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    refundType === 'full'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-sm font-medium">Full refund</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrencyMinor(maxRefundable, currencyCode)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType('partial')}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    refundType === 'partial'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-sm font-medium">Partial refund</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Custom amount</div>
                </button>
              </div>
            </div>

            {/* Custom Amount Input */}
            {refundType === 'partial' && (
              <div className="space-y-2">
                <Label htmlFor="refund-amount" className="text-sm">
                  Amount (max {formatCurrencyMinor(maxRefundable, currencyCode)})
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {currencyCode === 'GBP' ? '£' : currencyCode === 'EUR' ? '€' : '$'}
                  </span>
                  <Input
                    id="refund-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(maxRefundable / 100).toFixed(2)}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                {customAmount && !isValidAmount && (
                  <p className="text-xs text-destructive">
                    {refundAmountMinor <= 0
                      ? 'Amount must be greater than zero'
                      : `Amount exceeds maximum refundable (${formatCurrencyMinor(maxRefundable, currencyCode)})`}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-sm">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details..."
                rows={2}
                className="resize-none"
              />
            </div>

            <Button
              onClick={() => setStep('confirm')}
              disabled={!isValidAmount || !reason}
              className="w-full"
            >
              Review Refund
            </Button>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Confirm refund</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will refund {formatCurrencyMinor(refundAmountMinor, currencyCode)} to the parent's payment method. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Refund amount</span>
                <span className="font-bold text-lg">{formatCurrencyMinor(refundAmountMinor, currencyCode)}</span>
              </div>
              {reason && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reason</span>
                  <span>{REFUND_REASONS.find(r => r.value === reason)?.label || reason}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('form')}
                className="flex-1"
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Process Refund
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30"
            >
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </motion.div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">Refund Processed</h3>
              <p className="text-sm text-muted-foreground">
                {formatCurrencyMinor(refundAmountMinor, currencyCode)} will be returned to the parent's payment method.
              </p>
            </div>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">Refund Failed</h3>
              <p className="text-sm text-muted-foreground">
                Something went wrong processing the refund. Please try again.
              </p>
            </div>
            <Button variant="outline" onClick={() => setStep('form')}>
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Process Refund
            </DialogTitle>
            <DialogDescription>
              Refund a payment back to the parent
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-4 pb-6">
        <DrawerHeader className="px-0">
          <DrawerTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Process Refund
          </DrawerTitle>
          <DrawerDescription>
            Refund a payment back to the parent
          </DrawerDescription>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
