import { AlertCircle, AlertTriangle, Clock, Calendar, HelpCircle, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProactiveAlert } from '@/hooks/useProactiveAlerts';

interface ProactiveAlertsProps {
  alerts: ProactiveAlert[];
  onSuggestedAction: (prompt: string) => void;
}

export function ProactiveAlerts({ alerts, onSuggestedAction }: ProactiveAlertsProps) {
  if (alerts.length === 0) return null;

  const getIcon = (type: ProactiveAlert['type']) => {
    switch (type) {
      case 'unmarked_reason':
        return HelpCircle;
      case 'makeup_match':
        return Repeat;
      case 'cancellation':
        return AlertTriangle;
      case 'upcoming':
        return Calendar;
      case 'churn_risk':
        return AlertCircle;
      case 'practice_drop':
        return Clock;
      default:
        return Clock;
    }
  };

  const getSeverityStyles = (severity: ProactiveAlert['severity']) => {
    switch (severity) {
      case 'urgent':
        return 'border-destructive/50 bg-destructive/5';
      case 'warning':
        return 'border-warning/50 bg-warning/5';
      default:
        return 'border-primary/30 bg-primary/5';
    }
  };

  const getIconStyles = (severity: ProactiveAlert['severity']) => {
    switch (severity) {
      case 'urgent':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      default:
        return 'text-primary';
    }
  };

  const getActionPrompt = (alert: ProactiveAlert): string => {
    switch (alert.type) {
      case 'unmarked_reason':
        return 'Show me recent absences that are missing a reason';
      case 'makeup_match':
        return 'Show me make-up lesson matches that need action';
      case 'cancellation':
        return 'Show me cancelled lessons this week';
      case 'upcoming':
        return 'What lessons do I have today?';
      case 'churn_risk':
        return 'Which students are at risk of leaving? Show me their attendance and invoice status.';
      case 'practice_drop':
        return 'Which students haven\'t practised recently? Draft encouragement messages for their parents.';
      default:
        return alert.suggestedAction || '';
    }
  };

  return (
    <div className="space-y-2 mb-4">
      <p className="text-xs text-muted-foreground font-medium px-1">Needs attention</p>
      {alerts.slice(0, 3).map((alert, index) => {
        const Icon = getIcon(alert.type);
        const prompt = getActionPrompt(alert);
        
        return (
          <div
            key={`${alert.type}-${index}`}
            className={cn(
              'rounded-lg border p-3 transition-colors',
              getSeverityStyles(alert.severity)
            )}
          >
            <div className="flex items-start gap-2">
              <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', getIconStyles(alert.severity))} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.message}</p>
                {alert.suggestedAction && prompt && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => onSuggestedAction(prompt)}
                  >
                    {alert.suggestedAction} →
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
