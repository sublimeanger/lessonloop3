import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, AlertTriangle, ChevronRight } from 'lucide-react';
import { useContinuationRuns } from '@/hooks/useTermContinuation';
import { useOrg } from '@/contexts/OrgContext';

/**
 * Dashboard widget showing active continuation run status,
 * or a prompt if the current term is ending soon with no run created.
 */
export function ContinuationWidget() {
  const { currentOrg } = useOrg();
  const { data: runs = [] } = useContinuationRuns();

  if (!currentOrg) return null;

  // Find active run (not completed)
  const activeRun = runs.find(
    (r) => r.status !== 'completed'
  );

  if (!activeRun) {
    // No active run — don't show anything
    return null;
  }

  const summary = activeRun.summary as Record<string, number> | null;
  const continuing = (summary?.continuing ?? 0) + (summary?.assumed_continuing ?? 0);
  const total = summary?.total ?? 0;
  const pending = summary?.pending ?? 0;
  const withdrawing = summary?.withdrawing ?? 0;
  const pct = total > 0 ? Math.round((continuing / total) * 100) : 0;

  const nextTermName =
    (activeRun as any).next_term?.name || 'Next Term';

  return (
    <Link to="/continuation" className="block">
      <Card data-interactive className="rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  Term Continuation
                </p>
                <p className="text-xs text-muted-foreground">
                  {continuing}/{total} confirmed for {nextTermName}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-2" />
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                {continuing > 0 && (
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${(continuing / total) * 100}%` }}
                  />
                )}
                {withdrawing > 0 && (
                  <div
                    className="bg-destructive transition-all"
                    style={{ width: `${(withdrawing / total) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{pct}% confirmed</span>
                {pending > 0 && (
                  <Badge variant="secondary" className="text-micro">
                    {pending} pending
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
