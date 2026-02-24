import { useState } from 'react';
import { Bell, ArrowDown, Star, Clock } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  const [confirmEntry, setConfirmEntry] = useState<WaitlistEntry | null>(null);

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
                <div className="flex flex-wrap items-start justify-between gap-2">
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
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button
                  size="sm"
                  className="min-h-11 sm:min-h-9"
                  onClick={() => setConfirmEntry(entry)}
                  disabled={offerMutation.isPending}
                >
                  Offer to Parent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 sm:min-h-9"
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

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmEntry} onOpenChange={(open) => !open && setConfirmEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Make-Up Offer?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {confirmEntry && (
                  <>
                    <p>
                      This will email the parent to offer a make-up slot for{' '}
                      <span className="font-medium text-foreground">
                        {confirmEntry.student
                          ? `${confirmEntry.student.first_name} ${confirmEntry.student.last_name}`
                          : 'Unknown Student'}
                      </span>.
                    </p>
                    {confirmEntry.matched_lesson && (
                      <p>
                        Slot: <span className="font-medium text-foreground">{confirmEntry.matched_lesson.title}</span> on{' '}
                        {formatDate(confirmEntry.matched_lesson.start_at)} at {formatTime(confirmEntry.matched_lesson.start_at)}
                      </p>
                    )}
                    {confirmEntry.guardian && (
                      <p>
                        Guardian: <span className="font-medium text-foreground">{confirmEntry.guardian.full_name}</span>
                        {confirmEntry.guardian.email && ` (${confirmEntry.guardian.email})`}
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmEntry) {
                  offerMutation.mutate(confirmEntry.id);
                  setConfirmEntry(null);
                }
              }}
            >
              Send Offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
