import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Check, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanSelector } from './PlanSelector';
import { getSmartRecommendation } from '@/lib/plan-recommendation';
import { TRIAL_DAYS } from '@/lib/pricing-config';
import type { OrgType, SubscriptionPlan, MigrationChoice } from '@/hooks/useOnboardingState';

interface PlanRecommendationStepProps {
  orgType: OrgType;
  teamSize: string;
  locationCount: string;
  studentCount: string;
  migrationChoice: MigrationChoice | null;
  selectedPlan: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PlanRecommendationStep({
  orgType, teamSize, locationCount, studentCount, migrationChoice,
  selectedPlan, onSelectPlan, onNext, onBack,
}: PlanRecommendationStepProps) {
  const recommendation = useMemo(() => {
    return getSmartRecommendation({
      orgType,
      teamSize: teamSize || undefined,
      locationCount: locationCount || undefined,
      studentCount: studentCount || undefined,
      isSwitching: migrationChoice === 'switching',
    });
  }, [orgType, teamSize, locationCount, studentCount, migrationChoice]);

  return (
    <motion.div
      key="plan"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-8 sm:mb-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Start your {TRIAL_DAYS}-day free trial. No card required.
        </p>
      </div>

      {/* Smart recommendation banner */}
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mb-6 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/10">
            <Lightbulb className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Our Recommendation
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </h3>
            <ul className="mt-2 space-y-1.5">
              {recommendation.reasons.slice(0, 3).map((reason, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                  {reason}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Plan cards */}
      <PlanSelector
        selectedPlan={selectedPlan}
        onSelectPlan={onSelectPlan}
        recommendedPlan={recommendation.plan}
      />

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          size="lg"
          className="min-w-[170px] gradient-accent shadow-glow-teal hover:opacity-90 transition-opacity"
        >
          Start Free Trial
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
