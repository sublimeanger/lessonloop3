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
import { useOfferMakeUp, useDismissMatch, useFindMatches, type WaitlistEntry } from '@/hooks/useMakeUpWaitlist';
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
  const [matchResults, setMatchResults] = useState<Record<string, any[]>>({});

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
                onClick={() => handleFindMatch(entry)}
                disabled={findMatches.isPending}
              >
                <Search className="h-3 w-3 mr-1" />
                Find Match
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <p className="text-sm font-medium mb-2">Match Results</p>
              {(matchResults[entry.id]?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">No matches found yet. Click "Find Match" again or check later.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {matchResults[entry.id]?.map((m: any) => (
                    <div key={m.waitlist_id} className="p-2 rounded border border-border text-xs">
                      <p className="font-medium">{m.student_name}</p>
                      <p className="text-muted-foreground">
                        {m.missed_lesson_title} — {m.match_quality}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        );
      case 'matched':
        return (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => offerMutation.mutate(entry.id)} disabled={offerMutation.isPending}>
              Offer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => dismissMutation.mutate(entry.id)} disabled={dismissMutation.isPending}>
              Dismiss
            </Button>
          </div>
        );
      case 'offered':
        return (
          <Button variant="outline" size="sm" onClick={() => offerMutation.mutate(entry.id)} disabled={offerMutation.isPending}>
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
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter ?? 'all'}
              onValueChange={(v) => onStatusFilterChange(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
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
          <div className="overflow-x-auto">
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
                      <TableCell className="text-right">{renderAction(entry)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
