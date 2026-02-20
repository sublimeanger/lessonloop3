import { CalendarDays, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WeeklyActivityProps {
  lessonsThisWeek: number;
  hoursThisWeek: number;
  className?: string;
}

export function WeeklyActivity({ lessonsThisWeek, hoursThisWeek, className }: WeeklyActivityProps) {
  return (
    <div className={cn('', className)}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">This Week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{lessonsThisWeek}</p>
              <p className="text-xs text-muted-foreground">
                {lessonsThisWeek === 1 ? 'lesson' : 'lessons'} scheduled
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/50">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{hoursThisWeek.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">
                {hoursThisWeek === 1 ? 'hour' : 'hours'} taught
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
