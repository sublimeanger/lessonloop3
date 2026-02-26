import { motion } from 'framer-motion';
import { Check, User, Music2, FolderInput, CreditCard } from 'lucide-react';

interface Step {
  id: number | string;
  title?: string;
  label?: string;
}

interface OnboardingProgressProps {
  steps: Step[];
  currentStep: number;
}

const STEP_ICONS = [User, Music2, FolderInput, CreditCard];

export function OnboardingProgress({ steps, currentStep }: OnboardingProgressProps) {
  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    stepIndex: index,
    displayTitle: step.title || step.label || `Step ${index + 1}`,
  }));

  const totalSteps = normalizedSteps.length;
  const progressPercent = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="w-full mb-6 sm:mb-8" role="navigation" aria-label="Onboarding progress">
      {/* Mobile: Animated progress bar with step count */}
      <div className="md:hidden space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <motion.span
            key={normalizedSteps[currentStep]?.displayTitle}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-xs font-semibold text-foreground"
          >
            {normalizedSteps[currentStep]?.displayTitle}
          </motion.span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* Desktop: Full stepper with icons and connector lines */}
      <div className="hidden md:flex items-center justify-center">
        {normalizedSteps.map((step, index) => {
          const isCompleted = step.stepIndex < currentStep;
          const isCurrent = step.stepIndex === currentStep;
          const Icon = STEP_ICONS[index] || User;

          return (
            <div key={step.stepIndex} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                {/* Step circle */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: isCurrent ? 1.05 : 1,
                    opacity: 1,
                  }}
                  transition={{
                    delay: index * 0.08,
                    type: 'spring',
                    stiffness: 300,
                    damping: 22,
                  }}
                  className={`
                    flex items-center justify-center h-10 w-10 rounded-full text-sm font-medium
                    transition-all duration-300
                    ${isCompleted
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground shadow-elevated ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                    }
                  `}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Check className="h-4.5 w-4.5" />
                    </motion.div>
                  ) : (
                    <Icon className="h-4.5 w-4.5" />
                  )}
                </motion.div>

                {/* Step label */}
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.08 + 0.1 }}
                  className={`text-xs font-medium transition-colors duration-200 ${
                    isCurrent
                      ? 'text-foreground font-semibold'
                      : isCompleted
                        ? 'text-primary'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step.displayTitle}
                </motion.span>
              </div>

              {/* Connector line */}
              {index < normalizedSteps.length - 1 && (
                <div className="relative mx-4 h-0.5 w-14 bg-muted overflow-hidden rounded-full mt-[-20px]">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: isCompleted ? '100%' : isCurrent ? '50%' : '0%',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 100,
                      damping: 20,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
