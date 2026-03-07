import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionCheckout } from '@/hooks/useSubscriptionCheckout';
import { PRICING_CONFIG, PLAN_ORDER, DB_PLAN_MAP, formatLimit, type PlanKey } from '@/lib/pricing-config';
import { platform } from '@/lib/platform';
import { NativePaymentNotice } from '@/components/shared/NativePaymentNotice';

interface TrialExpiredModalProps {
  onDismissed?: () => void;
}

export function TrialExpiredModal({ onDismissed }: TrialExpiredModalProps) {
  const { isTrialExpired } = useSubscription();
  const { initiateSubscription, isLoading } = useSubscriptionCheckout();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    if (isTrialExpired && !dismissed) {
      setIsOpen(true);
    }
  }, [isTrialExpired, dismissed]);

  useEffect(() => {
    const handleNavigation = () => {
      if (isTrialExpired && !dismissed) {
        setIsOpen(true);
      }
    };
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, [isTrialExpired, dismissed]);

  const handleDismiss = () => {
    setIsOpen(false);
    setDismissed(true);
    onDismissed?.();
  };

  const handlePlanClick = async (planKey: PlanKey) => {
    if (isLoading || loadingPlan) return;
    setLoadingPlan(planKey);
    const dbPlan = DB_PLAN_MAP[planKey] as 'solo_teacher' | 'academy' | 'agency';
    await initiateSubscription(dbPlan);
    setLoadingPlan(null);
  };

  if (!isTrialExpired) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center pb-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
          >
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </motion.div>
          <DialogTitle className="text-xl">Your trial has expired</DialogTitle>
          <DialogDescription className="text-base">
            Choose a plan to continue using LessonLoop and keep all your data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-3">
            {PLAN_ORDER.map((planKey) => {
              const plan = PRICING_CONFIG[planKey];
              const isPlanLoading = loadingPlan === planKey;
              const isDisabled = !!loadingPlan || isLoading;
              return (
                <button
                  key={planKey}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !platform.isNative && handlePlanClick(planKey)}
                  className={`relative rounded-lg border p-4 text-left transition-colors ${
                    plan.isPopular
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                  } ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {plan.isPopular && (
                    <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground">
                      Popular
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{plan.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatLimit(plan.limits.students)} students • {formatLimit(plan.limits.teachers)} teacher{plan.limits.teachers !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      {isPlanLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      <span className="text-2xl font-bold">£{plan.price.monthly}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Your data is safe
            </h4>
            <p className="text-sm text-muted-foreground">
              All your students, lessons, and invoices are preserved. Simply choose a plan to unlock full access again.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {platform.isNative ? (
            <>
              <NativePaymentNotice
                variant="inline"
                message="Visit lessonloop.net in your browser to choose a plan and continue using LessonLoop."
              />
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                Continue in read-only mode
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings?tab=billing">
                  View all plan details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                Continue in read-only mode
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Persistent banner — only shown when `show` prop is true (after modal dismissed)
interface TrialExpiredBannerProps {
  show?: boolean;
}

export function TrialExpiredBanner({ show }: TrialExpiredBannerProps) {
  const { isTrialExpired } = useSubscription();

  if (!isTrialExpired || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-destructive text-destructive-foreground"
      >
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Your trial has expired. Upgrade to continue using LessonLoop.</span>
          </div>
          {platform.isNative ? (
            <span className="text-sm font-medium text-destructive-foreground">
              Visit lessonloop.net to upgrade
            </span>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link to="/settings?tab=billing">
                Upgrade Now
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
