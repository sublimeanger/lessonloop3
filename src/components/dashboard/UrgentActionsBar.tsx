import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUrgentActions, UrgentAction } from '@/hooks/useUrgentActions';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const DISMISS_KEY = 'urgent_actions_dismissed';

function getIsDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function setDismissedStorage(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, 'true');
  } catch {}
}

export function UrgentActionsBar() {
  const { actions, isLoading, hasActions, totalCount } = useUrgentActions();
  const [isDismissed, setIsDismissed] = useState(() => getIsDismissed());

  const handleDismiss = () => {
    setIsDismissed(true);
    setDismissedStorage();
  };

  if (isLoading || !hasActions || isDismissed) return null;

  const summaryParts = actions.map(
    (a) => `${a.count} ${a.label.toLowerCase()}`
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
          <div className="flex-1 min-w-0">
            <span className="text-sm text-warning-foreground">
              {summaryParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1 text-warning/50">·</span>}
                  <Link
                    to={actions[i].href}
                    className="hover:underline underline-offset-2"
                  >
                    {part}
                  </Link>
                </span>
              ))}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-warning hover:text-warning-foreground hover:bg-warning/20"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Compact version for smaller spaces
export function UrgentActionsBadge() {
  const { actions, hasActions, totalCount } = useUrgentActions();

  if (!hasActions) return null;

  const hasErrors = actions.some(a => a.severity === 'error');

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white',
        hasErrors ? 'bg-destructive' : 'bg-warning'
      )}
    >
      {totalCount}
    </span>
  );
}
