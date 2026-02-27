import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import { useEnrolmentWaitlistStats, useEnrolmentWaitlistByInstrument } from '@/hooks/useEnrolmentWaitlist';

export function WaitlistDashboardWidget() {
  const { data: stats } = useEnrolmentWaitlistStats();
  const { data: byInstrument } = useEnrolmentWaitlistByInstrument();

  const totalActive = (stats?.waiting ?? 0) + (stats?.offered ?? 0);

  // Don't show if no one is on the list
  if (totalActive === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <Link
          to="/waitlist"
          className="group flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-blue-500/10 p-2 shrink-0">
              <ClipboardCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Waiting List</p>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {totalActive}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.waiting ?? 0} waiting
                {(stats?.offered ?? 0) > 0 && ` · ${stats?.offered} offered`}
              </p>
              {byInstrument && byInstrument.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {byInstrument.slice(0, 4).map((item) => (
                    <Badge key={item.instrument_name} variant="outline" className="text-[10px] px-1.5 py-0">
                      {item.instrument_name} ({item.waiting_count + item.offered_count})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
        </Link>
      </CardContent>
    </Card>
  );
}
