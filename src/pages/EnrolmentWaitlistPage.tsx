import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/EmptyState';
import { AddToWaitlistDialog } from '@/components/waitlist/AddToWaitlistDialog';
import { OfferSlotDialog } from '@/components/waitlist/OfferSlotDialog';
import { WaitlistEntryDetail } from '@/components/waitlist/WaitlistEntryDetail';
import {
  useEnrolmentWaitlist,
  useEnrolmentWaitlistStats,
  useWithdrawFromWaitlist,
  type WaitlistFilters,
  type WaitlistStatus,
  type EnrolmentWaitlistEntry,
} from '@/hooks/useEnrolmentWaitlist';
import { useInstruments } from '@/hooks/useInstruments';
import { useTeachers } from '@/hooks/useTeachers';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Send,
  Pencil,
  UserMinus,
  Eye,
  Clock,
  Users,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  waiting: 'Waiting',
  offered: 'Offered',
  accepted: 'Accepted',
  enrolled: 'Enrolled',
  declined: 'Declined',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
  lost: 'Lost',
};

const STATUS_COLORS: Record<WaitlistStatus, string> = {
  waiting: 'bg-blue-100 text-blue-800',
  offered: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  enrolled: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-600',
  withdrawn: 'bg-gray-100 text-gray-600',
  lost: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  normal: '',
  high: 'bg-amber-50 border-l-2 border-l-amber-400',
  urgent: 'bg-red-50 border-l-2 border-l-red-400',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EnrolmentWaitlistPage() {
  usePageMeta('Waiting List | LessonLoop', 'Manage the enrolment waiting list');
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [instrumentFilter, setInstrumentFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');

  // Dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [offerEntry, setOfferEntry] = useState<EnrolmentWaitlistEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<EnrolmentWaitlistEntry | null>(null);

  // Data
  const { data: instruments } = useInstruments();
  const { data: teachers } = useTeachers();
  const withdrawMutation = useWithdrawFromWaitlist();

  const filters = useMemo((): WaitlistFilters => ({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter as WaitlistStatus | 'active' : undefined,
    instrument_id: instrumentFilter !== 'all' ? instrumentFilter : undefined,
    teacher_id: teacherFilter !== 'all' ? teacherFilter : undefined,
  }), [search, statusFilter, instrumentFilter, teacherFilter]);

  const { data: entries = [], isLoading } = useEnrolmentWaitlist(filters);
  const { data: stats } = useEnrolmentWaitlistStats();

  const handleWithdraw = (id: string) => {
    if (window.confirm('Withdraw this family from the waiting list?')) {
      withdrawMutation.mutate(id);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <PageHeader
        title="Waiting List"
        description={`${stats?.total ?? 0} active entr${(stats?.total ?? 0) !== 1 ? 'ies' : 'y'} on the waiting list`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Waiting List' },
        ]}
        actions={
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add to Waiting List
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4 sm:gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.waiting ?? 0}</p>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Send className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.offered ?? 0}</p>
              <p className="text-xs text-muted-foreground">Offered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.accepted ?? 0}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.enrolled_this_term ?? 0}</p>
              <p className="text-xs text-muted-foreground">Enrolled (term)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search families..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="offered">Offered</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="enrolled">Enrolled</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select value={instrumentFilter} onValueChange={setInstrumentFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Instrument" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All instruments</SelectItem>
            {instruments?.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={teacherFilter} onValueChange={setTeacherFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Teacher" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teachers</SelectItem>
            {teachers?.filter((t) => t.status === 'active').map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No families on the waiting list"
          description="Add a family to start tracking interest for available lesson slots."
          action={
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add to Waiting List
            </Button>
          }
        />
      ) : isMobile ? (
        /* Mobile: card list */
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className={cn('cursor-pointer', PRIORITY_COLORS[entry.priority])}
              onClick={() => setDetailEntry(entry)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">#{entry.position}</span>
                      <p className="font-medium truncate">
                        {entry.child_first_name} {entry.child_last_name || ''}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.instrument_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.contact_name}
                      {entry.preferred_days?.length
                        ? ` · ${entry.preferred_days.map((d) => d.slice(0, 3)).join(', ')}`
                        : ''}
                    </p>
                  </div>
                  <Badge className={cn('shrink-0', STATUS_COLORS[entry.status])}>
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Added {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop: table */
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Child</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Preferences</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Wait Time</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={cn('cursor-pointer', PRIORITY_COLORS[entry.priority])}
                  onClick={() => setDetailEntry(entry)}
                >
                  <TableCell className="font-mono text-muted-foreground">
                    {entry.position}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {entry.child_first_name} {entry.child_last_name || ''}
                      </p>
                      {entry.priority !== 'normal' && (
                        <Badge variant="outline" className={cn(
                          'text-[10px] mt-0.5',
                          entry.priority === 'urgent' ? 'border-red-400 text-red-600' : 'border-amber-400 text-amber-600'
                        )}>
                          {entry.priority}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{entry.instrument_name}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {entry.lesson_duration_mins} mins
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{entry.contact_name}</p>
                    {entry.contact_email && (
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {entry.contact_email}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {entry.preferred_days?.length ? (
                        <p>{entry.preferred_days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}</p>
                      ) : null}
                      {entry.preferred_time_earliest && entry.preferred_time_latest && (
                        <p>{entry.preferred_time_earliest}–{entry.preferred_time_latest}</p>
                      )}
                      {entry.teacher?.display_name && (
                        <p>{entry.teacher.display_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(STATUS_COLORS[entry.status])}>
                      {STATUS_LABELS[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {entry.status === 'waiting' && (
                          <DropdownMenuItem onClick={() => setOfferEntry(entry)}>
                            <Send className="mr-2 h-4 w-4" /> Offer Slot
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setDetailEntry(entry)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        {['waiting', 'offered'].includes(entry.status) && (
                          <DropdownMenuItem
                            onClick={() => handleWithdraw(entry.id)}
                            className="text-destructive"
                          >
                            <UserMinus className="mr-2 h-4 w-4" /> Withdraw
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <AddToWaitlistDialog open={showAdd} onOpenChange={setShowAdd} />

      {offerEntry && (
        <OfferSlotDialog
          open={!!offerEntry}
          onOpenChange={(open) => { if (!open) setOfferEntry(null); }}
          entry={offerEntry}
        />
      )}

      {detailEntry && (
        <WaitlistEntryDetail
          open={!!detailEntry}
          onOpenChange={(open) => { if (!open) setDetailEntry(null); }}
          entry={detailEntry}
          onOfferSlot={() => { setOfferEntry(detailEntry); setDetailEntry(null); }}
          onWithdraw={() => { handleWithdraw(detailEntry.id); setDetailEntry(null); }}
        />
      )}
    </AppLayout>
  );
}
