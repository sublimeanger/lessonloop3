import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseISO, isBefore, startOfToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Send, Eye, CreditCard, XCircle, Bell, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Receipt } from 'lucide-react';
import { InlineEmptyState } from '@/components/shared/EmptyState';
import { useOrg } from '@/contexts/OrgContext';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrencyMinor, formatDateUK } from '@/lib/utils';
import { cn } from '@/lib/utils';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];
type SortColumn = 'invoice_number' | 'payer' | 'due_date' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

const STATUS_ORDER: Record<string, number> = { overdue: 0, sent: 1, draft: 2, paid: 3, void: 4 };

function getEffectiveStatus(status: InvoiceStatus, dueDate: string): string {
  if (status === 'sent' && isBefore(parseISO(dueDate), startOfToday())) return 'overdue';
  return status;
}

function sortInvoices(
  invoices: InvoiceWithDetails[],
  column: SortColumn,
  direction: SortDirection,
): InvoiceWithDetails[] {
  return [...invoices].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case 'invoice_number':
        cmp = a.invoice_number.localeCompare(b.invoice_number, undefined, { numeric: true });
        break;
      case 'payer':
        cmp = getPayerName(a).localeCompare(getPayerName(b));
        break;
      case 'due_date':
        cmp = a.due_date.localeCompare(b.due_date);
        break;
      case 'status': {
        const sa = STATUS_ORDER[getEffectiveStatus(a.status, a.due_date)] ?? 5;
        const sb = STATUS_ORDER[getEffectiveStatus(b.status, b.due_date)] ?? 5;
        cmp = sa - sb;
        break;
      }
      case 'amount':
        cmp = a.total_minor - b.total_minor;
        break;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
}

function SortIcon({ column, active, direction }: { column: SortColumn; active: SortColumn | null; direction: SortDirection }) {
  if (active !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return direction === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

export const INVOICES_PAGE_SIZE = 25;

interface InvoiceListProps {
  invoices: InvoiceWithDetails[];
  totalCount?: number;
  onSend: (invoice: InvoiceWithDetails) => void;
  onMarkPaid: (invoice: InvoiceWithDetails) => void;
  onVoid: (invoice: InvoiceWithDetails) => void;
  onSendReminder: (invoice: InvoiceWithDetails) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

function StatusBadge({ status, dueDate, isCreditNote }: { status: InvoiceStatus; dueDate: string; isCreditNote?: boolean }) {
  if (isCreditNote) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        Credit Note
      </span>
    );
  }

  const isOverdue = status === 'sent' && isBefore(parseISO(dueDate), startOfToday());
  const effectiveStatus = isOverdue ? 'overdue' : status;

  const config: Record<string, { label: string; className: string; dot?: string }> = {
    draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-transparent' },
    sent: { label: 'Sent', className: 'bg-primary/10 text-primary border-primary/20' },
    paid: { label: 'Paid', className: 'bg-success/10 text-success border-success/20' },
    overdue: {
      label: 'Overdue',
      className: 'bg-destructive/10 text-destructive border-destructive/20',
      dot: 'bg-destructive animate-pulse',
    },
    void: { label: 'Void', className: 'bg-muted text-muted-foreground border-transparent' },
  };

  const c = config[effectiveStatus] || config.draft;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', c.className)}>
      {c.dot && <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />}
      {c.label}
    </span>
  );
}

function getPayerName(invoice: InvoiceWithDetails): string {
  if (invoice.payer_guardian) return invoice.payer_guardian.full_name;
  if (invoice.payer_student) return `${invoice.payer_student.first_name} ${invoice.payer_student.last_name}`;
  return 'Unknown';
}

