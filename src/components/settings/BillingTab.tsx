import { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Sparkles, CreditCard, Clock, Check, ArrowRight, 
  Users, GraduationCap, Loader2, ExternalLink, AlertTriangle,
  Link2, CheckCircle2, RefreshCw, Building2, Info, Eye, EyeOff, Save,
  Receipt, FileText, XCircle
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionCheckout, BillingInterval } from '@/hooks/useSubscriptionCheckout';
import { useUsageCounts } from '@/hooks/useUsageCounts';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { LimitReached } from '@/components/subscription/FeatureGate';
import { useOrg } from '@/contexts/OrgContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PRICING_CONFIG, PLAN_ORDER, type PlanKey, formatLimit, TRIAL_DAYS, DB_PLAN_MAP, PLAN_DISPLAY_NAMES } from '@/lib/pricing-config';

// Database plan types
type DbSubscriptionPlan = 'solo_teacher' | 'academy' | 'agency';

// Map display plan keys to database plan keys
const DISPLAY_TO_DB_PLAN: Record<PlanKey, DbSubscriptionPlan> = {
  teacher: 'solo_teacher',
  studio: 'academy',
  agency: 'agency',
};


interface PlanCardProps {
  plan: PlanKey;
  name: string;
  price: { monthly: number; yearly: number };
  features: string[];
  limits: { students: number; teachers: number };
  isCurrentPlan: boolean;
  isPopular?: boolean;
  billingInterval: BillingInterval;
  onSelect: () => void;
  isLoading: boolean;
}

