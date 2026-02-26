import { Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface NativePaymentNoticeProps {
  message?: string;
  className?: string;
  variant?: 'card' | 'inline';
}

/**
 * Shows a notice directing users to the website for payment/subscription management.
 * Used when running inside the native Capacitor app (iOS) where Apple prohibits
 * external payment processing UI.
 */
export function NativePaymentNotice({
  message = 'To manage your subscription, please visit lessonloop.net in your browser.',
  className,
  variant = 'card',
}: NativePaymentNoticeProps) {
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3',
          className
        )}
      >
        <Info className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Info className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
