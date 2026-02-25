import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFeatureGate, Feature, PLAN_NAMES } from '@/hooks/useFeatureGate';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

interface FeatureGateProps {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
}

/**
 * Wraps content that requires a specific subscription plan.
 * Shows upgrade prompt if user doesn't have access.
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true,
  className 
}: FeatureGateProps) {
  const { hasAccess, requiredPlanName, featureName, isTrialBlocked } = useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={className}
    >
      <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{featureName}</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            {isTrialBlocked 
              ? 'Your trial has expired. Upgrade to continue using this feature.'
              : `This feature requires the ${requiredPlanName} plan or higher.`}
          </p>
          <Button asChild>
            <Link to="/settings?tab=billing">
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade to {requiredPlanName}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface FeatureLockedOverlayProps {
  feature: Feature;
  children: ReactNode;
  className?: string;
}

/**
 * Renders children with a locked overlay if feature is not available.
 * Content is visible but not interactive.
 */
export function FeatureLockedOverlay({ feature, children, className }: FeatureLockedOverlayProps) {
  const { hasAccess, requiredPlanName, featureName } = useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none opacity-50 blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-3 text-sm font-medium">{featureName}</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings?tab=billing">
              Upgrade to {requiredPlanName}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LimitReachedProps {
  limitType: 'students' | 'teachers';
  currentCount: number;
  maxCount: number;
  className?: string;
}

/**
 * Shows when a usage limit is reached.
 */
export function LimitReached({ limitType, currentCount: _cc, maxCount, className }: LimitReachedProps) {
  const { plan, canUpgrade } = useSubscription();
  const limitName = limitType === 'students' ? 'students' : 'teachers';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border border-warning/30 bg-warning/10 p-4',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/20">
          <Lock className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-warning">
            {limitType === 'students' ? 'Student' : 'Teacher'} limit reached
          </h3>
          <p className="text-sm text-muted-foreground">
            You've reached your limit of {maxCount} {limitName} on the {PLAN_NAMES[plan]} plan.
            {canUpgrade && ' Upgrade to add more.'}
          </p>
        </div>
        {canUpgrade && (
          <Button asChild variant="outline" size="sm" className="border-warning text-warning hover:bg-warning/10">
            <Link to="/settings?tab=billing">
              Upgrade
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </motion.div>
  );
}

interface FeatureBadgeProps {
  feature: Feature;
  className?: string;
}

/**
 * Small badge indicating a feature requires upgrade.
 */
export function FeatureBadge({ feature, className }: FeatureBadgeProps) {
  const { hasAccess, requiredPlanName } = useFeatureGate(feature);

  if (hasAccess) return null;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
      className
    )}>
      <Sparkles className="h-3 w-3" />
      {requiredPlanName}
    </span>
  );
}
