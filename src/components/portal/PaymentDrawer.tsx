import { useState, useEffect, useCallback } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
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
import { CreditCard, Loader2, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { useEmbeddedPayment } from '@/hooks/useEmbeddedPayment';
import { getStripePromise } from '@/hooks/useStripeElements';
import { formatCurrencyMinor } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useMediaQuery } from '@/hooks/use-media-query';

interface PaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  invoiceNumber?: string;
  amount?: number;
  currencyCode?: string;
  dueDate?: string;
  installmentId?: string;
  payRemaining?: boolean;
  installmentLabel?: string;
}

export function PaymentDrawer({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  amount,
  currencyCode = 'GBP',
  dueDate,
  installmentId,
  payRemaining,
  installmentLabel,
}: PaymentDrawerProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(amount || 0);
  const [paymentCurrency, setPaymentCurrency] = useState(currencyCode);
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading' | 'ready' | 'processing' | 'success' | 'error'>('idle');
  const { createPaymentIntent } = useEmbeddedPayment();
  const isDesktop = useMediaQuery('(min-width: 640px)');

  // Create payment intent when drawer opens
  useEffect(() => {
    if (open && invoiceId && !clientSecret) {
      setPaymentStatus('loading');
      createPaymentIntent(invoiceId, { installmentId, payRemaining }).then((result) => {
        if (result) {
          setClientSecret(result.clientSecret);
          setPaymentAmount(result.amount);
          setPaymentCurrency(result.currency);
          setPaymentDescription(result.description);
          setPaymentStatus('ready');
        } else {
          setPaymentStatus('error');
        }
      });
    }
  }, [open, invoiceId, installmentId, payRemaining, clientSecret, createPaymentIntent]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow close animation
      const timer = setTimeout(() => {
        setClientSecret(null);
        setPaymentStatus('idle');
        setPaymentAmount(amount || 0);
        setPaymentDescription('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, amount]);

  const handleSuccess = useCallback(() => {
    setPaymentStatus('success');
    // Auto-close after success animation
    setTimeout(() => {
      onOpenChange(false);
    }, 2500);
  }, [onOpenChange]);

  const handleError = useCallback(() => {
    setPaymentStatus('error');
  }, []);

  const content = (
    <div className="space-y-5 px-1">
      {/* Invoice Summary */}
      <div className="rounded-xl bg-muted/50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {installmentLabel || invoiceNumber || 'Invoice'}
          </span>
          {dueDate && (
            <span className="text-xs text-muted-foreground">Due: {dueDate}</span>
          )}
        </div>
        <p className="text-3xl font-bold tracking-tight">
          {formatCurrencyMinor(paymentAmount, paymentCurrency.toUpperCase())}
        </p>
        {paymentDescription && (
          <p className="text-xs text-muted-foreground">{paymentDescription}</p>
        )}
      </div>

      {/* Payment Element */}
      <AnimatePresence mode="wait">
        {paymentStatus === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12 gap-3"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Setting up secure payment...</p>
          </motion.div>
        )}

        {paymentStatus === 'ready' && clientSecret && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Elements
              stripe={getStripePromise()}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                    borderRadius: '8px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  },
                },
              }}
            >
              <PaymentForm
                amount={paymentAmount}
                currency={paymentCurrency}
                onSuccess={handleSuccess}
                onError={handleError}
                onProcessing={() => setPaymentStatus('processing')}
              />
            </Elements>
          </motion.div>
        )}

        {paymentStatus === 'success' && (
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
              <h3 className="text-lg font-semibold">Payment Successful</h3>
              <p className="text-sm text-muted-foreground">
                {formatCurrencyMinor(paymentAmount, paymentCurrency.toUpperCase())} paid. Your invoice will update shortly.
              </p>
            </div>
          </motion.div>
        )}

        {paymentStatus === 'error' && !clientSecret && (
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
              <h3 className="text-lg font-semibold">Payment Setup Failed</h3>
              <p className="text-sm text-muted-foreground">
                Something went wrong. Please try again or contact your teacher.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust Badge */}
      {paymentStatus !== 'success' && paymentStatus !== 'error' && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secured by Stripe. Your card details are never stored on our servers.</span>
        </div>
      )}
    </div>
  );

  // Use Dialog on desktop, Drawer on mobile
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pay Invoice
            </DialogTitle>
            <DialogDescription>
              Complete your payment securely
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
            <CreditCard className="h-5 w-5 text-primary" />
            Pay Invoice
          </DrawerTitle>
          <DrawerDescription>
            Complete your payment securely
          </DrawerDescription>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}

// Internal PaymentForm component — must be inside <Elements>
interface PaymentFormProps {
  amount: number;
  currency: string;
  onSuccess: () => void;
  onError: () => void;
  onProcessing: () => void;
}

function PaymentForm({ amount, currency, onSuccess, onError, onProcessing }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    onProcessing();

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/portal/invoices?payment=success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed. Please try again.');
        setIsSubmitting(false);
        onError();
      } else if (paymentIntent?.status === 'succeeded') {
        // Payment succeeded inline (no redirect needed)
        queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['parent-installments'] });
        toast({
          title: 'Payment Successful',
          description: `${formatCurrencyMinor(amount, currency.toUpperCase())} has been paid.`,
        });
        onSuccess();
      } else if (paymentIntent?.status === 'processing') {
        toast({
          title: 'Payment Processing',
          description: 'Your payment is being processed. The invoice will update shortly.',
        });
        onSuccess();
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
      onError();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || !elements || isSubmitting}
        className="w-full h-12 text-base font-semibold"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Pay {formatCurrencyMinor(amount, currency.toUpperCase())}
          </>
        )}
      </Button>
    </form>
  );
}
