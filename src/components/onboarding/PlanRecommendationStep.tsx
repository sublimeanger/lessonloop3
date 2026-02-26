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
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold">Choose Your Plan</h1>
        <p className="mt-2 text-muted-foreground">
          Start your {TRIAL_DAYS}-day free trial. No card required.
        </p>
      </div>

      {/* Smart recommendation banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Our Recommendation
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </h3>
            <ul className="mt-1.5 space-y-1">
              {recommendation.reasons.slice(0, 3).map((reason, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                  <Check className="h-3 w-3 shrink-0 text-primary" />
                  {reason}
                </li>
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
        <Button onClick={onNext} size="lg" className="shadow-lg shadow-primary/20">
          Start Free Trial
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
