import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Step {
  id: number | string;
  title?: string;
  label?: string;
}

interface OnboardingProgressProps {
  steps: Step[];
  currentStep: number;
}

export function OnboardingProgress({ steps, currentStep }: OnboardingProgressProps) {
  // Normalize steps to have consistent index-based comparison
  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    stepIndex: index,
    displayTitle: step.title || step.label || `Step ${index + 1}`,
  }));

  return (
    <div className="w-full mb-8">
      {/* Mobile: Simple dots */}
      <div className="flex justify-center gap-2 md:hidden">
        {normalizedSteps.map((step) => (
          <motion.div
            key={step.stepIndex}
            initial={{ scale: 0.8 }}
            animate={{ 
              scale: step.stepIndex === currentStep ? 1.2 : 1,
              opacity: step.stepIndex <= currentStep ? 1 : 0.4 
            }}
            className={`h-2 w-2 rounded-full transition-colors ${
              step.stepIndex < currentStep 
                ? 'bg-success' 
                : step.stepIndex === currentStep 
                  ? 'bg-primary' 
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Desktop: Full progress with labels */}
      <div className="hidden md:flex items-center justify-center gap-2">
        {normalizedSteps.map((step, index) => (
          <div key={step.stepIndex} className="flex items-center">
            {/* Step circle */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-all ${
                step.stepIndex < currentStep
                  ? 'bg-success text-success-foreground'
                  : step.stepIndex === currentStep
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.stepIndex < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                step.stepIndex + 1
              )}
            </motion.div>

            {/* Step label */}
            <span className={`ml-2 text-sm font-medium transition-colors ${
              step.stepIndex === currentStep 
                ? 'text-foreground' 
                : step.stepIndex < currentStep 
                  ? 'text-success' 
                  : 'text-muted-foreground'
            }`}>
              {step.displayTitle}
            </span>

            {/* Connector line */}
            {index < normalizedSteps.length - 1 && (
              <div className="mx-4 h-0.5 w-8 bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: step.stepIndex < currentStep ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-success"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
