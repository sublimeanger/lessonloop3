import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Clock, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_NAMES } from '@/hooks/useFeatureGate';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface UpgradeBannerProps {
  className?: string;
  variant?: 'default' | 'compact' | 'minimal';
  dismissible?: boolean;
  storageKey?: string;
}

export function UpgradeBanner({ 
  className, 
  variant = 'default',
  dismissible = true,
  storageKey = 'upgrade-banner-dismissed'
}: UpgradeBannerProps) {
  const { plan, isTrialing, trialDaysRemaining, isTrialExpired, isPastDue, canUpgrade } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissible) return false;
    return localStorage.getItem(storageKey) === 'true';
  });

  // Don't show if dismissed, not upgradable, or on paid plan with good standing
  if (isDismissed || !canUpgrade) return null;
  if (!isTrialing && !isPastDue && !isTrialExpired) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  // Trial expired - urgent
  if (isTrialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative overflow-hidden rounded-lg border border-destructive/30 bg-destructive/10 p-4',
          className
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">Your trial has expired</h3>
            <p className="text-sm text-muted-foreground">
              Upgrade now to continue using LessonLoop and keep your data.
            </p>
          </div>
          <Button asChild variant="destructive" size="sm">
            <Link to="/settings?tab=billing">
              Upgrade Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  // Past due - warning
  if (isPastDue) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative overflow-hidden rounded-lg border border-warning/30 bg-warning/10 p-4',
          className
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-warning">Payment overdue</h3>
            <p className="text-sm text-muted-foreground">
              Please update your payment method to avoid service interruption.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="border-warning text-warning hover:bg-warning/10">
            <Link to="/settings?tab=billing">
              Update Payment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  // Trial active - informational
  if (isTrialing) {
    const urgency = trialDaysRemaining <= 3 ? 'high' : trialDaysRemaining <= 7 ? 'medium' : 'low';

    if (variant === 'minimal') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            'flex items-center gap-2 text-sm',
            urgency === 'high' ? 'text-destructive' : 'text-muted-foreground',
            className
          )}
        >
          <Clock className="h-4 w-4" />
          <span>
            {trialDaysRemaining === 0 
              ? 'Trial ends today' 
              : `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left in trial`}
          </span>
          <Link to="/settings?tab=billing" className="font-medium text-primary hover:underline">
            Upgrade
          </Link>
        </motion.div>
      );
    }

    if (variant === 'compact') {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'relative flex items-center justify-between gap-4 rounded-lg border p-3',
            urgency === 'high' 
              ? 'border-destructive/30 bg-destructive/5' 
              : urgency === 'medium'
              ? 'border-warning/30 bg-warning/5'
              : 'border-primary/30 bg-primary/5',
            className
          )}
        >
          <div className="flex items-center gap-3">
            <Clock className={cn(
              'h-4 w-4',
              urgency === 'high' ? 'text-destructive' : urgency === 'medium' ? 'text-warning' : 'text-primary'
            )} />
            <span className="text-sm">
              <strong>{trialDaysRemaining}</strong> day{trialDaysRemaining !== 1 ? 's' : ''} left in trial
            </span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings?tab=billing">Upgrade</Link>
          </Button>
          {dismissible && (
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      );
    }

    // Default variant
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative overflow-hidden rounded-lg border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4',
          urgency === 'high' ? 'border-destructive/30' : 'border-primary/20',
          className
        )}
      >
        {dismissible && (
          <button 
            onClick={handleDismiss} 
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            urgency === 'high' ? 'bg-destructive/20' : 'bg-primary/20'
          )}>
            {urgency === 'high' ? (
              <Clock className="h-6 w-6 text-destructive" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">
              {urgency === 'high' 
                ? `Only ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left!`
                : 'Enjoying your trial?'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {urgency === 'high'
                ? 'Upgrade now to keep all your data and unlock full features.'
                : `You have ${trialDaysRemaining} days remaining. Choose a plan for unlimited access.`}
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/settings?tab=billing">
              Choose Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
}
