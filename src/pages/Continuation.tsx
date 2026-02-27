import { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Mail,
  RefreshCw,
  Loader2,
  Search,
} from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import {
  useContinuationRuns,
  useContinuationRun,
  useContinuationResponses,
  useSendContinuationReminders,
  useProcessDeadline,
  useBulkProcessContinuation,
} from '@/hooks/useTermContinuation';
import type {
  ContinuationRun,
  ContinuationResponseEntry,
  ContinuationResponseType,
} from '@/hooks/useTermContinuation';
import { ContinuationRunWizard } from '@/components/continuation/ContinuationRunWizard';
import { ContinuationResponseDetail } from '@/components/continuation/ContinuationResponseDetail';
import { formatCurrencyMinor } from '@/lib/utils';
import { differenceInDays, isPast } from 'date-fns';

const RESPONSE_BADGE: Record<
  ContinuationResponseType,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  continuing: { label: 'Continuing', variant: 'default' },
  withdrawing: { label: 'Withdrawing', variant: 'destructive' },
  assumed_continuing: { label: 'Assumed', variant: 'outline' },
  no_response: { label: 'No Response', variant: 'secondary' },
};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Collecting Responses', variant: 'default' },
  reminding: { label: 'Reminding', variant: 'default' },
  deadline_passed: { label: 'Deadline Passed', variant: 'outline' },
  completed: { label: 'Completed', variant: 'secondary' },
};

