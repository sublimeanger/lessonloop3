import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { useOrg } from '@/contexts/OrgContext';
import {
  useRecentPartialOrFailedRuns,
  type RunWithTemplate,
} from '@/hooks/useRecurringTemplateRuns';

function fmtPeriod(start: string, end: string): string {
  try {
    return `${format(parseISO(start), 'd MMM')} – ${format(parseISO(end), 'd MMM')}`;
  } catch {
    return `${start} – ${end}`;
  }
}

export function RecurringFailuresBanner() {
  const { currentOrg } = useOrg();
  const { data: runs } = useRecentPartialOrFailedRuns(currentOrg?.id);
  const navigate = useNavigate();

  if (!runs || runs.length === 0) return null;

  return (
    <Card className="border-destructive/60 bg-destructive/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="font-medium text-sm">
              Recurring billing — {runs.length} partial/failed run(s) in the last 14 days
            </p>
            <div className="divide-y">
              {runs.slice(0, 3).map((r: RunWithTemplate) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    navigate(`/settings/recurring-billing/runs/${r.id}`)
                  }
                  className="w-full flex items-center justify-between py-2 text-left hover:bg-background/40 rounded px-2 -mx-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {r.template?.name ?? 'Unknown template'}
                      <span className="ml-2 text-xs text-muted-foreground font-normal capitalize">
                        {r.outcome}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtPeriod(r.period_start, r.period_end)} ·{' '}
                      {r.recipients_skipped} skipped
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            {runs.length > 3 && (
              <p className="text-xs text-muted-foreground">
                + {runs.length - 3} more
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
