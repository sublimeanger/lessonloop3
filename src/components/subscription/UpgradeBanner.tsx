import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Clock, AlertTriangle, ArrowRight, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { differenceInHours } from 'date-fns';

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
  const { plan: _plan, isTrialing, trialDaysRemaining, trialEndsAt, isTrialExpired, isPastDue, canUpgrade } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissible) return false;
    const dismissedAt = safeGetItem(storageKey);
    if (!dismissedAt) return false;
    // Auto-reset after 48 hours
    const dismissedDate = new Date(dismissedAt);
    if (isNaN(dismissedDate.getTime())) return false;
    const hoursSinceDismiss = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60);
    return hoursSinceDismiss < 48;
  });
  const [hoursRemaining, setHoursRemaining] = useState(0);

  // Calculate hours remaining for countdown
  useEffect(() => {
    if (trialEndsAt && trialDaysRemaining <= 3) {
      const updateHours = () => {
        const hours = differenceInHours(trialEndsAt, new Date());
        setHoursRemaining(Math.max(0, hours));
      };
      updateHours();
      const interval = setInterval(updateHours, 1000 * 60); // Update every minute
      return () => clearInterval(interval);
    }
  }, [trialEndsAt, trialDaysRemaining]);

  // Don't show if dismissed, not upgradable, or on paid plan with good standing
  if ((isDismissed && trialDaysRemaining > 3) || !canUpgrade) return null;
  if (!isTrialing && !isPastDue && !isTrialExpired) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    safeSetItem(storageKey, new Date().toISOString());
  };

  // Format countdown for final days
  const formatCountdown = () => {
    if (trialDaysRemaining > 0) {
      const hours = hoursRemaining % 24;
      return `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''} left`;
    }
    return `${hoursRemaining} hours left`;
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
    const urgency = trialDaysRemaining <= 1 ? 'critical' : trialDaysRemaining <= 3 ? 'high' : trialDaysRemaining <= 7 ? 'medium' : 'low';

    if (variant === 'minimal') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            'flex items-center gap-2 text-sm',
            urgency === 'critical' || urgency === 'high' ? 'text-destructive' : 'text-muted-foreground',
            className
          )}
        >
          <Clock className="h-4 w-4" />
          <span>
            {trialDaysRemaining === 0 
              ? 'Trial ends today' 
              : trialDaysRemaining <= 3 
                ? formatCountdown()
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
            urgency === 'critical'
              ? 'border-destructive/50 bg-destructive/10'
              : urgency === 'high' 
              ? 'border-destructive/30 bg-destructive/5' 
              : urgency === 'medium'
              ? 'border-warning/30 bg-warning/5'
              : 'border-primary/30 bg-primary/5',
            className
          )}
        >
          <div className="flex items-center gap-3">
            {urgency === 'critical' || urgency === 'high' ? (
              <Zap className="h-4 w-4 text-destructive animate-pulse" />
            ) : (
              <Clock className={cn(
                'h-4 w-4',
                urgency === 'medium' ? 'text-warning' : 'text-primary'
              )} />
            )}
            <span className="text-sm">
              {trialDaysRemaining <= 3 ? (
                <strong className={urgency === 'critical' || urgency === 'high' ? 'text-destructive' : ''}>
                  {formatCountdown()}
                </strong>
              ) : (
                <>
                  <strong>{trialDaysRemaining}</strong> day{trialDaysRemaining !== 1 ? 's' : ''} left in trial
                </>
              )}
            </span>
          </div>
          <Button asChild variant={urgency === 'critical' || urgency === 'high' ? 'destructive' : 'outline'} size="sm">
            <Link to="/settings?tab=billing">Upgrade Now</Link>
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
          'relative overflow-hidden rounded-lg border p-4',
          urgency === 'critical' 
            ? 'border-destructive/50 bg-gradient-to-r from-destructive/15 via-destructive/10 to-transparent'
            : urgency === 'high' 
            ? 'border-destructive/30 bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent' 
            : 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20',
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
            urgency === 'critical' || urgency === 'high' ? 'bg-destructive/20' : 'bg-primary/20'
          )}>
            {urgency === 'critical' ? (
              <Zap className="h-6 w-6 text-destructive animate-pulse" />
            ) : urgency === 'high' ? (
              <Clock className="h-6 w-6 text-destructive" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className={cn(
              'font-semibold',
              (urgency === 'critical' || urgency === 'high') && 'text-destructive'
            )}>
              {urgency === 'critical' 
                ? `⚡ Only ${hoursRemaining} hours left!`
                : urgency === 'high' 
                ? `Only ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left!`
                : 'Enjoying your trial?'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {urgency === 'critical' || urgency === 'high'
                ? 'Add a payment method now to keep all your data and unlock full features.'
                : `You have ${trialDaysRemaining} days remaining. Choose a plan for unlimited access.`}
            </p>
          </div>
          <Button 
            asChild 
            className={cn(
              'shrink-0',
              (urgency === 'critical' || urgency === 'high') && 'bg-destructive hover:bg-destructive/90'
            )}
          >
            <Link to="/settings?tab=billing">
              {urgency === 'critical' || urgency === 'high' ? 'Upgrade Now' : 'Choose Plan'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
}
