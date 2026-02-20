import { useState } from 'react';
import { AlertTriangle, CircleAlert, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProactiveAlerts, ProactiveAlert } from '@/hooks/useProactiveAlerts';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'll_alerts_dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function setDismissed(set: Set<string>) {
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
}

export function LoopAssistAlerts() {
  const { alerts } = useProactiveAlerts();
  const { openDrawerWithMessage } = useLoopAssistUI();
  const [dismissed, setDismissedState] = useState(getDismissed);

  const actionableAlerts = alerts
    .filter(a => a.severity === 'urgent' || a.severity === 'warning')
    .filter(a => !dismissed.has(a.type))
    .slice(0, 2);

  if (actionableAlerts.length === 0) return null;

  const dismiss = (type: string) => {
    const next = new Set(dismissed);
    next.add(type);
    setDismissed(next);
    setDismissedState(next);
  };

  return (
    <div className="space-y-2">
      {actionableAlerts.map((alert) => (
        <AlertRow
          key={alert.type}
          alert={alert}
          onAction={() => {
            if (alert.suggestedAction) {
              openDrawerWithMessage(alert.suggestedAction);
            }
          }}
          onDismiss={() => dismiss(alert.type)}
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
        'flex items-center gap-2 rounded-lg border px-3 py-2',
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

      <span className="flex-1 text-sm text-foreground truncate">{alert.message}</span>

      {alert.suggestedAction && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs shrink-0"
          onClick={onAction}
        >
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">{alert.suggestedAction}</span>
          <span className="sm:hidden">Fix</span>
        </Button>
      )}

      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
