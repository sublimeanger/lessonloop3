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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Send, Eye, CreditCard, XCircle, Bell } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrencyMinor, formatDateUK } from '@/lib/utils';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

interface InvoiceListProps {
  invoices: InvoiceWithDetails[];
  onSend: (invoice: InvoiceWithDetails) => void;
  onMarkPaid: (invoice: InvoiceWithDetails) => void;
  onVoid: (invoice: InvoiceWithDetails) => void;
  onSendReminder: (invoice: InvoiceWithDetails) => void;
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
      className={status === 'paid' ? 'bg-green-600 hover:bg-green-700' : undefined}
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

export function InvoiceList({
  invoices,
  onSend,
  onMarkPaid,
  onVoid,
  onSendReminder,
}: InvoiceListProps) {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const currency = currentOrg?.currency_code || 'GBP';

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No invoices found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
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
          {invoices.map((invoice) => (
            <TableRow
              key={invoice.id}
              className="cursor-pointer"
              onClick={() => navigate(`/invoices/${invoice.id}`)}
            >
              <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
              <TableCell>{getPayerName(invoice)}</TableCell>
              <TableCell>{formatDateUK(parseISO(invoice.issue_date), 'dd MMM yyyy')}</TableCell>
              <TableCell>{formatDateUK(parseISO(invoice.due_date), 'dd MMM yyyy')}</TableCell>
              <TableCell>{getStatusBadge(invoice.status, invoice.due_date)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrencyMinor(invoice.total_minor, currency)}
              </TableCell>
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
