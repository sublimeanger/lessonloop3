import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUrgentActions, UrgentAction } from '@/hooks/useUrgentActions';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function UrgentActionsBar() {
  const { actions, isLoading, hasActions, totalCount } = useUrgentActions();
  const [isDismissed, setIsDismissed] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  if (isLoading || !hasActions || isDismissed) {
    return null;
  }

  const hasErrors = actions.some(a => a.severity === 'error');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3',
            hasErrors
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-warning/30 bg-warning/5'
          )}
        >
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              hasErrors ? 'bg-destructive/10' : 'bg-warning/10'
            )}
          >
            <AlertTriangle
              className={cn(
                'h-4 w-4',
                hasErrors ? 'text-destructive' : 'text-warning'
              )}
            />
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm font-medium">
              {totalCount} {totalCount === 1 ? 'item needs' : 'items need'} attention
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {actions.map((action, index) => (
                <ActionChip key={action.id} action={action} index={index} />
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ActionChip({ action, index }: { action: UrgentAction; index: number }) {
  return (
    <Link
      to={action.href}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors',
        action.severity === 'error'
          ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
          : 'bg-warning/10 text-warning hover:bg-warning/20'
      )}
    >
      <span className="font-medium">{action.count}</span>
      <span>{action.label}</span>
      <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// Compact version for smaller spaces
export function UrgentActionsBadge() {
  const { actions, hasActions, totalCount } = useUrgentActions();

  if (!hasActions) {
    return null;
  }

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
