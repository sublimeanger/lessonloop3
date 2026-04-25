import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DetailSkeleton } from '@/components/shared/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useRecurringTemplateRun,
  useCancelTemplateRun,
  useRetryFailedRecipients,
} from '@/hooks/useRecurringTemplateRuns';
import { useRecurringInvoiceTemplates } from '@/hooks/useRecurringInvoiceTemplates';
import { Loader2, RotateCw, Ban, AlertTriangle, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const OUTCOME_VARIANT: Record<string, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'success',
  partial: 'destructive',
  failed: 'destructive',
  cancelled: 'secondary',
  running: 'outline',
};

const ERROR_CODE_LABELS: Record<string, string> = {
  no_payer_resolved: 'No primary-payer guardian and no student email',
  no_lessons_in_period: 'No lessons in billing period',
  no_rate_card: 'No rate card resolvable',
  already_invoiced: 'Already invoiced for this period',
  no_next_term: 'No future term scheduled',
  duplicate_invoice: 'Duplicate invoice attempt',
  authorization_failed: 'Authorisation failed',
  db_error: 'Database error',
};

const INVOICE_STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'success',
  sent: 'outline',
  draft: 'secondary',
  overdue: 'destructive',
  void: 'secondary',
  partial: 'outline',
};

function fmtDate(iso: string | null | undefined, fmt = 'd MMM yyyy'): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  return fmtDate(iso, 'd MMM yyyy HH:mm');
}