export default function Continuation() {
  usePageMeta('Continuation | LessonLoop', 'Manage term continuation and re-enrollment');
  const { currentOrg } = useOrg();
  const { data: runs = [], isLoading: runsLoading } = useContinuationRuns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] =
    useState<ContinuationResponseEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [responseFilter, setResponseFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Find the active run (most recent non-completed)
  const activeRun = runs.find((r) => r.status !== 'completed') || null;
  const runToShow = selectedRunId
    ? runs.find((r) => r.id === selectedRunId) || activeRun
    : activeRun;

  const { data: runDetail } = useContinuationRun(runToShow?.id || null);
  const { data: responses = [], isLoading: responsesLoading } =
    useContinuationResponses(
      runToShow?.id || null,
      responseFilter !== 'all' ? (responseFilter as ContinuationResponseType) : undefined
    );

  const sendReminders = useSendContinuationReminders();
  const processDeadline = useProcessDeadline();
  const bulkProcess = useBulkProcessContinuation();

  const currency = currentOrg?.currency_code || 'GBP';
  const run = runDetail || runToShow;
  const summary = run?.summary;

  const pastRuns = runs.filter((r) => r.status === 'completed');

  const deadlineDays = run?.notice_deadline
    ? differenceInDays(new Date(run.notice_deadline + 'T23:59:59'), new Date())
    : null;
  const deadlinePassed = run?.notice_deadline
    ? isPast(new Date(run.notice_deadline + 'T23:59:59'))
    : false;

  const filteredResponses = responses.filter((r) => {
    if (!search) return true;
    const name = `${r.student?.first_name} ${r.student?.last_name}`.toLowerCase();
    const gName = r.guardian?.full_name?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || gName.includes(search.toLowerCase());
  });

  const handleProcessDeadline = async () => {
    if (!run?.id) return;
    await processDeadline.mutateAsync(run.id);
  };

  const handleBulkProcess = async (type: 'confirmed' | 'withdrawals' | 'all') => {
    if (!run?.id || !run.next_term?.end_date || !run.next_term?.start_date) return;
    await bulkProcess.mutateAsync({
      run_id: run.id,
      next_term_end_date: run.next_term.end_date,
      next_term_start_date: run.next_term.start_date,
      process_type: type,
    });
  };

  const totalConfirmed = (summary?.confirmed || 0) + (summary?.assumed_continuing || 0);
  const totalStudents = summary?.total_students || 0;
  const progressPercent = totalStudents > 0 ? Math.round((totalConfirmed / totalStudents) * 100) : 0;

  return (
    <AppLayout>
      <PageHeader
        title="Term Continuation"
        description="Manage student re-enrollment for the next term"
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Run
          </Button>
        }
      />

      {runsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !run ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No continuation runs yet. Create one to start collecting responses.
            </p>
            <Button className="mt-4" onClick={() => setWizardOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Continuation Run
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {run.current_term?.name || 'Current Term'} &rarr;{' '}
                  {run.next_term?.name || 'Next Term'}
                </h2>
                <Badge variant={STATUS_BADGE[run.status]?.variant || 'secondary'}>
                  {STATUS_BADGE[run.status]?.label || run.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Deadline:{' '}
                {new Date(run.notice_deadline + 'T00:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {deadlineDays !== null && !deadlinePassed && (
                  <span className="ml-1 text-amber-600">
                    ({deadlineDays} day{deadlineDays !== 1 ? 's' : ''} remaining)
                  </span>
                )}
                {deadlinePassed && (
                  <span className="ml-1 text-destructive">(passed)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {['sent', 'reminding'].includes(run.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendReminders.mutateAsync(run.id)}
                  disabled={sendReminders.isPending}
                >
                  {sendReminders.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Send Reminders
                </Button>
              )}
              {['sent', 'reminding'].includes(run.status) && deadlinePassed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleProcessDeadline}
                  disabled={processDeadline.isPending}
                >
                  {processDeadline.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="mr-2 h-4 w-4" />
                  )}
                  Process Deadline
                </Button>
              )}
            </div>
          </div>

          {/* Stats Row */}
          {summary && (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Confirmed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalConfirmed}</div>
                    <p className="text-xs text-muted-foreground">
                      {progressPercent}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4 text-amber-500" />
                      Pending
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary.pending}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Withdrawing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary.withdrawing}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      No Response
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary.no_response + summary.assumed_continuing}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                {summary.confirmed > 0 && (
                  <div
                    className="bg-green-500 h-full"
                    style={{
                      width: `${(summary.confirmed / totalStudents) * 100}%`,
                    }}
                  />
                )}
                {summary.assumed_continuing > 0 && (
                  <div
                    className="bg-green-300 h-full"
                    style={{
                      width: `${(summary.assumed_continuing / totalStudents) * 100}%`,
                    }}
                  />
                )}
                {summary.withdrawing > 0 && (
                  <div
                    className="bg-destructive h-full"
                    style={{
                      width: `${(summary.withdrawing / totalStudents) * 100}%`,
                    }}
                  />
                )}
                {summary.no_response > 0 && (
                  <div
                    className="bg-muted-foreground/30 h-full"
                    style={{
                      width: `${(summary.no_response / totalStudents) * 100}%`,
                    }}
                  />
                )}
              </div>
            </>
          )}

          {/* Bulk Actions */}
          {run.status === 'deadline_passed' && (
            <div className="flex flex-wrap gap-2 rounded-lg border p-3 bg-muted/50">
              <span className="text-sm font-medium self-center mr-2">
                Process:
              </span>
              <Button
                size="sm"
                onClick={() => handleBulkProcess('confirmed')}
                disabled={bulkProcess.isPending}
              >
                {bulkProcess.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Extend Confirmed
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkProcess('withdrawals')}
                disabled={bulkProcess.isPending}
              >
                Process Withdrawals
              </Button>
            </div>
          )}

          {/* Response Table */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-medium">Responses</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 w-48"
                  />
                </div>
                <Select value={responseFilter} onValueChange={setResponseFilter}>
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="continuing">Continuing</SelectItem>
                    <SelectItem value="withdrawing">Withdrawing</SelectItem>
                    <SelectItem value="assumed_continuing">Assumed</SelectItem>
                    <SelectItem value="no_response">No Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Student</th>
                      <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">
                        Guardian
                      </th>
                      <th className="px-4 py-2 text-left font-medium hidden lg:table-cell">
                        Fee
                      </th>
                      <th className="px-4 py-2 text-left font-medium">Response</th>
                      <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                        Responded
                      </th>
                      <th className="px-4 py-2 text-left font-medium hidden lg:table-cell">
                        Reminders
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {responsesLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    ) : filteredResponses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No responses found
                        </td>
                      </tr>
                    ) : (
                      filteredResponses.map((resp) => {
                        const badge = RESPONSE_BADGE[resp.response];
                        return (
                          <tr
                            key={resp.id}
                            className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedResponse(resp);
                              setDetailOpen(true);
                            }}
                          >
                            <td className="px-4 py-2.5 font-medium">
                              {resp.student
                                ? `${resp.student.first_name} ${resp.student.last_name}`
                                : 'Unknown'}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                              {resp.guardian?.full_name || '—'}
                            </td>
                            <td className="px-4 py-2.5 hidden lg:table-cell">
                              {resp.next_term_fee_minor != null
                                ? formatCurrencyMinor(resp.next_term_fee_minor, currency)
                                : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                              {resp.response_at
                                ? new Date(resp.response_at).toLocaleDateString('en-GB')
                                : '—'}
                            </td>
                            <td className="px-4 py-2.5 hidden lg:table-cell">
                              {resp.reminder_count}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Past Runs */}
          {pastRuns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Past Runs
              </h3>
              <div className="space-y-2">
                {pastRuns.map((pastRun) => (
                  <div
                    key={pastRun.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedRunId(pastRun.id)}
                  >
                    <div>
                      <span className="text-sm font-medium">
                        {pastRun.current_term?.name} &rarr;{' '}
                        {pastRun.next_term?.name}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pastRun.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {pastRun.summary?.total_students || 0} students
                      </Badge>
                      <Badge variant="secondary">Completed</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ContinuationRunWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <ContinuationResponseDetail
        response={selectedResponse}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        currency={currency}
      />
    </AppLayout>
  );
}
