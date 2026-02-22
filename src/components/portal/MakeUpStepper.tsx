import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'matched', label: 'Matched' },
  { key: 'offered', label: 'Offered' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'booked', label: 'Booked' },
] as const;

interface MakeUpStepperProps {
  status: string;
}

export function MakeUpStepper({ status }: MakeUpStepperProps) {
  const activeIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-0.5 w-full" role="progressbar" aria-valuenow={activeIndex + 1} aria-valuemax={STEPS.length}>
      {STEPS.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;

        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-1 last:flex-initial">
            {/* Step dot */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors shrink-0',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isActive && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  !isCompleted && !isActive && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-[10px] leading-tight text-center whitespace-nowrap',
                  isActive ? 'font-semibold text-primary' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 rounded-full mb-4',
                  i < activeIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
