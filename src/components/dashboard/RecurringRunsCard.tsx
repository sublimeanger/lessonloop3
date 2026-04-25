import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrg } from '@/contexts/OrgContext';
import {
  useRecentPartialOrFailedRuns,
  type RunWithTemplate,
} from '@/hooks/useRecurringTemplateRuns';
import { cn } from '@/lib/utils';

function fmtPeriod(start: string, end: string): string {
  try {
    return `${format(parseISO(start), 'd MMM')} – ${format(parseISO(end), 'd MMM')}`;
  } catch {
    return `${start} – ${end}`;
  }
}

export function RecurringRunsCard() {
  const { currentOrg } = useOrg();
  const { data: runs } = useRecentPartialOrFailedRuns(currentOrg?.id);
  const navigate = useNavigate();

  if (!runs || runs.length === 0) return null;

  const hasFailed = runs.some((r) => r.outcome === 'failed');
  const borderClass = hasFailed
    ? 'border-red-300 dark:border-red-800/60'
    : 'border-amber-300 dark:border-amber-800/60';
  const titleClass = hasFailed
    ? 'text-red-700 dark:text-red-300'
    : 'text-amber-700 dark:text-amber-300';

  return (
    <Card className={cn(borderClass)}>
      <CardHeader className="pb-2">
        <CardTitle className={cn('text-sm flex items-center gap-2', titleClass)}>
          <AlertTriangle className="h-4 w-4" />
          Recurring billing — {runs.length} partial/failed run(s)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {runs.slice(0, 5).map((r: RunWithTemplate) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate(`/settings/recurring-billing/runs/${r.id}`)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 text-left transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {r.template?.name ?? 'Unknown template'}
                  <span className="ml-2 text-xs text-muted-foreground font-normal capitalize">
                    {r.outcome}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtPeriod(r.period_start, r.period_end)}
                  {' · '}
                  {r.recipients_skipped} skipped
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
        {runs.length > 5 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t">
            + {runs.length - 5} more
          </div>
        )}
      </CardContent>
    </Card>
  );
}
