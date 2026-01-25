import { motion } from 'framer-motion';
import { Check, Sparkles, Users, Building2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRICING_CONFIG, PLAN_ORDER, type PlanKey, formatLimit, TRIAL_DAYS, DB_PLAN_MAP } from '@/lib/pricing-config';

// Database subscription plan type (what gets stored)
type DbSubscriptionPlan = 'solo_teacher' | 'academy' | 'agency';

interface PlanOption {
  value: PlanKey;
  dbValue: DbSubscriptionPlan; // The value to use when saving to database
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  icon: React.ElementType;
  features: string[];
  highlighted?: boolean;
  recommended?: boolean;
}

const PLAN_ICONS: Record<PlanKey, React.ElementType> = {
  teacher: Users,
  studio: Building2,
  agency: Crown,
};

// Build PLANS from centralized config
const PLANS: PlanOption[] = PLAN_ORDER.map((key) => {
  const config = PRICING_CONFIG[key];
  return {
    value: key,
    dbValue: DB_PLAN_MAP[key] as DbSubscriptionPlan,
    name: config.name,
    tagline: config.tagline,
    price: `£${config.price.monthly}`,
    priceNote: '/month',
    icon: PLAN_ICONS[key],
    highlighted: config.isPopular,
    recommended: config.isPopular,
    features: [
      formatLimit(config.limits.students) === 'Unlimited' 
        ? 'Unlimited students' 
        : `Up to ${formatLimit(config.limits.students)} students`,
      config.limits.teachers > 1 
        ? config.limits.teachers >= 9999 
          ? 'Unlimited teachers' 
          : `Up to ${formatLimit(config.limits.teachers)} teachers`
        : 'Single teacher',
      ...config.features.slice(2, 6), // Take 4 more features
    ],
  };
});

interface PlanSelectorProps {
  selectedPlan: DbSubscriptionPlan;
  onSelectPlan: (plan: DbSubscriptionPlan) => void;
  recommendedPlan?: DbSubscriptionPlan;
}

export function PlanSelector({ selectedPlan, onSelectPlan, recommendedPlan }: PlanSelectorProps) {
  // Map db plan to display plan for comparison
  const getDisplayPlanKey = (dbPlan: DbSubscriptionPlan): PlanKey => {
    const map: Record<DbSubscriptionPlan, PlanKey> = {
      solo_teacher: 'teacher',
      academy: 'studio',
      agency: 'agency',
    };
    return map[dbPlan];
  };

  const selectedDisplayPlan = getDisplayPlanKey(selectedPlan);
  const recommendedDisplayPlan = recommendedPlan ? getDisplayPlanKey(recommendedPlan) : undefined;

  return (
    <div className="space-y-6">
      {/* Trial banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
      >
        <Sparkles className="h-4 w-4" />
        <span>{TRIAL_DAYS}-day free trial • No card required</span>
      </motion.div>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan, index) => {
          const Icon = plan.icon;
          const isSelected = selectedDisplayPlan === plan.value;
          const isRecommended = recommendedDisplayPlan === plan.value || plan.recommended;

          return (
            <motion.button
              key={plan.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              type="button"
              onClick={() => onSelectPlan(plan.dbValue)}
              className={cn(
                'relative flex flex-col rounded-xl border-2 p-5 text-left transition-all duration-200',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30',
                plan.highlighted && !isSelected && 'border-primary/30'
              )}
            >
              {/* Recommended badge */}
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Recommended
                  </span>
                </div>
              )}

              {/* Selection indicator */}
              <div
                className={cn(
                  'absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30'
                )}
              >
                {isSelected && <Check className="h-4 w-4" />}
              </div>

              {/* Plan header */}
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={cn(
                    'rounded-lg p-2',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.priceNote}</span>
              </div>

              {/* Features */}
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>

      {/* Plan comparison link */}
      <p className="text-center text-sm text-muted-foreground">
        All plans include LoopAssist AI, parent portal, and core features.{' '}
        <a href="/pricing" target="_blank" className="text-primary hover:underline">
          Compare plans in detail →
        </a>
      </p>
    </div>
  );
}

// Helper to get recommended plan based on org type
export function getRecommendedPlan(orgType: string): 'solo_teacher' | 'academy' | 'agency' {
  switch (orgType) {
    case 'solo_teacher':
      return 'solo_teacher';
    case 'studio':
    case 'academy':
      return 'academy';
    case 'agency':
      return 'agency';
    default:
      return 'academy';
  }
}