function fmtAmount(minor: number | null | undefined, currency = 'GBP'): string {
  const amount = (minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

function useRunInvoices(runId: string | null) {
  return useQuery({
    queryKey: ['recurring-run-invoices', runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_minor, status, currency_code, payer_guardian_id, payer_student_id')
        .eq('generated_from_run_id', runId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!runId,
    staleTime: 30 * 1000,
  });
}

function useStudentNamesForErrors(studentIds: string[]) {
  const unique = Array.from(new Set(studentIds));
  return useQuery({
    queryKey: ['students-names-for-errors', unique.sort().join(',')],
    queryFn: async () => {
      if (unique.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .in('id', unique);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const s of data || []) {
        map[s.id] = `${s.first_name} ${s.last_name}`;
      }
      return map;
    },
    enabled: unique.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export default function RecurringRunDetail() {
  usePageMeta('Run Detail | LessonLoop', 'View recurring run detail');
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);

  const { data: detail, isLoading } = useRecurringTemplateRun(runId ?? null);
  const { data: templates = [] } = useRecurringInvoiceTemplates();
  const { data: invoices = [] } = useRunInvoices(runId ?? null);

  const errorStudentIds = (detail?.errors ?? [])
    .map((e) => e.student_id)
    .filter((x): x is string => !!x);
  const { data: studentNames = {} } = useStudentNamesForErrors(errorStudentIds);

  const cancelMutation = useCancelTemplateRun();
  const retryMutation = useRetryFailedRecipients();

  if (isLoading || !detail) {
    return (
      <AppLayout>
        <DetailSkeleton />
      </AppLayout>
    );
  }

  const { run, errors, parent } = detail;
  const template = templates.find((t) => t.id === run.template_id) ?? null;
  const outcome = run.outcome ?? 'running';

  const hasErrorRows = errors.length > 0;
  const hasRetryableErrors = errors.some((e) => !!e.student_id);
  const canCancel = outcome !== 'cancelled' && outcome !== 'running';
  const canRetry =
    (outcome === 'partial' || outcome === 'failed') && hasRetryableErrors;

  const titleDate = fmtDate(run.run_date);
  const title = template ? `${template.name} — ${titleDate}` : `Run ${titleDate}`;

  const handleCancel = async () => {
    if (!runId) return;
    try {
      await cancelMutation.mutateAsync(runId);
      setCancelOpen(false);
      if (template) {
        navigate(`/settings/recurring-billing/${template.id}`);
      }
    } catch {
      /* toast handled */
    }
  };

  const handleRetry = async () => {
    if (!runId) return;
    try {
      const result = await retryMutation.mutateAsync(runId);
      setRetryOpen(false);
      if (result.run_id) {
        navigate(`/settings/recurring-billing/runs/${result.run_id}`);
      }
    } catch {
      /* toast handled */
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title={title}
        description={`Period ${fmtDate(run.period_start)} – ${fmtDate(run.period_end)}`}
        actions={
          <div className="flex items-center gap-2">
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCancelOpen(true)}
                disabled={cancelMutation.isPending}
              >
                <Ban className="h-3.5 w-3.5" />
                Cancel run
              </Button>
            )}
            {canRetry && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => setRetryOpen(true)}
                disabled={retryMutation.isPending}
              >
                {retryMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                Retry failed
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge variant={OUTCOME_VARIANT[outcome] ?? 'outline'}>
          {outcome}
        </Badge>
        {run.triggered_by && (
          <Badge variant="outline">triggered: {run.triggered_by}</Badge>
        )}
      </div>

      {/* Summary */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Period</dt>
              <dd className="font-medium">
                {fmtDate(run.period_start)} – {fmtDate(run.period_end)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Outcome</dt>
              <dd className="font-medium capitalize">{outcome}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Invoices generated</dt>
              <dd className="font-medium">{run.invoices_generated}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recipients total</dt>
              <dd className="font-medium">{run.recipients_total}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recipients skipped</dt>
              <dd className="font-medium">{run.recipients_skipped}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Started</dt>
              <dd className="font-medium">{fmtDateTime(run.started_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="font-medium">{fmtDateTime(run.completed_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Triggered by</dt>
              <dd className="font-medium">{run.triggered_by ?? '—'}</dd>
            </div>
            {parent && (
              <div>
                <dt className="text-muted-foreground">Parent run</dt>
                <dd>
                  <button
                    onClick={() =>
                      navigate(`/settings/recurring-billing/runs/${parent.id}`)
                    }
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {fmtDate(parent.run_date)}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Errors */}
      {hasErrorRows && (
        <Card className="mb-4 border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Student</th>
                    <th className="py-2 font-medium">Error</th>
                    <th className="py-2 font-medium">Detail</th>
                    <th className="py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err) => {
                    const studentLabel = err.student_id
                      ? studentNames[err.student_id] ?? 'Unknown student'
                      : '— (template-level)';
                    const label =
                      ERROR_CODE_LABELS[err.error_code] ?? err.error_code;
                    return (
                      <tr key={err.id} className="border-b last:border-b-0">
                        <td className="py-2 align-top">
                          <span className={!err.student_id ? 'italic text-muted-foreground' : ''}>
                            {studentLabel}
                          </span>
                        </td>
                        <td className="py-2 align-top">
                          <Badge variant="outline">{label}</Badge>
                        </td>
                        <td className="py-2 align-top text-muted-foreground max-w-md">
                          {err.error_message}
                        </td>
                        <td className="py-2 align-top text-muted-foreground whitespace-nowrap">
                          {fmtDateTime(err.occurred_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated invoices */}
      {invoices.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">
              Generated Invoices ({invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Invoice</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">{inv.invoice_number}</td>
                      <td className="py-2">
                        {fmtAmount(inv.total_minor, inv.currency_code)}
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={
                            INVOICE_STATUS_VARIANT[inv.status] ?? 'outline'
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void every non-void invoice generated by this run
              ({run.invoices_generated} invoice(s)) and mark the run cancelled.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep run</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Cancel run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={retryOpen} onOpenChange={setRetryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry failed recipients?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a new run that reattempts only the recipients
              who errored in this run. The parent run's period is reused.
              Fix the underlying issue (attendance, rate cards, etc.) first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRetry}
              disabled={retryMutation.isPending}
            >
              {retryMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
