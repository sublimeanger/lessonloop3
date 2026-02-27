import { AlertTriangle, CircleAlert, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProactiveAlerts, ProactiveAlert } from '@/hooks/useProactiveAlerts';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useBannerDismissals } from '@/hooks/useBannerDismissals';
import { cn } from '@/lib/utils';

export function LoopAssistAlerts() {
  const { alerts } = useProactiveAlerts();
  const { openDrawerWithMessage } = useLoopAssistUI();
  const { isDismissed, dismissPermanently } = useBannerDismissals();

  const actionableAlerts = alerts
    .filter(a => a.severity === 'urgent' || a.severity === 'warning')
    .filter(a => !isDismissed(a.dismissalKey ?? a.type))
    .slice(0, 2);

  if (actionableAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {actionableAlerts.map((alert) => (
        <AlertRow
          key={alert.dismissalKey ?? alert.type}
          alert={alert}
          onAction={() => {
            if (alert.suggestedAction) {
              dismissPermanently(alert.dismissalKey ?? alert.type);
              openDrawerWithMessage(alert.suggestedAction);
            }
          }}
          onDismiss={() => dismissPermanently(alert.dismissalKey ?? alert.type)}
        />
      ))}
    </div>
  );
}

function AlertRow({
  alert,
  onAction,
  onDismiss,
}: {
  alert: ProactiveAlert;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const isUrgent = alert.severity === 'urgent';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2',
        isUrgent
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-warning/30 bg-warning/5'
      )}
    >
      {isUrgent ? (
        <CircleAlert className="h-4 w-4 text-destructive shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
      )}

      <span className="flex-1 text-body text-foreground truncate">{alert.message}</span>

      {alert.suggestedAction && (
        <Button
          variant="ghost"
          size="sm"
          className="h-11 gap-1 px-3 text-body shrink-0"
          onClick={onAction}
        >
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">{alert.suggestedAction}</span>
          <span className="sm:hidden">Fix</span>
        </Button>
      )}

      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