function InvoiceActions({
  invoice,
  onSend,
  onMarkPaid,
  onVoid,
  onSendReminder,
  alwaysVisible = false,
}: {
  invoice: InvoiceWithDetails;
  onSend: (inv: InvoiceWithDetails) => void;
  onMarkPaid: (inv: InvoiceWithDetails) => void;
  onVoid: (inv: InvoiceWithDetails) => void;
  onSendReminder: (inv: InvoiceWithDetails) => void;
  alwaysVisible?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" aria-label="Invoice actions" className={cn('h-11 w-11 transition-opacity sm:h-7 sm:w-7', !alwaysVisible && 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        {invoice.status === 'draft' && (
          <DropdownMenuItem onClick={() => onSend(invoice)}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </DropdownMenuItem>
        )}
        {(invoice.status === 'sent' || invoice.status === 'overdue') && (
          <>
            <DropdownMenuItem onClick={() => onMarkPaid(invoice)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSendReminder(invoice)}>
              <Bell className="mr-2 h-4 w-4" />
              Send Reminder
            </DropdownMenuItem>
          </>
        )}
        {invoice.status !== 'void' && invoice.status !== 'paid' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onVoid(invoice)} className="text-destructive">
              <XCircle className="mr-2 h-4 w-4" />
              Void
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MobileInvoiceCard = React.memo(function MobileInvoiceCard({
  invoice,
  currency,
  selected,
  onSelect,
  onNavigate,
  onSend,
  onMarkPaid,
  onVoid,
  onSendReminder,
}: {
  invoice: InvoiceWithDetails;
  currency: string;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onNavigate: () => void;
  onSend: (inv: InvoiceWithDetails) => void;
  onMarkPaid: (inv: InvoiceWithDetails) => void;
  onVoid: (inv: InvoiceWithDetails) => void;
  onSendReminder: (inv: InvoiceWithDetails) => void;
}) {
  return (
    <div
      onClick={onNavigate}
      className={cn(
        'rounded-xl border bg-card p-3 cursor-pointer transition-colors active:bg-muted/40',
        selected && 'ring-1 ring-primary bg-primary/5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              aria-label={`Select invoice ${invoice.invoice_number}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{getPayerName(invoice)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.invoice_number}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={cn('text-base font-bold tabular-nums', invoice.is_credit_note ? 'text-success' : 'text-foreground')}>
            {invoice.is_credit_note && invoice.total_minor > 0 ? '-' : ''}
            {formatCurrencyMinor(Math.abs(invoice.total_minor), currency)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pl-7">
        <div className="flex items-center gap-2">
          <StatusBadge status={invoice.status} dueDate={invoice.due_date} isCreditNote={invoice.is_credit_note} />
          <span className="text-xs text-muted-foreground">
            Due {formatDateUK(parseISO(invoice.due_date), 'dd MMM yyyy')}
          </span>
        </div>
        <InvoiceActions
          invoice={invoice}
          onSend={onSend}
          onMarkPaid={onMarkPaid}
          onVoid={onVoid}
          onSendReminder={onSendReminder}
          alwaysVisible
        />
      </div>
    </div>
  );
});

export function InvoiceList({
  invoices,
  totalCount,
  onSend,
  onMarkPaid,
  onVoid,
  onSendReminder,
  selectedIds,
  onSelectionChange,
  currentPage,
  onPageChange,
}: InvoiceListProps) {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const currency = currentOrg?.currency_code || 'GBP';

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // Pagination — when totalCount is provided, pagination is server-side (data is already one page)
  const serverPaginated = totalCount !== undefined;
  const effectiveTotal = serverPaginated ? totalCount : invoices.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / INVOICES_PAGE_SIZE));
  const startIndex = (currentPage - 1) * INVOICES_PAGE_SIZE;
  const endIndex = Math.min(startIndex + INVOICES_PAGE_SIZE, effectiveTotal);

  const sortedInvoices = useMemo(() => {
    if (!sortColumn) return invoices;
    return sortInvoices(invoices, sortColumn, sortDirection);
  }, [invoices, sortColumn, sortDirection]);

  const pageInvoices = serverPaginated ? sortedInvoices : sortedInvoices.slice(startIndex, endIndex);

  const allSelected = pageInvoices.length > 0 && pageInvoices.every((inv) => selectedIds.has(inv.id));
  const someSelected = pageInvoices.some((inv) => selectedIds.has(inv.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      pageInvoices.forEach((inv) => next.add(inv.id));
    } else {
      pageInvoices.forEach((inv) => next.delete(inv.id));
    }
    onSelectionChange(next);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  if (invoices.length === 0) {
    return (
      <InlineEmptyState
        icon={Receipt}
        message="No invoices match your current filters."
      />
    );
  }

  const paginationFooter = effectiveTotal > INVOICES_PAGE_SIZE ? (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-xs text-muted-foreground">
        {startIndex + 1}–{endIndex} of {effectiveTotal}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground px-2">
          {currentPage}/{totalPages}
        </span>
        <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div>
      {/* Mobile card layout */}
      <div className="space-y-2 px-1 md:hidden">
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={someSelected ? 'indeterminate' : allSelected}
            onCheckedChange={(checked) => handleSelectAll(checked === true)}
            aria-label="Select all"
          />
          <span>Select all</span>
        </div>
        {pageInvoices.map((invoice) => (
          <MobileInvoiceCard
            key={invoice.id}
            invoice={invoice}
            currency={currency}
            selected={selectedIds.has(invoice.id)}
            onSelect={(checked) => handleSelectOne(invoice.id, !!checked)}
            onNavigate={() => navigate(`/invoices/${invoice.id}`)}
            onSend={onSend}
            onMarkPaid={onMarkPaid}
            onVoid={onVoid}
            onSendReminder={onSendReminder}
          />
        ))}
      </div>

      {/* Desktop list layout */}
      <div className="hidden overflow-x-auto md:block">
        {/* Select all row */}
        <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground border-b">
          <Checkbox
            checked={someSelected ? 'indeterminate' : allSelected}
            onCheckedChange={(checked) => handleSelectAll(checked === true)}
            aria-label="Select all"
          />
          <button onClick={() => handleSort('payer')} className={cn('flex-1 flex items-center text-left hover:text-foreground transition-colors', sortColumn === 'payer' && 'text-foreground font-semibold')}>
            Invoice <SortIcon column="payer" active={sortColumn} direction={sortDirection} />
          </button>
          <button onClick={() => handleSort('due_date')} className={cn('w-28 flex items-center hover:text-foreground transition-colors', sortColumn === 'due_date' && 'text-foreground font-semibold')}>
            Due <SortIcon column="due_date" active={sortColumn} direction={sortDirection} />
          </button>
          <button onClick={() => handleSort('status')} className={cn('w-20 flex items-center hover:text-foreground transition-colors', sortColumn === 'status' && 'text-foreground font-semibold')}>
            Status <SortIcon column="status" active={sortColumn} direction={sortDirection} />
          </button>
          <button onClick={() => handleSort('amount')} className={cn('w-24 flex items-center justify-end hover:text-foreground transition-colors', sortColumn === 'amount' && 'text-foreground font-semibold')}>
            Amount <SortIcon column="amount" active={sortColumn} direction={sortDirection} />
          </button>
          <span className="w-7" />
        </div>

        {/* Invoice rows */}
        <div className="divide-y divide-border" role="list" aria-label="Invoices list">
          {pageInvoices.map((invoice) => (
            <div
              key={invoice.id}
              onClick={() => navigate(`/invoices/${invoice.id}`)}
              className={cn(
                'flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors hover:bg-muted/30 group',
                selectedIds.has(invoice.id) && 'bg-primary/5',
              )}
              role="listitem"
            >
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(invoice.id)}
                  onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                  aria-label={`Select invoice ${invoice.invoice_number}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-foreground truncate block">
                  {getPayerName(invoice)}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {invoice.invoice_number}
                </span>
              </div>
              <div className="w-28 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {formatDateUK(parseISO(invoice.due_date), 'dd MMM yyyy')}
                </span>
              </div>
              <div className="w-20 shrink-0">
                <StatusBadge status={invoice.status} dueDate={invoice.due_date} isCreditNote={invoice.is_credit_note} />
              </div>
              <div className="w-24 text-right shrink-0">
                <span className={cn('text-sm font-semibold tabular-nums', invoice.is_credit_note ? 'text-success' : 'text-foreground')}>
                  {invoice.is_credit_note && invoice.total_minor > 0 ? '-' : ''}
                  {formatCurrencyMinor(Math.abs(invoice.total_minor), currency)}
                </span>
              </div>
              <InvoiceActions
                invoice={invoice}
                onSend={onSend}
                onMarkPaid={onMarkPaid}
                onVoid={onVoid}
                onSendReminder={onSendReminder}
              />
            </div>
          ))}
        </div>
      </div>

      {paginationFooter}
    </div>
  );
}
