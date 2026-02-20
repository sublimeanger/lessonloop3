import { useNavigate } from 'react-router-dom';
import { parseISO, isBefore } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useIsMobile } from '@/hooks/use-mobile';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrencyMinor, formatDateUK } from '@/lib/utils';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

export const INVOICES_PAGE_SIZE = 25;

interface InvoiceListProps {
  invoices: InvoiceWithDetails[];
  onSend: (invoice: InvoiceWithDetails) => void;
  onMarkPaid: (invoice: InvoiceWithDetails) => void;
  onVoid: (invoice: InvoiceWithDetails) => void;
  onSendReminder: (invoice: InvoiceWithDetails) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

function getStatusBadge(status: InvoiceStatus, dueDate: string) {
  const today = new Date();
  const due = parseISO(dueDate);
  const isOverdue = status === 'sent' && isBefore(due, today);

  if (isOverdue) {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  const variants: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    sent: 'default',
    paid: 'default',
    overdue: 'destructive',
    void: 'outline',
  };

  const labels: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    void: 'Void',
  };

  return (
    <Badge
      variant={variants[status]}
      className={status === 'paid' ? 'bg-success hover:bg-success/90' : undefined}
    >
      {labels[status]}
    </Badge>
  );
}

function getPayerName(invoice: InvoiceWithDetails): string {
  if (invoice.payer_guardian) {
    return invoice.payer_guardian.full_name;
  }
  if (invoice.payer_student) {
    return `${invoice.payer_student.first_name} ${invoice.payer_student.last_name}`;
  }
  return 'Unknown';
}

// ─── Actions dropdown (shared between table and card) ───
function InvoiceActions({ invoice, onSend, onMarkPaid, onVoid, onSendReminder }: {
  invoice: InvoiceWithDetails;
  onSend: (inv: InvoiceWithDetails) => void;
  onMarkPaid: (inv: InvoiceWithDetails) => void;
  onVoid: (inv: InvoiceWithDetails) => void;
  onSendReminder: (inv: InvoiceWithDetails) => void;
}) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-8 w-8">
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
            <DropdownMenuItem
              onClick={() => onVoid(invoice)}
              className="text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Void
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InvoiceList({
  invoices,
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
  const isMobile = useIsMobile();
  const currency = currentOrg?.currency_code || 'GBP';

  // Pagination
  const totalCount = invoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / INVOICES_PAGE_SIZE));
  const startIndex = (currentPage - 1) * INVOICES_PAGE_SIZE;
  const endIndex = Math.min(startIndex + INVOICES_PAGE_SIZE, totalCount);
  const pageInvoices = invoices.slice(startIndex, endIndex);

  const allSelected = pageInvoices.length > 0 && pageInvoices.every((inv) => selectedIds.has(inv.id));
  const someSelected = pageInvoices.some((inv) => selectedIds.has(inv.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedIds);
      pageInvoices.forEach((inv) => next.add(inv.id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      pageInvoices.forEach((inv) => next.delete(inv.id));
      onSelectionChange(next);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    onSelectionChange(next);
  };

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No invoices found</p>
      </div>
    );
  }

  const paginationFooter = totalCount > INVOICES_PAGE_SIZE ? (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Showing {startIndex + 1}–{endIndex} of {totalCount} invoices
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ) : null;

  // ─── Mobile card layout ───
  if (isMobile) {
    return (
      <div>
        <div className="space-y-2" role="list" aria-label="Invoices list">
          {pageInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent cursor-pointer"
              onClick={() => navigate(`/invoices/${invoice.id}`)}
              role="listitem"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={selectedIds.has(invoice.id)}
                    onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select invoice ${invoice.invoice_number}`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{invoice.invoice_number}</span>
                      {getStatusBadge(invoice.status, invoice.due_date)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {getPayerName(invoice)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-medium text-sm">
                    {formatCurrencyMinor(invoice.total_minor, currency)}
                  </span>
                  <InvoiceActions
                    invoice={invoice}
                    onSend={onSend}
                    onMarkPaid={onMarkPaid}
                    onVoid={onVoid}
                    onSendReminder={onSendReminder}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {paginationFooter}
      </div>
    );
  }

  // ─── Desktop table layout ───
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
                className={someSelected ? 'data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary/50' : ''}
                {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
              />
            </TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>Payer</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageInvoices.map((invoice) => (
            <TableRow
              key={invoice.id}
              className="cursor-pointer"
              data-selected={selectedIds.has(invoice.id) ? '' : undefined}
              onClick={() => navigate(`/invoices/${invoice.id}`)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(invoice.id)}
                  onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                  aria-label={`Select invoice ${invoice.invoice_number}`}
                />
              </TableCell>
              <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
              <TableCell>{getPayerName(invoice)}</TableCell>
              <TableCell>{formatDateUK(parseISO(invoice.issue_date), 'dd MMM yyyy')}</TableCell>
              <TableCell>{formatDateUK(parseISO(invoice.due_date), 'dd MMM yyyy')}</TableCell>
              <TableCell>{getStatusBadge(invoice.status, invoice.due_date)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrencyMinor(invoice.total_minor, currency)}
              </TableCell>
              <TableCell>
                <InvoiceActions
                  invoice={invoice}
                  onSend={onSend}
                  onMarkPaid={onMarkPaid}
                  onVoid={onVoid}
                  onSendReminder={onSendReminder}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {paginationFooter}
    </div>
  );
}