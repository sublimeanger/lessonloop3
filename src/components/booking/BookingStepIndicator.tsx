import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  key: string;
}

interface BookingStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  accentColor?: string;
}

export function BookingStepIndicator({ steps, currentStep, accentColor }: BookingStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 py-4" role="navigation" aria-label="Booking progress">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.key} className="flex items-center gap-1">
            {/* Dot / Check */}
            <div
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-300',
                isCurrent
                  ? 'h-3 w-3 ring-4 ring-opacity-20'
                  : isCompleted
                    ? 'h-3 w-3'
                    : 'h-2.5 w-2.5',
              )}
              style={{
                backgroundColor: isCurrent || isCompleted
                  ? accentColor || 'hsl(var(--primary))'
                  : 'hsl(var(--muted-foreground) / 0.25)',
                ringColor: isCurrent ? (accentColor || 'hsl(var(--primary))') : undefined,
                boxShadow: isCurrent
                  ? `0 0 0 4px ${accentColor || 'hsl(var(--primary))'}33`
                  : undefined,
              }}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Step ${index + 1}: ${step.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
            >
              {isCompleted && (
                <Check className="h-2 w-2 text-white" strokeWidth={3} />
              )}
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-4 sm:w-6 rounded-full transition-all duration-300',
                )}
                style={{
                  backgroundColor: index < currentStep
                    ? accentColor || 'hsl(var(--primary))'
                    : 'hsl(var(--muted-foreground) / 0.2)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
