import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PortalErrorStateProps {
  onRetry?: () => void;
  message?: string;
}

export function PortalErrorState({
  onRetry,
  message = "We couldn't load this page. Please try again.",
}: PortalErrorStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive/40" />
        <h3 className="mt-4 text-lg font-medium">Something went wrong</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} className="mt-4" variant="outline">
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
