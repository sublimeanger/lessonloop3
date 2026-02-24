import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SortableTableHead } from '@/components/reports/SortableTableHead';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useActivePaymentPlans, type Installment } from '@/hooks/useInvoiceInstallments';
import { formatCurrencyMinor } from '@/lib/utils';
import { differenceInDays, parseISO, formatDistanceToNowStrict, startOfToday } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock, Eye, Send, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

type PlanHealth = 'on_track' | 'attention' | 'overdue';

interface PlanRow {
  id: string;
  invoiceNumber: string;
  familyName: string;
  paidMinor: number;
  totalMinor: number;
  currencyCode: string;
  paidCount: number;
  totalCount: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  nextInstallmentId: string | null;
  health: PlanHealth;
  overdueDays: number;
  installments: Installment[];
}

function getPlanHealth(installments: Installment[]): PlanHealth {
  const today = startOfToday();
  const hasOverdue = installments.some((i: Installment) =>
    i.status === 'overdue' || (i.status === 'pending' && differenceInDays(today, parseISO(i.due_date)) > 0)
  );
  if (hasOverdue) return 'overdue';

  const nextPending = installments.find((i: Installment) => i.status === 'pending');
  if (nextPending) {
    const daysUntilDue = differenceInDays(parseISO(nextPending.due_date), today);
    if (daysUntilDue <= 3) return 'attention';
  }

  return 'on_track';
}

function getMaxOverdueDays(installments: Installment[]): number {
  const today = startOfToday();
  return installments
    .filter((i: Installment) => i.status === 'overdue' || (i.status === 'pending' && differenceInDays(today, parseISO(i.due_date)) > 0))
    .reduce((max: number, i: Installment) => {
      const days = differenceInDays(today, parseISO(i.due_date));
      return Math.max(max, days);
    }, 0);
}

const healthOrder: Record<PlanHealth, number> = { overdue: 0, attention: 1, on_track: 2 };

