import { useNavigate } from 'react-router-dom';
import { parseISO, isBefore } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Send, Eye, CreditCard, XCircle, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrencyMinor, formatDateUK } from '@/lib/utils';
import { cn } from '@/lib/utils';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

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

function StatusBadge({ status, dueDate }: { status: InvoiceStatus; dueDate: string }) {
  const isOverdue = status === 'sent' && isBefore(parseISO(dueDate), new Date());
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
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium', c.className)}>
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
        <Button variant="ghost" size="icon" className={cn('h-7 w-7 transition-opacity', !alwaysVisible && 'opacity-0 group-hover:opacity-100')}>
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

function MobileInvoiceCard({
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
        'rounded-lg border bg-card p-3 cursor-pointer transition-colors active:bg-muted/40',
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
          <p className="text-base font-bold tabular-nums text-foreground">
            {formatCurrencyMinor(invoice.total_minor, currency)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pl-7">
        <div className="flex items-center gap-2">
          <StatusBadge status={invoice.status} dueDate={invoice.due_date} />
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
}

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

  // Pagination — when totalCount is provided, pagination is server-side (data is already one page)
  const serverPaginated = totalCount !== undefined;
  const effectiveTotal = serverPaginated ? totalCount : invoices.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / INVOICES_PAGE_SIZE));
  const startIndex = (currentPage - 1) * INVOICES_PAGE_SIZE;
  const endIndex = Math.min(startIndex + INVOICES_PAGE_SIZE, effectiveTotal);
  const pageInvoices = serverPaginated ? invoices : invoices.slice(startIndex, endIndex);

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
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No invoices found</p>
      </div>
    );
  }

  const paginationFooter = effectiveTotal > INVOICES_PAGE_SIZE ? (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-xs text-muted-foreground">
        {startIndex + 1}–{endIndex} of {effectiveTotal}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground px-2">
          {currentPage}/{totalPages}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div>
      {/* Mobile card layout */}
      <div className="md:hidden space-y-2 px-1">
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
            className={someSelected ? 'data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary/50' : ''}
            {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
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
      <div className="hidden md:block">
        {/* Select all row */}
        <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground border-b">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
            className={someSelected ? 'data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary/50' : ''}
            {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
          />
          <span className="flex-1">Invoice</span>
          <span className="w-28">Due</span>
          <span className="w-20">Status</span>
          <span className="w-24 text-right">Amount</span>
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
                <StatusBadge status={invoice.status} dueDate={invoice.due_date} />
              </div>
              <div className="w-24 text-right shrink-0">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrencyMinor(invoice.total_minor, currency)}
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
