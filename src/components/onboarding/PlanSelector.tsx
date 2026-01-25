import { motion } from 'framer-motion';
import { Check, Sparkles, Users, Building2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubscriptionPlan = 'solo_teacher' | 'academy' | 'agency';

interface PlanOption {
  value: SubscriptionPlan;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  icon: React.ElementType;
  features: string[];
  highlighted?: boolean;
  recommended?: boolean;
}

const PLANS: PlanOption[] = [
  {
    value: 'solo_teacher',
    name: 'Solo Teacher',
    tagline: 'Perfect for independent music teachers',
    price: '£9',
    priceNote: '/month',
    icon: Users,
    features: [
      'Up to 30 students',
      'Unlimited lessons',
      'Invoicing & payments',
      'Parent portal',
      'Practice tracking',
    ],
  },
  {
    value: 'academy',
    name: 'Academy',
    tagline: 'For studios and music schools',
    price: '£29',
    priceNote: '/month',
    icon: Building2,
    highlighted: true,
    recommended: true,
    features: [
      'Up to 150 students',
      'Up to 10 teachers',
      'Multi-location support',
      'LoopAssist AI copilot',
      'Advanced reporting',
      'Custom branding',
    ],
  },
  {
    value: 'agency',
    name: 'Agency',
    tagline: 'For teaching agencies at scale',
    price: '£79',
    priceNote: '/month',
    icon: Crown,
    features: [
      'Unlimited students',
      'Unlimited teachers',
      'Payroll management',
      'White-label portal',
      'Priority support',
      'API access',
    ],
  },
];

interface PlanSelectorProps {
  selectedPlan: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  recommendedPlan?: SubscriptionPlan;
}

export function PlanSelector({ selectedPlan, onSelectPlan, recommendedPlan }: PlanSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Trial banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
      >
        <Sparkles className="h-4 w-4" />
        <span>14-day free trial • No credit card required</span>
      </motion.div>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan, index) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.value;
          const isRecommended = recommendedPlan === plan.value || plan.recommended;

          return (
            <motion.button
              key={plan.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              type="button"
              onClick={() => onSelectPlan(plan.value)}
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
        All plans include core scheduling, billing, and parent portal features.{' '}
        <a href="/pricing" target="_blank" className="text-primary hover:underline">
          Compare plans in detail →
        </a>
      </p>
    </div>
  );
}

// Helper to get recommended plan based on org type
export function getRecommendedPlan(orgType: string): SubscriptionPlan {
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