const healthConfig: Record<PlanHealth, { label: string; color: string; icon: typeof AlertTriangle }> = {
  on_track: { label: 'On Track', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 },
  attention: { label: 'Attention', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  overdue: { label: 'Overdue', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
};

type SortField = 'family' | 'nextDue' | 'status' | 'progress';

export function PaymentPlansDashboard() {
  const { data: plans, isLoading } = useActivePaymentPlans();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | PlanHealth>('all');

  const rows: PlanRow[] = useMemo(() => {
    if (!plans) return [];
    return plans.map((plan) => {
      const installments: Installment[] = (plan.invoice_installments || []).map((i) => ({
        ...i,
        invoice_id: plan.id,
        payment_id: (i as Record<string, unknown>).payment_id as string | null ?? null,
        status: i.status as Installment['status'],
      }));
      const paidInstallments = installments.filter((i: Installment) => i.status === 'paid');
      const nextPending = installments.find((i: Installment) => i.status === 'pending' || i.status === 'overdue');
      const health = getPlanHealth(installments);
      const overdueDays = getMaxOverdueDays(installments);

      const guardian = plan.payer_guardian;
      const student = plan.payer_student;
      const familyName = guardian?.full_name
        || (student ? `${student.first_name} ${student.last_name}` : 'Unknown');

      return {
        id: plan.id,
        invoiceNumber: plan.invoice_number,
        familyName,
        paidMinor: plan.paid_minor ?? 0,
        totalMinor: plan.total_minor,
        currencyCode: plan.currency_code,
        paidCount: paidInstallments.length,
        totalCount: plan.installment_count ?? installments.length,
        nextDueDate: nextPending?.due_date ?? null,
        nextDueAmount: nextPending?.amount_minor ?? 0,
        nextInstallmentId: nextPending?.id ?? null,
        health,
        overdueDays,
        installments,
      };
    });
  }, [plans]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => r.health === statusFilter);
  }, [rows, statusFilter]);

  const comparators: Record<SortField, (a: PlanRow, b: PlanRow) => number> = useMemo(() => ({
    family: (a, b) => a.familyName.localeCompare(b.familyName),
    nextDue: (a, b) => (a.nextDueDate ?? '').localeCompare(b.nextDueDate ?? ''),
    status: (a, b) => healthOrder[a.health] - healthOrder[b.health],
    progress: (a, b) => (a.paidMinor / (a.totalMinor || 1)) - (b.paidMinor / (b.totalMinor || 1)),
  }), []);

  const { sorted, sort, toggle } = useSortableTable<PlanRow, SortField>(
    filtered, 'status', 'asc', comparators
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const onTrack = rows.filter((r) => r.health === 'on_track').length;
    const attention = rows.filter((r) => r.health === 'attention').length;
    const overdue = rows.filter((r) => r.health === 'overdue').length;
    return { total, onTrack, attention, overdue };
  }, [rows]);

  if (isLoading) return <LoadingState message="Loading payment plans..." />;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No active payment plans"
        description="Payment plans will appear here once you set them up on an invoice."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="Active Plans" value={stats.total} onClick={() => setStatusFilter('all')} active={statusFilter === 'all'} />
        <StatCard label="On Track" value={stats.onTrack} variant="success" onClick={() => setStatusFilter('on_track')} active={statusFilter === 'on_track'} />
        <StatCard label="Attention" value={stats.attention} variant="warning" onClick={() => setStatusFilter('attention')} active={statusFilter === 'attention'} />
        <StatCard label="Overdue" value={stats.overdue} variant="danger" onClick={() => setStatusFilter('overdue')} active={statusFilter === 'overdue'} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {sorted.length} plan{sorted.length !== 1 ? 's' : ''}
        </p>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | PlanHealth)}>
          <SelectTrigger className="h-11 w-full text-xs sm:h-8 sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="on_track">On Track</SelectItem>
            <SelectItem value="attention">Attention</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {sorted.map((row) => {
          const pct = row.totalMinor > 0 ? Math.round((row.paidMinor / row.totalMinor) * 100) : 0;
          const cfg = healthConfig[row.health];
          const Icon = cfg.icon;

          return (
            <Card key={row.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.familyName}</p>
                    <p className="text-xs text-muted-foreground">{row.invoiceNumber}</p>
                  </div>
                  <Badge variant="outline" className={`gap-1 shrink-0 ${cfg.color}`}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <Progress value={pct} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {row.paidCount}/{row.totalCount} · {formatCurrencyMinor(row.paidMinor, row.currencyCode)}/{formatCurrencyMinor(row.totalMinor, row.currencyCode)}
                  </p>
                </div>

                {row.nextDueDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next due</span>
                    <span className="font-medium">
                      {formatCurrencyMinor(row.nextDueAmount, row.currencyCode)}{' '}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(parseISO(row.nextDueDate), { addSuffix: true })}
                      </span>
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs flex-1"
                    onClick={() => navigate(`/invoices/${row.id}`)}
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </Button>
                  {row.health === 'overdue' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 flex-1"
                      onClick={() => navigate(`/messaging?prefill=installment-reminder&invoiceId=${row.id}`)}
                    >
                      <Send className="h-3 w-3" />
                      Chase
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead label="Family" field="family" currentField={sort.field} currentDir={sort.dir} onToggle={(f) => toggle(f as SortField)} />
              <TableHead>Invoice</TableHead>
              <SortableTableHead label="Progress" field="progress" currentField={sort.field} currentDir={sort.dir} onToggle={(f) => toggle(f as SortField)} />
              <SortableTableHead label="Next Due" field="nextDue" currentField={sort.field} currentDir={sort.dir} onToggle={(f) => toggle(f as SortField)} />
              <SortableTableHead label="Status" field="status" currentField={sort.field} currentDir={sort.dir} onToggle={(f) => toggle(f as SortField)} />
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const pct = row.totalMinor > 0 ? Math.round((row.paidMinor / row.totalMinor) * 100) : 0;
              const cfg = healthConfig[row.health];
              const Icon = cfg.icon;

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.familyName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.invoiceNumber}</TableCell>
                  <TableCell>
                    <div className="space-y-1 min-w-[140px]">
                      <Progress value={pct} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {row.paidCount}/{row.totalCount} · {formatCurrencyMinor(row.paidMinor, row.currencyCode)}/{formatCurrencyMinor(row.totalMinor, row.currencyCode)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.nextDueDate ? (
                      <div className="text-sm">
                        <p>{formatCurrencyMinor(row.nextDueAmount, row.currencyCode)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNowStrict(parseISO(row.nextDueDate), { addSuffix: true })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Complete</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => navigate(`/invoices/${row.id}`)}
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                      {row.health === 'overdue' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => navigate(`/messaging?prefill=installment-reminder&invoiceId=${row.id}`)}
                        >
                          <Send className="h-3 w-3" />
                          Chase
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = 'default',
  onClick,
  active,
}: {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  onClick: () => void;
  active: boolean;
}) {
  const variantStyles: Record<string, string> = {
    default: '',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  };

  return (
    <Card
      className={`cursor-pointer transition-all ${active ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <p className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