function PlanCard({ 
  plan, 
  name, 
  price, 
  features, 
  limits,
  isCurrentPlan, 
  isPopular,
  billingInterval,
  onSelect,
  isLoading
}: PlanCardProps) {
  const currentPrice = billingInterval === 'yearly' 
    ? Math.round(price.yearly / 12) 
    : price.monthly;
  const yearlyDiscount = Math.round((1 - (price.yearly / (price.monthly * 12))) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-primary text-primary-foreground shadow-lg">
            Most Popular
          </Badge>
        </div>
      )}
      <Card className={cn(
        'relative overflow-hidden transition-all',
        isPopular && 'border-primary shadow-lg ring-2 ring-primary/20',
        isCurrentPlan && 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20'
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{name}</CardTitle>
            {isCurrentPlan && (
              <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                Current Plan
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">£{currentPrice}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            {billingInterval === 'yearly' && yearlyDiscount > 0 && (
              <p className="text-sm text-emerald-600 mt-1">
                Save {yearlyDiscount}% with annual billing
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{limits.students >= 9999 ? 'Unlimited' : limits.students} students</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span>{limits.teachers >= 9999 ? 'Unlimited' : limits.teachers} teachers</span>
            </div>
          </div>
          
          <Separator />
          
          <ul className="space-y-2">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            onClick={onSelect}
            disabled={isCurrentPlan || isLoading}
            className="w-full mt-4"
            variant={isPopular ? 'default' : 'outline'}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isCurrentPlan ? (
              'Current Plan'
            ) : (
              <>
                {isPopular ? 'Upgrade Now' : 'Select Plan'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Use centralized pricing config
const PLANS = Object.fromEntries(
  PLAN_ORDER.map((key) => {
    const config = PRICING_CONFIG[key];
    return [
      key,
      {
        name: config.name,
        price: config.price,
        features: config.features,
        limits: config.limits,
        isPopular: config.isPopular,
      },
    ];
  })
) as Record<PlanKey, {
  name: string;
  price: { monthly: number; yearly: number };
  features: string[];
  limits: { students: number; teachers: number };
  isPopular?: boolean;
}>;

export function BillingTab() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [searchParams, setSearchParams] = useSearchParams();
  const [downgradeTarget, setDowngradeTarget] = useState<PlanKey | null>(null);
  const queryClient = useQueryClient();
  const { 
    plan, 
    status, 
    isTrialing, 
    trialEndsAt, 
    trialDaysRemaining,
    isTrialExpired,
    isPastDue,
    limits,
    stripeSubscriptionId,
    cancelsAt,
  } = useSubscription();
  const { initiateSubscription, openCustomerPortal, isLoading } = useSubscriptionCheckout();
  const { counts, usage } = useUsageCounts();
  const { isOrgOwner, isOrgAdmin, currentOrg, refreshOrganisations } = useOrg();
  const {
    connectStatus,
    isLoading: isConnectLoading,
    isOnboarding,
    startOnboarding,
    refreshStatus,
    isConnected,
    isPending,
    dashboardUrl,
  } = useStripeConnect();

  // Handle connect return/refresh from Stripe
  useEffect(() => {
    const connectParam = searchParams.get('connect');
    if (connectParam === 'return') {
      refreshStatus();
      toast({ title: 'Stripe account setup updated' });
      searchParams.delete('connect');
      setSearchParams(searchParams, { replace: true });
    } else if (connectParam === 'refresh') {
      toast({ title: 'Please complete your Stripe account setup' });
      searchParams.delete('connect');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, refreshStatus, setSearchParams]);

  // Handle subscription success redirect with polling
  useEffect(() => {
    const subParam = searchParams.get('subscription');
    if (subParam !== 'success' || !currentOrg?.id) return;

    // Clear the param immediately
    searchParams.delete('subscription');
    setSearchParams(searchParams, { replace: true });

    // Refresh data right away
    refreshOrganisations();
    queryClient.invalidateQueries({ queryKey: ['usage-counts'] });

    // Poll for up to 10s until status becomes 'active'
    let attempts = 0;
    const maxAttempts = 5;
    const pollInterval = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from('organisations')
        .select('subscription_status, subscription_plan')
        .eq('id', currentOrg.id)
        .single();

      if (data?.subscription_status === 'active' || attempts >= maxAttempts) {
        clearInterval(pollInterval);
        refreshOrganisations();
        queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
        const planName = data?.subscription_plan ? (PLAN_DISPLAY_NAMES[data.subscription_plan] || data.subscription_plan) : 'your plan';
        toast({ title: `Subscription activated! Welcome to LessonLoop ${planName}.` });
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [searchParams, currentOrg?.id, setSearchParams, refreshOrganisations, queryClient]);

  const canManageBilling = isOrgOwner || isOrgAdmin;
  const hasActiveSubscription = stripeSubscriptionId && status === 'active';

  // Map current database plan to display plan key
  const getCurrentDisplayPlan = (): PlanKey | null => {
    const map: Record<string, PlanKey> = {
      solo_teacher: 'teacher',
      academy: 'studio',
      agency: 'agency',
    };
    return map[plan] || null;
  };

  const currentDisplayPlan = getCurrentDisplayPlan();

  const isDowngrade = (targetPlan: PlanKey): boolean => {
    if (!currentDisplayPlan || isTrialing) return false;
    const currentIdx = PLAN_ORDER.indexOf(currentDisplayPlan);
    const targetIdx = PLAN_ORDER.indexOf(targetPlan);
    return targetIdx < currentIdx;
  };

  const getLostFeatures = (targetPlan: PlanKey): string[] => {
    if (!currentDisplayPlan) return [];
    const currentFeatures = PRICING_CONFIG[currentDisplayPlan].features;
    const targetFeatures = new Set(PRICING_CONFIG[targetPlan].features);
    return currentFeatures.filter(f => !targetFeatures.has(f) && !f.startsWith('Everything in'));
  };

  const handlePlanSelect = (targetPlan: PlanKey) => {
    if (isDowngrade(targetPlan)) {
      setDowngradeTarget(targetPlan);
    } else {
      initiateSubscription(DISPLAY_TO_DB_PLAN[targetPlan], billingInterval);
    }
  };

  const confirmDowngrade = () => {
    if (downgradeTarget) {
      initiateSubscription(DISPLAY_TO_DB_PLAN[downgradeTarget], billingInterval);
      setDowngradeTarget(null);
    }
  };

  const lostFeatures = downgradeTarget ? getLostFeatures(downgradeTarget) : [];

  return (
    <div className="space-y-8">
      {/* Downgrade Confirmation Dialog */}
      <AlertDialog open={!!downgradeTarget} onOpenChange={(open) => !open && setDowngradeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm plan change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You're about to change from <strong>{currentDisplayPlan ? PRICING_CONFIG[currentDisplayPlan].name : ''}</strong> to <strong>{downgradeTarget ? PRICING_CONFIG[downgradeTarget].name : ''}</strong>.
                </p>
                {lostFeatures.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-2">You'll lose access to:</p>
                    <ul className="space-y-1">
                      {lostFeatures.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-sm">This change will take effect at the end of your current billing period.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDowngrade} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Subscription Status
              </CardTitle>
              <CardDescription>
                Manage your LessonLoop subscription
              </CardDescription>
            </div>
            {hasActiveSubscription && canManageBilling && (
              <Button 
                variant="outline" 
                onClick={openCustomerPortal}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Manage Billing
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl',
                isTrialing ? 'bg-primary/10' : 
                isPastDue ? 'bg-destructive/10' : 
                'bg-emerald-500/10'
              )}>
                {isTrialing ? (
                  <Clock className="h-6 w-6 text-primary" />
                ) : isPastDue ? (
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                ) : (
                  <Sparkles className="h-6 w-6 text-emerald-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{PLAN_DISPLAY_NAMES[plan] || plan}</h3>
                  <Badge variant={
                    status === 'active' ? 'default' :
                    status === 'trialing' ? 'secondary' :
                    status === 'past_due' ? 'destructive' : 'outline'
                  }>
                    {status === 'active' ? 'Active' :
                     status === 'trialing' ? 'Trial' :
                     status === 'past_due' ? 'Past Due' :
                     status === 'cancelled' ? 'Cancelled' : status}
                  </Badge>
                </div>
                {isTrialing && trialEndsAt && (
                  <p className="text-sm text-muted-foreground">
                    Trial ends {format(trialEndsAt, 'dd MMM yyyy')} ({trialDaysRemaining} days remaining)
                  </p>
                )}
                {isPastDue && (
                  <p className="text-sm text-destructive">
                    Please update your payment method to continue using LessonLoop
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Students</span>
                <span className={cn(
                  'text-sm font-medium',
                  usage.isStudentNearLimit && 'text-warning',
                  usage.isStudentAtLimit && 'text-destructive'
                )}>
                  {limits.maxStudents >= 9999 ? 'Unlimited' : `${counts.students} / ${limits.maxStudents}`}
                </span>
              </div>
              {limits.maxStudents < 9999 && (
                <Progress 
                  value={usage.studentsPercentage} 
                  className={cn(
                    'h-2',
                    usage.isStudentNearLimit && '[&>div]:bg-warning',
                    usage.isStudentAtLimit && '[&>div]:bg-destructive'
                  )} 
                />
              )}
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Teachers</span>
                <span className={cn(
                  'text-sm font-medium',
                  usage.isTeacherNearLimit && 'text-warning',
                  usage.isTeacherAtLimit && 'text-destructive'
                )}>
                  {limits.maxTeachers >= 9999 ? 'Unlimited' : `${counts.teachers} / ${limits.maxTeachers}`}
                </span>
              </div>
              {limits.maxTeachers < 9999 && (
                <Progress 
                  value={usage.teachersPercentage} 
                  className={cn(
                    'h-2',
                    usage.isTeacherNearLimit && '[&>div]:bg-warning',
                    usage.isTeacherAtLimit && '[&>div]:bg-destructive'
                  )} 
                />
              )}
            </div>
          </div>

          {/* Limit Reached Warnings */}
          {usage.isStudentAtLimit && (
            <LimitReached 
              limitType="students"
              currentCount={counts.students}
              maxCount={limits.maxStudents}
            />
          )}
          {usage.isTeacherAtLimit && (
            <LimitReached 
              limitType="teachers"
              currentCount={counts.teachers}
              maxCount={limits.maxTeachers}
            />
          )}
        </CardContent>
      </Card>

      {/* Pending Cancellation Banner */}
      {cancelsAt && cancelsAt > new Date() && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <Info className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">Subscription cancelling</h3>
              <p className="text-sm text-muted-foreground">
                Your subscription will cancel on {format(cancelsAt, 'dd MMM yyyy')}. You'll retain full access until then.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial Expired Warning */}
      {isTrialExpired && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-destructive">Your trial has expired</h3>
              <p className="text-sm text-muted-foreground">
                Choose a plan below to continue using LessonLoop and keep all your data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Selection */}
      {canManageBilling && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Choose Your Plan</h2>
              <p className="text-sm text-muted-foreground">
                Start free for {TRIAL_DAYS} days. No credit card required.
              </p>
            </div>
            <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setBillingInterval('monthly')}
                aria-label="Monthly billing"
                aria-pressed={billingInterval === 'monthly'}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  billingInterval === 'monthly' 
                    ? 'bg-background shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('yearly')}
                aria-label="Yearly billing"
                aria-pressed={billingInterval === 'yearly'}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  billingInterval === 'yearly' 
                    ? 'bg-background shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Yearly
                <Badge variant="secondary" className="ml-2 text-xs">
                  Save {Math.round((1 - PRICING_CONFIG.studio.price.yearly / (PRICING_CONFIG.studio.price.monthly * 12)) * 100)}%
                </Badge>
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, planData]) => (
              <PlanCard
                key={key}
                plan={key}
                name={planData.name}
                price={planData.price}
                features={planData.features}
                limits={planData.limits}
                isCurrentPlan={currentDisplayPlan === key && !isTrialing}
                isPopular={'isPopular' in planData && planData.isPopular}
                billingInterval={billingInterval}
                onSelect={() => handlePlanSelect(key)}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Payment Collection (Stripe Connect) */}
      {canManageBilling && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Payment Collection
                </CardTitle>
                <CardDescription>
                  Connect your Stripe account to receive parent payments directly
                </CardDescription>
              </div>
              {isConnected && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
              {isPending && (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Setup Incomplete
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnectLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : isConnected ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="font-medium text-sm">Stripe account connected</p>
                      <p className="text-xs text-muted-foreground">
                        Parent payments will be deposited directly into your Stripe account.
                        {connectStatus?.platformFeePercent ? ` A ${connectStatus.platformFeePercent}% platform fee applies.` : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {dashboardUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Stripe Dashboard
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={refreshStatus}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>
              </div>
            ) : isPending ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-sm">Setup incomplete</p>
                      <p className="text-xs text-muted-foreground">
                        Your Stripe account has been created but setup isn't complete. 
                        Click below to finish the process.
                      </p>
                    </div>
                  </div>
                </div>
                <Button onClick={startOnboarding} disabled={isOnboarding}>
                  {isOnboarding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Complete Stripe Setup
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Stripe account so parents can pay invoices online. 
                  Payments go directly to your bank account via Stripe. You'll be redirected 
                  to Stripe to complete the setup.
                </p>
                <Button onClick={startOnboarding} disabled={isOnboarding}>
                  {isOnboarding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Connect Stripe Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Preferences */}
      {canManageBilling && <PaymentPreferencesCard orgId={currentOrg?.id} isConnected={isConnected} />}

      {/* Billing History */}
      {canManageBilling && hasActiveSubscription && currentOrg?.id && (
        <BillingHistoryCard orgId={currentOrg.id} />
      )}

      {/* Cancel Subscription */}
      {canManageBilling && hasActiveSubscription && currentOrg?.id && (
        <CancellationFlowCard
          orgId={currentOrg.id}
          onConfirmCancel={openCustomerPortal}
          isLoading={isLoading}
        />
      )}

      {/* Non-admin message */}
      {!canManageBilling && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Contact your organisation owner to manage billing and subscriptions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PaymentPreferencesCard({ orgId, isConnected }: { orgId?: string; isConnected: boolean }) {
  const [onlinePayments, setOnlinePayments] = useState(true);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [bacsEnabled, setBacsEnabled] = useState(false);
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankSortCode, setBankSortCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankReferencePrefix, setBankReferencePrefix] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from('organisations')
      .select('online_payments_enabled, payment_methods_enabled, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix')
      .eq('id', orgId)
      .single()
      .then(({ data }) => {
        if (data) {
          setOnlinePayments(data.online_payments_enabled !== false);
          const methods = data.payment_methods_enabled || ['card'];
          setCardEnabled(methods.includes('card'));
          setBacsEnabled(methods.includes('bacs_debit'));
          setBankAccountName(data.bank_account_name || '');
          setBankSortCode(data.bank_sort_code || '');
          setBankAccountNumber(data.bank_account_number || '');
          setBankReferencePrefix(data.bank_reference_prefix || '');
        }
        setIsLoaded(true);
      });
  }, [orgId]);

  const handleSave = async () => {
    if (!orgId) return;
    setIsSaving(true);
    const methods: string[] = [];
    if (cardEnabled) methods.push('card');
    if (bacsEnabled) methods.push('bacs_debit');

    const { error } = await supabase
      .from('organisations')
      .update({
        online_payments_enabled: onlinePayments,
        payment_methods_enabled: methods.length > 0 ? methods : ['card'],
        bank_account_name: bankAccountName || null,
        bank_sort_code: bankSortCode || null,
        bank_account_number: bankAccountNumber || null,
        bank_reference_prefix: bankReferencePrefix || null,
      })
      .eq('id', orgId);

    setIsSaving(false);
    if (error) {
      toast({ title: 'Failed to save payment preferences', variant: 'destructive' });
    } else {
      toast({ title: 'Payment preferences saved' });
    }
  };

  if (!isLoaded) return null;

  const hasBankDetails = !!(bankAccountName && bankSortCode && bankAccountNumber);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Payment Preferences
        </CardTitle>
        <CardDescription>
          Control how parents can pay invoices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Online Payments Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Online Payments</Label>
            <p className="text-xs text-muted-foreground">
              Enable the "Pay Now" button on invoices for parents
            </p>
          </div>
          <Switch checked={onlinePayments} onCheckedChange={setOnlinePayments} />
        </div>

        {/* Accepted Methods (only when online payments on + Stripe connected) */}
        {onlinePayments && isConnected && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Accepted Payment Methods</Label>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={cardEnabled} onCheckedChange={(v) => setCardEnabled(!!v)} />
                <div>
                  <span className="text-sm font-medium">Card</span>
                  <span className="text-xs text-muted-foreground ml-2">Visa, Mastercard, etc.</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={bacsEnabled} onCheckedChange={(v) => setBacsEnabled(!!v)} />
                <div>
                  <span className="text-sm font-medium">Bacs Direct Debit</span>
                  <span className="text-xs text-muted-foreground ml-2">UK bank account payments</span>
                </div>
              </label>
            </div>
          </div>
        )}

        <Separator />

        {/* Bank Transfer Details */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Bank Transfer Details</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Shown on PDF invoices and emails so parents can pay by bank transfer
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bank-name" className="text-xs">Account Name</Label>
              <Input id="bank-name" placeholder="e.g. Mrs J Smith" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort-code" className="text-xs">Sort Code</Label>
              <Input id="sort-code" placeholder="e.g. 12-34-56" value={bankSortCode} onChange={(e) => setBankSortCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-number" className="text-xs">Account Number</Label>
              <div className="flex gap-2">
                <Input id="account-number" type={showAccountNumber ? "text" : "password"} placeholder="e.g. 12345678" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setShowAccountNumber(!showAccountNumber)} title={showAccountNumber ? "Hide" : "Show"}>
                  {showAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-prefix" className="text-xs">Reference Prefix</Label>
              <Input id="ref-prefix" placeholder="e.g. LESSON" value={bankReferencePrefix} onChange={(e) => setBankReferencePrefix(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Info banner */}
        {!isConnected && hasBankDetails && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Parents will see your bank details on invoices for manual payment. Connect Stripe above to also offer online card payments.
            </p>
          </div>
        )}

        {/* Preview toggle */}
        {hasBankDetails && (
          <div>
            <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? 'Hide Preview' : 'Preview on Invoice'}
            </Button>
            {showPreview && (
              <div className="mt-3 p-4 rounded-lg bg-sky-50/80 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-800/30">
                <p className="text-sm font-semibold text-sky-900 dark:text-sky-200 mb-2">Payment Details</p>
                <div className="text-xs space-y-1 text-sky-800 dark:text-sky-300">
                  <p><strong>Account Name:</strong> {bankAccountName}</p>
                  <p><strong>Sort Code:</strong> {bankSortCode}</p>
                  <p><strong>Account Number:</strong> {bankAccountNumber}</p>
                  {bankReferencePrefix && <p><strong>Reference:</strong> {bankReferencePrefix}-LL-2025-00001</p>}
                </div>
              </div>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Payment Preferences
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Billing History Card ───────────────────────────────────────────────────

interface StripeInvoice {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status: string | null;
  pdf_url: string | null;
  hosted_url: string | null;
}

function BillingHistoryCard({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['billing-history', orgId],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke('stripe-billing-history', {
        body: { orgId },
      });
      if (error) throw error;
      return (result as { invoices: StripeInvoice[] }).invoices;
    },
    // Uses default SEMI_STABLE (2 min)
  });

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Paid</Badge>;
      case 'open':
        return <Badge variant="secondary">Open</Badge>;
      case 'void':
        return <Badge variant="outline">Void</Badge>;
      case 'uncollectible':
        return <Badge variant="destructive">Uncollectible</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Billing History
        </CardTitle>
        <CardDescription>Your recent subscription invoices</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4">Unable to load billing history.</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span></span>
            </div>
            {data.map((inv) => (
              <div
                key={inv.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-3 py-2.5 rounded-lg border"
              >
                <span className="text-sm">
                  {format(new Date(inv.date * 1000), 'dd MMM yyyy')}
                </span>
                <span className="text-sm font-medium">
                  {formatAmount(inv.amount, inv.currency)}
                </span>
                {getStatusBadge(inv.status)}
                <div className="flex gap-1">
                  {inv.hosted_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={inv.hosted_url} target="_blank" rel="noopener noreferrer" title="View invoice">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  {inv.pdf_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" title="Download PDF">
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cancellation Flow ──────────────────────────────────────────────────────

const CANCEL_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'switching', label: 'Switching to another tool' },
  { value: 'temporary', label: 'I only need it temporarily' },
  { value: 'other', label: 'Other' },
] as const;

function CancellationFlowCard({
  orgId,
  onConfirmCancel,
  isLoading,
}: {
  orgId: string;
  onConfirmCancel: () => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setReason('');
    setDetails('');
    setOpen(false);
  };

  const handleNext = () => {
    if (step === 1 && reason) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await supabase.from('cancellation_feedback').insert({
        org_id: orgId,
        user_id: (await supabase.auth.getUser()).data.user!.id,
        reason,
        details: details || null,
      });
    } catch {
      // Non-blocking — best effort
    }
    setSaving(false);
    reset();
    onConfirmCancel();
  };

  const retentionContent = () => {
    switch (reason) {
      case 'too_expensive':
        return (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <p className="font-medium text-sm">💰 We'd hate to lose you over price</p>
            <p className="text-sm text-muted-foreground">
              Contact us at <strong>support@lessonloop.co.uk</strong> — we may be able to offer a
              discounted rate or suggest a plan that better fits your budget.
            </p>
          </div>
        );
      case 'temporary':
        return (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <p className="font-medium text-sm">⏸️ Consider pausing instead</p>
            <p className="text-sm text-muted-foreground">
              You can pause your subscription through the billing portal instead of cancelling.
              Your data will be preserved and you can resume anytime.
            </p>
          </div>
        );
      case 'missing_features':
        return (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
              <p className="font-medium text-sm">🛠️ We're always building</p>
              <p className="text-sm text-muted-foreground">
                Tell us what you need — we ship features based on teacher feedback every week.
              </p>
            </div>
            <Textarea
              placeholder="What features are you missing?"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
        );
      default:
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We'd love to understand how we can improve. Any feedback helps.
            </p>
            <Textarea
              placeholder="Tell us more (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
        );
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setOpen(true)}>
          <XCircle className="h-4 w-4 mr-2" />
          Cancel Subscription
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); }}>
        <DialogContent className="sm:max-w-md">
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>We're sorry to see you go</DialogTitle>
                <DialogDescription>
                  Help us understand why you're leaving so we can improve.
                </DialogDescription>
              </DialogHeader>
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-3 py-4">
                {CANCEL_REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-3 cursor-pointer">
                    <RadioGroupItem value={r.value} />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </RadioGroup>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={reset}>Never mind</Button>
                <Button onClick={handleNext} disabled={!reason}>Continue</Button>
              </DialogFooter>
            </>
          )}

          {step === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>Before you go…</DialogTitle>
                <DialogDescription>We want to help if we can.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                {retentionContent()}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button variant="destructive" onClick={handleNext}>Continue to cancel</Button>
              </DialogFooter>
            </>
          )}

          {step === 3 && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm cancellation</DialogTitle>
                <DialogDescription>
                  Your subscription will cancel at the end of your current billing period.
                  You'll retain full access until then.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm text-muted-foreground">
                    All your data will be preserved. You can resubscribe at any time to regain access.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={reset}>Keep My Plan</Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={saving || isLoading}
                >
                  {(saving || isLoading) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Cancel Subscription
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
