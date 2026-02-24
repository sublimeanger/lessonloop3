import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { useOfferMakeUp, useDismissMatch, useFindMatches, type WaitlistEntry, type WaitlistMatchResult } from '@/hooks/useMakeUpWaitlist';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  isLoading: boolean;
  statusFilter: string | undefined;
  onStatusFilterChange: (v: string | undefined) => void;
  teacherFilter: string | undefined;
  onTeacherFilterChange: (v: string | undefined) => void;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  waiting: 'outline',
  matched: 'default',
  offered: 'secondary',
  accepted: 'secondary',
  booked: 'default',
  expired: 'destructive',
  cancelled: 'destructive',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'd MMM'); } catch { return dateStr; }
}

function waitingSince(dateStr: string | null) {
  if (!dateStr) return '—';
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: false }); } catch { return '—'; }
}

export function WaitlistTable({
  entries, isLoading,
  statusFilter, onStatusFilterChange,
  teacherFilter, onTeacherFilterChange,
}: WaitlistTableProps) {
  const offerMutation = useOfferMakeUp();
  const dismissMutation = useDismissMatch();
  const findMatches = useFindMatches();
  const [matchResults, setMatchResults] = useState<Record<string, WaitlistMatchResult[]>>({});

  const teacherOptions = Array.from(
    new Map(
      entries
        .filter((entry) => entry.teacher?.id && entry.teacher?.display_name)
        .map((entry) => [entry.teacher!.id, entry.teacher!.display_name])
    ).entries()
  );

  const handleFindMatch = async (entry: WaitlistEntry) => {
    const result = await findMatches.mutateAsync({
      lessonId: entry.missed_lesson_id,
      absentStudentId: entry.student_id,
    });
    setMatchResults((prev) => ({ ...prev, [entry.id]: result }));
  };

  function renderAction(entry: WaitlistEntry) {
    switch (entry.status) {
      case 'waiting':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-9"
                onClick={() => handleFindMatch(entry)}
                disabled={findMatches.isPending}
              >
                {findMatches.isPending ? (
                  <span className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Find Match
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <p className="text-sm font-medium mb-2">Match Results</p>
              {matchResults[entry.id] === undefined ? (
                <p className="text-xs text-muted-foreground">Searching for available matches...</p>
              ) : matchResults[entry.id].length === 0 ? (
                <p className="text-xs text-muted-foreground">No matches found. Try again later when new slots open up.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {matchResults[entry.id].map((m: WaitlistMatchResult) => (
                    <div key={m.waitlist_id} className="p-2 rounded border border-border text-xs">
                      <p className="font-medium">{m.student_name}</p>
                      <p className="text-muted-foreground">
                        {m.missed_lesson_title}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-1 capitalize">
                        {m.match_quality.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        );
      case 'matched':
        return (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="min-h-11 sm:min-h-9" onClick={() => offerMutation.mutate(entry.id)} disabled={offerMutation.isPending}>
              Offer
            </Button>
            <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9" onClick={() => dismissMutation.mutate(entry.id)} disabled={dismissMutation.isPending}>
              Dismiss
            </Button>
          </div>
        );
      case 'offered':
        return (
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={() => offerMutation.mutate(entry.id)} disabled={offerMutation.isPending}>
            Resend
          </Button>
        );
      default:
        return <span className="text-xs text-muted-foreground">—</span>;
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Waitlist</CardTitle>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Select
              value={statusFilter ?? 'all'}
              onValueChange={(v) => onStatusFilterChange(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="h-11 w-full text-xs sm:h-8 sm:w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="offered">Offered</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={teacherFilter ?? 'all'}
              onValueChange={(v) => onTeacherFilterChange(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="h-11 w-full text-xs sm:h-8 sm:w-[180px]">
                <SelectValue placeholder="All teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers</SelectItem>
                {teacherOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No waitlist entries found.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Missed Lesson</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waiting</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const studentName = entry.student
                      ? `${entry.student.first_name} ${entry.student.last_name}`
                      : '—';

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{studentName}</TableCell>
                        <TableCell className="text-sm">{entry.lesson_title}</TableCell>
                        <TableCell className="text-sm">{formatDate(entry.missed_lesson_date)}</TableCell>
                        <TableCell className="text-sm capitalize">{entry.absence_reason.replace(/_/g, ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[entry.status] ?? 'outline'} className="text-xs capitalize">
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {waitingSince(entry.created_at)}
                        </TableCell>
                        <TableCell className="text-right"><div className="inline-flex justify-end">{renderAction(entry)}</div></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-border">
              {entries.map((entry) => {
                const studentName = entry.student
                  ? `${entry.student.first_name} ${entry.student.last_name}`
                  : '—';

                return (
                  <div key={entry.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{studentName}</p>
                      <Badge variant={statusVariant[entry.status] ?? 'outline'} className="text-xs capitalize shrink-0">
                        {entry.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.lesson_title} · {formatDate(entry.missed_lesson_date)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">{entry.absence_reason.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-muted-foreground">Waiting {waitingSince(entry.created_at)}</span>
                    </div>
                    <div className="pt-1">{renderAction(entry)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
