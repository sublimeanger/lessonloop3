import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface BookingSummary {
  instrumentName?: string;
  teacherName?: string;
  date?: string;
  time?: string;
  parentName?: string;
  email?: string;
}

interface BookingConfirmationProps {
  summary: BookingSummary;
  confirmationMessage?: string | null;
  accentColor?: string;
}

export function BookingConfirmation({
  summary,
  confirmationMessage,
  accentColor,
}: BookingConfirmationProps) {
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimationPhase(1), 100);
    const t2 = setTimeout(() => setAnimationPhase(2), 500);
    const t3 = setTimeout(() => setAnimationPhase(3), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const accent = accentColor || 'hsl(var(--primary))';

  return (
    <div className="flex flex-col items-center text-center px-4 py-6">
      {/* Animated checkmark circle */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-500 ease-out',
          animationPhase >= 1 ? 'h-20 w-20 opacity-100 scale-100' : 'h-12 w-12 opacity-0 scale-50',
        )}
        style={{
          backgroundColor: `${accent}15`,
          boxShadow: animationPhase >= 2 ? `0 0 0 8px ${accent}10` : undefined,
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-full transition-all duration-300 delay-200',
            animationPhase >= 1 ? 'h-14 w-14 opacity-100' : 'h-8 w-8 opacity-0',
          )}
          style={{ backgroundColor: accent }}
        >
          <Check
            className={cn(
              'text-white transition-all duration-300 delay-300',
              animationPhase >= 2 ? 'h-7 w-7 opacity-100' : 'h-0 w-0 opacity-0',
            )}
            strokeWidth={3}
          />
        </div>
      </div>

      {/* Heading */}
      <h2
        className={cn(
          'text-xl font-semibold mt-6 transition-all duration-500 delay-500',
          animationPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        )}
      >
        Booking Request Received!
      </h2>

      {/* Message */}
      <p
        className={cn(
          'text-muted-foreground mt-2 max-w-sm transition-all duration-500 delay-700',
          animationPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        )}
      >
        {confirmationMessage || "Thank you for your booking request. We'll review it and confirm your lesson shortly."}
      </p>

      {/* Summary card */}
      <div
        className={cn(
          'mt-6 w-full max-w-sm rounded-xl border bg-card p-4 text-left transition-all duration-500 delay-[900ms]',
          animationPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Booking Summary</h3>
        <dl className="space-y-2 text-sm">
          {summary.instrumentName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Instrument</dt>
              <dd className="font-medium">{summary.instrumentName}</dd>
            </div>
          )}
          {summary.teacherName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Teacher</dt>
              <dd className="font-medium">{summary.teacherName}</dd>
            </div>
          )}
          {summary.date && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-medium">{summary.date}</dd>
            </div>
          )}
          {summary.time && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Time</dt>
              <dd className="font-medium">{summary.time}</dd>
            </div>
          )}
          {summary.parentName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{summary.parentName}</dd>
            </div>
          )}
          {summary.email && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium truncate ml-4">{summary.email}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Footer */}
      <p
        className={cn(
          'text-xs text-muted-foreground mt-6 transition-all duration-500 delay-[1100ms]',
          animationPhase >= 3 ? 'opacity-100' : 'opacity-0',
        )}
      >
        The team will confirm your booking shortly.
      </p>
    </div>
  );
}
