import { Bell, ArrowDown, Star, Clock } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOfferMakeUp, useDismissMatch, type WaitlistEntry } from '@/hooks/useMakeUpWaitlist';

interface NeedsActionSectionProps {
  entries: WaitlistEntry[];
  isLoading: boolean;
}

function qualityBadge(quality?: string) {
  switch (quality) {
    default:
      return <Badge variant="outline" className="text-xs">Match</Badge>;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'EEE d MMM yyyy');
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'HH:mm');
  } catch {
    return '';
  }
}

function waitingSince(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: false });
  } catch {
    return '—';
  }
}

export function NeedsActionSection({ entries, isLoading }: NeedsActionSectionProps) {
  const offerMutation = useOfferMakeUp();
  const dismissMutation = useDismissMatch();

  if (isLoading) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-warning" />
          Needs Action
          <Badge variant="secondary" className="ml-1">{entries.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry) => {
          const studentName = entry.student
            ? `${entry.student.first_name} ${entry.student.last_name}`
            : 'Unknown Student';

          return (
            <div key={entry.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              {/* Match info */}
              <div className="space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      🔔 Match Found
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">{studentName}</span> missed "{entry.lesson_title}" on {formatDate(entry.missed_lesson_date)} ({entry.absence_reason.replace(/_/g, ' ')})
                    </p>
                  </div>
                  {qualityBadge()}
                </div>

                <div className="flex items-center gap-1 text-muted-foreground my-1">
                  <ArrowDown className="h-3 w-3" />
                  <span className="text-xs">can take</span>
                </div>

                {entry.matched_lesson ? (
                  <p className="text-sm text-foreground">
                    Open slot: "{entry.matched_lesson.title}" on {formatDate(entry.matched_lesson.start_at)} at {formatTime(entry.matched_lesson.start_at)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Matched lesson details not available</p>
                )}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Waiting: {waitingSince(entry.created_at)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => offerMutation.mutate(entry.id)}
                  disabled={offerMutation.isPending}
                >
                  Offer to Parent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dismissMutation.mutate(entry.id)}
                  disabled={dismissMutation.isPending}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
